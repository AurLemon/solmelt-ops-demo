<script setup lang="ts">
import type { RoleSummary, UserStatus, UserSummary } from '~~/shared/contracts/auth'

definePageMeta({ layout: 'dashboard', permission: 'system:user:read' })

const { user: currentUser, hasPermission, apiFetch } = useAuth()
const canWrite = computed(() => hasPermission('system:user:write'))
const canReadRoles = computed(() => hasPermission('system:role:read'))

const users = ref<UserSummary[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const keyword = ref('')
const roles = ref<RoleSummary[]>([])
const errorMessage = ref('')
const loading = ref(false)

const roleOptions = computed(() =>
	roles.value.map((role) => ({ label: `${role.name}（${role.code}）`, value: role.id })),
)

const editorOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
	username: '',
	password: '',
	displayName: '',
	roleId: 0,
	status: 'ACTIVE' as UserStatus,
})

const resetTarget = ref<UserSummary | null>(null)
const resetPassword = ref('')

function roleLabel(code: string): string {
	return roles.value.find((role) => role.code === code)?.name ?? code
}

async function loadUsers(): Promise<void> {
	loading.value = true
	errorMessage.value = ''
	try {
		const result = await apiFetch<{
			items: UserSummary[]
			total: number
		}>(
			`/api/v1/auth/users?page=${page.value}&pageSize=${pageSize}${keyword.value ? `&keyword=${encodeURIComponent(keyword.value)}` : ''}`,
		)
		users.value = result.items
		total.value = result.total
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '用户列表加载失败'
	} finally {
		loading.value = false
	}
}

async function loadRoles(): Promise<void> {
	if (!canReadRoles.value) return
	try {
		const result = await apiFetch<{ items: RoleSummary[] }>(
			'/api/v1/auth/roles?page=1&pageSize=100',
		)
		roles.value = result.items
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '角色列表加载失败'
	}
}

function openCreate(): void {
	editingId.value = null
	form.value = {
		username: '',
		password: '',
		displayName: '',
		roleId: Number(roles.value[0]?.id ?? 0),
		status: 'ACTIVE',
	}
	editorOpen.value = true
}

function openEdit(target: UserSummary): void {
	editingId.value = Number(target.id)
	form.value = {
		username: target.username,
		password: '',
		displayName: target.displayName,
		roleId: Number(roles.value.find((role) => role.code === target.role)?.id ?? 0),
		status: target.status,
	}
	editorOpen.value = true
}

async function submitEditor(): Promise<void> {
	errorMessage.value = ''
	try {
		if (editingId.value === null) {
			await apiFetch('/api/v1/auth/users', { method: 'POST', body: form.value })
		} else {
			await apiFetch(`/api/v1/auth/users/${editingId.value}`, {
				method: 'PUT',
				body: {
					displayName: form.value.displayName,
					roleId: form.value.roleId,
					status: form.value.status,
				},
			})
		}
		editorOpen.value = false
		await loadUsers()
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '保存失败'
	}
}

function openReset(target: UserSummary): void {
	resetTarget.value = target
	resetPassword.value = ''
}

async function submitReset(): Promise<void> {
	if (!resetTarget.value) return
	errorMessage.value = ''
	try {
		await apiFetch(`/api/v1/auth/users/${resetTarget.value.id}/reset-password`, {
			method: 'POST',
			body: { password: resetPassword.value },
		})
		resetTarget.value = null
		resetPassword.value = ''
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '重置密码失败'
	}
}

async function removeUser(target: UserSummary): Promise<void> {
	if (!window.confirm(`确认删除用户「${target.displayName}」（逻辑删除）？`)) return
	errorMessage.value = ''
	try {
		await apiFetch(`/api/v1/auth/users/${target.id}`, { method: 'DELETE' })
		await loadUsers()
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '删除失败'
	}
}

function search(): void {
	page.value = 1
	void loadUsers()
}

