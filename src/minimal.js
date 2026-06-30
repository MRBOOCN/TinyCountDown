const x = {
	a: 1,
	b: {
		c: 2,
	},
}

function f(obj) {}

f({
	start_stop_countdown: {
		name: 'x',
		options: [],
		callback: async (action) => {
			let command
			switch (action.op) {
				case 'toggle':
					command = 'stop'
					break
			}
			await command
		},
	},
	set_ndi_fps: {
		name: 'NDI',
		options: [],
		callback: async () => {},
	},
})
