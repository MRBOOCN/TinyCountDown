// Shared constants used across the Companion module.

export const COLORS = {
	white: 0xFFFFFF,
	black: 0x000000,
	green: 0x3FD63F,
	red: 0xFF0000,
	yellow: 0xFFD700,
}

export const RESOLUTION_MAP = {
	'-1': 'Default',
	'0': '1366 x 768',
	'1': '1920 x 1080',
	'2': '2560 x 1440',
	'3': '3840 x 2160',
}

export const RESOLUTION_CHOICES = [
	{ id: '-1', label: 'Default' },
	{ id: '0', label: '1366 x 768' },
	{ id: '1', label: '1920 x 1080' },
	{ id: '2', label: '2560 x 1440' },
	{ id: '3', label: '3840 x 2160' },
]

export const MODE_MAP = {
	countdown: '倒计时',
	countup: '正计时',
	time: '时间',
}

export const MODE_CHOICES = [
	{ id: 'toggle', label: '切换' },
	{ id: 'countdown', label: '倒计时' },
	{ id: 'countup', label: '正计时' },
	{ id: 'time', label: '时间' },
]

export const MODE_STATUS_CHOICES = [
	{ id: 'countdown', label: '倒计时' },
	{ id: 'countup', label: '正计时' },
	{ id: 'time', label: '时间' },
]

export const FPS_MAP = {
	'60': '60p',
	'30': '30p',
	'15': '15p',
	'10': '10p',
}

export const FPS_CHOICES = [
	{ id: '60', label: '60p' },
	{ id: '30', label: '30p' },
	{ id: '15', label: '15p' },
	{ id: '10', label: '10p' },
]

export const FPS_STATUS_CHOICES = [
	{ id: '60', label: '60p' },
	{ id: '30', label: '30p' },
	{ id: '15', label: '15p' },
	{ id: '10', label: '10p' },
]