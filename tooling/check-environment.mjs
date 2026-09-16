import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const requiredFailures = []

function run(command, args) {
	try {
		return execFileSync(command, args, {
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'pipe'],
		}).trim()
	} catch {
		return null
	}
}

function report(level, label, detail) {
	console.log(`${level.padEnd(4)} ${label}: ${detail}`)
}

function requireCheck(label, detail, passed) {
	report(passed ? 'PASS' : 'FAIL', label, detail)
	if (!passed) requiredFailures.push(label)
}

const nodeMajor = Number(process.versions.node.split('.')[0])
requireCheck('Node.js', `${process.version}，要求 24.x`, nodeMajor === 24)

const pnpmVersion = run('pnpm', ['--version'])
requireCheck('pnpm', `${pnpmVersion ?? '未找到'}，要求 11.24.0`, pnpmVersion === '11.24.0')

const gitVersion = run('git', ['--version'])
requireCheck('Git', gitVersion ?? '未找到', Boolean(gitVersion))

const envExists = existsSync('.env')
const hasDatabaseUrl = envExists
	? /^\s*DATABASE_URL\s*=\s*['"]?\S+/m.test(readFileSync('.env', 'utf8'))
	: false
report(
	envExists && hasDatabaseUrl ? 'PASS' : 'WARN',
	'.env',
	envExists
		? hasDatabaseUrl
			? '已找到 DATABASE_URL（不会显示其值）'
			: '已找到但缺少 DATABASE_URL；请检查 .env'
		: '未找到；首次启动请从 .env.example 复制',
)

const dockerVersion = run('docker', ['compose', 'version'])
report(
	dockerVersion ? 'PASS' : 'INFO',
	'Docker Compose',
	dockerVersion ?? '未找到；可按 docs/environment-setup.md 使用原生 MySQL 8.4 兜底',
)

const dockerServerVersion = dockerVersion
	? run('docker', ['info', '--format', '{{.ServerVersion}}'])
	: null
report(
	dockerServerVersion ? 'PASS' : 'INFO',
	'Docker daemon',
	dockerVersion
		? dockerServerVersion
			? `可连接，Server ${dockerServerVersion}`
			: 'Docker Desktop 未启动或 daemon 不可连接；启动后再执行 docker compose up -d'
		: '未检查；Docker 路径不可用时可使用原生 MySQL 8.4 兜底',
)

const pythonCommand = run('python3', ['--version']) ? 'python3' : 'python'
const pythonVersion = run(pythonCommand, ['--version'])
const pythonMatch = pythonVersion?.match(/(\d+)\.(\d+)/)
const pythonSupported = Boolean(
	pythonMatch &&
	(Number(pythonMatch[1]) > 3 || (Number(pythonMatch[1]) === 3 && Number(pythonMatch[2]) >= 11)),
)
report(
	pythonSupported ? 'PASS' : pythonVersion ? 'WARN' : 'INFO',
	'Python',
	pythonVersion
		? `${pythonVersion}${pythonSupported ? '' : '；telemetry 组要求 3.11+'}`
		: '仅 telemetry 组需要 Python 3.11+ 与 requests',
)

const requestsVersion = pythonSupported
	? run(pythonCommand, ['-c', 'import requests; print(requests.__version__)'])
	: null
report(
	requestsVersion ? 'PASS' : 'INFO',
	'Python requests',
	requestsVersion
		? `已找到 ${requestsVersion}`
		: '仅 telemetry 组需要；进入模拟器任务前安装 requests',
)

console.log(
	'\n数据库标准路径：Docker Compose；Docker 不可用时，按 docs/environment-setup.md 配置原生 MySQL 8.4。',
)

if (requiredFailures.length > 0) {
	console.error(`\n缺少必需环境：${requiredFailures.join('、')}`)
	process.exitCode = 1
}
