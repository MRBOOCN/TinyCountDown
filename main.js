const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base')
const net = require('net')
const UpgradeScripts = require('./upgrades')
const UpdateActions = require('./actions')
const UpdateFeedbacks = require('./feedbacks')
const UpdateVariableDefinitions = require('./variables')

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.client = null
		this.isConnected = false
		this.reconnectInterval = null
		this.heartbeatInterval = null
		this.countdownInterval = null
		this.buffer = ''
		this.countdownState = {
			running: false,
			paused: false,
			remainingTime: 0,
		}
		this.featureStates = {
			top: false,
			fullscreen: false,
			blink: false,
			windowVisible: true,
		}
		// Batch processing for status updates
		this.statusUpdateBatch = null
		this.statusUpdateTimeout = null
	}

	async init(config) {
		this.config = config

		// Initialize countdown state
		this.countdownState = {
			running: false,
			paused: false,
			remainingTime: 0,
		}

		// Initialize feature states
		this.featureStates = {
			top: false,
			fullscreen: false,
			blink: false,
			windowVisible: true,
		}

		// Initialize countdown interval
		this.countdownInterval = null

		// Connect to TinyCountdown
		this.connect()

		this.updateStatus(InstanceStatus.Connecting)

		this.updateActions() // export actions
		this.updateFeedbacks() // export feedbacks
		this.updateVariableDefinitions() // export variable definitions
	}

	// Process batched status updates
	processStatusUpdateBatch() {
		if (this.statusUpdateBatch) {
			// Update state
			this.countdownState = this.statusUpdateBatch.state

			// Update feature states
			this.featureStates = this.statusUpdateBatch.features

			// Update feedbacks and variables
			if (this.checkFeedbacks) {
				this.checkFeedbacks()
			}
			if (this.updateVariables) {
				this.updateVariables()
			}

			// Clear batch
			this.statusUpdateBatch = null
		}
	}

	// When module gets deleted
	async destroy() {
		this.disconnect()
		// Ensure countdown interval is stopped
		if (this.countdownInterval) {
			clearInterval(this.countdownInterval)
			this.countdownInterval = null
		}
		// Clear status update timeout
		if (this.statusUpdateTimeout) {
			clearTimeout(this.statusUpdateTimeout)
			this.statusUpdateTimeout = null
		}
		this.log('debug', 'destroy')
	}

	async configUpdated(config) {
		const oldHost = this.config?.host
		const oldPort = this.config?.port
		this.config = config

		// Reconnect if host or port changed
		if (oldHost !== config.host || oldPort !== config.port) {
			this.disconnect()
			this.connect()
		}
	}

	// 返回Web配置的字段
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: '目标IP',
				width: 8,
				regex: Regex.IP,
				default: '127.0.0.1',
			},
			{
				type: 'textinput',
				id: 'port',
				label: '目标端口',
				width: 4,
				regex: Regex.PORT,
				default: '8080',
			},
			{
				type: 'number',
				id: 'reconnectInterval',
				label: '重连间隔（秒）',
				width: 4,
				default: 5,
				min: 1,
				max: 30,
			},
			{
				type: 'number',
				id: 'heartbeatInterval',
				label: '心跳间隔（秒）',
				width: 4,
				default: 10,
				min: 5,
				max: 60,
			},
		]
	}

	// 连接到TinyCountdown
	connect() {
		if (!this.config.host || !this.config.port) {
			this.log('error', '缺少主机或端口配置')
			this.updateStatus(InstanceStatus.Error, '缺少主机或端口配置')
			return
		}

		this.disconnect() // 确保之前的连接已关闭

		this.log('debug', `尝试连接到 ${this.config.host}:${this.config.port}`)
		this.updateStatus(InstanceStatus.Connecting, `正在连接到 ${this.config.host}:${this.config.port}`)

		this.client = new net.Socket()
		this.client.setTimeout(10000)

		this.client.connect(this.config.port, this.config.host, () => {
			this.log('info', `已连接到 ${this.config.host}:${this.config.port}`)
			this.isConnected = true
			this.updateStatus(InstanceStatus.Ok, `已连接到 ${this.config.host}:${this.config.port}`)

			// 启动心跳
			this.startHeartbeat()

			// 请求当前状态
			this.sendCommand('GET_STATUS')
		})

		this.client.on('data', (data) => {
			this.handleIncomingData(data)
		})

		this.client.on('error', (err) => {
			this.log('error', `连接错误: ${err.message}`)
			// 根据错误类型提供更具体的状态信息
			if (err.code === 'ECONNREFUSED') {
				this.updateStatus(InstanceStatus.Error, 'TinyCountdown未运行或端口未开放')
			} else if (err.code === 'ETIMEDOUT') {
				this.updateStatus(InstanceStatus.Error, '连接超时')
			} else {
				this.updateStatus(InstanceStatus.Error, `连接错误: ${err.message}`)
			}
			this.isConnected = false
			this.scheduleReconnect()
		})

		this.client.on('timeout', () => {
			this.log('error', '连接超时')
			this.updateStatus(InstanceStatus.Error, '连接超时')
			this.client.destroy()
			this.isConnected = false
			this.scheduleReconnect()
		})

		this.client.on('close', () => {
			this.log('debug', '连接已关闭')
			this.isConnected = false
			this.updateStatus(InstanceStatus.Disconnected, '连接已关闭')
			this.scheduleReconnect()
		})
	}

	// 断开与TinyCountdown的连接
	disconnect() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
			this.heartbeatInterval = null
		}

		if (this.reconnectInterval) {
			clearTimeout(this.reconnectInterval)
			this.reconnectInterval = null
		}

		if (this.countdownInterval) {
			clearInterval(this.countdownInterval)
			this.countdownInterval = null
		}

		if (this.client) {
			this.client.destroy()
			this.client = null
		}

		this.isConnected = false
		this.buffer = ''
	}

	// 安排重新连接
	scheduleReconnect() {
		if (this.reconnectInterval) {
			clearTimeout(this.reconnectInterval)
		}

		const interval = (this.config.reconnectInterval || 5) * 1000
		this.reconnectInterval = setTimeout(() => {
			this.log('debug', '尝试重新连接...')
			this.connect()
		}, interval)
	}

	// 启动心跳
	startHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval)
		}

		const interval = (this.config.heartbeatInterval || 10) * 1000
		this.heartbeatInterval = setInterval(() => {
			this.sendCommand('PING')
		}, interval)
	}

	// 处理传入数据
	handleIncomingData(data) {
		this.buffer += data.toString()

		// 处理完整消息
		while (this.buffer.includes('\n')) {
			const messageEnd = this.buffer.indexOf('\n')
			const message = this.buffer.substring(0, messageEnd)
			this.buffer = this.buffer.substring(messageEnd + 1)

			this.processMessage(message)
		}
	}

	// 处理传入消息
	processMessage(message) {
		try {
			// 尝试解析JSON消息
			const parsedMessage = JSON.parse(message)
			this.handleJsonMessage(parsedMessage)
		} catch (error) {
			// 处理纯文本消息
			this.handlePlainMessage(message)
		}
	}

	// 启动倒计时计时器 - 不再需要，因为TinyCountDown发送实时更新
	startCountdownTimer() {
		// 计时器功能现在由TinyCountDown的实时更新处理
		// 保留此方法是为了向后兼容
	}

	// 停止倒计时计时器 - 不再需要，因为TinyCountDown发送实时更新
	stopCountdownTimer() {
		// 计时器功能现在由TinyCountDown的实时更新处理
		// 保留此方法是为了向后兼容
		if (this.countdownInterval) {
			clearInterval(this.countdownInterval)
			this.countdownInterval = null
		}
	}

	// 处理JSON消息
	handleJsonMessage(message) {
		if (message.type === 'status') {
			// 更新倒计时状态
			const newState = {
				running: message.data.running || false,
				paused: message.data.paused || false,
				remainingTime: message.data.remainingTime || 0,
				remainingTimeMs: message.data.remainingTimeMs || 0,
				totalTime: message.data.totalTime || 0,
			}

			// 创建功能状态副本
			const newFeatures = { ...this.featureStates }

			// 更新功能状态
			if (message.data.blink !== undefined) {
				newFeatures.blink = message.data.blink
			}
			if (message.data.top !== undefined) {
				newFeatures.top = message.data.top
			}
			if (message.data.fullscreen !== undefined) {
				newFeatures.fullscreen = message.data.fullscreen
			}
			if (message.data.windowVisible !== undefined) {
				newFeatures.windowVisible = message.data.windowVisible
			}

			// 检查状态是否实际发生变化
			const stateChanged =
				Math.abs(this.countdownState.remainingTime - newState.remainingTime) >= 1 ||
				this.countdownState.running !== newState.running ||
				this.countdownState.paused !== newState.paused ||
				this.featureStates.blink !== newFeatures.blink ||
				this.featureStates.top !== newFeatures.top ||
				this.featureStates.fullscreen !== newFeatures.fullscreen

			// 仅在状态发生显著变化时记录日志
			if (stateChanged) {
				this.log(
					'debug',
					`收到状态更新: running=${newState.running}, paused=${newState.paused}, remainingTime=${newState.remainingTime}, remainingTimeMs=${newState.remainingTimeMs}, totalTime=${newState.totalTime}`,
				)
			}

			// 对状态更新使用批量处理
			this.statusUpdateBatch = {
				state: newState,
				features: newFeatures,
			}

			// 清除现有超时（如果有）
			if (this.statusUpdateTimeout) {
				clearTimeout(this.statusUpdateTimeout)
			}

			// 设置超时，在较短延迟后处理批次（10ms）以减少延迟
			this.statusUpdateTimeout = setTimeout(() => {
				this.processStatusUpdateBatch()
			}, 10)
		} else if (message.type === 'error') {
			this.log('error', `TinyCountdown错误: ${message.message}`)
		} else if (message.type === 'pong') {
			// 心跳响应 - 仅在调试模式下记录
			// this.log('debug', '收到心跳响应')
		}
	}

	// 处理纯文本消息
	handlePlainMessage(message) {
		const msg = message.trim()

		if (msg === 'PONG') {
			// 心跳响应
			this.log('debug', '收到心跳响应')
		} else if (msg.startsWith('STATUS:')) {
			// 状态更新
			const statusParts = msg.substring(7).split(',')
			const status = {}

			statusParts.forEach((part) => {
				const [key, value] = part.split('=')
				if (key && value) {
					status[key.trim()] = value.trim()
				}
			})

			// 更新倒计时状态
			const newState = {
				running: status.running === 'true',
				paused: status.paused === 'true',
				remainingTime: parseInt(status.remainingTime, 10) || 0,
			}

			// 更新状态
			this.countdownState = newState

			// 管理倒计时计时器
			if (newState.running && newState.remainingTime > 0) {
				this.startCountdownTimer()
			} else {
				this.stopCountdownTimer()
			}

			// 更新反馈和变量
			if (this.checkFeedbacks) {
				this.checkFeedbacks()
			}
			if (this.updateVariables) {
				this.updateVariables()
			}
		}
	}

	// 发送命令到TinyCountdown
	async sendCommand(command, data = {}) {
		if (!this.config.host || !this.config.port) {
			this.log('error', '缺少主机或端口配置')
			return false
		}

		if (!this.isConnected || !this.client) {
			this.log('warn', `未连接到TinyCountdown，无法发送命令: ${command}`)
			// 尝试重新连接
			if (!this.reconnectInterval) {
				this.connect()
			}
			return false
		}

		// 转换为纯文本TCP命令格式
		let tcpCommand = ''
		switch (command) {
			case 'START':
				tcpCommand = 'start+'
				break
			case 'STOP':
				tcpCommand = 'start-'
				break
			case 'SETTIME':
				tcpCommand = `time=${data.seconds}`
				break
			case 'PAUSE':
				tcpCommand = 'start-'
				break
			case 'RESUME':
				tcpCommand = 'start+'
				break
			case 'RESET':
				tcpCommand = 'start+' // 通过启动来重置
				break
			default:
				// 对于其他命令，使用JSON格式
				const jsonCommand = {
					type: 'command',
					command: command,
					data: data,
					timestamp: Date.now(),
					version: '1.6.2',
				}
				tcpCommand = JSON.stringify(jsonCommand)
		}

		return new Promise((resolve, reject) => {
			const message = tcpCommand + '\n'

			this.client.write(message, (err) => {
				if (err) {
					this.log('error', `发送命令错误: ${err.message}`)
					// 连接可能已断开，尝试重新连接
					this.isConnected = false
					this.scheduleReconnect()
					reject(err)
				} else {
					this.log('debug', `已发送TCP命令: ${tcpCommand}`)
					resolve(true)
				}
			})
		})
	}

	// 发送纯文本命令（用于向后兼容）
	async sendPlainCommand(command) {
		if (!this.config.host || !this.config.port) {
			this.log('error', '缺少主机或端口配置')
			return false
		}

		if (!this.isConnected || !this.client) {
			this.log('warn', `未连接到TinyCountdown，无法发送纯文本命令: ${command}`)
			// 尝试重新连接
			if (!this.reconnectInterval) {
				this.connect()
			}
			return false
		}

		return new Promise((resolve, reject) => {
			const message = command + '\n'

			this.client.write(message, (err) => {
				if (err) {
					this.log('error', `发送纯文本命令错误: ${err.message}`)
					// 连接可能已断开，尝试重新连接
					this.isConnected = false
					this.scheduleReconnect()
					reject(err)
				} else {
					this.log('debug', `已发送纯文本命令: ${command}`)
					resolve(true)
				}
			})
		})
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		UpdateVariableDefinitions(this)
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