function changePage(next: number): void {
	page.value = next
	void loadUsers()
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

onMounted(() => {
	void loadUsers()
	void loadRoles()
})
</script>

<template>
	<section class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold">用户管理</h1>
				<p class="text-sm text-slate-400">
					共 {{ total }} 个账号；删除为逻辑删除，不影响历史数据。
				</p>
			</div>
			<div class="flex items-center gap-2">
				<UInput v-model="keyword" placeholder="按用户名/显示名搜索" @keydown.enter="search" />
				<UButton color="neutral" variant="soft" @click="search">搜索</UButton>
				<UButton v-if="canWrite" color="warning" @click="openCreate">新建用户</UButton>
			</div>
		</div>

		<UAlert
			v-if="errorMessage"
			color="error"
			variant="subtle"
			title="操作失败"
			:description="errorMessage"
		/>

		<div
			v-if="editorOpen && canWrite"
			class="rounded-lg border border-slate-800 bg-slate-900/70 p-4"
		>
			<h2 class="mb-3 font-medium">
				{{ editingId === null ? '新建用户' : `编辑用户：${form.username}` }}
			</h2>
			<form class="grid gap-3 md:grid-cols-2" @submit.prevent="submitEditor">
				<label class="space-y-1 text-sm">
					<span class="text-slate-300">用户名</span>
					<UInput v-model="form.username" class="w-full" :disabled="editingId !== null" />
				</label>
				<label v-if="editingId === null" class="space-y-1 text-sm">
					<span class="text-slate-300">初始密码</span>
					<UInput v-model="form.password" type="password" class="w-full" />
				</label>
				<label class="space-y-1 text-sm">
					<span class="text-slate-300">显示名</span>
					<UInput v-model="form.displayName" class="w-full" />
				</label>
				<label class="space-y-1 text-sm">
					<span class="text-slate-300">角色</span>
					<select
						v-model.number="form.roleId"
						class="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
					>
						<option v-for="option in roleOptions" :key="option.value" :value="option.value">
							{{ option.label }}
						</option>
					</select>
				</label>
				<label class="space-y-1 text-sm">
					<span class="text-slate-300">状态</span>
					<select
						v-model="form.status"
						class="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
					>
						<option value="ACTIVE">启用</option>
						<option value="DISABLED">禁用</option>
					</select>
				</label>
				<div class="flex items-end gap-2 md:col-span-2">
					<UButton type="submit" color="warning">保存</UButton>
					<UButton color="neutral" variant="soft" @click="editorOpen = false">取消</UButton>
				</div>
			</form>
		</div>

		<div v-if="resetTarget" class="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
			<h2 class="mb-3 font-medium">
				重置密码：{{ resetTarget.displayName }}（{{ resetTarget.username }}）
			</h2>
			<form class="flex flex-wrap items-end gap-3" @submit.prevent="submitReset">
				<label class="space-y-1 text-sm">
					<span class="text-slate-300">新密码</span>
					<UInput v-model="resetPassword" type="password" class="w-64" />
				</label>
				<UButton type="submit" color="warning">确认重置</UButton>
				<UButton color="neutral" variant="soft" @click="resetTarget = null">取消</UButton>
			</form>
		</div>

		<div class="overflow-x-auto rounded-lg border border-slate-800">
			<table class="w-full text-sm">
				<thead class="bg-slate-900 text-left text-slate-400">
					<tr>
						<th class="px-4 py-3">用户名</th>
						<th class="px-4 py-3">显示名</th>
						<th class="px-4 py-3">角色</th>
						<th class="px-4 py-3">状态</th>
						<th class="px-4 py-3">创建时间（北京）</th>
						<th v-if="canWrite" class="px-4 py-3">操作</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="item in users" :key="item.id" class="border-t border-slate-800">
						<td class="px-4 py-3 font-mono">{{ item.username }}</td>
						<td class="px-4 py-3">{{ item.displayName }}</td>
						<td class="px-4 py-3">{{ roleLabel(item.role) }}</td>
						<td class="px-4 py-3">
							<UBadge :color="item.status === 'ACTIVE' ? 'success' : 'error'" variant="subtle">
								{{ item.status === 'ACTIVE' ? '启用' : '禁用' }}
							</UBadge>
						</td>
						<td class="px-4 py-3 text-slate-400">
							{{ new Date(item.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }}
						</td>
						<td v-if="canWrite" class="space-x-2 px-4 py-3">
							<UButton size="xs" variant="soft" @click="openEdit(item)">编辑</UButton>
							<UButton size="xs" variant="soft" @click="openReset(item)">重置密码</UButton>
							<UButton
								size="xs"
								color="error"
								variant="soft"
								:disabled="currentUser?.id === item.id"
								@click="removeUser(item)"
							>
								删除
							</UButton>
						</td>
					</tr>
					<tr v-if="users.length === 0 && !loading">
						<td colspan="6" class="px-4 py-8 text-center text-slate-500">暂无用户数据</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="flex items-center justify-end gap-2 text-sm">
			<UButton size="xs" variant="soft" :disabled="page <= 1" @click="changePage(page - 1)"
				>上一页</UButton
			>
			<span class="text-slate-400">第 {{ page }} / {{ totalPages }} 页</span>
			<UButton size="xs" variant="soft" :disabled="page >= totalPages" @click="changePage(page + 1)"
				>下一页</UButton
			>
		</div>
	</section>
</template>
