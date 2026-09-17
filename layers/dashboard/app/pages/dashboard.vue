<script setup lang="ts">
import type { DashboardOverview, DashboardRealtimeDevice } from '~~/shared/contracts/dashboard'
import type { AlarmSummary } from '~~/shared/contracts/telemetry'
import { DOMAIN_THRESHOLDS } from '~~/shared/domain/thresholds'
import {
	DashboardRequestError,
	type DashboardRequestErrorCode,
} from '../composables/useDashboardApi'

definePageMeta({ layout: false })

useHead({ title: 'SolMelt 监测大屏' })

/**
 * 大屏是只读消费者：只调用 /api/v1/dashboard/* 三个冻结接口，
 * 不写任何业务表、不 import 其他领域 Service、不在页面内生成任何随机或静态业务数据。
 */
const { request, hasToken } = useDashboardApi()

const overview = ref<DashboardOverview | null>(null)
const devices = ref<DashboardRealtimeDevice[]>([])
const alarms = ref<AlarmSummary[]>([])
const loading = ref(true)
const errorCode = ref<DashboardRequestErrorCode | null>(null)
const errorMessage = ref('')
const now = ref(new Date())

/** 最近一次成功刷新的时间，用于错误态下说明「当前展示的是哪一刻的真实数据」。 */
const lastSuccessfulAt = ref<Date | null>(null)

interface StatCardView {
	label: string
	value: number | string
	unit: string
	tone: 'cyan' | 'emerald' | 'slate' | 'amber' | 'orange' | 'rose'
	icon: string
	hint: string
}

/** 六张统计卡全部来自 overview 的真实聚合结果；未取到时显示占位符，不补零。 */
const statCards = computed<StatCardView[]>(() => {
	const data = overview.value
	return [
		{
			label: '设备总数',
			value: data?.deviceTotal ?? '—',
			unit: '台',
			tone: 'cyan',
			icon: 'i-lucide-cpu',
			hint: '未删除设备',
		},
		{
			label: '在线设备',
			value: data?.onlineCount ?? '—',
			unit: '台',
			tone: 'emerald',
			icon: 'i-lucide-wifi',
			hint: '300 秒内成功上报',
		},
		{
			label: '离线设备',
			value: data?.offlineCount ?? '—',
			unit: '台',
			tone: 'slate',
			icon: 'i-lucide-wifi-off',
			hint: '超过 300 秒未上报',
		},
		{
			label: '运行中设备',
			value: data?.runningCount ?? '—',
			unit: '台',
			tone: 'amber',
			icon: 'i-lucide-play',
			hint: '在线且变频器已启动',
		},
		{
			label: '今日报警',
			value: data?.todayAlarmCount ?? '—',
			unit: '条',
			tone: 'orange',
			icon: 'i-lucide-bell',
			hint: '北京时间今日 00:00 起',
		},
		{
			label: '未处理报警',
			value: data?.unhandledAlarmCount ?? '—',
			unit: '条',
			tone: 'rose',
			icon: 'i-lucide-bell-ring',
			hint: '状态为 UNHANDLED',
		},
	]
})

const pumpTypes = computed(() => overview.value?.pumpTypes ?? [])

type DataUntilState = 'empty' | 'fresh' | 'delayed'

/** 数据截至 = 最新一条真实上报时间；超过 60 秒只标记延迟，不用页面刷新时间代替。 */
const dataDelaySeconds = computed<number | null>(() => {
	const iso = overview.value?.dataUntil
	if (!iso) return null
	const reportedAt = new Date(iso).getTime()
	if (Number.isNaN(reportedAt)) return null
	return Math.max(0, Math.floor((now.value.getTime() - reportedAt) / 1_000))
})

const dataUntilState = computed<DataUntilState>(() => {
	const seconds = dataDelaySeconds.value
	if (seconds === null) return 'empty'
	return seconds > DOMAIN_THRESHOLDS.dataDelaySeconds ? 'delayed' : 'fresh'
})

const dataUntilLabel = computed(() =>
	overview.value?.dataUntil ? formatShanghaiTime(overview.value.dataUntil) : '—',
)

const clockLabel = computed(() => formatShanghaiClock(now.value))

const errorTitle = computed(() => {
	switch (errorCode.value) {
		case 'UNAUTHENTICATED':
			return '登录凭证无效'
		case 'FORBIDDEN':
			return '权限不足'
		case 'DATABASE_UNAVAILABLE':
			return '数据库暂时不可用'
		default:
			return '数据加载异常'
	}
})

const credentialHint = computed(() => {
	if (errorCode.value !== 'UNAUTHENTICATED') return ''
	return hasToken.value ? '登录凭证已过期，请重新登录。' : '未检测到登录凭证，请先登录。'
})

