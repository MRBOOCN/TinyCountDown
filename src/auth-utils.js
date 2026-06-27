// 认证相关通用工具函数

/**
 * 校验用户名/密码是否满足基本提交要求
 * @param {string} username
 * @param {string} password
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validateCredentials(username, password) {
	const u = (username || '').trim()
	const p = password || ''

	if (!u) {
		return { valid: false, message: '用户名不能为空，请在模块配置中填写用户名后保存' }
	}
	if (!p) {
		return { valid: false, message: '密码不能为空，请在模块配置中填写密码后保存' }
	}
	if (p.trim().length === 0) {
		return { valid: false, message: '密码不能仅包含空格，请重新输入' }
	}

	return { valid: true }
}

/**
 * 构造带 token 的 WebSocket URL
 * @param {string} protocol - 'ws:' 或 'wss:'
 * @param {string} host
 * @param {number} port
 * @param {string|null} token
 * @returns {string}
 */
export function buildWebSocketUrl(protocol, host, port, token) {
	let url = `${protocol}//${host}`
	if (port > 0) {
		url += `:${port}`
	}
	url += '/ws'
	if (token) {
		url += `?token=${encodeURIComponent(token)}`
	}
	return url
}

