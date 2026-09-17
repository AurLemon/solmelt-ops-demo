<script setup lang="ts">
import type { MenuItem, RoleSummary } from '~~/shared/contracts/auth'

defineOptions({ name: 'SystemRolesPage' })
definePageMeta({ layout: 'dashboard', permission: 'system:role:read' })

const { hasPermission, apiFetch } = useAuth()
const canWrite = computed(() => hasPermission('system:role:write'))

const roles = ref<RoleSummary[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const menuOptions = ref<{ id: number; label: string }[]>([])
const errorMessage = ref('')
const loading = ref(false)

const editorOpen = ref(false)
const editingId = ref<number | null>(null)
const form = ref({
	code: '',
	name: '',
	remark: '',
	menuIds: [] as number[],
})

function flattenMenus(items: MenuItem[], parentLabel: string): void {
	for (const item of items) {
		const label = item.permissionCode
			? `${parentLabel}${item.name}（${item.permissionCode}）`
			: `${parentLabel}${item.name}`
		menuOptions.value.push({ id: Number(item.id), label })
		flattenMenus(item.children, `${label} / `)
	}
}

async function loadRoles(): Promise<void> {
	loading.value = true
	errorMessage.value = ''
	try {
		const result = await apiFetch<{ items: RoleSummary[]; total: number }>(
			`/api/v1/auth/roles?page=${page.value}&pageSize=${pageSize}`,
		)
		roles.value = result.items
		total.value = result.total
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '角色列表加载失败'
	} finally {
		loading.value = false
	}
}

async function loadMenus(): Promise<void> {
	try {
		menuOptions.value = []
		const tree = await apiFetch<MenuItem[]>('/api/v1/auth/menus')
		flattenMenus(tree, '')
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '菜单加载失败'
	}
}

function openCreate(): void {
	editingId.value = null
	form.value = { code: '', name: '', remark: '', menuIds: [] }
	editorOpen.value = true
}

function openEdit(target: RoleSummary): void {
	editingId.value = Number(target.id)
	form.value = {
		code: target.code,
		name: target.name,
		remark: target.remark ?? '',
		menuIds: target.menuIds.map((id) => Number(id)),
	}
	editorOpen.value = true
}

function toggleMenu(menuId: number, checked: boolean): void {
	if (checked && !form.value.menuIds.includes(menuId)) {
		form.value.menuIds = [...form.value.menuIds, menuId]
	}
	if (!checked) {
		form.value.menuIds = form.value.menuIds.filter((id) => id !== menuId)
	}
}

async function submitEditor(): Promise<void> {
	errorMessage.value = ''
	try {
		if (editingId.value === null) {
			await apiFetch('/api/v1/auth/roles', { method: 'POST', body: form.value })
		} else {
			await apiFetch(`/api/v1/auth/roles/${editingId.value}`, {
				method: 'PUT',
				body: {
					name: form.value.name,
					remark: form.value.remark || undefined,
					menuIds: form.value.menuIds,
				},
			})
		}
		editorOpen.value = false
		await loadRoles()
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '保存失败'
	}
}

async function removeRole(target: RoleSummary): Promise<void> {
	if (!window.confirm(`确认删除角色「${target.name}」？角色删除为物理删除且不可恢复。`)) return
	errorMessage.value = ''
	try {
		await apiFetch(`/api/v1/auth/roles/${target.id}`, { method: 'DELETE' })
		await loadRoles()
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : '删除失败'
	}
}

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

function goToPage(next: number): void {
	page.value = next
	void loadRoles()
}

onMounted(() => {
	void loadRoles()
	void loadMenus()
})
</script>

<template>
	<section class="space-y-4">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div>
				<h1 class="text-xl font-semibold">角色管理</h1>
				<p class="text-sm text-slate-400">
					共 {{ total }} 个角色；角色为物理删除，仍被用户关联时会被拒绝。鉴权以权限码为准。
				</p>
			</div>
			<UButton v-if="canWrite" color="warning" @click="openCreate">新建角色</UButton>
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
				{{ editingId === null ? '新建角色' : `编辑角色：${form.code}` }}
			</h2>
			<form class="space-y-3" @submit.prevent="submitEditor">
				<div class="grid gap-3 md:grid-cols-3">
					<label class="space-y-1 text-sm">
						<span class="text-slate-300">角色编码</span>
						<UInput
							v-model="form.code"
							class="w-full"
							:disabled="editingId !== null"
							placeholder="如 VIEWER"
						/>
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-300">角色名称</span>
						<UInput v-model="form.name" class="w-full" />
					</label>
					<label class="space-y-1 text-sm">
						<span class="text-slate-300">备注</span>
						<UInput v-model="form.remark" class="w-full" />
					</label>
				</div>

				<fieldset class="rounded-md border border-slate-800 p-3">
					<legend class="px-1 text-sm text-slate-300">菜单与操作权限</legend>
					<div class="grid gap-2 md:grid-cols-3">
						<UCheckbox
							v-for="option in menuOptions"
							:key="option.id"
							:label="option.label"
							:model-value="form.menuIds.includes(option.id)"
							@update:model-value="toggleMenu(option.id, Boolean($event))"
						/>
					</div>
					<p v-if="menuOptions.length === 0" class="text-sm text-slate-500">
						当前角色没有可分配的菜单项（需要管理员权限的菜单数据）。
					</p>
				</fieldset>

				<div class="flex gap-2">
					<UButton type="submit" color="warning">保存</UButton>
					<UButton color="neutral" variant="soft" @click="editorOpen = false">取消</UButton>
				</div>
			</form>
		</div>

		<div class="overflow-x-auto rounded-lg border border-slate-800">
			<table class="w-full text-sm">
				<thead class="bg-slate-900 text-left text-slate-400">
					<tr>
						<th class="px-4 py-3">编码</th>
						<th class="px-4 py-3">名称</th>
						<th class="px-4 py-3">备注</th>
						<th class="px-4 py-3">权限数</th>
						<th class="px-4 py-3">创建时间（北京）</th>
						<th v-if="canWrite" class="px-4 py-3">操作</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="item in roles" :key="item.id" class="border-t border-slate-800">
						<td class="px-4 py-3 font-mono">{{ item.code }}</td>
						<td class="px-4 py-3">{{ item.name }}</td>
						<td class="px-4 py-3 text-slate-400">{{ item.remark ?? '—' }}</td>
						<td class="px-4 py-3">{{ item.menuIds.length }}</td>
						<td class="px-4 py-3 text-slate-400">
							{{ new Date(item.createdAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) }}
						</td>
						<td v-if="canWrite" class="space-x-2 px-4 py-3">
							<UButton size="xs" variant="soft" @click="openEdit(item)">编辑</UButton>
							<UButton size="xs" color="error" variant="soft" @click="removeRole(item)"
								>删除</UButton
							>
						</td>
					</tr>
					<tr v-if="roles.length === 0 && !loading">
						<td colspan="6" class="px-4 py-8 text-center text-slate-500">暂无角色数据</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="flex items-center justify-end gap-2 text-sm">
			<UButton size="xs" variant="soft" :disabled="page <= 1" @click="goToPage(page - 1)">
				上一页
			</UButton>
			<span class="text-slate-400">第 {{ page }} / {{ totalPages }} 页</span>
			<UButton size="xs" variant="soft" :disabled="page >= totalPages" @click="goToPage(page + 1)">
				下一页
			</UButton>
		</div>
	</section>
</template>
