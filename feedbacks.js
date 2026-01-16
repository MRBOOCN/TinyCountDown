const { combineRgb } = require('@companion-module/base')

module.exports = async function (self) {
	// 确保countdownState已初始化
	if (!self.countdownState) {
		self.countdownState = {
			running: false,
			paused: false,
			remainingTime: 0,
			connected: false,
		}
	}

	// 确保featureStates已初始化
	if (!self.featureStates) {
		self.featureStates = {
			top: false,
			fullscreen: false,
			blink: false,
			windowVisible: true,
		}
	}

	self.setFeedbackDefinitions({
		countdown_running: {
			name: '倒计时运行中',
			description: '指示倒计时是否正在运行',
			type: 'boolean',
			label: '倒计时运行中',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: (feedback) => {
				return self.countdownState.running
			},
		},
		countdown_paused: {
			name: '倒计时已暂停',
			description: '指示倒计时是否已暂停',
			type: 'boolean',
			label: '倒计时已暂停',
			defaultStyle: {
				bgcolor: combineRgb(255, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: (feedback) => {
				return self.countdownState.paused
			},
		},
		countdown_complete: {
			name: '倒计时已完成',
			description: '指示倒计时是否已完成',
			type: 'boolean',
			label: '倒计时已完成',
			defaultStyle: {
				bgcolor: combineRgb(255, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return self.countdownState.remainingTime <= 0 && !self.countdownState.running
			},
		},
		countdown_time_remaining: {
			name: '剩余时间',
			description: '以秒为单位显示剩余时间',
			type: 'text',
			label: '剩余时间',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [
				{
					id: 'format',
					type: 'dropdown',
					label: '时间格式',
					default: 'seconds',
					choices: [
						{ id: 'seconds', label: '秒' },
						{ id: 'mmss', label: '分:秒' },
						{ id: 'hhmmss', label: '时:分:秒' },
					],
				},
			],
			callback: (feedback) => {
				const format = feedback.options.format || 'seconds'
				let text = ''

				switch (format) {
					case 'seconds':
						text = self.countdownState.remainingTime.toString()
						break
					case 'mmss':
						const minutes = Math.floor(self.countdownState.remainingTime / 60)
						const seconds = self.countdownState.remainingTime % 60
						text = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
						break
					case 'hhmmss':
						const hours = Math.floor(self.countdownState.remainingTime / 3600)
						const mins = Math.floor((self.countdownState.remainingTime % 3600) / 60)
						const secs = self.countdownState.remainingTime % 60
						text = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
						break
				}

				return {
					text: text,
				}
			},
		},
		countdown_remaining_time_mmss: {
			name: '倒计时剩余时间 (分:秒)',
			description: '以分:秒格式显示倒计时剩余时间',
			type: 'text',
			label: '倒计时剩余时间 (分:秒)',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				const minutes = Math.floor(self.countdownState.remainingTime / 60)
				const seconds = self.countdownState.remainingTime % 60
				const text = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
				return { text: text }
			},
		},
		countdown_remaining_time_hhmmss: {
			name: '倒计时剩余时间 (时:分:秒)',
			description: '以时:分:秒格式显示倒计时剩余时间',
			type: 'text',
			label: '倒计时剩余时间 (时:分:秒)',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				const hours = Math.floor(self.countdownState.remainingTime / 3600)
				const mins = Math.floor((self.countdownState.remainingTime % 3600) / 60)
				const secs = self.countdownState.remainingTime % 60
				const text = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
				return { text: text }
			},
		},
		countdown_remaining_time: {
			name: '倒计时剩余时间 (秒)',
			description: '以秒为单位显示倒计时剩余时间',
			type: 'text',
			label: '倒计时剩余时间 (秒)',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return { text: self.countdownState.remainingTime.toString() }
			},
		},
		connection_status: {
			name: '连接状态',
			description: '指示是否已连接到TinyCountdown',
			type: 'boolean',
			label: '连接状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: (feedback) => {
				return self.isConnected
			},
		},
		connection_status_text: {
			name: '连接状态 (文本)',
			description: '显示详细的连接状态',
			type: 'text',
			label: '连接状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				if (self.isConnected) {
					return { text: `已连接到 ${self.config?.host}:${self.config?.port}` }
				} else {
					return { text: '已断开连接' }
				}
			},
		},
		time_remaining_warning: {
			name: '剩余时间警告',
			description: '当剩余时间低于阈值时指示',
			type: 'boolean',
			label: '剩余时间警告',
			defaultStyle: {
				bgcolor: combineRgb(255, 165, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [
				{
					id: 'threshold',
					type: 'number',
					label: '警告阈值 (秒)',
					default: 10,
					min: 1,
					max: 60,
				},
			],
			callback: (feedback) => {
				const threshold = feedback.options.threshold || 10
				return (
					self.countdownState.running &&
					self.countdownState.remainingTime <= threshold &&
					self.countdownState.remainingTime > 0
				)
			},
		},

		start_stop_status: {
			name: '启动/停止状态',
			description: '显示启动/停止状态',
			type: 'text',
			label: '启动/停止状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return { text: self.countdownState.running ? '运行中' : '已停止' }
			},
		},
		top_status: {
			name: '置顶状态',
			description: '显示置顶功能状态',
			type: 'boolean',
			label: '置顶状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: (feedback) => {
				return self.featureStates.top
			},
		},
		top_status_text: {
			name: '置顶状态 (文本)',
			description: '以文本形式显示置顶功能状态',
			type: 'text',
			label: '置顶状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return { text: self.featureStates.top ? '已启用' : '已禁用' }
			},
		},
		fullscreen_status: {
			name: '全屏状态',
			description: '显示全屏模式状态',
			type: 'boolean',
			label: '全屏状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: (feedback) => {
				return self.featureStates.fullscreen
			},
		},
		fullscreen_status_text: {
			name: '全屏状态 (文本)',
			description: '以文本形式显示全屏模式状态',
			type: 'text',
			label: '全屏状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return { text: self.featureStates.fullscreen ? '已启用' : '已禁用' }
			},
		},
		blink_status: {
			name: '闪烁状态',
			description: '显示闪烁效果状态',
			type: 'boolean',
			label: '闪烁状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: (feedback) => {
				return self.featureStates.blink
			},
		},
		blink_status_text: {
			name: '闪烁状态 (文本)',
			description: '以文本形式显示闪烁效果状态',
			type: 'text',
			label: '闪烁状态',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return { text: self.featureStates.blink ? '已启用' : '已禁用' }
			},
		},
		port_number: {
			name: '端口号',
			description: '显示当前通信端口号',
			type: 'text',
			label: '端口号',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return { text: self.config?.port || '未配置' }
			},
		},
		window_visible: {
			name: '窗口可见性',
			description: '指示窗口是否可见（迷你命令状态）',
			type: 'boolean',
			label: '窗口可见性',
			defaultStyle: {
				bgcolor: combineRgb(0, 255, 0),
				color: combineRgb(0, 0, 0),
			},
			options: [],
			callback: (feedback) => {
				return self.featureStates.windowVisible
			},
		},
		window_visible_text: {
			name: '窗口可见性 (文本)',
			description: '以文本形式显示窗口可见性状态（迷你命令状态）',
			type: 'text',
			label: '窗口可见性',
			defaultStyle: {
				bgcolor: combineRgb(0, 0, 0),
				color: combineRgb(255, 255, 255),
			},
			options: [],
			callback: (feedback) => {
				return { text: self.featureStates.windowVisible ? '可见' : '隐藏' }
			},
		},
	})

	// 从TCP消息更新倒计时状态
	self.updateCountdownState = (state) => {
		// 仅在状态变化时更新
		const stateChanged = JSON.stringify(self.countdownState) !== JSON.stringify({ ...self.countdownState, ...state })

		if (stateChanged) {
			self.countdownState = { ...self.countdownState, ...state }
			self.log('info', '通过TCP更新倒计时状态:', self.countdownState)
			self.checkFeedbacks()
			if (self.updateVariables) {
				self.updateVariables()
			}
		}
	}

	// 从TCP消息更新功能状态
	self.updateFeatureState = (feature, state) => {
		if (self.featureStates[feature] !== state) {
			self.featureStates[feature] = state
			self.log('info', `通过TCP更新${feature}状态:`, state)
			self.checkFeedbacks()
			if (self.updateVariables) {
				self.updateVariables()
			}
		}
	}

	// 增强型状态反馈
	self.getDetailedStatus = () => {
		if (!self.isConnected) {
			return '已断开连接'
		} else if (self.countdownState.running) {
			return '运行中'
		} else if (self.countdownState.paused) {
			return '已暂停'
		} else if (self.countdownState.remainingTime <= 0) {
			return '已完成'
		} else {
			return '已停止'
		}
	}

	// 从TinyCountdown请求状态更新
	self.requestStatusUpdate = async () => {
		try {
			await self.sendCommand('GET_STATUS')
			self.log('debug', '通过TCP请求状态更新')
		} catch (error) {
			self.log('error', `请求状态更新错误: ${error.message}`)
		}
	}

	// 开始定期状态更新
	if (!self.statusUpdateInterval) {
		self.statusUpdateInterval = setInterval(() => {
			if (self.isConnected) {
				self.requestStatusUpdate()
			}
		}, 5000) // 每5秒更新一次
	}

	// 在销毁时清理间隔
	const originalDestroy = self.destroy
	self.destroy = async function () {
		if (self.statusUpdateInterval) {
			clearInterval(self.statusUpdateInterval)
			self.statusUpdateInterval = null
		}
		if (originalDestroy) {
			await originalDestroy.apply(this, arguments)
		}
	}
}
