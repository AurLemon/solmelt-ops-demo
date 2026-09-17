<script setup lang="ts">
import type { MenuItem, PermissionCode } from '~~/shared/contracts/auth'

defineOptions({ name: 'DashboardLayout' })

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const { user, fetchCurrentUser, hasPermission, logout, apiFetch } = useAuth()

const menus = ref<MenuItem[]>([])
const menuError = ref('')
const mobileNavOpen = ref(false)

interface NavItem {
	label: string
	to: string
	icon: string
}

const PORTAL_NAV_ITEM: NavItem = {
	label: '系统门户',
	to: '/system/portal',
	icon: 'i-lucide-layout-dashboard',
}

function resolveNavigationPath(path: string): string {
	return path === '/telemetry' ? '/telemetry/history' : path
}

function collectNavItems(items: MenuItem[], result: NavItem[]): void {
	for (const item of items) {
		if (item.children.length > 0) {
			collectNavItems(item.children, result)
			continue
		}
		if (item.permissionCode?.endsWith(':read')) {
			result.push({
				label: item.name,
				to: resolveNavigationPath(item.path),
				icon: iconForPath(item.path),
			})
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
	const result: NavItem[] = [PORTAL_NAV_ITEM]
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

function closeMobileNavigation(): void {
	mobileNavOpen.value = false
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
	<div
		class="admin-shell flex h-dvh overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
	>
		<aside
			class="hidden h-dvh w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex"
		>
			<div class="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
				<p class="text-lg font-semibold text-amber-500 dark:text-amber-300">SolMelt</p>
				<p class="text-xs text-slate-500 dark:text-slate-400">光热熔盐泵智能运营管理系统</p>
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
					active-class="bg-amber-100 text-amber-800 dark:bg-slate-800 dark:text-amber-300"
					exact-active-class="bg-amber-100 text-amber-800 dark:bg-slate-800 dark:text-amber-300"
				>
					<UIcon :name="item.icon" class="size-4 shrink-0" />
					<span>{{ item.label }}</span>
				</NuxtLink>
			</nav>

			<div v-if="user" class="shrink-0 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
				<p class="text-sm font-medium">{{ user.displayName }}</p>
				<p class="mb-3 text-xs text-slate-500 dark:text-slate-400">{{ user.role }}</p>
				<UButton color="error" variant="soft" size="xs" block @click="logout">退出登录</UButton>
			</div>
		</aside>

		<div class="flex min-w-0 flex-1 flex-col">
			<header
				class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80 md:px-6"
			>
				<div class="flex min-w-0 items-center gap-2">
					<UButton
						class="md:hidden"
						color="neutral"
						variant="ghost"
						square
						icon="i-lucide-menu"
						aria-label="打开导航"
						@click="mobileNavOpen = true"
					/>
					<p class="truncate text-sm text-slate-600 dark:text-slate-300">
						{{ runtimeConfig.public.appName }}
					</p>
				</div>
				<div class="flex items-center gap-2">
					<ThemeToggleButton />
					<UBadge color="warning" variant="subtle">{{ user?.role ?? '未加载' }}</UBadge>
				</div>
			</header>
			<main class="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
				<slot />
			</main>
		</div>

		<Transition name="mobile-nav">
			<div
				v-if="mobileNavOpen"
				class="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm md:hidden"
				@click.self="closeMobileNavigation"
			>
				<aside
					class="flex h-dvh w-72 flex-col border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
				>
					<div
						class="flex items-start justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800"
					>
						<div>
							<p class="text-lg font-semibold text-amber-500 dark:text-amber-300">SolMelt</p>
							<p class="text-xs text-slate-500 dark:text-slate-400">光热熔盐泵智能运营管理系统</p>
						</div>
						<UButton
							color="neutral"
							variant="ghost"
							square
							icon="i-lucide-x"
							aria-label="关闭导航"
							@click="closeMobileNavigation"
						/>
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
							active-class="bg-amber-100 text-amber-800 dark:bg-slate-800 dark:text-amber-300"
							exact-active-class="bg-amber-100 text-amber-800 dark:bg-slate-800 dark:text-amber-300"
							@click="closeMobileNavigation"
						>
							<UIcon :name="item.icon" class="size-4 shrink-0" />
							<span>{{ item.label }}</span>
						</NuxtLink>
					</nav>

					<div
						v-if="user"
						class="shrink-0 border-t border-slate-200 px-5 py-4 dark:border-slate-800"
					>
						<p class="text-sm font-medium">{{ user.displayName }}</p>
						<p class="mb-3 text-xs text-slate-500 dark:text-slate-400">{{ user.role }}</p>
						<UButton color="error" variant="soft" size="xs" block @click="logout">退出登录</UButton>
					</div>
				</aside>
			</div>
		</Transition>
	</div>
</template>

<style scoped>
.mobile-nav-enter-active,
.mobile-nav-leave-active {
	transition: opacity 180ms ease;
}

.mobile-nav-enter-active aside,
.mobile-nav-leave-active aside {
	transition: transform 180ms ease;
}

.mobile-nav-enter-from,
.mobile-nav-leave-to {
	opacity: 0;
}

.mobile-nav-enter-from aside,
.mobile-nav-leave-to aside {
	transform: translateX(-100%);
}

@media (prefers-reduced-motion: reduce) {
	.mobile-nav-enter-active,
	.mobile-nav-leave-active,
	.mobile-nav-enter-active aside,
	.mobile-nav-leave-active aside {
		transition: none;
	}
}
</style>
