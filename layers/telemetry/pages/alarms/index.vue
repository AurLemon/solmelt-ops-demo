<script setup lang="ts">
import type { AlarmSummary } from '~~/shared/contracts/telemetry'
import {
	ALL_ALARM_FILTER,
	ALARM_LEVEL_OPTIONS,
	ALARM_STATUS_OPTIONS,
	formatBeijingTime,
	type DeviceOption,
	useTelemetryData,
} from '../../composables/useTelemetryData'

definePageMeta({ layout: 'dashboard', permission: 'alarm:read' })

useHead({ title: '报警管理 — SolMelt' })

const { fetchAlarms, loadCatalog } = useTelemetryData()
const devices = ref<DeviceOption[]>([])
const filterDeviceId = ref<string>(ALL_ALARM_FILTER)
const filterLevel = ref<string>(ALL_ALARM_FILTER)
const filterStatus = ref('UNHANDLED')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const alarms = ref<AlarmSummary[]>([])
const loading = ref(false)
const error = ref('')
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const deviceOptions = computed(() => [
	{ label: '全部设备', value: ALL_ALARM_FILTER },
	...devices.value.map((device) => ({
		label: `${device.name}（${device.deviceCode}）`,
		value: device.deviceId,
	})),
])

function optionalFilter(value: string): string | undefined {
	return value === ALL_ALARM_FILTER ? undefined : value
}

async function loadAlarms(): Promise<void> {
	loading.value = true
	error.value = ''
	try {
		const result = await fetchAlarms({
			page: page.value,
			pageSize: pageSize.value,
			deviceId: optionalFilter(filterDeviceId.value),
			level: optionalFilter(filterLevel.value),
			status: optionalFilter(filterStatus.value),
		})
		alarms.value = result.items
		total.value = result.total
	} catch (queryError: unknown) {
		alarms.value = []
		error.value = queryError instanceof Error ? queryError.message : '查询失败'
	} finally {
		loading.value = false
	}
}

function handleFilter(): void {
	page.value = 1
	void loadAlarms()
}

function levelClass(level: string): string {
	return level === 'SERIOUS'
		? 'border-rose-500/40 bg-rose-500/20 text-rose-300'
		: 'border-amber-500/40 bg-amber-500/20 text-amber-300'
}

function levelLabel(level: string): string {
	return level === 'SERIOUS' ? '严重' : '预警'
}

function statusClass(status: string): string {
	switch (status) {
		case 'UNHANDLED':
			return 'border-rose-500/40 bg-rose-500/20 text-rose-300'
		case 'ACKNOWLEDGED':
			return 'border-amber-500/40 bg-amber-500/20 text-amber-300'
		case 'RECOVERED':
			return 'border-emerald-500/40 bg-emerald-500/20 text-emerald-300'
		default:
			return 'border-slate-500/40 bg-slate-500/20 text-slate-300'
	}
}

function statusLabel(status: string): string {
	const labels: Record<string, string> = {
		UNHANDLED: '未处理',
		ACKNOWLEDGED: '已确认',
		RECOVERED: '已恢复',
		IGNORED: '已忽略',
	}
	return labels[status] ?? status
}

function goToPage(target: number): void {
	page.value = target
	void loadAlarms()
}

onMounted(async () => {
	void loadAlarms()
	try {
		devices.value = (await loadCatalog()).devices
	} catch (catalogError: unknown) {
		error.value = catalogError instanceof Error ? catalogError.message : '加载设备列表失败'
	}
})
</script>

<template>
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
				报警管理
			</h1>
			<UButton
				to="/telemetry/history"
				color="neutral"
				variant="link"
				trailing-icon="i-lucide-arrow-right"
			>
				历史曲线
			</UButton>
		</div>

		<UCard class="border-slate-800 bg-slate-900/70">
			<div class="flex flex-wrap items-end gap-4">
				<div>
					<label class="mb-1 block text-xs text-slate-400">设备</label>
					<USelect
						v-model="filterDeviceId"
						class="min-w-52"
						:items="deviceOptions"
						@update:model-value="handleFilter"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs text-slate-400">级别</label>
					<USelect
						v-model="filterLevel"
						class="min-w-28"
						:items="ALARM_LEVEL_OPTIONS"
						@update:model-value="handleFilter"
					/>
				</div>
				<div>
					<label class="mb-1 block text-xs text-slate-400">状态</label>
					<USelect
						v-model="filterStatus"
						class="min-w-28"
						:items="ALARM_STATUS_OPTIONS"
						@update:model-value="handleFilter"
					/>
				</div>
				<UButton color="warning" variant="outline" @click="handleFilter">刷新</UButton>
			</div>
		</UCard>

		<p v-if="error" class="text-sm text-rose-400">{{ error }}</p>

		<UCard class="border-slate-800 bg-slate-900/70">
			<template #header>
				<span class="text-base font-medium text-slate-200"
					>报警列表 <span class="ml-2 text-sm text-slate-500">共 {{ total }} 条</span></span
				>
			</template>
			<div v-if="loading" class="py-10 text-center text-slate-500">加载中...</div>
			<div v-else-if="alarms.length === 0" class="py-10 text-center text-slate-500">
				暂无报警数据
			</div>
			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-700 text-left text-xs text-slate-400">
							<th class="px-3 py-2">设备</th>
							<th class="px-3 py-2">指标</th>
							<th class="px-3 py-2">级别</th>
							<th class="px-3 py-2">状态</th>
							<th class="px-3 py-2">实际值</th>
							<th class="px-3 py-2">阈值</th>
							<th class="px-3 py-2">发生时间</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="alarm in alarms"
							:key="alarm.id"
							class="border-b border-slate-800 hover:bg-slate-800/40"
						>
							<td class="px-3 py-3 font-mono text-xs text-slate-300">{{ alarm.deviceCode }}</td>
							<td class="px-3 py-3 text-slate-300">{{ alarm.metric }}</td>
							<td class="px-3 py-3">
								<span
									class="inline-block rounded border px-2 py-0.5 text-xs"
									:class="levelClass(alarm.level)"
									>{{ levelLabel(alarm.level) }}</span
								>
							</td>
							<td class="px-3 py-3">
								<span
									class="inline-block rounded border px-2 py-0.5 text-xs"
									:class="statusClass(alarm.status)"
									>{{ statusLabel(alarm.status) }}</span
								>
							</td>
							<td class="px-3 py-3 font-mono text-rose-300">{{ alarm.actualValue }}</td>
							<td class="px-3 py-3 font-mono text-slate-400">{{ alarm.threshold }}</td>
							<td class="px-3 py-3 text-xs text-slate-400">
								{{ formatBeijingTime(alarm.occurredAt) }}
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<div v-if="total > pageSize" class="flex items-center justify-between pt-4">
				<span class="text-xs text-slate-500">第 {{ page }} / {{ totalPages }} 页</span>
				<div class="flex gap-2">
					<UButton
						size="sm"
						variant="outline"
						color="neutral"
						:disabled="page <= 1 || loading"
						@click="goToPage(page - 1)"
						>上一页</UButton
					>
					<UButton
						size="sm"
						variant="outline"
						color="neutral"
						:disabled="page >= totalPages || loading"
						@click="goToPage(page + 1)"
						>下一页</UButton
					>
				</div>
			</div>
		</UCard>
	</div>
</template>
