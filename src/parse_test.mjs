import vm from 'vm'
import fs from 'fs'

const src = fs.readFileSync(new URL('./main_test.js', import.meta.url), 'utf8')
try {
	// eslint-disable-next-line no-new
	new vm.SourceTextModule(src)
	console.log('parse ok')
} catch (e) {
	console.error('parse error:', e.message)
	if (e.stack) console.error(e.stack.split('\n').slice(0, 4).join('\n'))
}
