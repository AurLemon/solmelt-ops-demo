<script setup lang="ts">
import type { AlarmSummary } from '~~/shared/contracts/telemetry'

const props = defineProps<{ alarms: AlarmSummary[]; loading?: boolean }>()

const LEVEL_CLASSES: Record<AlarmSummary['level'], string> = {
	WARNING: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
	SERIOUS: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
}

const STATUS_CLASSES: Record<AlarmSummary['status'], string> = {
	UNHANDLED: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
	ACKNOWLEDGED: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
	RECOVERED: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
	IGNORED: 'border-slate-500/40 bg-slate-500/15 text-slate-400',
}

interface AlarmRow {
	id: string
	occurredAtLabel: string
	deviceCode: string
	metricLabel: string
	valueLabel: string
	levelLabel: string
	levelClass: string
	statusLabel: string
	statusClass: string
}

const rows = computed<AlarmRow[]>(() =>
	props.alarms.map((alarm) => ({
		id: alarm.id,
		occurredAtLabel: formatShanghaiTime(alarm.occurredAt),
		deviceCode: alarm.deviceCode,
		metricLabel: metricLabel(alarm.metric),
		valueLabel: `${alarm.actualValue} / > ${alarm.threshold} ${metricUnit(alarm.metric)}`.trim(),
		levelLabel: ALARM_LEVEL_LABELS[alarm.level],
		levelClass: LEVEL_CLASSES[alarm.level],
		statusLabel: ALARM_STATUS_LABELS[alarm.status],
		statusClass: STATUS_CLASSES[alarm.status],
	})),
)
</script>

<template>
	<div class="flex h-full min-h-0 flex-col rounded-lg border border-slate-800 bg-slate-900/40">
		<div class="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
			<p class="text-sm font-medium text-slate-200">近期报警</p>
			<p class="text-xs text-slate-500">
				未处理优先，其余按发生时间倒序 · 共 {{ alarms.length }} 条
			</p>
		</div>

		<div
			class="grid shrink-0 grid-cols-12 gap-3 border-b border-slate-800 px-4 py-2 text-xs text-slate-500"
		>
			<span class="col-span-3">发生时间（北京）</span>
			<span class="col-span-2">设备编号</span>
			<span class="col-span-3">指标</span>
			<span class="col-span-2">实测 / 阈值</span>
			<span class="col-span-1">级别</span>
			<span class="col-span-1">状态</span>
		</div>

		<div v-if="rows.length === 0" class="flex flex-1 items-center justify-center">
			<p class="text-sm text-slate-500">{{ loading ? '数据加载中…' : '暂无报警记录' }}</p>
		</div>

		<div v-else class="min-h-0 flex-1 overflow-y-auto">
			<div
				v-for="row in rows"
				:key="row.id"
				class="grid grid-cols-12 items-center gap-3 border-b border-slate-800/60 px-4 py-2 text-sm last:border-b-0"
			>
				<span class="col-span-3 font-mono text-xs tabular-nums text-slate-400">
					{{ row.occurredAtLabel }}
				</span>
				<span class="col-span-2 truncate font-mono text-xs text-slate-200">
					{{ row.deviceCode }}
				</span>
				<span class="col-span-3 truncate text-slate-200" :title="row.metricLabel">
					{{ row.metricLabel }}
				</span>
				<span class="col-span-2 truncate font-mono text-xs tabular-nums text-slate-300">
					{{ row.valueLabel }}
				</span>
				<span class="col-span-1">
					<span class="inline-block rounded border px-2 py-0.5 text-xs" :class="row.levelClass">
						{{ row.levelLabel }}
					</span>
				</span>
				<span class="col-span-1">
					<span class="inline-block rounded border px-2 py-0.5 text-xs" :class="row.statusClass">
						{{ row.statusLabel }}
					</span>
				</span>
			</div>
		</div>
	</div>
</template>
