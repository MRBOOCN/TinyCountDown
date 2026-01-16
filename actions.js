module.exports = function (self) {
	self.setActionDefinitions({
		start_stop_countdown: {
			name: '启动/停止倒计时',
			description: '启动或停止倒计时计时器',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: '模式',
					default: 'start+',
					choices: [
						{ id: 'start+', label: '启动' },
						{ id: 'start-', label: '停止' },
					],
				},
			],
			callback: async (event) => {
				try {
					const mode = event.options.mode
					const result = await self.sendPlainCommand(mode)
					if (result) {
						self.log('info', `Sent ${mode} command via TCP`)
						// Update local state optimistically
						if (mode === 'start+') {
							self.countdownState.running = true
							self.countdownState.paused = false
							// Start countdown timer
							if (self.startCountdownTimer) {
								self.startCountdownTimer()
							}
						} else {
							self.countdownState.running = false
							self.countdownState.paused = false
							// Stop countdown timer
							if (self.stopCountdownTimer) {
								self.stopCountdownTimer()
							}
						}
						if (self.checkFeedbacks) {
							self.checkFeedbacks()
						}
						if (self.updateVariables) {
							self.updateVariables()
						}
					} else {
						self.log('warn', `Failed to send ${mode} command: not connected`)
					}
				} catch (error) {
					self.log('error', `Error sending command: ${error.message}`)
				}
			},
		},

		set_time: {
			name: '设置倒计时时间',
			description: '设置倒计时时间（秒）',
			options: [
				{
					id: 'seconds',
					type: 'number',
					label: '秒',
					default: 60,
					min: 1,
					max: 3600,
				},
			],
			callback: async (event) => {
				try {
					const seconds = event.options.seconds
					const result = await self.sendCommand('SETTIME', { seconds: seconds })
					if (result) {
						self.log('info', `Sent SETTIME command with ${seconds} seconds via TCP`)
						// Update local state optimistically
						self.countdownState.remainingTime = seconds
						// For reset operation, stop the countdown
						// Reset is typically when we set a new time while countdown is running
						if (self.countdownState.running) {
							// Stop the countdown timer
							if (self.stopCountdownTimer) {
								self.stopCountdownTimer()
							}
							// Set running to false
							self.countdownState.running = false
						}
						// Force immediate update of feedbacks and variables
						if (self.updateVariables) {
							self.updateVariables()
						}
						if (self.checkFeedbacks) {
							self.checkFeedbacks()
						}
					} else {
						self.log('warn', 'Failed to send SETTIME command: not connected')
					}
				} catch (error) {
					self.log('error', `Error setting countdown time: ${error.message}`)
				}
			},
		},

		fullscreen_mode: {
			name: '全屏',
			description: '全屏模式',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: '模式',
					default: 'on',
					choices: [
						{ id: 'on', label: '开启全屏' },
						{ id: 'off', label: '关闭全屏' },
					],
				},
			],
			callback: async (event) => {
				try {
					const mode = event.options.mode
					const tcpCommand = mode === 'on' ? 'fullscreen+' : 'fullscreen-'
					const result = await self.sendPlainCommand(tcpCommand)
					if (result) {
						self.log('info', `Sent ${tcpCommand} command via TCP`)
						// Update feature state
						self.updateFeatureState('fullscreen', mode === 'on')
					} else {
						self.log('warn', `Failed to send ${tcpCommand} command: not connected`)
					}
				} catch (error) {
					self.log('error', `Error setting fullscreen mode: ${error.message}`)
				}
			},
		},
		always_on_top_mode: {
			name: '置顶模式',
			description: '置顶模式',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: '模式',
					default: 'on',
					choices: [
						{ id: 'on', label: '开启置顶' },
						{ id: 'off', label: '关闭置顶' },
					],
				},
			],
			callback: async (event) => {
				try {
					const mode = event.options.mode
					const tcpCommand = mode === 'on' ? 'top+' : 'top-'
					const result = await self.sendPlainCommand(tcpCommand)
					if (result) {
						self.log('info', `Sent ${tcpCommand} command via TCP`)
						// Update feature state
						self.updateFeatureState('top', mode === 'on')
					} else {
						self.log('warn', `Failed to send ${tcpCommand} command: not connected`)
					}
				} catch (error) {
					self.log('error', `Error setting always-on-top mode: ${error.message}`)
				}
			},
		},
		blink_functionality: {
			name: '闪烁功能',
			description: '闪烁功能',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: '模式',
					default: 'on',
					choices: [
						{ id: 'on', label: '开启闪烁' },
						{ id: 'off', label: '关闭闪烁' },
					],
				},
			],
			callback: async (event) => {
				try {
					const mode = event.options.mode
					const tcpCommand = mode === 'on' ? 'Blink+' : 'Blink-'
					const result = await self.sendPlainCommand(tcpCommand)
					if (result) {
						self.log('info', `Sent ${tcpCommand} command via TCP`)
						// Update feature state
						self.updateFeatureState('blink', mode === 'on')
					} else {
						self.log('warn', `Failed to send ${tcpCommand} command: not connected`)
					}
				} catch (error) {
					self.log('error', `Error setting blink functionality: ${error.message}`)
				}
			},
		},
		show_hide_window: {
			name: '显示/隐藏窗口',
			description: '显示或隐藏窗口',
			options: [
				{
					id: 'mode',
					type: 'dropdown',
					label: '模式',
					default: 'show',
					choices: [
						{ id: 'show', label: '显示窗口' },
						{ id: 'hide', label: '隐藏窗口' },
					],
				},
			],
			callback: async (event) => {
				try {
					const mode = event.options.mode
					const tcpCommand = mode === 'show' ? 'mini+' : 'mini-'
					const result = await self.sendPlainCommand(tcpCommand)
					if (result) {
						self.log('info', `Sent ${tcpCommand} command via TCP`)
						// Update local state optimistically
						self.updateFeatureState('windowVisible', mode === 'show')
					} else {
						self.log('warn', `Failed to send ${tcpCommand} command: not connected`)
					}
				} catch (error) {
					self.log('error', `Error setting window visibility: ${error.message}`)
				}
			},
		},

		// 设置消息功能（放在末尾）
		set_message: {
			name: '设置消息',
			description: '设置自定义消息',
			options: [
				{
					id: 'message',
					type: 'textinput',
					label: '自定义消息',
					default: '',
					required: true,
				},
			],
			callback: async (event) => {
				try {
					const message = event.options.message
					// Directly send the message as TCP command without prefix
					const result = await self.sendPlainCommand(message)
					if (result) {
						self.log('info', `Sent message command via TCP`)
					} else {
						self.log('warn', 'Failed to send message command: not connected')
					}
				} catch (error) {
					self.log('error', `Error setting message: ${error.message}`)
				}
			},
		},
	})
}
