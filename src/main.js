import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import WebSocket from 'ws'
import { upgradeScripts } from './upgrade.js'
import { LoadPresets } from './presets.js'
import { validateCredentials, buildWebSocketUrl } from './auth-utils.js'
import { COLORS, RESOLUTION_MAP, RESOLUTION_CHOICES } from './constants.js'
import {
	WS_CONNECTION_TIMEOUT,
	LOGIN_TIMEOUT,
	MAX_TOKEN_RECONNECT_ATTEMPTS,
	computeReconnectDelay,
	isNetworkError,
	isTokenInvalidated,
	createAbortableTimeout,
} from './reconnection.js'

function formatTimeHHMMSS(totalSeconds) {
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function formatTimeMMSS(totalSeconds) {
	const totalMinutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${totalMinutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

function createToggleAction(name, commands, sendCommand, log, logTexts) {
	return {
		name,
		options: [
			{
				type: 'dropdown',
				label: '操作',
				id: 'operation',
				default: 'toggle',
				choices: [
					{ id: 'toggle', label: '切换' },
					{ id: 'enable', label: '开启' },
					{ id: 'disable', label: '关闭' },
				],
			},
		],
		callback: async (action) => {
			const op = action.options.operation
			let command
			let logText
			if (op === 'toggle') {
				command = commands.toggle
				logText = logTexts?.toggle || '切换'
			} else if (op === 'enable') {
				command = commands.enable
				logText = logTexts?.enable || '开启'
			} else {
				command = commands.disable
				logText = logTexts?.disable || '关闭'
			}
			await sendCommand(command)
			log('info', `操作：${logText}${name}`)
		},
	}
}

class TinyCountdownInstance extends InstanceBase {
	isInitialized = false
	ws = null
	heartbeatInterval = null
	connectionTimeout = null
	reconnectTimeout = null
	reconnectAttempt = 0
	closingIntentionally = false
	isConnecting = false
	
	// Configuration defaults
	config = {
		host: 'localhost',
		port: 0, // 0 means auto-detect from status
		reconnect: true,
		debug_messages: false,
		reset_variables: true,
		auth_username: 'admin',
	}

	// Secrets store (password is kept here, not in config)
	secrets = {}

	// Connection state
	connectionState = {
		running: false,
		paused: false,
		remainingTime: 0,
		remainingTimeMs: 0,
		totalTime: 0,
		time: '00:00',
		blink: false,
		top: false,
		fullscreen: false,
		windowVisible: true,
		port: 0,
		resolution: -1,
		ndi: false,
		lastSyncTime: 0,
	}

	// Local interpolation timer for smooth countdown display
	interpolationInterval = null

	// Authentication state
	isAuthenticated = false
	isAuthenticating = false
	authToken = null

	init(config, isFirstInit, secrets) {
		this.config = config || this.config
		this.secrets = secrets || {}
		this.isInitialized = true
		
		// Initialize variables, actions and feedbacks
		this.initVariables()
		this.initActions()
		this.initFeedbacks()
		
		// Load presets
		LoadPresets(this)
		
		// Authenticate before establishing WebSocket connection
		this.authenticate()
	}

	async destroy() {
		this.isInitialized = false
		
		// Cleanup timers
		this.stopHeartbeat()
		this.stopConnectionTimeout()
		this.stopReconnect()
		this.stopInterpolation()
		
		// Close WebSocket
		this.closeWebSocketIntentionally()
	}

	async configUpdated(config, secrets) {
		this.config = config
		this.secrets = secrets || {}
		
		this.stopHeartbeat()
		this.stopConnectionTimeout()
		this.stopReconnect()
		
		// Close existing WebSocket connection and ignore its close event
		this.closeWebSocketIntentionally()
		
		// Reset authentication state and re-authenticate
		this.clearAuthState()
		this.reconnectAttempt = 0
		
		setTimeout(() => {
			this.authenticate()
		}, 100)
	}

	closeWebSocketIntentionally() {
		if (!this.ws) {
			return
		}

		const socket = this.ws
		this.ws = null

		// Only set the flag and call close() when the socket is still active.
		// If the socket is already closed/closed, we just clean up the reference.
		const isActive = socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING

		socket.removeAllListeners('open')
		socket.removeAllListeners('message')
		socket.removeAllListeners('close')
		socket.removeAllListeners('error')

		if (isActive) {
			this.closingIntentionally = true
			socket.close(1000)
			// Clear the flag after the current event loop so legitimate close events
			// that may already be queued are ignored.
			setTimeout(() => {
				this.closingIntentionally = false
			}, 0)
		}
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: '信息',
				value: "<strong>TinyCountdown 模块</strong><br/>通过 Companion 控制您的 TinyCountdown 应用。<br/>请确保 TinyCountdown 正在运行且 Web 服务器已启用。",
			},
			{
				type: 'textinput',
				id: 'host',
				label: '主机',
				tooltip: 'TinyCountdown 服务器的 IP 地址或主机名',
				width: 6,
				default: 'localhost',
				regex: '/^[\\w\\.-]+$/',
			},
			{
				type: 'number',
				id: 'port',
				label: '端口',
				tooltip: '端口号 (0 = 从首次状态请求自动检测)',
				width: 3,
				default: 0,
				min: 0,
				max: 65535,
			},
			{
				type: 'checkbox',
				id: 'reconnect',
				label: '自动重连',
				tooltip: '连接丢失时自动重连',
				width: 3,
				default: true,
			},
			{
				type: 'checkbox',
				id: 'debug_messages',
				label: '调试消息',
				tooltip: '记录所有接收和发送的消息',
				width: 6,
				default: false,
			},
			{
				type: 'checkbox',
				id: 'reset_variables',
				label: '连接时重置变量',
				tooltip: '连接时重置所有变量',
				width: 6,
				default: true,
			},
			{
				type: 'textinput',
				id: 'auth_username',
				label: '用户名',
				tooltip: '管理员用户名，固定为 admin',
				width: 6,
				default: 'admin',
				regex: '/^.{1,64}$/',
			},
			{
				type: 'textinput',
				id: 'auth_password',
				label: '密码',
				tooltip: '管理员密码，与后台管理页面密码一致（必填，不能为空或仅包含空格）',
				width: 6,
				default: '',
				required: true,
				regex: '/^.{1,64}$/',
			},
		]
	}

	initVariables() {
		const variableDefinitions = [
			{ variableId: 'running', name: '运行状态' },
			{ variableId: 'paused', name: '暂停状态' },
			{ variableId: 'remainingTime', name: '剩余时间 (秒)' },
			{ variableId: 'remainingTimeMs', name: '剩余时间 (毫秒)' },
			{ variableId: 'remainingTimeFormatted', name: '剩余时间 (时：分：秒)' },
			{ variableId: 'totalTime', name: '总时间 (秒)' },
			{ variableId: 'time', name: '时间 (分：秒)' },
			{ variableId: 'blink', name: '闪烁模式' },
			{ variableId: 'top', name: '窗口置顶' },
			{ variableId: 'fullscreen', name: '全屏模式' },
			{ variableId: 'windowVisible', name: '窗口可见' },
			{ variableId: 'port', name: '服务器端口' },
			{ variableId: 'resolution', name: '分辨率索引' },
			{ variableId: 'resolutionLabel', name: '分辨率' },
			{ variableId: 'ndi', name: 'NDI 输出' },
			{ variableId: 'authenticated', name: '已登录' },
		]
		
		this.setVariableDefinitions(variableDefinitions)
		
		// Set initial values
		if (this.config.reset_variables) {
			this.setVariableValues({
				running: 'false',
				paused: 'false',
				remainingTime: '0',
				remainingTimeMs: '0',
				remainingTimeFormatted: '00:00:00',
				totalTime: '0',
				time: '00:00',
				blink: 'false',
				top: 'false',
				fullscreen: 'false',
				windowVisible: 'true',
				port: '0',
				resolution: '-1',
				resolutionLabel: 'Default',
				ndi: 'false',
				authenticated: 'false',
			})
		}
	}

	initActions() {
		const sendCommand = this.sendCommand.bind(this)

		this.setActionDefinitions({
			start_stop_countdown: {
				name: '开始/停止',
				options: [
					{
						type: 'dropdown',
						label: '操作',
						id: 'operation',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: '开始/停止' },
							{ id: 'start', label: '开始' },
							{ id: 'stop', label: '停止' },
						],
					},
				],
				callback: async (action) => {
					let command, logText
					switch (action.options.operation) {
						case 'toggle':
							if (this.connectionState.running) {
								command = 'stop'
								logText = '停止倒计时'
							} else {
								command = 'start'
								logText = '开始倒计时'
							}
							break
						case 'start':
							command = 'start'
							logText = '开始倒计时'
							break
						case 'stop':
							command = 'stop'
							logText = '停止倒计时'
							break
					}
					await sendCommand(command)
					this.log('info', `操作：${logText}`)
				},
			},
			reset_countdown: {
				name: '重置倒计时',
				options: [],
				callback: async () => {
					const command = 'reset'
					this.log('debug', `发送重置命令："${command}"`)
					await sendCommand(command)
					this.log('info', '操作：重置倒计时')
				},
			},
			set_time: {
				name: '时间',
				options: [
					{
						type: 'number',
						label: '小时',
						id: 'hours',
						default: 0,
						min: 0,
						max: 23,
					},
					{
						type: 'number',
						label: '分钟',
						id: 'minutes',
						default: 0,
						min: 0,
						max: 59,
					},
					{
						type: 'number',
						label: '秒',
						id: 'seconds',
						default: 0,
						min: 0,
					},
				],
				callback: async (action) => {
					const totalSeconds = action.options.hours * 3600 + 
									   action.options.minutes * 60 + 
									   action.options.seconds
					await sendCommand(`time=${totalSeconds}`)
					this.log('info', `操作：设置时间为 ${totalSeconds}秒`)
				},
			},
			adjust_time: {
				name: '时间+/-',
				options: [
					{
						type: 'dropdown',
						label: '操作',
						id: 'operation',
						default: 'add',
						choices: [
							{ id: 'add', label: '增加时间' },
							{ id: 'subtract', label: '减少时间' },
						],
					},
					{
						type: 'number',
						label: '小时',
						id: 'hours',
						default: 0,
						min: 0,
						max: 23,
					},
					{
						type: 'number',
						label: '分钟',
						id: 'minutes',
						default: 0,
						min: 0,
						max: 59,
					},
					{
						type: 'number',
						label: '秒',
						id: 'seconds',
						default: 0,
						min: 0,
					},
				],
				callback: async (action) => {
					const totalSeconds = action.options.hours * 3600 + 
									   action.options.minutes * 60 + 
								   action.options.seconds
					const command = action.options.operation === 'add' 
						? `timeAdd=${totalSeconds}`
						: `timeSubtract=${totalSeconds}`
					await sendCommand(command)
								
					const opText = action.options.operation === 'add' ? '增加' : '减少'
					this.log('info', `操作：${opText} ${totalSeconds}秒`)
				},
			},
			toggle_blink: createToggleAction(
				'闪烁模式',
				{ toggle: 'Blink_Toggle', enable: 'Blink_Enabled', disable: 'Blink_Disabled' },
				sendCommand,
				this.log.bind(this),
				{ toggle: '切换闪烁模式', enable: '开启闪烁模式', disable: '关闭闪烁模式' },
			),
			toggle_top: createToggleAction(
				'置顶',
				{ toggle: 'Top_Toggle', enable: 'Top_Enabled', disable: 'Top_Disabled' },
				sendCommand,
				this.log.bind(this),
				{ toggle: '切换置顶', enable: '开启置顶', disable: '关闭置顶' },
			),
			toggle_fullscreen: createToggleAction(
				'全屏模式',
				{ toggle: 'Fullscreen_Toggle', enable: 'Fullscreen_Enabled', disable: 'Fullscreen_Disabled' },
				sendCommand,
				this.log.bind(this),
				{ toggle: '切换全屏模式', enable: '开启全屏模式', disable: '关闭全屏模式' },
			),
			toggle_window: createToggleAction(
				'显示/隐藏',
				{ toggle: 'Show_Toggle', enable: 'Show_Enabled', disable: 'Show_Disabled' },
				sendCommand,
				this.log.bind(this),
				{ toggle: '切换窗口可见性', enable: '显示窗口', disable: '隐藏窗口' },
			),
			set_resolution: {
				name: '分辨率',
				options: [
					{
						type: 'dropdown',
						label: '分辨率',
						id: 'resolution',
						default: '-1',
						choices: RESOLUTION_CHOICES,
					},
				],
				callback: async (action) => {
					const index = action.options.resolution
					await sendCommand(`Resolution_Set?index=${index}`)
					this.log('info', `操作：设置分辨率为 ${index}`)
				},
			},
			authenticate: {
				name: '登录/重新认证',
				options: [],
				callback: async () => {
					this.log('info', '操作：手动触发登录认证')
					await this.authenticate()
				},
			},
			toggle_ndi: {
				name: 'NDI 输出',
				options: [
					{
						type: 'dropdown',
						label: '操作',
						id: 'operation',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: '切换' },
							{ id: 'enable', label: '开启' },
							{ id: 'disable', label: '关闭' },
						],
					},
				],
				callback: async (action) => {
					const op = action.options.operation
					let command
					let logText
					if (op === 'toggle') {
						const target = !this.connectionState.ndi
						command = `NDI_Set?enabled=${target}`
						logText = target ? '开启 NDI 输出' : '关闭 NDI 输出'
					} else if (op === 'enable') {
						command = 'NDI_Set?enabled=true'
						logText = '开启 NDI 输出'
					} else {
						command = 'NDI_Set?enabled=false'
						logText = '关闭 NDI 输出'
					}
					await sendCommand(command)
					this.log('info', `操作：${logText}`)
				},
			},
		})
	}

	initFeedbacks() {
		this.setFeedbackDefinitions({
			start_stop_countdown: {
				name: '开始/停止',
				type: 'boolean',
				defaultStyle: {
					color: COLORS.green,
				},
				options: [],
				callback: () => {
					return this.connectionState.running
				},
			},
			stop_countdown: {
				name: '停止状态',
				type: 'boolean',
				defaultStyle: {
					color: COLORS.red,
				},
				options: [],
				callback: () => {
					return !this.connectionState.running
				},
			},
			running_status: {
				name: '运行状态',
				type: 'boolean',
				defaultStyle: {
					bgcolor: COLORS.green,
					color: COLORS.black,
				},
				options: [
					{
						type: 'dropdown',
						label: '运行时',
						id: 'state_running',
						default: 'true',
						choices: [
							{ id: 'true', label: '激活' },
							{ id: 'false', label: '未激活' },
						],
					},
				],
				callback: (feedback) => {
					const expectedState = feedback.options.state_running === 'true'
					return this.connectionState.running === expectedState
				},
			},
			paused_status: {
				name: '暂停状态',
				type: 'boolean',
				defaultStyle: {
					bgcolor: 0xFFA500,
					color: COLORS.black,
				},
				options: [
					{
						type: 'dropdown',
						label: '暂停时',
						id: 'state_paused',
						default: 'true',
						choices: [
							{ id: 'true', label: '激活' },
							{ id: 'false', label: '未激活' },
						],
					},
				],
				callback: (feedback) => {
					const expectedState = feedback.options.state_paused === 'true'
					return this.connectionState.paused === expectedState
				},
			},
			blink_status: {
				name: '闪烁模式',
				type: 'boolean',
				defaultStyle: {
					bgcolor: COLORS.yellow,
					color: COLORS.black,
				},
				options: [],
				callback: () => {
					return this.connectionState.blink
				},
			},
			top_status: {
				name: '窗口置顶',
				type: 'boolean',
				defaultStyle: {
					bgcolor: 0x00BFFF,
					color: COLORS.black,
				},
				options: [],
				callback: () => {
					return this.connectionState.top
				},
			},
			fullscreen_status: {
				name: '全屏模式',
				type: 'boolean',
				defaultStyle: {
					bgcolor: 0x9370DB,
					color: COLORS.black,
				},
				options: [],
				callback: () => {
					return this.connectionState.fullscreen
				},
			},
			window_visible: {
				name: '窗口可见',
				type: 'boolean',
				defaultStyle: {
					bgcolor: 0x32CD32,
					color: COLORS.black,
				},
				options: [],
				callback: () => {
					return this.connectionState.windowVisible
				},
			},
			ndi_status: {
				name: 'NDI 输出',
				type: 'boolean',
				defaultStyle: {
					bgcolor: COLORS.green,
					color: COLORS.black,
				},
				options: [],
				callback: () => {
					return this.connectionState.ndi
				},
			},
			resolution_status: {
				name: '分辨率状态',
				type: 'boolean',
				defaultStyle: {
					bgcolor: COLORS.green,
					color: COLORS.black,
				},
				options: [
					{
						type: 'dropdown',
						label: '分辨率',
						id: 'resolution',
						default: '-1',
						choices: RESOLUTION_CHOICES,
					},
				],
				callback: (feedback) => {
					return String(this.connectionState.resolution) === feedback.options.resolution
				},
			},
			time_remaining: {
				name: '剩余时间',
				type: 'boolean',
				defaultStyle: {
					bgcolor: COLORS.red,
					color: COLORS.white,
				},
				options: [
					{
						type: 'number',
						label: '阈值 (秒)',
						id: 'threshold',
						default: 10,
						min: 1,
					},
				],
				callback: (feedback) => {
					const threshold = parseInt(feedback.options.threshold)
					// 添加 NaN 保护
					if (isNaN(threshold)) {
						this.log('warn', `无效的阈值设置：${feedback.options.threshold}`)
						return false
					}
					return this.connectionState.remainingTime <= threshold && 
						   this.connectionState.remainingTime > 0
				}
			},
			authenticated_status: {
				name: '登录状态',
				type: 'boolean',
				defaultStyle: {
					bgcolor: COLORS.green,
					color: COLORS.black,
				},
				options: [
					{
						type: 'dropdown',
						label: '登录状态时',
						id: 'state_authenticated',
						default: 'true',
						choices: [
							{ id: 'true', label: '已登录' },
							{ id: 'false', label: '未登录' },
						],
					},
				],
				callback: (feedback) => {
					const expectedState = feedback.options.state_authenticated === 'true'
					return this.isAuthenticated === expectedState
				},
			},
		})
	}

	/**
	 * 用户登录认证
	 * 调用 TinyCountdown 后台相同的 /api/login 接口，验证成功后才会建立 WebSocket 连接。
	 */
	async authenticate() {
		if (this.isAuthenticating) {
			return
		}
		this.isAuthenticating = true

		try {
			// 表单验证：用户名/密码必填，且密码不能仅由空白字符组成
			const username = (this.config.auth_username || '').trim()
			const secretPassword = this.secrets && this.secrets.auth_password
			const configPassword = this.config.auth_password
			const rawPassword = secretPassword || configPassword || ''
			const passwordSource = secretPassword ? 'secrets' : (configPassword ? 'config' : 'none')
			this.log('debug', `读取到密码来源：${passwordSource}，长度：${rawPassword.length}`)

			const validation = validateCredentials(username, rawPassword)
			if (!validation.valid) {
				this.updateStatus(InstanceStatus.BadConfig, validation.message)
				throw new Error(validation.message)
			}

			const host = this.config.host
			const port = this.config.port || 80
			const loginUrl = `http://${host}:${port}/api/login`

			this.log('debug', `正在登录：${username}`)
			this.updateStatus(InstanceStatus.Connecting)

			const { signal, clear: clearLoginTimeout } = createAbortableTimeout(LOGIN_TIMEOUT, () => {
				this.log('warn', `登录请求在 ${LOGIN_TIMEOUT}ms 内未完成，强制取消`)
			})

			let response
			try {
				response = await fetch(loginUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						'User-Agent': 'TinyCountdown-Companion/1.6.7',
					},
					body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(rawPassword)}`,
					signal,
				})
			} finally {
				clearLoginTimeout()
			}

			let result = null
			const responseText = await response.text()
			try {
				result = JSON.parse(responseText)
			} catch {
				// 非 JSON 响应时保留 null
			}

			if (response.ok && result && result.type === 'response' && result.code === 200) {
				this.isAuthenticated = true
				this.authToken = result.token || null
				this.setVariableValues({ authenticated: 'true' })
				this.checkFeedbacks()
				this.log('info', '登录成功')
				this.stopReconnect()
				this.setupWebSocket()
			} else if (response.status === 401) {
				throw new Error('用户名或密码错误')
			} else {
				const message = result?.message || `HTTP ${response.status}`
				throw new Error(`登录失败：${message}`)
			}
		} catch (error) {
			this.clearAuthState()
			this.log('error', `登录失败：${error.message}`)

			// Network-level failures (server restarting, unreachable, etc.) should be
			// retried so recovery is automatic. Authentication failures keep BadConfig.
			if (isNetworkError(error)) {
				this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
				this.scheduleReconnect(1000, '登录网络错误')
			} else {
				this.updateStatus(InstanceStatus.BadConfig, error.message)
			}
		} finally {
			this.isAuthenticating = false
		}
	}

	setupWebSocket() {
		// 未登录时重新启动认证链路，而不是静默放弃，避免断线后彻底停止恢复。
		if (!this.isAuthenticated) {
			this.log('warn', '未登录，先执行认证再建立 WebSocket 连接')
			this.authenticate()
			return
		}

		// 避免同时存在多个连接尝试
		if (this.isConnecting) {
			this.log('debug', '已有 WebSocket 连接正在进行中，跳过重复尝试')
			return
		}
		this.isConnecting = true
		this.stopReconnect()
		this.closeWebSocketIntentionally()

		const wsUrl = buildWebSocketUrl('ws:', this.config.host, this.config.port, this.authToken)

		this.log('debug', `正在连接到 WebSocket: ${wsUrl}`)
		this.updateStatus(InstanceStatus.Connecting)

		// 连接超时保护：防止 ws 永远卡在 CONNECTING 状态
		const timeout = createAbortableTimeout(WS_CONNECTION_TIMEOUT, () => {
			if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
				this.log('warn', `WebSocket 连接在 ${WS_CONNECTION_TIMEOUT}ms 内未建立，强制终止并重试`)
				this.ws.terminate()
			}
		})
		this.connectionTimeout = timeout.timer
		
		try {
			// 创建 WebSocket 连接时添加选项，设置 User-Agent
			const wsOptions = {
				headers: {
					'User-Agent': 'TinyCountdown-Companion/1.6.7'
				}
			}
			this.ws = new WebSocket(wsUrl, undefined, wsOptions)
			
			this.ws.on('open', () => {
				this.finishConnectionAttempt()
				this.reconnectAttempt = 0
				this.updateStatus(InstanceStatus.Ok)
				this.startHeartbeat()
				// WebSocket 连接成功后，服务端已主动推送状态，无需再发送 GET_STATUS 请求
				// 避免冗余通讯（2026-03-10 优化）
			})
			
			this.ws.on('message', (data) => {
				this.handleMessage(data)
			})
			
			this.ws.on('close', (code, reason) => {
				this.finishConnectionAttempt()
				const reasonText = reason ? reason.toString() : ''
				this.log('warn', `WebSocket 连接已关闭，代码 ${code}${reasonText ? `，原因：${reasonText}` : ''}`)
				this.updateStatus(InstanceStatus.Disconnected, `已关闭：${code}`)
				// Stop local interpolation to avoid counting down while disconnected
				this.stopInterpolation()
				this.stopHeartbeat()
				this.scheduleReconnectFromClose(code, reasonText)
			})
			
			this.ws.on('error', (error) => {
				this.finishConnectionAttempt()
				this.log('error', `WebSocket 错误：${error.message}`)
				this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
			})
		} catch (error) {
			this.finishConnectionAttempt()
			this.log('error', `无法创建 WebSocket 连接：${error.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
			this.scheduleReconnect()
		}
	}

	handleMessage(data) {
		try {
			let message
			if (Buffer.isBuffer(data)) {
				message = data.toString('utf8')
			} else {
				message = data.toString()
			}
			
			// Handle multiple messages separated by newlines
			const messages = message.split('\n').filter(m => m.trim())
			for (const msg of messages) {
				this.processSingleMessage(msg)
			}
		} catch (error) {
			this.log('error', `处理消息时出错：${error.message}`)
		}
	}
	processSingleMessage(message) {
		// 去除校验和（如果有）- 格式为 ||XX
		let cleanMessage = message
		const checksumPos = message.indexOf('||')
		if (checksumPos !== -1) {
			cleanMessage = message.substring(0, checksumPos)
		}
		
		// 如果去除校验和后消息为空，直接返回
		if (!cleanMessage || cleanMessage.trim() === '') {
			return
		}
		
		// 尝试解析 JSON 消息
		let parsedData
		try {
			parsedData = JSON.parse(cleanMessage)
		} catch (e) {
			// 非 JSON 消息（命令响应）静默处理
			// 如："started", "stopped", "time_decreased", "time_increased", "reset", "blink_toggled" 等
			return
		}
		
		// 处理 PONG 响应
		if (parsedData.type === 'pong') {
			return
		}

		// 处理服务端下发的登出/端口变更通知
		if (parsedData.type === 'logout') {
			this.handleLogoutMessage(parsedData)
			return
		}
		
		// 统一数据标准化：提取状态数据
		const normalizedData = this.normalizeStatusData(parsedData)
		
		if (normalizedData) {
			// 验证数据有效性
			if (this.validateStatusData(normalizedData)) {
				// 更新状态并记录日志（一步到位）
				const updates = this.updateConnectionState(normalizedData)
				
				// 调试模式下记录详细日志
				if (this.config.debug_messages && updates && Object.keys(updates).length > 0) {
					this.log('debug', `收到命令：${cleanMessage}`)
				}
			} else {
				this.log('error', `状态数据验证失败：${JSON.stringify(normalizedData)}`)
			}
		} else {
			this.log('warn', `未知消息格式：${JSON.stringify(parsedData)}`)
		}
	}

	handleLogoutMessage(parsedData) {
		const reason = parsedData.reason || ''

		if (reason === 'port_changed') {
			const oldPort = parsedData.old_port
			const newPort = parsedData.new_port
			this.log(
				'warn',
				`TinyCountdown 端口已变更：${oldPort} -> ${newPort}，请在模块配置中更新端口并保存`,
			)
			this.updateStatus(
				InstanceStatus.BadConfig,
				`端口已变更为 ${newPort}，请更新配置`,
			)
		} else {
			this.log('warn', `收到服务端登出通知：${reason}`)
		}
	}

	/**
	 * 数据标准化：统一不同格式的状态数据
	 * @param {Object} parsedData - 解析后的原始数据
	 * @returns {Object|null} 标准化后的状态数据，失败返回 null
	 */
	normalizeStatusData(parsedData) {
		if (!parsedData || typeof parsedData !== 'object') {
			return null
		}
		
		let rawData = null
		
		// 情况 1: 标准格式 {type: 'status', data: {...}}
		if ((parsedData.type === 'status' || parsedData.type === 'time') && parsedData.data) {
			rawData = parsedData.data
		}
		// 情况 2: 嵌套格式 {status: 'success', data: {...}}
		else if (parsedData.data && typeof parsedData.data === 'object') {
			rawData = parsedData.data
		}
		// 情况 3: 扁平格式 {running: true, paused: false, ...}
		else if (parsedData.running !== undefined) {
			rawData = parsedData
		}
		
		if (!rawData) {
			return null
		}
		
		// 提取并标准化所有字段（提供默认值确保完整性）
		return {
			running: rawData.running ?? false,
			paused: rawData.paused ?? false,
			remainingTime: rawData.remainingTime ?? 0,
			remainingTimeMs: rawData.remainingTimeMs ?? ((rawData.remainingTime ?? 0) * 1000),
			totalTime: rawData.totalTime ?? 0,
			blink: rawData.blink ?? false,
			top: rawData.top ?? false,
			fullscreen: rawData.fullscreen ?? false,
			windowVisible: rawData.windowVisible ?? true,
			port: rawData.port ?? 0,
			resolution: rawData.resolution ?? -1,
			ndi: rawData.ndi ?? false,
		}
	}
	
	/**
	 * 验证状态数据的有效性
	 * @param {Object} data - 待验证的状态数据
	 * @returns {boolean} 验证是否通过
	 */
	validateStatusData(data) {
		// 基本类型验证
		if (data.running == null) {
			this.log('warn', `running 缺失`)
			return false
		}
		data.running = Boolean(data.running)
		
		if (data.paused == null) {
			this.log('warn', `paused 缺失`)
			return false
		}
		data.paused = Boolean(data.paused)
		
		if (data.remainingTime == null) {
			this.log('warn', `remainingTime 缺失`)
			return false
		}
		data.remainingTime = Number(data.remainingTime)
		if (isNaN(data.remainingTime)) {
			this.log('warn', `remainingTime 无法转换为数字`)
			return false
		}
		
		if (data.remainingTimeMs == null) {
			this.log('warn', `remainingTimeMs 缺失`)
			return false
		}
		data.remainingTimeMs = Number(data.remainingTimeMs)
		if (isNaN(data.remainingTimeMs)) {
			this.log('warn', `remainingTimeMs 无法转换为数字`)
			return false
		}
		
		if (data.totalTime == null) {
			this.log('warn', `totalTime 缺失`)
			return false
		}
		data.totalTime = Number(data.totalTime)
		if (isNaN(data.totalTime)) {
			this.log('warn', `totalTime 无法转换为数字`)
			return false
		}
		
		// 逻辑验证：剩余时间不能为负数
		if (data.remainingTime < 0) {
			this.log('error', `剩余时间不能为负数：${data.remainingTime}`)
			return false
		}
		
		// 逻辑验证：总时间应该大于等于剩余时间（仅警告，不阻止更新）
		if (data.totalTime > 0 && data.remainingTime > data.totalTime) {
			// 这通常是中间状态，软件端会立即重置数据
			// 仅在调试模式下记录
			if (this.config.debug_messages) {
				this.log('debug', `数据异常：剩余时间 (${data.remainingTime}) 超过总时间 (${data.totalTime}) - 可能是中间状态`)
			}
		}
		
		return true
	}
	
	updateConnectionState(data) {
		// 直接更新变量值，无需中间状态对象
		const updates = {}
		
		// 运行状态
		if (data.running !== undefined && this.connectionState.running !== data.running) {
			this.connectionState.running = data.running
			updates.running = data.running.toString()
		}
		
		// 暂停状态：仅当未运行时才可能为 true
		const paused = !data.running && !!data.paused
		if (this.connectionState.paused !== paused) {
			this.connectionState.paused = paused
			updates.paused = paused.toString()
		}
		
		// 剩余时间（毫秒级）：每次同步都更新，以保证本地插值基准准确
		if (data.remainingTimeMs !== undefined) {
			this.connectionState.remainingTimeMs = data.remainingTimeMs
			this.connectionState.lastSyncTime = Date.now()
			updates.remainingTimeMs = data.remainingTimeMs.toString()
		}
		
		// 根据运行状态启动或停止本地插值
		const isRunning = this.connectionState.running && !this.connectionState.paused
		if (isRunning) {
			this.startInterpolation()
		} else {
			this.stopInterpolation()
			// 非运行状态直接刷新显示
			const displayMs = Math.max(0, this.connectionState.remainingTimeMs)
			const displaySec = Math.floor(displayMs / 1000)
			if (this.connectionState.remainingTime !== displaySec) {
				this.connectionState.remainingTime = displaySec
				updates.remainingTime = displaySec.toString()
				updates.remainingTimeFormatted = formatTimeHHMMSS(displaySec)
				updates.time = formatTimeMMSS(displaySec)
				this.connectionState.time = updates.time
			}
		}
		
		// 简单字段统一处理
		const fields = ['blink', 'top', 'fullscreen', 'windowVisible', 'ndi', 'port', 'totalTime']

		for (const key of fields) {
			if (data[key] !== undefined && this.connectionState[key] !== data[key]) {
				this.connectionState[key] = data[key]
				updates[key] = data[key].toString()
			}
		}

		// 分辨率索引及可读标签
		if (data.resolution !== undefined && this.connectionState.resolution !== data.resolution) {
			this.connectionState.resolution = data.resolution
			updates.resolution = data.resolution.toString()
			updates.resolutionLabel = RESOLUTION_MAP[updates.resolution] || 'Default'
		}

		// 仅在有变化时更新变量，减少不必要的操作
		if (Object.keys(updates).length > 0) {
			this.setVariableValues(updates)
			// 检查反馈
			this.checkFeedbacks()
		}
		
		// 返回更新的内容（用于日志记录）
		return updates
	}

	startInterpolation() {
		if (this.interpolationInterval) {
			return
		}
		this.interpolationInterval = setInterval(() => {
			this.tickInterpolation()
		}, 100) // 100ms 本地渲染间隔
	}

	stopInterpolation() {
		clearInterval(this.interpolationInterval)
		this.interpolationInterval = null
	}

	tickInterpolation() {
		if (!this.connectionState.running || this.connectionState.paused) {
			return
		}

		const elapsed = Date.now() - this.connectionState.lastSyncTime
		const estimatedMs = Math.max(0, this.connectionState.remainingTimeMs - elapsed)
		const estimatedSec = Math.floor(estimatedMs / 1000)

		// 只有当秒级显示变化时才更新变量，避免 Companion 变量系统过载
		if (this.connectionState.remainingTime !== estimatedSec) {
			this.connectionState.remainingTime = estimatedSec
			this.setVariableValues({
				remainingTime: estimatedSec.toString(),
				remainingTimeMs: estimatedMs.toString(),
				remainingTimeFormatted: formatTimeHHMMSS(estimatedSec),
				time: formatTimeMMSS(estimatedSec),
			})
			this.connectionState.time = formatTimeMMSS(estimatedSec)
			this.checkFeedbacks()
		}
	}

	startHeartbeat() {
		clearInterval(this.heartbeatInterval)
		this.heartbeatInterval = setInterval(() => {
			if (this.isWebSocketConnected()) {
				this.sendCommand('PING')
			}
		}, 10000) // 10 seconds
	}

	stopHeartbeat() {
		clearInterval(this.heartbeatInterval)
		this.heartbeatInterval = null
	}

	// Single entry point for all reconnect/recovery scheduling.
	// Callers can suggest a delay; if omitted, exponential backoff is used.
	scheduleReconnect(delayMs = -1, reason = '') {
		if (!this.isInitialized || !this.config.reconnect || this.closingIntentionally) {
			return
		}

		this.stopReconnect()

		if (delayMs < 0) {
			this.reconnectAttempt++
			delayMs = computeReconnectDelay(this.reconnectAttempt)
		}

		const logReason = reason ? ` (${reason})` : ''
		this.log('info', `${delayMs}ms 后重连中 (第 ${this.reconnectAttempt} 次尝试)${logReason}`)

		this.reconnectTimeout = setTimeout(() => {
			this.executeReconnect()
		}, delayMs)
	}

	// Called from ws.on('close') so we can interpret the close reason.
	scheduleReconnectFromClose(closeCode = -1, closeReason = '') {
		if (!this.isInitialized || !this.config.reconnect || this.closingIntentionally) {
			return
		}

		// Server explicitly rejected our token (password changed, etc.) -> re-auth immediately.
		if (this.authToken && isTokenInvalidated(closeCode, closeReason)) {
			this.log('warn', '服务器拒绝当前令牌，立即重新认证')
			this.reconnectAttempt = 0
			this.clearAuthState()
			this.scheduleReconnect(0, '令牌失效，立即重新认证')
			return
		}

		// After several failed attempts with an existing token, the token is probably stale.
		if (this.authToken && this.reconnectAttempt >= MAX_TOKEN_RECONNECT_ATTEMPTS) {
			this.log('warn', `连续 ${MAX_TOKEN_RECONNECT_ATTEMPTS} 次使用旧令牌重连失败，尝试重新认证`)
			this.reconnectAttempt = 0
			this.clearAuthState()
			this.scheduleReconnect(0, '旧令牌重连失败，重新认证')
			return
		}

		// Fast path: token is still valid and this is the first disconnect since last successful
		// connection. Reconnect WebSocket immediately (0ms) without re-authentication.
		// Increment reconnectAttempt so that if this fast attempt fails, subsequent
		// retries fall through to exponential backoff instead of looping at 0ms.
		if (this.authToken && this.reconnectAttempt === 0) {
			this.reconnectAttempt = 1
			this.scheduleReconnect(0, '快速重连（令牌有效，跳过认证）')
			return
		}

		this.scheduleReconnect(-1, closeReason)
	}

	// Decide whether to authenticate or open a WebSocket based on current state.
	executeReconnect() {
		if (!this.isInitialized) {
			return
		}

		if (!this.isAuthenticated) {
			this.authenticate()
		} else {
			this.setupWebSocket()
		}
	}

	clearAuthState() {
		this.isAuthenticated = false
		this.authToken = null
		this.setVariableValues({ authenticated: 'false' })
		this.checkFeedbacks()
	}

	stopConnectionTimeout() {
		if (this.connectionTimeout) {
			clearTimeout(this.connectionTimeout)
			this.connectionTimeout = null
		}
	}

	// Reset flags and timers tied to an in-flight connection attempt.
	finishConnectionAttempt() {
		this.isConnecting = false
		this.stopConnectionTimeout()
	}

	stopReconnect() {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout)
			this.reconnectTimeout = null
		}
	}

	isWebSocketConnected() {
		return this.ws && this.ws.readyState === WebSocket.OPEN
	}

	async sendCommand(command) {
		if (!this.isAuthenticated) {
			this.log('warn', `无法发送命令 "${command}": 未登录`)
			return
		}

		if (!this.isWebSocketConnected()) {
			this.log('warn', `无法发送命令 "${command}": WebSocket 未连接`)
			return
		}
		
		try {
			// Skip logging for PING commands to reduce noise
			if (this.config.debug_messages && command !== 'PING') {
				this.log('debug', `正在发送：${command}`)
			}
			this.ws.send(command)
		} catch (error) {
			this.log('error', `发送命令失败：${error.message}`)
		}
	}
}

export { TinyCountdownInstance }

// Only start the Companion entrypoint when the host has set up the expected
// environment. This lets tests import the class without triggering the IPC
// runtime, while keeping normal Companion execution unchanged.
if (process.env.MODULE_MANIFEST) {
	runEntrypoint(TinyCountdownInstance, upgradeScripts)
}
