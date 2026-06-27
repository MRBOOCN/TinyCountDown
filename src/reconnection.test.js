import assert from 'assert'
import {
	RECONNECT_DELAYS,
	MAX_TOKEN_RECONNECT_ATTEMPTS,
	computeReconnectDelay,
	isNetworkError,
	isTokenInvalidated,
	createAbortableTimeout,
} from './reconnection.js'
import { TinyCountdownInstance } from './main.js'

async function test(name, fn) {
	try {
		await fn()
		console.log(`  PASS: ${name}`)
	} catch (error) {
		console.error(`  FAIL: ${name}`)
		console.error(`    ${error.message}`)
		process.exitCode = 1
	}
}

function createTestInstance() {
	const instance = Object.create(TinyCountdownInstance.prototype)
	instance.isInitialized = true
	instance.config = { reconnect: true }
	instance.isAuthenticated = false
	instance.authToken = null
	instance.reconnectAttempt = 0
	instance.reconnectTimeout = null
	instance.closingIntentionally = false
	instance.isAuthenticating = false
	instance.isConnecting = false
	instance.variables = {}
	instance.status = null
	instance.statusMessage = null
	instance.log = () => {}
	instance.updateStatus = (status, message) => {
		instance.status = status
		instance.statusMessage = message
	}
	instance.setVariableValues = (values) => {
		Object.assign(instance.variables, values)
	}
	instance.checkFeedbacks = () => {}
	return instance
}

