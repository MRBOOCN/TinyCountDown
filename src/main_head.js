import { InstanceBase, runEntrypoint, InstanceStatus } from '@companion-module/base'
import WebSocket from 'ws'
import { upgradeScripts } from './upgrade.js'
import { LoadPresets } from './presets.js'
import { validateCredentials, buildWebSocketUrl } from './auth-utils.js'
import { COLORS, RESOLUTION_MAP, RESOLUTION_CHOICES, MODE_CHOICES, MODE_STATUS_CHOICES, FPS_MAP, FPS_CHOICES, FPS_STATUS_CHOICES } from './constants.js'
import {
	WS_CONNECTION_TIMEOUT,
	LOGIN_TIMEOUT,
	MAX_TOKEN_RECONNECT_ATTEMPTS,
	computeReconnectDelay,
	isNetworkError,
	isTokenInvalidated,
	createAbortableTimeout,
} from './reconnection.js'

const USER_AGENT = 'TinyCountdown-Companion/1.6.7'

const TOGGLE_OPERATIONS = [
	{ id: 'toggle', label: '切换' },
	{ id: 'enable', label: '开�? },
	{ id: 'disable', label: '关闭' },
]

const COUNTDOWN_LOG_TEXTS = {
	start: '开始倒计�?,
	stop: '停止倒计�?,
}

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

function formatTimeVariable(totalSeconds, mode) {
	// 时间模式始终使用 HH:MM:SS；其他模式当超过 60 分钟时自动切换为 HH:MM:SS
	if (mode === 'time' || totalSeconds >= 3600) {
		return formatTimeHHMMSS(totalSeconds)
	}
	return formatTimeMMSS(totalSeconds)
}

function createTimeOptions() {
	return [
		{ type: 'number', label: '小时', id: 'hours', default: 0, min: 0, max: 23 },
		{ type: 'number', label: '分钟', id: 'minutes', default: 0, min: 0, max: 59 },
		{ type: 'number', label: '�?, id: 'seconds', default: 0, min: 0, max: 59 },
	]
}

function computeTotalSeconds(hours, minutes, seconds) {
	return hours * 3600 + minutes * 60 + seconds
}

function capitalizeFirst(str) {
	if (!str || typeof str !== 'string') return str
	return str.charAt(0).toUpperCase() + str.slice(1)
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
				choices: TOGGLE_OPERATIONS,
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
				logText = logTexts?.enable || '开�?
			} else {
				command = commands.disable
				logText = logTexts?.disable || '关闭'
			}
			await sendCommand(command)
			log('info', `操作�?{logText}${name}`)
		},
	}
}

function createBooleanFeedback(instance, name, defaultStyle, stateKey, invert = false) {
	return {
		name,
		type: 'boolean',
		defaultStyle,
		options: [],
		callback: () => {
			const value = instance.connectionState[stateKey]
			return invert ? !value : value
		},
	}
}

