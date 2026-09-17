<script setup lang="ts">
import type { MenuItem } from '~~/shared/contracts/auth'

defineOptions({ name: 'SystemPortalPage' })
definePageMeta({ layout: 'dashboard' })

const { user, apiFetch } = useAuth()

interface PortalCard {
	name: string
	path: string
}

const cards = ref<PortalCard[]>([])
const loadError = ref('')

/** 展开当前角色实际可访问的菜单树；各领域页面由同一应用路由承载。 */
function collectCards(items: MenuItem[], result: PortalCard[]): void {
	for (const item of items) {
		if (item.children.length > 0) {
			collectCards(item.children, result)
			continue
		}
		if (item.permissionCode?.endsWith(':read')) {
			result.push({ name: item.name, path: item.path })
		}
	}
}

onMounted(async () => {
	try {
		const menus = await apiFetch<MenuItem[]>('/api/v1/auth/menus')
		const result: PortalCard[] = []
		collectCards(menus, result)
		cards.value = result
		loadError.value = ''
	} catch (error) {
		loadError.value = error instanceof Error ? error.message : '菜单加载失败'
	}
})
</script>

<template>
	<div class="mx-auto max-w-3xl space-y-6">
		<div>
			<h1 class="text-2xl font-semibold">系统门户</h1>
			<p v-if="user" class="mt-1 text-sm text-slate-400">
				欢迎你，{{ user.displayName }}（{{ user.role }}），当前持有
				{{ user.permissions.length }} 项权限
			</p>
			<p class="mt-1 text-xs text-slate-500">所有已授权业务板块均可从左侧菜单或下方入口进入。</p>
		</div>

		<UAlert
			v-if="loadError"
			color="error"
			variant="subtle"
			title="菜单加载失败"
			:description="loadError"
		/>

		<div class="grid gap-4 sm:grid-cols-2">
			<NuxtLink
				v-for="card in cards"
				:key="card.path"
				:to="card.path"
				class="rounded-lg border border-slate-700 bg-slate-900/70 px-5 py-4 transition-colors hover:border-amber-400"
			>
				<p class="font-medium text-amber-300">{{ card.name }}</p>
				<p class="mt-1 text-xs text-slate-400">{{ card.path }} · 点击进入</p>
			</NuxtLink>
		</div>
	</div>
</template>
