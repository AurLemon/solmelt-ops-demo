<script setup lang="ts">
import type { AlarmSummary, AlarmStatus } from '~~/shared/contracts/telemetry'
import {
	DEVICE_OPTIONS,
	ALARM_LEVEL_OPTIONS,
	ALARM_STATUS_OPTIONS,
	ALARM_STATUS_ACTIONS,
	fetchAlarms,
	patchAlarmStatus,
	formatBeijingTime,
} from '../../composables/useTelemetryData'

useHead({ title: '报警管理 — SolMelt' })

// 筛选状态
const filterDeviceId = ref('')
const filterLevel = ref('')
const filterStatus = ref('UNHANDLED')

// 分页状态
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 数据状态
const alarms = ref<AlarmSummary[]>([])
const loading = ref(false)
const error = ref('')
const updatingId = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

async function loadAlarms() {
	loading.value = true
	error.value = ''
	try {
		const result = await fetchAlarms({
			page: page.value,
			pageSize: pageSize.value,
			deviceId: filterDeviceId.value || undefined,
			level: filterLevel.value || undefined,
			status: filterStatus.value || undefined,
		})
		alarms.value = result.items
		total.value = result.total
	} catch (err: unknown) {
		alarms.value = []
		error.value = err instanceof Error ? err.message : '查询失败'
	} finally {
		loading.value = false
	}
}

function handleFilter() {
	page.value = 1
	loadAlarms()
}

async function handleStatusUpdate(alarm: AlarmSummary, status: AlarmStatus) {
	updatingId.value = alarm.id
	try {
		await patchAlarmStatus(alarm.id, status)
		await loadAlarms()
	} catch (err: unknown) {
		error.value = err instanceof Error ? err.message : '状态更新失败'
	} finally {
		updatingId.value = ''
	}
}

// 级别样式映射
function levelClass(level: string): string {
	return level === 'SERIOUS'
		? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
		: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
}

function levelLabel(level: string): string {
	return level === 'SERIOUS' ? '严重' : '预警'
}

// 状态样式映射
function statusClass(status: string): string {
	switch (status) {
		case 'UNHANDLED':
			return 'bg-rose-500/20 text-rose-300 border-rose-500/40'
		case 'ACKNOWLEDGED':
			return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
		case 'RECOVERED':
			return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
		case 'IGNORED':
			return 'bg-slate-500/20 text-slate-300 border-slate-500/40'
		default:
			return 'bg-slate-500/20 text-slate-300 border-slate-500/40'
	}
}

function statusLabel(status: string): string {
	switch (status) {
		case 'UNHANDLED':
			return '未处理'
		case 'ACKNOWLEDGED':
			return '已确认'
		case 'RECOVERED':
			return '已恢复'
		case 'IGNORED':
			return '已忽略'
		default:
			return status
	}
}

function goToPage(target: number) {
	page.value = target
	loadAlarms()
}

// 初次加载
onMounted(() => loadAlarms())
</script>

