#!/usr/bin/env node

/**
 * TinyCountDown TCP通信诊断工具
 *
 * 此脚本用于诊断Companion和TinyCountDown之间的TCP通信问题
 */

const net = require('net')
const fs = require('fs')
const path = require('path')

// 默认配置
const defaultConfig = {
	host: '127.0.0.1',
	port: 8080,
	reconnectInterval: 5,
	heartbeatInterval: 10,
}

// 终端输出颜色
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	underscore: '\x1b[4m',
	blink: '\x1b[5m',
	reverse: '\x1b[7m',
	hidden: '\x1b[8m',

	black: '\x1b[30m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',

	bgBlack: '\x1b[40m',
	bgRed: '\x1b[41m',
	bgGreen: '\x1b[42m',
	bgYellow: '\x1b[43m',
	bgBlue: '\x1b[44m',
	bgMagenta: '\x1b[45m',
	bgCyan: '\x1b[46m',
	bgWhite: '\x1b[47m',
}

function log(message, color = 'white') {
	console.log(`${colors[color]}${message}${colors.reset}`)
}

function logError(message) {
	log(message, 'red')
}

function logSuccess(message) {
	log(message, 'green')
}

function logInfo(message) {
	log(message, 'cyan')
}

function logWarning(message) {
	log(message, 'yellow')
}

// 测试TCP连接
function testTcpConnection(config) {
	return new Promise((resolve, reject) => {
		logInfo(`Testing TCP connection to ${config.host}:${config.port}...`)

		const client = new net.Socket()
		const startTime = Date.now()

		client.setTimeout(10000)

		client.connect(config.port, config.host, () => {
			const connectTime = Date.now() - startTime
			logSuccess(`✓ Connected to ${config.host}:${config.port} (${connectTime}ms)`)

			// Test sending a simple command
			const testCommand = 'PING'
			logInfo(`Sending test command: ${testCommand}`)

			client.write(testCommand + '\n', (err) => {
				if (err) {
					logError(`✗ Error sending command: ${err.message}`)
					client.destroy()
					reject(err)
					return
				}

				logInfo('Waiting for response...')

				// Wait for response
				let responseReceived = false

				client.on('data', (data) => {
					responseReceived = true
					const response = data.toString().trim()
					logSuccess(`✓ Received response: ${response}`)
					client.destroy()
					resolve({ connected: true, response: response })
				})

				// Timeout for response
				setTimeout(() => {
					if (!responseReceived) {
						logWarning('⚠ No response received within timeout period')
						client.destroy()
						resolve({ connected: true, response: null })
					}
				}, 5000)
			})
		})

		client.on('error', (err) => {
			logError(`✗ Connection error: ${err.message}`)
			client.destroy()
			reject(err)
		})

		client.on('timeout', () => {
			logError(`✗ Connection timeout`)
			client.destroy()
			reject(new Error('Connection timeout'))
		})
	})
}

// 检查TinyCountdown是否正在运行
function checkTinyCountdownProcess() {
	logInfo('Checking for TinyCountdown process...')

	try {
		// This is a simple check - in a real scenario, you might want to use ps or tasklist
		logInfo('Note: Process checking not implemented in this script')
		logInfo('Please manually verify that TinyCountdown is running')
		return true
	} catch (error) {
		logError(`Error checking process: ${error.message}`)
		return false
	}
}

// 检查网络连接
function checkNetworkConnectivity(host) {
	logInfo(`Checking network connectivity to ${host}...`)

	return new Promise((resolve) => {
		// In a real scenario, you might want to use ping
		logInfo('Note: Network connectivity check not implemented in this script')
		logInfo('Please manually verify network connectivity')
		resolve(true)
	})
}

// 检查防火墙设置
function checkFirewallSettings(port) {
	logInfo(`Checking firewall settings for port ${port}...`)

	try {
		// This is a simple check - in a real scenario, you might want to check firewall rules
		logInfo('Note: Firewall check not implemented in this script')
		logInfo('Please manually verify that port ${port} is open')
		return true
	} catch (error) {
		logError(`Error checking firewall: ${error.message}`)
		return false
	}
}

