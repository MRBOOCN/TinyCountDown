// Shared constants used across the Companion module.

export const COLORS = {
	white: 0xFFFFFF,
	black: 0x000000,
	green: 0x3FD63F,
	red: 0xFF0000,
	yellow: 0xFFD700,
}

export const RESOLUTION_CHOICES = [
	{ id: '-1', label: 'Default' },
	{ id: '0', label: '1366 x 768' },
	{ id: '1', label: '1920 x 1080' },
	{ id: '2', label: '2560 x 1440' },
	{ id: '3', label: '3840 x 2160' },
]

export const RESOLUTION_MAP = Object.fromEntries(RESOLUTION_CHOICES.map((choice) => [choice.id, choice.label]))