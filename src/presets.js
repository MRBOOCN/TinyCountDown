/**
 * Preset definitions for TinyCountdown module
 */

/**
 * Get all preset definitions
 * @param {any} instance - The module instance
 * @returns {Object} Preset definitions object
 */
export function GetPresetsList(instance) {
	const presets = {}

	// ==================== 常用时间 ====================
	// 1:00
	presets['time_1min'] = {
		type: 'button',
		category: '常用时间',
		name: '',
		style: {
			text: '1:00',
			size: '24',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'set_time',
						options: { hours: 0, minutes: 1, seconds: 0 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// 3:00
	presets['time_3min'] = {
		type: 'button',
		category: '常用时间',
		name: '',
		style: {
			text: '3:00',
			size: '24',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'set_time',
						options: { hours: 0, minutes: 3, seconds: 0 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// 5:00
	presets['time_5min'] = {
		type: 'button',
		category: '常用时间',
		name: '',
		style: {
			text: '5:00',
			size: '24',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'set_time',
						options: { hours: 0, minutes: 5, seconds: 0 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// 10:00
	presets['time_10min'] = {
		type: 'button',
		category: '常用时间',
		name: '',
		style: {
			text: '10:00',
			size: '24',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'set_time',
						options: { hours: 0, minutes: 10, seconds: 0 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// ==================== 功能控制 ====================
	// 开始
	presets['start'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '开始',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'start_stop_countdown',
						options: { operation: 'start' },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'start_stop_countdown',
				options: {},
				style: {
					color: 4183615, // #3FD63F 绿色
				},
			},
		],
	}

	// 停止
	presets['stop'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '停止',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'start_stop_countdown',
						options: { operation: 'stop' },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'stop_countdown',
				options: {},
				style: {
					color: 16711680, // #FF0000 红色
				},
			},
		],
	}

	// 重置
	presets['reset'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '重置',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'reset_countdown',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// 全屏
	presets['fullscreen'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '全屏',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_fullscreen',
						options: { operation: 'toggle' },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'fullscreen_status',
				options: {},
				style: {
					color: 0,
					bgcolor: 4183615,
				},
			},
		],
	}

	// 置顶
	presets['top'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '置顶',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_top',
						options: { operation: 'toggle' },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'top_status',
				options: {},
				style: {
					color: 0,
					bgcolor: 4183615,
				},
			},
		],
	}

	// 闪烁
	presets['blink'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '闪烁',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_blink',
						options: { operation: 'toggle' },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'blink_status',
				options: {},
				style: {
					color: 0,
					bgcolor: 4183615,
				},
			},
		],
	}

	// 窗口（合并显示/隐藏）
	presets['window'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '窗口',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_window',
						options: { operation: 'toggle' },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'window_visible',
				options: {},
				style: {
					color: 0,
					bgcolor: 4183615,
				},
			},
		],
	}

	// 时间 +
	presets['time_add'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '时间+',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjust_time',
						options: { operation: 'add', hours: 0, minutes: 1, seconds: 0 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// 时间 -
	presets['time_sub'] = {
		type: 'button',
		category: '功能控制',
		name: '',
		style: {
			text: '时间-',
			size: '18',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjust_time',
						options: { operation: 'subtract', hours: 0, minutes: 1, seconds: 0 },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// ==================== 状态显示 ====================
	// 46:13 (分：秒格式)
	presets['display_mmss'] = {
		type: 'button',
		category: '状态显示',
		name: '',
		style: {
			text: '$(TinyCountdown:time)',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [],
		feedbacks: [],
	}

	// 46:13 (时：分：秒格式)
	presets['display_hhmmss'] = {
		type: 'button',
		category: '状态显示',
		name: '',
		style: {
			text: '$(TinyCountdown:remainingTimeFormatted)',
			size: '15',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [],
		feedbacks: [],
	}

	// 2773 (端口号)
	presets['display_port'] = {
		type: 'button',
		category: '状态显示',
		name: '',
		style: {
			text: '$(TinyCountdown:port)',
			size: 'auto',
			color: 16777215,
			bgcolor: 0,
		},
		steps: [],
		feedbacks: [],
	}

	return presets
}

/**
 * Load presets into the instance
 * @param {any} instance - The module instance
 */
export function LoadPresets(instance) {
	instance.setPresetDefinitions(GetPresetsList(instance))
}