async function loadOnce(): Promise<void> {
	try {
		const [nextOverview, nextDevices, nextAlarms] = await Promise.all([
			request<DashboardOverview>('/api/v1/dashboard/overview'),
			request<DashboardRealtimeDevice[]>('/api/v1/dashboard/realtime'),
			request<AlarmSummary[]>('/api/v1/dashboard/alarms/recent?limit=10'),
		])
		overview.value = nextOverview
		devices.value = nextDevices
		alarms.value = nextAlarms
		errorCode.value = null
		errorMessage.value = ''
		lastSuccessfulAt.value = new Date()
	} catch (error) {
		// 失败时保留上一轮的真实数据，只补充错误说明与延迟标识。
		if (error instanceof DashboardRequestError) {
			errorCode.value = error.code
			errorMessage.value = error.message
		} else {
			errorCode.value = 'NETWORK_ERROR'
			errorMessage.value = error instanceof Error ? error.message : '大屏数据请求失败'
		}
	} finally {
		loading.value = false
	}
}

/** 解构后每个 ref 都位于 setup 顶层，模板可直接使用而无需写 .value。 */
const { intervalSeconds, inFlight, completedRounds, skippedRounds } = useDashboardPolling(loadOnce)

let clockTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
	clockTimer = setInterval(() => {
		now.value = new Date()
	}, 1_000)
})

onBeforeUnmount(() => {
	if (clockTimer !== null) clearInterval(clockTimer)
	clockTimer = null
})
</script>

<template>
	<div class="flex h-screen w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
		<header
			class="flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-3"
		>
			<div class="flex items-baseline gap-3">
				<span class="text-xl font-semibold text-amber-300">SolMelt</span>
				<span class="text-sm text-slate-300">光热熔盐泵智能运营监测大屏</span>
			</div>

			<div class="flex items-center gap-6">
				<div class="flex items-center gap-2">
					<span class="text-xs text-slate-500">数据截至</span>
					<span class="font-mono text-sm tabular-nums text-slate-200">{{ dataUntilLabel }}</span>
					<span
						v-if="dataUntilState === 'delayed'"
						class="rounded border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-xs text-orange-300"
					>
						数据延迟 {{ dataDelaySeconds }} 秒
					</span>
					<span
						v-else-if="dataUntilState === 'empty'"
						class="rounded border border-slate-600/50 bg-slate-600/15 px-2 py-0.5 text-xs text-slate-400"
					>
						暂无上报数据
					</span>
					<span
						v-else
						class="rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
					>
						数据正常
					</span>
				</div>

				<div class="flex items-center gap-2 text-xs text-slate-500">
					<span>{{ intervalSeconds }} 秒轮询</span>
					<span class="font-mono tabular-nums text-slate-300">{{ clockLabel }}</span>
					<span class="font-mono tabular-nums">第 {{ completedRounds }} 轮</span>
					<span v-if="skippedRounds > 0" class="font-mono tabular-nums text-amber-400">
						跳过 {{ skippedRounds }}
					</span>
					<span v-if="inFlight" class="text-cyan-300">刷新中…</span>
				</div>
			</div>
		</header>

		<div
			v-if="errorMessage"
			class="flex shrink-0 items-center gap-3 border-b border-rose-500/40 bg-rose-500/10 px-6 py-2 text-sm"
		>
			<span class="font-medium text-rose-200">{{ errorTitle }}</span>
			<span class="text-rose-300/80">{{ errorMessage }}</span>
			<span v-if="credentialHint" class="text-rose-300/60">{{ credentialHint }}</span>
			<span v-if="lastSuccessfulAt" class="ml-auto text-xs text-rose-300/70">
				当前展示 {{ formatShanghaiTime(lastSuccessfulAt.toISOString()) }} 的最后真实数据
			</span>
		</div>

		<main class="flex min-h-0 flex-1 flex-col gap-3 p-4">
			<section class="grid shrink-0 grid-cols-6 gap-3">
				<DashboardStatCard v-for="card in statCards" :key="card.label" v-bind="card" />
			</section>

			<section class="grid min-h-0 flex-1 auto-rows-fr grid-cols-12 gap-3">
				<DashboardDeviceGrid class="col-span-8" :devices="devices" :loading="loading" />

				<div class="col-span-4 grid min-h-0 auto-rows-fr gap-3">
					<DashboardStatusChart
						:device-total="overview?.deviceTotal ?? 0"
						:online-count="overview?.onlineCount ?? 0"
						:offline-count="overview?.offlineCount ?? 0"
					/>
					<DashboardPumpTypeChart :pump-types="pumpTypes" />
				</div>
			</section>

			<section class="h-[236px] shrink-0">
				<DashboardAlarmList class="h-full" :alarms="alarms" :loading="loading" />
			</section>
		</main>
	</div>
</template>
