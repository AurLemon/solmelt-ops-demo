<script setup lang="ts">
import type { MenuItem, PermissionCode } from '~~/shared/contracts/auth'

defineOptions({ name: 'DashboardLayout' })

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const { user, fetchCurrentUser, hasPermission, logout, apiFetch } = useAuth()

const menus = ref<MenuItem[]>([])
const menuError = ref('')

interface NavItem {
	label: string
	to: string
	icon: string
}

function collectNavItems(items: MenuItem[], result: NavItem[]): void {
	for (const item of items) {
		if (item.children.length > 0) {
			collectNavItems(item.children, result)
			continue
		}
		if (item.permissionCode?.endsWith(':read')) {
			result.push({ label: item.name, to: item.path, icon: iconForPath(item.path) })
		}
	}
}

function iconForPath(path: string): string {
	if (path.startsWith('/system/users')) return 'i-lucide-users'
	if (path.startsWith('/system/roles')) return 'i-lucide-shield'
	if (path.startsWith('/devices')) return 'i-lucide-cpu'
	if (path.startsWith('/telemetry')) return 'i-lucide-activity'
	if (path.startsWith('/alarms')) return 'i-lucide-bell-ring'
	if (path.startsWith('/dashboard')) return 'i-lucide-monitor-up'
	return 'i-lucide-circle'
}

const navItems = computed<NavItem[]>(() => {
	const result: NavItem[] = []
	collectNavItems(menus.value, result)
	return result
})

/** 前端权限拦截：页面 meta 声明所需权限码，无权访问立即回到系统门户（门户不要求权限码，任何登录角色可停留）。 */
function checkRoutePermission(): void {
	const required = route.meta.permission as PermissionCode | undefined
	if (required && user.value && !hasPermission(required)) {
		navigateTo('/system/portal')
	}
}

onMounted(async () => {
	if (!user.value) await fetchCurrentUser()
	checkRoutePermission()

	try {
		menus.value = await apiFetch<MenuItem[]>('/api/v1/auth/menus')
		menuError.value = ''
	} catch (error) {
		menuError.value = error instanceof Error ? error.message : '菜单加载失败'
	}
})

watch(
	() => route.fullPath,
	() => checkRoutePermission(),
)
</script>

<template>
	<div class="flex min-h-screen bg-slate-950 text-slate-100">
		<aside class="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-950">
			<div class="border-b border-slate-800 px-5 py-4">
				<p class="text-lg font-semibold text-amber-300">SolMelt</p>
				<p class="text-xs text-slate-400">光热熔盐泵智能运营管理系统</p>
			</div>

			<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
				<UAlert
					v-if="menuError"
					color="error"
					variant="subtle"
					title="菜单加载失败"
					:description="menuError"
				/>
				<NuxtLink
					v-for="item in navItems"
					:key="item.to"
					:to="item.to"
					class="flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors"
					active-class="bg-slate-800 text-amber-300"
					exact-active-class="bg-slate-800 text-amber-300"
				>
					<UIcon :name="item.icon" class="size-4 shrink-0" />
					<span>{{ item.label }}</span>
				</NuxtLink>
			</nav>

			<div v-if="user" class="border-t border-slate-800 px-5 py-4">
				<p class="text-sm font-medium">{{ user.displayName }}</p>
				<p class="mb-3 text-xs text-slate-400">{{ user.role }}</p>
				<UButton color="error" variant="soft" size="xs" block @click="logout">退出登录</UButton>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<header class="flex items-center justify-between border-b border-slate-800 px-6 py-3">
				<p class="text-sm text-slate-300">{{ runtimeConfig.public.appName }}</p>
				<UBadge color="warning" variant="subtle">{{ user?.role ?? '未加载' }}</UBadge>
			</header>
			<main class="flex-1 overflow-y-auto px-6 py-6">
				<slot />
			</main>
		</div>
	</div>
</template>
