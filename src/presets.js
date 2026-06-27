/**
 * Preset definitions for TinyCountdown module
 */

import { COLORS, RESOLUTION_MAP } from './constants.js'

const SIZES = {
	default: '24',
	small: '18',
	resolution: '12',
}

const RESOLUTION_PRESET_IDS = {
	'-1': 'default',
	'0': '1366',
	'1': '1920',
	'2': '2560',
	'3': '3840',
}

function createActionPreset({ category, name, text, size, actionId, options, feedbackId, feedbackOptions, activeStyle = {} }) {
	const preset = {
		type: 'button',
		category,
		name,
		style: {
			text,
			size: size || SIZES.default,
			color: COLORS.white,
			bgcolor: COLORS.black,
		},
		steps: [
			{
				down: actionId ? [{ actionId, options: options || {} }] : [],
				up: [],
			},
		],
		feedbacks: [],
	}
	if (feedbackId) {
		preset.feedbacks.push({
			feedbackId,
			options: feedbackOptions || {},
			style: {
				color: activeStyle.color ?? COLORS.black,
				bgcolor: activeStyle.bgcolor ?? COLORS.green,
			},
		})
	}
	return preset
}

function createTimePreset(id, text, minutes, presets) {
	presets[id] = createActionPreset({
		category: '常用时间',
		name: '',
		text,
		size: SIZES.default,
		actionId: 'set_time',
		options: { hours: 0, minutes, seconds: 0 },
	})
}

/**
 * Get all preset definitions
 * @param {any} instance - The module instance
 * @returns {Object} Preset definitions object
 */
export function GetPresetsList(instance) {
	const presets = {}

	// ==================== 常用时间 ====================
	createTimePreset('time_1min', '1:00', 1, presets)
	createTimePreset('time_3min', '3:00', 3, presets)
	createTimePreset('time_5min', '5:00', 5, presets)
	createTimePreset('time_10min', '10:00', 10, presets)

	// ==================== 功能控制 ====================
	// 开始
	presets['start'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '开始',
		size: SIZES.small,
		actionId: 'start_stop_countdown',
		options: { operation: 'start' },
		feedbackId: 'start_stop_countdown',
		feedbackOptions: {},
	})

	// 停止
	presets['stop'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '停止',
		size: SIZES.small,
		actionId: 'start_stop_countdown',
		options: { operation: 'stop' },
		feedbackId: 'stop_countdown',
		feedbackOptions: {},
		activeStyle: {
			bgcolor: COLORS.red,
			color: COLORS.white,
		},
	})

	// 重置
	presets['reset'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '重置',
		size: SIZES.small,
		actionId: 'reset_countdown',
		options: {},
	})

	// 全屏
	presets['fullscreen'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '全屏',
		size: SIZES.small,
		actionId: 'toggle_fullscreen',
		options: { operation: 'toggle' },
		feedbackId: 'fullscreen_status',
		feedbackOptions: {},
	})

	// 置顶
	presets['top'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '置顶',
		size: SIZES.small,
		actionId: 'toggle_top',
		options: { operation: 'toggle' },
		feedbackId: 'top_status',
		feedbackOptions: {},
	})

	// 闪烁
	presets['blink'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '闪烁',
		size: SIZES.small,
		actionId: 'toggle_blink',
		options: { operation: 'toggle' },
		feedbackId: 'blink_status',
		feedbackOptions: {},
	})

	// 窗口（合并显示/隐藏）
	presets['window'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '窗口',
		size: SIZES.small,
		actionId: 'toggle_window',
		options: { operation: 'toggle' },
		feedbackId: 'window_visible',
		feedbackOptions: {},
	})

	// 时间 +
	presets['time_add'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '时间+',
		size: SIZES.small,
		actionId: 'adjust_time',
		options: { operation: 'add', hours: 0, minutes: 1, seconds: 0 },
	})

	// 时间 -
	presets['time_sub'] = createActionPreset({
		category: '功能控制',
		name: '',
		text: '时间-',
		size: SIZES.small,
		actionId: 'adjust_time',
		options: { operation: 'subtract', hours: 0, minutes: 1, seconds: 0 },
	})

	// 分辨率当前标签（动态显示当前分辨率名称）
	presets['resolution_label'] = {
		type: 'button',
		category: '分辨率',
		name: '',
		style: {
			text: '$(Tinycountdown:resolutionLabel)',
			size: SIZES.resolution,
			color: COLORS.white,
			bgcolor: COLORS.black,
		},
		steps: [],
		feedbacks: [],
	}

	// 分辨率按钮循环生成
	for (const [resolutionId, label] of Object.entries(RESOLUTION_MAP)) {
		presets[`resolution_${RESOLUTION_PRESET_IDS[resolutionId]}`] = createActionPreset({
			category: '分辨率',
			name: '',
			text: label.replace(/\s/g, ''),
			size: SIZES.resolution,
			actionId: 'set_resolution',
			options: { resolution: resolutionId },
			feedbackId: 'resolution_status',
			feedbackOptions: { resolution: resolutionId },
		})
	}

	// NDI 切换
	presets['ndi_toggle'] = createActionPreset({
		category: 'NDI',
		name: '',
		text: 'NDI',
		size: SIZES.small,
		actionId: 'toggle_ndi',
		options: { operation: 'toggle' },
		feedbackId: 'ndi_status',
		feedbackOptions: {},
	})

	// ==================== 状态显示 ====================
	// 46:13 (分：秒格式)
	presets['display_mmss'] = {
		type: 'button',
		category: '状态显示',
		name: '',
		style: {
			text: '$(Tinycountdown:time)',
			color: COLORS.white,
			bgcolor: COLORS.black,
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
			text: '$(Tinycountdown:remainingTimeFormatted)',
			size: '15',
			color: COLORS.white,
			bgcolor: COLORS.black,
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
			text: '$(Tinycountdown:port)',
			size: 'auto',
			color: COLORS.white,
			bgcolor: COLORS.black,
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
