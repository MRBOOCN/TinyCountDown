export default [
	{
		files: ['src/**/*.js'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				console: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				fetch: 'readonly',
				WebSocket: 'readonly',
			},
		},
		rules: {
			'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
			'no-unreachable': 'warn',
			'no-constant-condition': 'warn',
			'no-empty': 'warn',
			'no-var': 'warn',
			'prefer-const': 'warn',
			'no-dupe-keys': 'error',
			'no-duplicate-imports': 'warn',
		},
	},
]
