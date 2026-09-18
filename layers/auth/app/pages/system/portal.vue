<script setup lang="ts">
import type { MenuItem } from '~~/shared/contracts/auth'

defineOptions({ name: 'SystemPortalPage' })
definePageMeta({ layout: 'dashboard' })

const { user, apiFetch } = useAuth()

interface PortalCard {
	name: string
	path: string
	icon: string
	description: string
}

const cards = ref<PortalCard[]>([])
const loadError = ref('')
const loading = ref(true)

function portalCardMeta(path: string): Pick<PortalCard, 'icon' | 'description'> {
	if (path.startsWith('/system/users')) {
		return { icon: 'i-lucide-users', description: '维护账号、角色归属与启用状态' }
	}
	if (path.startsWith('/system/roles')) {
		return { icon: 'i-lucide-shield-check', description: '配置角色权限与菜单访问边界' }
	}
	if (path.startsWith('/devices')) {
		return { icon: 'i-lucide-cpu', description: '查看设备档案、在线状态与最新数据' }
	}
	if (path.startsWith('/telemetry')) {
		return {
			icon: 'i-lucide-chart-no-axes-combined',
			description: '按设备、属性和时间检索历史数据',
		}
	}
	if (path.startsWith('/alarms')) {
		return { icon: 'i-lucide-bell-ring', description: '追踪阈值报警与当前处理状态' }
	}
	if (path.startsWith('/dashboard')) {
		return { icon: 'i-lucide-monitor-up', description: '进入实时运营监测大屏' }
	}
	return { icon: 'i-lucide-arrow-up-right', description: '进入已授权业务模块' }
}

/** 展开当前角色实际可访问的菜单树；各领域页面由同一应用路由承载。 */
function collectCards(items: MenuItem[], result: PortalCard[]): void {
	for (const item of items) {
		if (item.children.length > 0) {
			collectCards(item.children, result)
			continue
		}
		if (item.permissionCode?.endsWith(':read')) {
			result.push({ name: item.name, path: item.path, ...portalCardMeta(item.path) })
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
	} finally {
		loading.value = false
	}
})
</script>

