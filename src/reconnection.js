// Reconnection policy constants and pure helpers for the Companion module.
// Keeping this logic in a separate file makes it easy to unit-test without
// pulling in the full InstanceBase runtime.

export const RECONNECT_DELAYS = [200, 500, 1000, 2000, 5000]
export const WS_CONNECTION_TIMEOUT = 3000
export const LOGIN_TIMEOUT = 3000
export const WS_CLOSE_POLICY_VIOLATION = 1008
export const MAX_TOKEN_RECONNECT_ATTEMPTS = 2

/**
 * Pick the next reconnect delay from the exponential-backoff table.
 * @param {number} attempt - 1-based attempt counter.
 * @returns {number} delay in milliseconds.
 */
export function computeReconnectDelay(attempt) {
	return RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length) - 1]
}

/**
 * Determine whether an error represents a transient network problem that
 * should be retried, as opposed to a configuration or authentication error.
 * @param {Error|object} error
 * @returns {boolean}
 */
export function isNetworkError(error) {
	const networkErrorCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN']
	const message = error?.message || ''
	if (networkErrorCodes.some((code) => message.includes(code))) {
		return true
	}

	const retryableMessages = ['fetch failed', 'aborted', 'networkerror', 'network error']
	if (retryableMessages.some((text) => message.toLowerCase().includes(text))) {
		return true
	}

	if (error?.name === 'AbortError' || error?.name === 'TypeError') {
		return true
	}

	const causeCode = error?.cause?.code
	return causeCode !== undefined && networkErrorCodes.includes(causeCode)
}

/**
 * Check whether a WebSocket close frame indicates the token was rejected.
 * @param {number} closeCode
 * @param {string} closeReason
 * @returns {boolean}
 */
export function isTokenInvalidated(closeCode, closeReason) {
	if (closeCode === WS_CLOSE_POLICY_VIOLATION) {
		return true
	}
	const reason = (closeReason || '').toLowerCase()
	return reason.includes('token') || reason.includes('invalid')
}

/**
 * Create an AbortController that aborts after a fixed timeout.
 * Returns both the signal and a cleanup function to clear the timer.
 * @param {number} timeoutMs
 * @param {() => void} onAbort
 * @returns {{ signal: AbortSignal, clear: () => void }}
 */
export function createAbortableTimeout(timeoutMs, onAbort) {
	const controller = new AbortController()
	const timer = setTimeout(() => {
		onAbort()
		controller.abort()
	}, timeoutMs)
	return {
		signal: controller.signal,
		timer,
		clear: () => clearTimeout(timer),
	}
}
