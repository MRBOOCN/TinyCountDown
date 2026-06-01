import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import WebSocket from 'ws'
import { upgradeScripts } from './upgrade.js'
import { LoadPresets } from './presets.js'

class TinyCountdownInstance extends InstanceBase {
	isInitialized = false
	ws = null
	heartbeatInterval = null
	reconnectInterval = null
	reconnectCount = 0
	
	// Configuration defaults
	config = {
		host: 'localhost',
		port: 0, // 0 means auto-detect from status
		reconnect: true,
		debug_messages: false,
		reset_variables: true
	}

	// Connection state
	connectionState = {
		running: false,
		paused: false,
		remainingTime: 0,
		totalTime: 0,
		time: '00:00',
		blink: false,
		top: false,
		fullscreen: false,
		windowVisible: true,
		port: 0
	}

	init(config) {
		this.config = config || this.config
		this.isInitialized = true
		
		// Initialize variables, actions and feedbacks
		this.initVariables()
		this.initActions()
		this.initFeedbacks()
		
		// Load presets
		LoadPresets(this)
		
		// Setup WebSocket connection
		this.setupWebSocket()
	}

	async destroy() {
		this.isInitialized = false
		
		// Cleanup timers
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
			this.heartbeatInterval = null
		}
		if (this.reconnectInterval) {
			clearTimeout(this.reconnectInterval)
			this.reconnectInterval = null
		}
		