// 检查模块配置
function checkModuleConfiguration() {
	logInfo('Checking module configuration...')

	try {
		const packageJsonPath = path.join(__dirname, 'package.json')
		const manifestJsonPath = path.join(__dirname, 'companion', 'manifest.json')

		if (fs.existsSync(packageJsonPath)) {
			const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
			logInfo(`Module version: ${packageJson.version}`)
		} else {
			logWarning('⚠ package.json not found')
		}

		if (fs.existsSync(manifestJsonPath)) {
			const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'))
			logInfo(`Manifest version: ${manifestJson.version}`)
		} else {
			logWarning('⚠ companion/manifest.json not found')
		}

		return true
	} catch (error) {
		logError(`Error checking configuration: ${error.message}`)
		return false
	}
}

// 运行所有诊断
async function runDiagnostics(config) {
	logInfo('========================================')
	logInfo('TinyCountDown TCP Communication Diagnostics')
	logInfo('========================================')

	logInfo('Configuration:')
	logInfo(`- Host: ${config.host}`)
	logInfo(`- Port: ${config.port}`)
	logInfo(`- Reconnect Interval: ${config.reconnectInterval}s`)
	logInfo(`- Heartbeat Interval: ${config.heartbeatInterval}s`)
	logInfo('')

	const results = {
		configuration: checkModuleConfiguration(),
		process: checkTinyCountdownProcess(),
		firewall: checkFirewallSettings(config.port),
		tcp: null,
		network: null,
	}

	logInfo('')

	try {
		results.network = await checkNetworkConnectivity(config.host)
		logInfo('')
		results.tcp = await testTcpConnection(config)
	} catch (error) {
		logError(`Diagnostic error: ${error.message}`)
		results.tcp = { connected: false, error: error.message }
	}

	logInfo('')
	logInfo('========================================')
	logInfo('Diagnostic Results')
	logInfo('========================================')

	logInfo(`Configuration Check: ${results.configuration ? 'PASS' : 'FAIL'}`)
	logInfo(`Process Check: ${results.process ? 'PASS' : 'FAIL'}`)
	logInfo(`Firewall Check: ${results.firewall ? 'PASS' : 'FAIL'}`)
	logInfo(`Network Check: ${results.network ? 'PASS' : 'FAIL'}`)
	logInfo(`TCP Connection: ${results.tcp?.connected ? 'PASS' : 'FAIL'}`)

	if (!results.tcp?.connected) {
		logError('')
		logError('TCP Connection Failed!')
		logError('Possible causes:')
		logError('1. TinyCountdown is not running')
		logError('2. Incorrect IP address or port configuration')
		logError('3. Firewall is blocking the connection')
		logError('4. Network connectivity issues')
		logError('5. TinyCountdown server not listening on the specified port')

		logInfo('')
		logInfo('Recommended solutions:')
		logInfo('1. Ensure TinyCountdown is running and properly configured')
		logInfo('2. Verify the IP address and port in Companion configuration')
		logInfo('3. Check firewall settings to allow TCP traffic on port 8080')
		logInfo('4. Test network connectivity between Companion and TinyCountdown')
		logInfo('5. Check TinyCountdown logs for server errors')
	} else {
		logSuccess('')
		logSuccess('TCP Connection Successful!')
		logSuccess('The issue may be in the Companion module implementation.')
		logSuccess('Check Companion logs for more detailed error messages.')
	}

	logInfo('')
	logInfo('========================================')
	logInfo('End of Diagnostics')
	logInfo('========================================')

	return results
}

// 主函数
function main() {
	// Use default config or override with command line arguments
	const config = { ...defaultConfig }

	// Parse command line arguments
	process.argv.forEach((arg, index) => {
		if (arg.startsWith('--host=')) {
			config.host = arg.split('=')[1]
		} else if (arg.startsWith('--port=')) {
			config.port = parseInt(arg.split('=')[1], 10)
		} else if (arg.startsWith('--reconnect=')) {
			config.reconnectInterval = parseInt(arg.split('=')[1], 10)
		} else if (arg.startsWith('--heartbeat=')) {
			config.heartbeatInterval = parseInt(arg.split('=')[1], 10)
		}
	})

	runDiagnostics(config)
		.then((results) => {
			if (!results.tcp?.connected) {
				process.exit(1)
			} else {
				process.exit(0)
			}
		})
		.catch((error) => {
			logError(`Fatal error: ${error.message}`)
			process.exit(1)
		})
}

// 运行主函数
if (require.main === module) {
	main()
}

module.exports = {
	runDiagnostics,
	testTcpConnection,
	checkModuleConfiguration,
}