<template>
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-amber-300">报警管理</h1>
			<NuxtLink to="/telemetry/history" class="text-sm text-slate-400 hover:text-amber-300">
				历史曲线 →
			</NuxtLink>
		</div>

		<!-- 筛选栏 -->
		<UCard class="border-slate-800 bg-slate-900/70">
			<div class="flex flex-wrap items-end gap-4">
				<div>
					<label class="mb-1 block text-xs text-slate-400">设备</label>
					<select
						v-model="filterDeviceId"
						class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
						@change="handleFilter"
					>
						<option value="">全部设备</option>
						<option v-for="d in DEVICE_OPTIONS" :key="d.deviceId" :value="d.deviceId">
							{{ d.name }} ({{ d.deviceCode }})
						</option>
					</select>
				</div>

				<div>
					<label class="mb-1 block text-xs text-slate-400">级别</label>
					<select
						v-model="filterLevel"
						class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
						@change="handleFilter"
					>
						<option v-for="opt in ALARM_LEVEL_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</div>

				<div>
					<label class="mb-1 block text-xs text-slate-400">状态</label>
					<select
						v-model="filterStatus"
						class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
						@change="handleFilter"
					>
						<option v-for="opt in ALARM_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
							{{ opt.label }}
						</option>
					</select>
				</div>

				<UButton color="warning" variant="outline" @click="handleFilter">刷新</UButton>
			</div>
		</UCard>

		<p v-if="error" class="text-sm text-rose-400">{{ error }}</p>

		<!-- 报警列表 -->
		<UCard class="border-slate-800 bg-slate-900/70">
			<template #header>
				<span class="text-base font-medium text-slate-200">
					报警列表
					<span class="ml-2 text-sm text-slate-500">共 {{ total }} 条</span>
				</span>
			</template>

			<div v-if="loading" class="py-10 text-center text-slate-500">加载中...</div>

			<div v-else-if="alarms.length === 0" class="py-10 text-center text-slate-500">
				暂无报警数据
			</div>

			<div v-else class="overflow-x-auto">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-700 text-left text-xs text-slate-400">
							<th class="px-3 py-2 font-medium">设备</th>
							<th class="px-3 py-2 font-medium">指标</th>
							<th class="px-3 py-2 font-medium">级别</th>
							<th class="px-3 py-2 font-medium">状态</th>
							<th class="px-3 py-2 font-medium">实际值</th>
							<th class="px-3 py-2 font-medium">阈值</th>
							<th class="px-3 py-2 font-medium">发生时间</th>
							<th class="px-3 py-2 font-medium">处理</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="alarm in alarms"
							:key="alarm.id"
							class="border-b border-slate-800 hover:bg-slate-800/40"
						>
							<td class="px-3 py-3">
								<div class="font-mono text-xs text-slate-300">{{ alarm.deviceCode }}</div>
							</td>
							<td class="px-3 py-3 text-slate-300">{{ alarm.metric }}</td>
							<td class="px-3 py-3">
								<span
									class="inline-block rounded border px-2 py-0.5 text-xs"
									:class="levelClass(alarm.level)"
								>
									{{ levelLabel(alarm.level) }}
								</span>
							</td>
							<td class="px-3 py-3">
								<span
									class="inline-block rounded border px-2 py-0.5 text-xs"
									:class="statusClass(alarm.status)"
								>
									{{ statusLabel(alarm.status) }}
								</span>
							</td>
							<td class="px-3 py-3 font-mono text-rose-300">{{ alarm.actualValue }}</td>
							<td class="px-3 py-3 font-mono text-slate-400">{{ alarm.threshold }}</td>
							<td class="px-3 py-3 text-xs text-slate-400">
								{{ formatBeijingTime(alarm.occurredAt) }}
							</td>
							<td class="px-3 py-3">
								<div v-if="alarm.status === 'UNHANDLED'" class="flex gap-1">
									<button
										v-for="action in ALARM_STATUS_ACTIONS"
										:key="action.value"
										:disabled="updatingId === alarm.id"
										class="rounded border px-2 py-1 text-xs transition hover:bg-slate-700 disabled:opacity-40"
										:class="{
											'border-amber-500/40 text-amber-300': action.color === 'amber',
											'border-emerald-500/40 text-emerald-300': action.color === 'green',
											'border-slate-500/40 text-slate-300': action.color === 'slate',
										}"
										@click="handleStatusUpdate(alarm, action.value)"
									>
										{{ action.label }}
									</button>
								</div>
								<span v-else class="text-xs text-slate-600">—</span>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<!-- 分页 -->
			<div v-if="total > pageSize" class="flex items-center justify-between pt-4">
				<span class="text-xs text-slate-500"> 第 {{ page }} / {{ totalPages }} 页 </span>
				<div class="flex gap-2">
					<UButton
						size="sm"
						variant="outline"
						color="neutral"
						:disabled="page <= 1 || loading"
						@click="goToPage(page - 1)"
					>
						上一页
					</UButton>
					<UButton
						size="sm"
						variant="outline"
						color="neutral"
						:disabled="page >= totalPages || loading"
						@click="goToPage(page + 1)"
					>
						下一页
					</UButton>
				</div>
			</div>
		</UCard>
	</div>
</template>
