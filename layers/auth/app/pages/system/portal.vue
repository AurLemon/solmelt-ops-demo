<script setup lang="ts">
import type { MenuItem } from '~~/shared/contracts/auth'

definePageMeta({ layout: 'dashboard' })

const { user, apiFetch } = useAuth()

interface PortalCard {
	name: string
	path: string
	ready: boolean
}

const cards = ref<PortalCard[]>([])
const loadError = ref('')

/** 展开菜单树为叶子卡片；auth 层已实现的 /system/* 页面可点击，其余板块标注待开发。 */
function collectCards(items: MenuItem[], result: PortalCard[]): void {
	for (const item of items) {
		if (item.children.length > 0) {
			collectCards(item.children, result)
			continue
		}
		if (item.permissionCode?.endsWith(':read')) {
			result.push({ name: item.name, path: item.path, ready: item.path.startsWith('/system') })
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
			<p class="mt-1 text-xs text-slate-500">
				除「登录与权限」外，其余板块由设备、采集、大屏小组按各自 Layer
				开发，开放后可从左侧菜单进入。
			</p>
		</div>

		<UAlert
			v-if="loadError"
			color="error"
			variant="subtle"
			title="菜单加载失败"
			:description="loadError"
		/>

		<div class="grid gap-4 sm:grid-cols-2">
			<template v-for="card in cards" :key="card.path">
				<NuxtLink
					v-if="card.ready"
					:to="card.path"
					class="rounded-lg border border-slate-700 bg-slate-900/70 px-5 py-4 transition-colors hover:border-amber-400"
				>
					<p class="font-medium text-amber-300">{{ card.name }}</p>
					<p class="mt-1 text-xs text-slate-400">{{ card.path }} · 点击进入</p>
				</NuxtLink>
				<div v-else class="rounded-lg border border-slate-800 bg-slate-900/40 px-5 py-4 opacity-70">
					<p class="font-medium">{{ card.name }}</p>
					<p class="mt-1 text-xs text-slate-500">{{ card.path }} · 待开发</p>
				</div>
			</template>
		</div>
	</div>
</template>