async function runTests() {
	console.log('Running reconnection policy tests...')

	// --- Pure helper tests from reconnection.js ---

	await test('computeReconnectDelay follows the exponential backoff table', () => {
		for (let i = 1; i <= RECONNECT_DELAYS.length; i++) {
			assert.strictEqual(computeReconnectDelay(i), RECONNECT_DELAYS[i - 1])
		}
		assert.strictEqual(computeReconnectDelay(RECONNECT_DELAYS.length + 5), RECONNECT_DELAYS.at(-1))
	})

	await test('isNetworkError recognizes explicit network error codes', () => {
		assert.strictEqual(isNetworkError(new Error('connect ECONNREFUSED')), true)
		assert.strictEqual(isNetworkError(new Error('getaddrinfo ENOTFOUND')), true)
		assert.strictEqual(isNetworkError(new Error('socket ETIMEDOUT')), true)
	})

	await test('isNetworkError recognizes fetch and abort failures', () => {
		assert.strictEqual(isNetworkError(new Error('fetch failed')), true)
		assert.strictEqual(isNetworkError(new Error('The operation was aborted')), true)
		assert.strictEqual(isNetworkError({ name: 'AbortError' }), true)
		assert.strictEqual(isNetworkError({ name: 'TypeError' }), true)
	})

	await test('isNetworkError rejects configuration-like errors', () => {
		assert.strictEqual(isNetworkError(new Error('用户名或密码错误')), false)
		assert.strictEqual(isNetworkError(new Error('Invalid JSON')), false)
		assert.strictEqual(isNetworkError({ cause: { code: 'UNKNOWN' } }), false)
	})

	await test('isTokenInvalidated detects policy violation close code', () => {
		assert.strictEqual(isTokenInvalidated(1008, ''), true)
	})

	await test('isTokenInvalidated detects token-related reasons', () => {
		assert.strictEqual(isTokenInvalidated(-1, 'Token invalidated'), true)
		assert.strictEqual(isTokenInvalidated(-1, 'invalid token'), true)
	})

	await test('isTokenInvalidated returns false for normal closes', () => {
		assert.strictEqual(isTokenInvalidated(1001, 'Server stopping'), false)
		assert.strictEqual(isTokenInvalidated(1006, ''), false)
	})

	await test('createAbortableTimeout aborts after the given duration', () => {
		return new Promise((resolve) => {
			let aborted = false
			const { signal, clear } = createAbortableTimeout(50, () => {
				aborted = true
			})

			assert.strictEqual(signal.aborted, false)

			setTimeout(() => {
				assert.strictEqual(aborted, true)
				assert.strictEqual(signal.aborted, true)
				clear() // no-op after firing, should not throw
				resolve()
			}, 100)
		})
	})

	await test('createAbortableTimeout can be cleared', () => {
		let aborted = false
		const { signal, clear } = createAbortableTimeout(50, () => {
			aborted = true
		})
		clear()
		assert.strictEqual(signal.aborted, false)
		assert.strictEqual(aborted, false)
	})

	// --- Instance-level integration tests ---

	await test('scheduleReconnect increments attempt and uses exponential delays', () => {
		const instance = createTestInstance()

		const delays = []
		const originalSetTimeout = global.setTimeout
		global.setTimeout = (cb, delay) => {
			delays.push(delay)
			return { unref: () => {} }
		}

		for (let i = 0; i < RECONNECT_DELAYS.length + 1; i++) {
			instance.scheduleReconnect()
		}

		global.setTimeout = originalSetTimeout

		assert.deepStrictEqual(delays, [...RECONNECT_DELAYS, RECONNECT_DELAYS.at(-1)])
		assert.strictEqual(instance.reconnectAttempt, RECONNECT_DELAYS.length + 1)
	})

	await test('scheduleReconnect with explicit delay does not increment attempt', () => {
		const instance = createTestInstance()

		const delays = []
		const originalSetTimeout = global.setTimeout
		global.setTimeout = (cb, delay) => {
			delays.push(delay)
			return { unref: () => {} }
		}

		instance.reconnectAttempt = 2
		instance.scheduleReconnect(0, 'immediate')

		global.setTimeout = originalSetTimeout

		assert.deepStrictEqual(delays, [0])
		assert.strictEqual(instance.reconnectAttempt, 2)
	})

	await test('scheduleReconnectFromClose resets auth on token invalidated close code', () => {
		const instance = createTestInstance()
		instance.isAuthenticated = true
		instance.authToken = 'old-token'

		const delays = []
		const originalSetTimeout = global.setTimeout
		global.setTimeout = (cb, delay) => {
			delays.push(delay)
			return { unref: () => {} }
		}

		instance.scheduleReconnectFromClose(1008, 'Token invalidated')

		global.setTimeout = originalSetTimeout

		assert.strictEqual(instance.isAuthenticated, false)
		assert.strictEqual(instance.authToken, null)
		assert.deepStrictEqual(delays, [0])
	})

	await test('scheduleReconnectFromClose uses fast reconnect when token valid and first attempt', () => {
		const instance = createTestInstance()
		instance.isAuthenticated = true
		instance.authToken = 'valid-token'
		instance.reconnectAttempt = 0

		const delays = []
		const originalSetTimeout = global.setTimeout
		global.setTimeout = (cb, delay) => {
			delays.push(delay)
			return { unref: () => {} }
		}

		instance.scheduleReconnectFromClose(1006, '')

		global.setTimeout = originalSetTimeout

		// Token should still be valid, fast reconnect with 0ms delay
		assert.strictEqual(instance.isAuthenticated, true)
		assert.strictEqual(instance.authToken, 'valid-token')
		// reconnectAttempt must be incremented to 1 to prevent infinite fast-retry loop
		assert.strictEqual(instance.reconnectAttempt, 1)
		assert.deepStrictEqual(delays, [0])
	})

	await test('scheduleReconnectFromClose falls back to exponential backoff after fast reconnect fails', () => {
		const instance = createTestInstance()
		instance.isAuthenticated = true
		instance.authToken = 'valid-token'
		instance.reconnectAttempt = 1  // Simulate fast reconnect already attempted

		const delays = []
		const originalSetTimeout = global.setTimeout
		global.setTimeout = (cb, delay) => {
			delays.push(delay)
			return { unref: () => {} }
		}

		instance.scheduleReconnectFromClose(1006, '')

		global.setTimeout = originalSetTimeout

		// After fast reconnect failed, should use exponential backoff
		// reconnectAttempt is 1, scheduleReconnect(-1) increments to 2 -> RECONNECT_DELAYS[1] = 500ms
		assert.strictEqual(instance.isAuthenticated, true)
		assert.strictEqual(instance.authToken, 'valid-token')
		assert.strictEqual(instance.reconnectAttempt, 2)
		assert.deepStrictEqual(delays, [RECONNECT_DELAYS[1]])
	})

	await test('scheduleReconnectFromClose resets auth after max token reconnect attempts', () => {
		const instance = createTestInstance()
		instance.isAuthenticated = true
		instance.authToken = 'old-token'
		instance.reconnectAttempt = MAX_TOKEN_RECONNECT_ATTEMPTS

		const delays = []
		const originalSetTimeout = global.setTimeout
		global.setTimeout = (cb, delay) => {
			delays.push(delay)
			return { unref: () => {} }
		}

		instance.scheduleReconnectFromClose(1006, '')

		global.setTimeout = originalSetTimeout

		assert.strictEqual(instance.isAuthenticated, false)
		assert.strictEqual(instance.authToken, null)
		assert.deepStrictEqual(delays, [0])
	})

	await test('executeReconnect chooses authenticate when not authenticated', () => {
		const instance = createTestInstance()
		instance.isAuthenticated = false

		let authCalled = false
		instance.authenticate = () => {
			authCalled = true
		}
		instance.setupWebSocket = () => {
			assert.fail('setupWebSocket should not be called')
		}

		instance.executeReconnect()
		assert.strictEqual(authCalled, true)
	})

	await test('executeReconnect chooses setupWebSocket when authenticated', () => {
		const instance = createTestInstance()
		instance.isAuthenticated = true

		let wsCalled = false
		instance.authenticate = () => {
			assert.fail('authenticate should not be called')
		}
		instance.setupWebSocket = () => {
			wsCalled = true
		}

		instance.executeReconnect()
		assert.strictEqual(wsCalled, true)
	})

	await test('setupWebSocket ignores concurrent connection attempts', () => {
		const instance = createTestInstance()
		instance.isAuthenticated = true
		instance.isConnecting = true

		let wsCalled = false
		instance.closeWebSocketIntentionally = () => {}
		instance.stopReconnect = () => {}

		const OriginalWebSocket = global.WebSocket
		global.WebSocket = function () {
			wsCalled = true
		}

		instance.setupWebSocket()
		global.WebSocket = OriginalWebSocket

		assert.strictEqual(wsCalled, false)
		assert.strictEqual(instance.isConnecting, true)
	})

	console.log('Done.')
}

runTests()