<template>
	<div class="portal-page mx-auto max-w-6xl space-y-8">
		<section
			class="grid items-center gap-8 border-b border-slate-200 pb-8 dark:border-slate-800 lg:grid-cols-[minmax(0,1fr)_24rem]"
		>
			<div class="portal-copy max-w-2xl">
				<div
					class="mb-4 inline-flex items-center gap-2 text-xs font-medium tracking-widest text-emerald-700 uppercase dark:text-emerald-300"
				>
					<span class="portal-live-dot size-2 rounded-full bg-emerald-500" />
					Operations online
				</div>
				<h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
					系统门户
				</h1>
				<p v-if="user" class="mt-3 text-base text-slate-600 dark:text-slate-300">
					{{ user.displayName }}，欢迎进入 SolMelt。
				</p>
				<p class="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
					从这里进入当前角色已授权的运营模块，查看设备、遥测、报警与实时监测状态。
				</p>

				<div class="mt-6 flex flex-wrap gap-x-8 gap-y-3">
					<div>
						<p class="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
							{{ cards.length }}
						</p>
						<p class="text-xs text-slate-500">可用入口</p>
					</div>
					<div v-if="user">
						<p class="font-mono text-2xl font-semibold tabular-nums text-slate-900 dark:text-white">
							{{ user.permissions.length }}
						</p>
						<p class="text-xs text-slate-500">权限节点</p>
					</div>
					<div v-if="user">
						<p class="text-2xl font-mono font-semibold text-slate-900 dark:text-white">
							{{ user.role }}
						</p>
						<p class="text-xs text-slate-500">当前角色</p>
					</div>
				</div>
			</div>

			<div
				class="portal-terminal overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-slate-300 shadow-sm dark:border-slate-700"
				aria-label="熔盐泵循环状态示意"
			>
				<div class="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
					<div class="flex gap-1.5" aria-hidden="true">
						<span class="size-2 rounded-full bg-rose-400/80" />
						<span class="size-2 rounded-full bg-amber-300/80" />
						<span class="size-2 rounded-full bg-emerald-400/80" />
					</div>
					<span class="font-mono text-[10px] tracking-widest text-slate-500"
						>THERMAL LOOP / LIVE</span
					>
				</div>
				<div class="space-y-1 px-5 py-5 text-center font-mono text-xs leading-5 sm:text-sm">
					<p class="text-amber-300">SOLAR THERMAL LOOP</p>
					<p class="portal-flow text-cyan-300">
						&gt;&gt;&gt; &gt;&gt;&gt; &gt;&gt;&gt; &gt;&gt;&gt; &gt;&gt;&gt;
					</p>
					<p>.-------.</p>
					<p>IN ======( <span class="portal-rotor text-amber-300">+</span> )====== OUT</p>
					<p>'---+---'</p>
					<p>|</p>
					<p class="text-slate-500">MOLTEN SALT PUMP</p>
				</div>
				<div class="flex items-center gap-2 border-t border-slate-800 px-4 py-2.5 text-xs">
					<span class="size-1.5 rounded-full bg-emerald-400" />
					<span class="font-mono text-emerald-300">circulation nominal</span>
				</div>
			</div>
		</section>

		<Transition name="portal-feedback">
			<UAlert
				v-if="loadError"
				color="error"
				variant="subtle"
				title="菜单加载失败"
				:description="loadError"
			/>
		</Transition>

		<section class="space-y-4">
			<div class="flex items-end justify-between gap-4">
				<div>
					<h2 class="text-base font-semibold text-slate-900 dark:text-slate-100">业务入口</h2>
					<p class="mt-1 text-sm text-slate-500">入口随当前账号权限动态生成</p>
				</div>
				<span v-if="!loading" class="font-mono text-xs text-slate-500">
					{{ cards.length.toString().padStart(2, '0') }} modules
				</span>
			</div>

			<div v-if="loading" class="flex items-center gap-2 py-8 text-sm text-slate-500">
				<UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
				正在读取权限菜单…
			</div>

			<div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				<NuxtLink
					v-for="(card, index) in cards"
					:key="card.path"
					:to="card.path"
					class="portal-card group flex min-h-32 flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-amber-500"
					:style="{ animationDelay: `${120 + index * 55}ms` }"
				>
					<div class="flex items-start justify-between gap-4">
						<span
							class="flex size-9 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition-colors group-hover:bg-amber-100 group-hover:text-amber-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-amber-500/15 dark:group-hover:text-amber-300"
						>
							<UIcon :name="card.icon" class="size-4" />
						</span>
						<UIcon
							name="i-lucide-arrow-up-right"
							class="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-amber-500"
						/>
					</div>
					<div class="mt-5">
						<p class="font-medium text-slate-900 dark:text-slate-100">{{ card.name }}</p>
						<p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
							{{ card.description }}
						</p>
					</div>
				</NuxtLink>
			</div>
		</section>
	</div>
</template>

<style scoped>
.portal-copy,
.portal-terminal {
	animation: portal-rise 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.portal-terminal {
	animation-delay: 90ms;
}

.portal-card {
	opacity: 0;
	animation: portal-rise 480ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.portal-live-dot {
	box-shadow: 0 0 0 0 rgb(16 185 129 / 45%);
	animation: portal-pulse 1.8s ease-out infinite;
}

.portal-flow {
	animation: portal-flow 1.4s ease-in-out infinite;
}

.portal-rotor {
	display: inline-block;
	animation: portal-rotor 1.1s linear infinite;
}

.portal-feedback-enter-active,
.portal-feedback-leave-active {
	transition:
		opacity 220ms ease,
		transform 220ms ease;
}

.portal-feedback-enter-from,
.portal-feedback-leave-to {
	opacity: 0;
	transform: translateY(-6px);
}

@keyframes portal-rise {
	from {
		opacity: 0;
		transform: translateY(12px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes portal-pulse {
	70% {
		box-shadow: 0 0 0 7px rgb(16 185 129 / 0%);
	}
	100% {
		box-shadow: 0 0 0 0 rgb(16 185 129 / 0%);
	}
}

@keyframes portal-flow {
	0%,
	100% {
		opacity: 0.55;
		transform: translateX(-3px);
	}
	50% {
		opacity: 1;
		transform: translateX(3px);
	}
}

@keyframes portal-rotor {
	to {
		transform: rotate(360deg);
	}
}

@media (prefers-reduced-motion: reduce) {
	.portal-copy,
	.portal-terminal,
	.portal-card,
	.portal-live-dot,
	.portal-flow,
	.portal-rotor {
		animation: none;
		opacity: 1;
		transform: none;
	}

	.portal-feedback-enter-active,
	.portal-feedback-leave-active {
		transition: none;
	}
}
</style>
