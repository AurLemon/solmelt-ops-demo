import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const simulatorPath = resolve(repositoryRoot, 'scripts/simulator/simulate.py')
const virtualEnvironmentRoot = resolve(repositoryRoot, 'scripts/simulator/.venv')
const pythonCandidates =
	process.platform === 'win32'
		? [
				resolve(virtualEnvironmentRoot, 'Scripts/python.exe'),
				resolve(virtualEnvironmentRoot, 'Scripts/python.bat'),
			]
		: [resolve(virtualEnvironmentRoot, 'bin/python')]

function findVirtualEnvironmentPython() {
	return pythonCandidates.find((candidate) => existsSync(candidate))
}

function run(command, args) {
	return new Promise((resolvePromise) => {
		const child = spawn(command, args, { stdio: 'inherit' })
		child.on('error', (error) => {
			console.error(`命令启动失败：${error.message}`)
			resolvePromise(1)
		})
		child.on('exit', (code) => resolvePromise(code ?? 1))
	})
}

async function setupVirtualEnvironment() {
	const bootstrap = process.platform === 'win32' ? 'python' : 'python3'
	const createEnvironment = await run(bootstrap, ['-m', 'venv', virtualEnvironmentRoot])
	if (createEnvironment !== 0) return createEnvironment

	const pythonPath = findVirtualEnvironmentPython()
	if (!pythonPath) {
		console.error('虚拟环境创建后仍未找到 Python。')
		return 1
	}

	return run(pythonPath, ['-m', 'pip', 'install', 'requests'])
}

const rawArgs = process.argv.slice(2)
const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs

if (args[0] === '--setup') {
	process.exitCode = await setupVirtualEnvironment()
} else {
	const pythonPath = findVirtualEnvironmentPython()

	if (!pythonPath) {
		console.error('未找到 scripts/simulator/.venv 中的 Python。请先执行：pnpm simulator:setup')
		process.exitCode = 1
	} else {
		process.exitCode = await run(pythonPath, [simulatorPath, ...args])
	}
}
