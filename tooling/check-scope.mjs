import { execFileSync } from 'node:child_process'

const scopeRules = {
	'feat/auth': ['layers/auth/'],
	'feat/device': ['layers/device/'],
	'feat/telemetry': ['layers/telemetry/', 'scripts/simulator/'],
	'feat/dashboard': ['layers/dashboard/'],
}

function git(args) {
	return execFileSync('git', args, {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore'],
	}).trim()
}

function currentBranch() {
	return git(['branch', '--show-current'])
}

function changedFiles() {
	const files = new Set()
	const addFiles = (args) => {
		try {
			for (const file of git(args).split('\n').filter(Boolean)) files.add(file)
			return true
		} catch {
			// 某个比较基线不存在时由调用方继续尝试，首次提交前属于正常情况。
			return false
		}
	}

	for (const base of ['origin/main', 'main']) {
		if (addFiles(['diff', '--name-only', '--diff-filter=ACMRD', `${base}...HEAD`])) break
	}

	addFiles(['diff', '--name-only', '--diff-filter=ACMRD'])
	addFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMRD'])
	addFiles(['ls-files', '--others', '--exclude-standard'])

	return [...files]
}

const branch = currentBranch()
const allowedPrefixes = scopeRules[branch]

if (!allowedPrefixes) {
	if (branch === 'main' || branch.startsWith('chore/') || branch.startsWith('contract/')) {
		console.log(
			`scope:check 跳过范围校验：${branch} 仅可由组长按 Gitee 审批流程维护，不能据此视为已获授权。`,
		)
		process.exit(0)
	}

	console.error(`scope:check 不认识分支 ${branch}。请使用四个固定 feat 分支或组长维护分支。`)
	process.exit(1)
}

const files = changedFiles()
const violations = files.filter(
	(file) => !allowedPrefixes.some((prefix) => file.startsWith(prefix)),
)

if (violations.length > 0) {
	console.error(`分支 ${branch} 存在越界修改：`)
	for (const file of violations) console.error(`- ${file}`)
	console.error(`允许范围：${allowedPrefixes.join('、')}`)
	process.exit(1)
}

console.log(`scope:check 通过：${branch} 的 ${files.length} 个改动文件均在允许范围内。`)