		// Close WebSocket
		if (this.ws) {
			this.ws.close(1000)
			this.ws = null
		}
	}

	async configUpdated(config) {
		this.config = config
		
		// Reconnect if host or port changed
		if (this.ws) {
			this.ws.close(1000)
			this.ws = null
		}
		
		setTimeout(() => {
			this.setupWebSocket()
		}, 1000)
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
		]
	}

	initVariables() {
		const variableDefinitions = [
			{ variableId: 'running', name: '运行状态' },
			{ variableId: 'paused', name: '暂停状态' },
			{ variableId: 'remainingTime', name: '剩余时间 (秒)' },
			{ variableId: 'remainingTimeFormatted', name: '剩余时间 (时：分：秒)' },
			{ variableId: 'totalTime', name: '总时间 (秒)' },
			{ variableId: 'time', name: '时间 (分：秒)' },
			{ variableId: 'blink', name: '闪烁模式' },
			{ variableId: 'top', name: '窗口置顶' },
			{ variableId: 'fullscreen', name: '全屏模式' },
			{ variableId: 'windowVisible', name: '窗口可见' },
			{ variableId: 'port', name: '服务器端口' },
		]
		
		this.setVariableDefinitions(variableDefinitions)
		
		// Set initial values
		if (this.config.reset_variables) {
			this.setVariableValues({
				running: 'false',
				paused: 'false',
				remainingTime: '0',
				remainingTimeFormatted: '00:00:00',
				totalTime: '0',
				time: '00:00',
				blink: 'false',
				top: 'false',
				fullscreen: 'false',
				windowVisible: 'true',
				port: '0',
			})
		}
	}

	initActions() {
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
					await this.sendCommand(command)
					this.log('info', `操作：${logText}`)
				},
			},
			reset_countdown: {
				name: '重置倒计时',
				options: [],
				callback: async () => {
					const command = 'reset'
					this.log('debug', `发送重置命令："${command}"`)
					await this.sendCommand(command)
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
					await this.sendCommand(`time=${totalSeconds}`)
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
					await this.sendCommand(command)
									
					const opText = action.options.operation === 'add' ? '增加' : '减少'
					this.log('info', `操作：${opText} ${totalSeconds}秒`)
				},
			},
			toggle_blink: {
				name: '闪烁模式',
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
					if (op === 'toggle') {
						await this.sendCommand('Blink_Toggle')
						this.log('info', '操作：切换闪烁')
					} else if (op === 'enable') {
						await this.sendCommand('Blink_Enabled')
						this.log('info', '操作：开启闪烁')
					} else {
						await this.sendCommand('Blink_Disabled')
						this.log('info', '操作：关闭闪烁')
					}
				},
			},
			toggle_top: {
				name: '置顶',
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
					if (op === 'toggle') {
						await this.sendCommand('Top_Toggle')
						this.log('info', '操作：切换窗口置顶')
					} else if (op === 'enable') {
						await this.sendCommand('Top_Enabled')
						this.log('info', '操作：开启窗口置顶')
					} else {
						await this.sendCommand('Top_Disabled')
						this.log('info', '操作：关闭窗口置顶')
					}
				},
			},
			toggle_fullscreen: {
				name: '全屏模式',
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
					if (op === 'toggle') {
						await this.sendCommand('Fullscreen_Toggle')
						this.log('info', '操作：切换全屏')
					} else if (op === 'enable') {
						await this.sendCommand('Fullscreen_Enabled')
						this.log('info', '操作：开启全屏')
					} else {
						await this.sendCommand('Fullscreen_Disabled')
						this.log('info', '操作：关闭全屏')
					}
				},
			},
			toggle_window: {
				name: '显示/隐藏',
				options: [
					{
						type: 'dropdown',
						label: '操作',
						id: 'operation',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: '切换' },
							{ id: 'enable', label: '显示' },
							{ id: 'disable', label: '隐藏' },
						],
					},
				],
				callback: async (action) => {
					const op = action.options.operation
					if (op === 'toggle') {
						await this.sendCommand('Show_Toggle')
						this.log('info', '操作：切换窗口可见性')
					} else if (op === 'enable') {
						await this.sendCommand('Show_Enabled')
						this.log('info', '操作：显示窗口')
					} else {
						await this.sendCommand('Show_Disabled')
						this.log('info', '操作：隐藏窗口')
					}
				}
			}
		})
	}

	initFeedbacks() {
		this.setFeedbackDefinitions({
			start_stop_countdown: {
				name: '开始/停止',
				type: 'boolean',
				defaultStyle: {
					color: '#3FD63F',
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
					color: '#FF0000',
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
					bgcolor: '#3FD63F',
					color: '#000000',
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
					bgcolor: '#FFA500',
					color: '#000000',
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
					bgcolor: '#FFFF00',
					color: '#000000',
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
					bgcolor: '#00BFFF',
					color: '#000000',
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
					bgcolor: '#9370DB',
					color: '#000000',
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
					bgcolor: '#32CD32',
					color: '#000000',
				},
				options: [],
				callback: () => {
					// 窗口可见时返回 true
					return this.connectionState.windowVisible
				},
			},
			time_remaining: {
				name: '剩余时间',
				type: 'boolean',
				defaultStyle: {
					bgcolor: '#FF0000',
					color: '#FFFFFF',
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
		})
	}

	setupWebSocket() {
		const protocol = 'ws:'
		const host = this.config.host || 'localhost'
		const port = this.config.port || 0
		
		// Build WebSocket URL
		let wsUrl = `${protocol}//${host}`
		if (port > 0) {
			wsUrl += `:${port}`
		}
		wsUrl += '/ws'
		
		this.log('debug', `正在连接到 WebSocket: ${wsUrl}`)
		this.updateStatus(InstanceStatus.Connecting)
		
		try {
			// 创建 WebSocket 连接时添加选项，设置 User-Agent
			const wsOptions = {
				headers: {
					'User-Agent': 'TinyCountdown-Companion/1.6.6'
				}
			}
			this.ws = new WebSocket(wsUrl, undefined, wsOptions)
			
			this.ws.on('open', () => {
				this.updateStatus(InstanceStatus.Ok)
				this.reconnectCount = 0
						
				// Start heartbeat
				this.startHeartbeat()
						
				// WebSocket 连接成功后，服务端已主动推送状态，无需再发送 GET_STATUS 请求
				// 避免冗余通讯（2026-03-10 优化）
			})
			
			this.ws.on('message', (data) => {
				this.handleMessage(data)
			})
			
			this.ws.on('close', (code) => {
				this.log('warn', `WebSocket 连接已关闭，代码 ${code}`)
				this.updateStatus(InstanceStatus.Disconnected, `已关闭：${code}`)
				this.maybeReconnect()
			})
			
			this.ws.on('error', (error) => {
				this.log('error', `WebSocket 错误：${error.message}`)
				this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
			})
		} catch (error) {
			this.log('error', `无法创建 WebSocket 连接：${error.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
			this.maybeReconnect()
		}
	}

	handleMessage(data) {
		try {
			let message
			if (Buffer.isBuffer(data)) {
				message = data.toString('utf8')
			} else if (typeof data === 'object') {
				message = JSON.stringify(data)
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
			totalTime: rawData.totalTime ?? 0,
			blink: rawData.blink ?? false,
			top: rawData.top ?? false,
			fullscreen: rawData.fullscreen ?? false,
			windowVisible: rawData.windowVisible ?? true,
			port: rawData.port ?? 0
		}
	}
	
	/**
	 * 验证状态数据的有效性
	 * @param {Object} data - 待验证的状态数据
	 * @returns {boolean} 验证是否通过
	 */
	validateStatusData(data) {
		// 基本类型验证
		if (typeof data.running !== 'boolean') {
			this.log('warn', `running 类型错误：${typeof data.running}`)
			return false
		}
		if (typeof data.paused !== 'boolean') {
			this.log('warn', `paused 类型错误：${typeof data.paused}`)
			return false
		}
		if (typeof data.remainingTime !== 'number') {
			this.log('warn',`remainingTime 类型错误：${typeof data.remainingTime}`)
			return false
		}
		if (typeof data.totalTime !== 'number') {
			this.log('warn', `totalTime 类型错误：${typeof data.totalTime}`)
			return false
		}
		
		// 逻辑验证：剩余时间不能为负数
		if (data.remainingTime < 0) {
			this.log('error', `剩余时间不能为负数：${data.remainingTime}`)
			return false
		}
		
		// 逻辑验证：暂停时必须是未运行状态（自动修正）
		if (data.paused && data.running) {
			this.log('warn', '数据异常：运行状态下不能暂停，自动修正 paused=false')
			data.paused = false
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
		
		// 暂停状态（仅当未运行时有效）
		if (data.paused !== undefined && !data.running && this.connectionState.paused !== data.paused) {
			this.connectionState.paused = data.paused
			updates.paused = data.paused.toString()
		}
		
		// 剩余时间（秒）- 直接透传软件端数据，同时更新格式化变量
		if (data.remainingTime !== undefined && this.connectionState.remainingTime !== data.remainingTime) {
			this.connectionState.remainingTime = data.remainingTime
			const totalSeconds = Math.floor(data.remainingTime)  // 向下取整，直接使用整数部分
			updates.remainingTime = totalSeconds.toString()
					
			// 内联格式化：HH:MM:SS
			const hours = Math.floor(totalSeconds / 3600)
			const minutes = Math.floor((totalSeconds % 3600) / 60)
			const seconds = totalSeconds % 60
			updates.remainingTimeFormatted = 
				`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
					
			// 内联格式化：MM:SS
			const totalMinutes = Math.floor(totalSeconds / 60)
			const secs = totalSeconds % 60
			updates.time= `${totalMinutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
		}
		
		// 总时间
		if (data.totalTime !== undefined && this.connectionState.totalTime !== data.totalTime) {
			this.connectionState.totalTime = data.totalTime
			updates.totalTime = data.totalTime.toString()
		}
		
		// 闪烁模式
		if (data.blink !== undefined && this.connectionState.blink !== data.blink) {
			this.connectionState.blink = data.blink
			updates.blink = data.blink.toString()
		}
		
		// 窗口置顶
		if (data.top !== undefined && this.connectionState.top !== data.top) {
			this.connectionState.top = data.top
			updates.top = data.top.toString()
		}
		
		// 全屏模式
		if (data.fullscreen !== undefined && this.connectionState.fullscreen !== data.fullscreen) {
			this.connectionState.fullscreen = data.fullscreen
			updates.fullscreen = data.fullscreen.toString()
		}
		
		// 窗口可见性
		if (data.windowVisible !== undefined && this.connectionState.windowVisible !== data.windowVisible) {
			this.connectionState.windowVisible = data.windowVisible
			updates.windowVisible = data.windowVisible.toString()
		}
		
		// 服务器端口
		if (data.port !== undefined && this.connectionState.port !== data.port) {
			this.connectionState.port = data.port
			updates.port = data.port.toString()
		}
		
		// 仅在有变化时更新变量，减少不必要的操作
		if (Object.keys(updates).length > 0) {
			this.setVariableValues(updates)
			// 检查反馈
			this.checkFeedbacks()
		}
		
		// 返回更新的内容（用于日志记录）
		return Object.keys(updates).length > 0 ? updates : null
	}
	
	

	startHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
		}
		
		this.heartbeatInterval = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.sendCommand('PING')
			}
		}, 10000) // 10 seconds
	}

	maybeReconnect() {
		if (!this.isInitialized || !this.config.reconnect) {
			return
		}
		
		if (this.reconnectInterval) {
			clearTimeout(this.reconnectInterval)
		}
		
		// 无限重连直到连接成功
		this.reconnectCount++
		this.log('info', `5 秒后重连中 (第 ${this.reconnectCount} 次尝试)`)
		
		this.reconnectInterval = setTimeout(() => {
			this.setupWebSocket()
		}, 5000)
	}

	async sendCommand(command) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			this.log('warn', `无法发送命令 "${command}": WebSocket 未连接`)
			return false
		}
		
		try {
			// Skip logging for PING commands to reduce noise
			if (this.config.debug_messages && command !== 'PING') {
				this.log('debug', `正在发送：${command}`)
			}
			this.ws.send(command)
			return true
		} catch (error) {
			this.log('error', `发送命令失败：${error.message}`)
			return false
		}
	}
}

runEntrypoint(TinyCountdownInstance, upgradeScripts)
