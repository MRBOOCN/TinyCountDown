module.exports = function (self) {
	self.setVariableDefinitions([
		{ variableId: 'countdown_running', name: '倒计时运行中' },
		{ variableId: 'countdown_paused', name: '倒计时已暂停' },
		{ variableId: 'countdown_remaining_time', name: '倒计时剩余时间（秒）' },
		{ variableId: 'connection_status', name: '连接状态' },
		{ variableId: 'countdown_remaining_time_mmss', name: '倒计时剩余时间（分:秒）' },
		{ variableId: 'countdown_remaining_time_hhmmss', name: '倒计时剩余时间（时:分:秒）' },
		{ variableId: 'start_stop_status', name: '启动/停止状态' },
		{ variableId: 'top_status', name: '置顶状态' },
		{ variableId: 'fullscreen_status', name: '全屏状态' },
		{ variableId: 'blink_status', name: '闪烁状态' },
		{ variableId: 'window_visible', name: '窗口可见性' },
		{ variableId: 'port_number', name: '端口号' },
	])

	// Initialize feature states
	self.featureStates = {
		top: false,
		fullscreen: false,
		blink: false,
		windowVisible: true,
	}

	// 更新变量状态
	self.updateVariables = () => {
		const remainingTime = self.countdownState?.remainingTime || 0
		const values = {
			countdown_running: self.countdownState?.running || false,
			countdown_paused: self.countdownState?.paused || false,
			countdown_remaining_time: remainingTime,
			connection_status: self.isConnected || false,
			countdown_remaining_time_mmss: self.formatTime(remainingTime, 'mmss'),
			countdown_remaining_time_hhmmss: self.formatTime(remainingTime, 'hhmmss'),
			start_stop_status: self.countdownState?.running || false ? '运行中' : '已停止',
			top_status: self.featureStates?.top ? '已启用' : '已禁用',
			fullscreen_status: self.featureStates?.fullscreen ? '已启用' : '已禁用',
			blink_status: self.featureStates?.blink ? '已启用' : '已禁用',
			window_visible: self.featureStates?.windowVisible ? '可见' : '隐藏',
			port_number: self.config?.port || '未配置',
		}

		self.setVariableValues(values)
		self.log('debug', '通过TCP更新变量:', values)

		// 触发反馈更新，确保双向通信
		if (self.checkFeedbacks) {
			self.checkFeedbacks()
		}
	}

	// 格式化时间为不同格式
	self.formatTime = (seconds, format) => {
		if (seconds < 0) seconds = 0

		switch (format) {
			case 'mmss':
				const minutes = Math.floor(seconds / 60)
				const secs = seconds % 60
				return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
			case 'hhmmss':
				const hours = Math.floor(seconds / 3600)
				const mins = Math.floor((seconds % 3600) / 60)
				const secs2 = seconds % 60
				return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs2.toString().padStart(2, '0')}`
			default:
				return seconds.toString()
		}
	}

	// 更新功能状态
	self.updateFeatureState = (feature, state) => {
		if (self.featureStates) {
			self.featureStates[feature] = state
			if (self.updateVariables) {
				self.updateVariables()
			}
		}
	}

	// 初始化变量
	self.updateVariables()
}