function createExpectedStateFeedback(
	instance,
	name,
	defaultStyle,
	stateKey,
	optionLabel,
	choices = [
		{ id: 'true', label: '激�? },
		{ id: 'false', label: '未激�? },
	],
) {
	const optionId = `state_${stateKey}`
	return {
		name,
		type: 'boolean',
		defaultStyle,
		options: [
			{
				type: 'dropdown',
				label: optionLabel,
				id: optionId,
				default: 'true',
				choices,
			},
		],
		callback: (feedback) => {
			const expectedState = feedback.options[optionId] === 'true'
			const value = stateKey in instance ? instance[stateKey] : instance.connectionState[stateKey]
			return value === expectedState
		},
	}
}

function createMappedFeedback(instance, name, stateKey, optionId, choices, defaultValue, defaultStyle, optionLabel) {
	return {
		name,
		type: 'boolean',
		defaultStyle,
		options: [
			{
				type: 'dropdown',
				label: optionLabel,
				id: optionId,
				default: defaultValue,
				choices,
			},
		],
		callback: (feedback) => {
			return String(instance.connectionState[stateKey]) === feedback.options[optionId]
		},
	}
}

function validateRequiredBoolean(data, key, log) {
	if (data[key] == null) {
		log('warn', `${key} 缺失`)
		return false
	}
	data[key] = Boolean(data[key])
	return true
}

function validateRequiredNumber(data, key, log) {
	if (data[key] == null) {
		log('warn', `${key} 缺失`)
		return false
	}
	data[key] = Number(data[key])
	if (isNaN(data[key])) {
		log('warn', `${key} 无法转换为数字`)
		return false
	}
	return true
}

const DEFAULT_CONNECTION_STATE = {
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
	ndiFps: 30,
	currentMode: 'countdown',
	lastSyncTime: 0,
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
	connectionState = { ...DEFAULT_CONNECTION_STATE }

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
		this.stopAllConnectionTimers()
		this.stopInterpolation()

		// Close WebSocket
		this.closeWebSocketIntentionally()
	}

	async configUpdated(config, secrets) {
		this.config = config
		this.secrets = secrets || {}

		this.stopAllConnectionTimers()

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
				value:
					'<strong>TinyCountdown 模块</strong><br/>通过 Companion 控制您的 TinyCountdown 应用�?br/>请确�?TinyCountdown 正在运行�?Web 服务器已启用�?,
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
				tooltip: '端口�?(0 = 从首次状态请求自动检�?',
				width: 3,
				default: 0,
				min: 0,
				max: 65535,
			},
			{
				type: 'checkbox',
				id: 'reconnect',
				label: '自动重连',
				tooltip: '连接丢失时自动重�?,
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
				label: '连接时重置变�?,
				tooltip: '连接时重置所有变�?,
				width: 6,
				default: true,
			},
			{
				type: 'textinput',
				id: 'auth_username',
				label: '用户�?,
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
			{ variableId: 'running', name: '运行状�? },
			{ variableId: 'paused', name: '暂停状�? },
			{ variableId: 'remainingTime', name: '剩余时间 (�?' },
			{ variableId: 'totalTime', name: '总时�?(�?' },
			{ variableId: 'time', name: '时间（分：秒 / 时：分：秒）' },
			{ variableId: 'blink', name: '闪烁模式' },
			{ variableId: 'top', name: '窗口置顶' },
			{ variableId: 'fullscreen', name: '全屏模式' },
			{ variableId: 'windowVisible', name: '窗口可见' },
			{ variableId: 'port', name: '服务器端�? },
			{ variableId: 'resolution', name: '分辨率索�? },
			{ variableId: 'resolutionLabel', name: '分辨�? },
			{ variableId: 'ndi', name: 'NDI 输出' },
			{ variableId: 'ndiFps', name: 'NDI 帧率' },
			{ variableId: 'currentMode', name: '当前模式' },
		]

		this.setVariableDefinitions(variableDefinitions)

		// Set initial values
		if (this.config.reset_variables) {
			const initialValues = {}
			for (const { variableId } of variableDefinitions) {
				if (variableId === 'resolutionLabel') {
					initialValues.resolutionLabel = RESOLUTION_MAP[String(initialValues.resolution)] || 'Default'
				} else if (variableId in DEFAULT_CONNECTION_STATE) {
					const value = DEFAULT_CONNECTION_STATE[variableId]
					initialValues[variableId] = variableId === 'currentMode' ? capitalizeFirst(value) : String(value)
				}
			}
			this.setVariableValues(initialValues)
		}
	}

	initActions() {
		const sendCommand = this.sendCommand.bind(this)
		const log = this.log.bind(this)

		this.setActionDefinitions({
			start_stop_countdown: {
				name: '开�?停止',
				options: [
					{
						type: 'dropdown',
						label: '操作',
						id: 'operation',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: '开�?停止' },
							{ id: 'start', label: '开�? },
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
							logText = COUNTDOWN_LOG_TEXTS.stop
						} else {
							command = 'start'
							logText = COUNTDOWN_LOG_TEXTS.start
						}
						break
					case 'start':
						command = 'start'
						logText = COUNTDOWN_LOG_TEXTS.start
						break
					case 'stop':
						command = 'stop'
						logText = COUNTDOWN_LOG_TEXTS.stop
						break
				}
				await sendCommand(command)
				this.log('info', `操作�?{logText}`)
			},
			reset_countdown: {
				name: '重置倒计�?,
				options: [],
				callback: async () => {
					const command = 'reset'
					this.log('debug', `发送重置命令："${command}"`)
					await sendCommand(command)
					this.log('info', '操作：重置倒计�?)
				},
			},
				set_time: {
				name: '时间',
				options: createTimeOptions(),
				callback: async (action) => {
					const totalSeconds = computeTotalSeconds(action.options.hours, action.options.minutes, action.options.seconds)
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
					...createTimeOptions(),
				],
				callback: async (action) => {
					const totalSeconds = computeTotalSeconds(action.options.hours, action.options.minutes, action.options.seconds)
					const command =
						action.options.operation === 'add' ? `timeAdd=${totalSeconds}` : `timeSubtract=${totalSeconds}`
					await sendCommand(command)

					const opText = action.options.operation === 'add' ? '增加' : '减少'
					this.log('info', `操作�?{opText} ${totalSeconds}秒`)
				},
			},
			toggle_blink: createToggleAction(
				'闪烁模式',
				{ toggle: 'Blink_Toggle', enable: 'Blink_Enabled', disable: 'Blink_Disabled' },
				sendCommand,
				log,
				{ toggle: '切换闪烁模式', enable: '开启闪烁模�?, disable: '关闭闪烁模式' },
			),
			toggle_top: createToggleAction(
				'置顶',
				{ toggle: 'Top_Toggle', enable: 'Top_Enabled', disable: 'Top_Disabled' },
				sendCommand,
				log,
				{ toggle: '切换置顶', enable: '开启置�?, disable: '关闭置顶' },
			),
			toggle_fullscreen: createToggleAction(
				'全屏模式',
				{ toggle: 'Fullscreen_Toggle', enable: 'Fullscreen_Enabled', disable: 'Fullscreen_Disabled' },
				sendCommand,
				log,
				{ toggle: '切换全屏模式', enable: '开启全屏模�?, disable: '关闭全屏模式' },
			),
			toggle_window: createToggleAction(
				'显示/隐藏',
				{ toggle: 'Show_Toggle', enable: 'Show_Enabled', disable: 'Show_Disabled' },
				sendCommand,
				log,
				{ toggle: '切换窗口可见�?, enable: '显示窗口', disable: '隐藏窗口' },
			),
			set_mode: {
				name: '模式',
				options: [
					{
						type: 'dropdown',
						label: '操作',
						id: 'operation',
						default: 'toggle',
						choices: MODE_CHOICES,
					},
				],
				callback: async (action) => {
					const op = action.options.operation
					let command
					let logText
					if (op === 'toggle') {
						command = 'mode=toggle'
						logText = '切换模式'
					} else if (op === 'countdown') {
						command = 'mode=countdown'
						logText = '切换到倒计�?
					} else if (op === 'countup') {
						command = 'mode=countup'
						logText = '切换到正计时'
					} else {
						command = 'mode=time'
						logText = '切换到时�?
					}
					await sendCommand(command)
					this.log('info', `操作�?{logText}`)
				},
			},
			set_resolution: {
				name: '分辨�?,
				options: [
					{
						type: 'dropdown',
						label: '分辨�?,
						id: 'resolution',
						default: '-1',
						choices: RESOLUTION_CHOICES,
					},
				],
				callback: async (action) => {
					const index = action.options.resolution
					await sendCommand(`Resolution_Set?index=${index}`)
					this.log('info', `操作：设置分辨率�?${index}`)
				},
			},
			authenticate: {
				name: '登录/重新认证',
				options: [],
				callback: async () => {
					this.log('info', '操作：手动触发登录认�?)
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
						choices: TOGGLE_OPERATIONS,
					},
				],
				callback: async (action) => {
					const op = action.options.operation
					let command
					let logText
					if (op === 'toggle') {
						const target = !this.connectionState.ndi
						command = `NDI_Set?enabled=${target}`
						logText = target ? '开�?NDI 输出' : '关闭 NDI 输出'
					} else if (op === 'enable') {
						command = 'NDI_Set?enabled=true'
						logText = '开�?NDI 输出'
					} else {
						command = 'NDI_Set?enabled=false'
						logText = '关闭 NDI 输出'
					}
					await sendCommand(command)
					this.log('info', `操作�?{logText}`)
				},
			},
			set_ndi_fps: {
				name: 'NDI 帧率',
				options: [
					{
						type: 'dropdown',
						label: '帧率',
						id: 'fps',
						default: '30',
						choices: FPS_CHOICES,
					},
				],
				callback: async (action) => {
					const fps = action.options.fps
					await sendCommand(`NDI_FPS?fps=${fps}`)
					this.log('info', `操作：设�?NDI 帧率�?${FPS_MAP[fps] || fps}`)
				},
			},
		})
	}

	initFeedbacks() {
		this.setFeedbackDefinitions({
			start_stop_countdown: createBooleanFeedback(this, '开�?停止', { color: COLORS.green }, 'running'),
			stop_countdown: createBooleanFeedback(this, '停止状�?, { color: COLORS.red }, 'running', true),
			running_status: createExpectedStateFeedback(
				this,
				'运行状�?,
				{
					bgcolor: COLORS.green,
					color: COLORS.black,
				},
				'running',
				'运行�?,
			),
			paused_status: createExpectedStateFeedback(
				this,
				'暂停状�?,
				{
					bgcolor: 0xffa500,
					color: COLORS.black,
				},
				'paused',
				'暂停�?,
			),
			blink_status: createBooleanFeedback(this, '闪烁模式', { bgcolor: COLORS.yellow, color: COLORS.black }, 'blink'),
			top_status: createBooleanFeedback(this, '窗口置顶', { bgcolor: 0x00bfff, color: COLORS.black }, 'top'),
			fullscreen_status: createBooleanFeedback(this, '全屏模式', { bgcolor: 0x9370db, color: COLORS.black }, 'fullscreen'),
			window_visible: createBooleanFeedback(this, '窗口可见', { bgcolor: 0x32cd32, color: COLORS.black }, 'windowVisible'),
			ndi_status: createBooleanFeedback(this, 'NDI 输出', { bgcolor: COLORS.green, color: COLORS.black }, 'ndi'),
			ndi_fps_status: createMappedFeedback(
				this,
				'NDI 帧率状�?,
				'ndiFps',
				'fps',
				FPS_STATUS_CHOICES,
				'30',
				{
					bgcolor: COLORS.green,
					color: COLORS.black,
				},
				'帧率',
			),
			resolution_status: createMappedFeedback(
				this,
				'分辨率状�?,
				'resolution',
				'resolution',
				RESOLUTION_CHOICES,
				'-1',
				{
					bgcolor: COLORS.green,
					color: COLORS.black,
