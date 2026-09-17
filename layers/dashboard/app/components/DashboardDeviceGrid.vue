<script setup lang="ts">
import type { DashboardRealtimeDevice } from '~~/shared/contracts/dashboard'

const props = defineProps<{ devices: DashboardRealtimeDevice[]; loading?: boolean }>()

interface DeviceView {
	device: DashboardRealtimeDevice
	statusLabel: string
	statusClass: string
	lastReportedLabel: string
	metrics: { identifier: string; label: string; value: string }[]
}

/** 在线 = 未删除且 300 秒内有成功上报；运行中 = 在线且变频器启动状态为 true。 */
function resolveStatus(device: DashboardRealtimeDevice): { label: string; className: string } {
	if (device.online && device.running) {
		return {
			label: '运行中',
			className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
		}
	}
	if (device.online) {
		return { label: '在线', className: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40' }
	}
	return { label: '离线', className: 'bg-slate-500/15 text-slate-400 border-slate-500/40' }
}

const deviceViews = computed<DeviceView[]>(() =>
	props.devices.map((device) => {
		const status = resolveStatus(device)
		return {
			device,
			statusLabel: status.label,
			statusClass: status.className,
			lastReportedLabel: formatShanghaiTime(device.latestReportedAt),
			metrics: KEY_METRICS.map((identifier) => ({
				identifier,
				label: metricLabel(identifier),
				value: formatMetricValue(device.metrics[identifier], identifier),
			})),
		}
	}),
)
</script>

<template>
	<div
		class="flex h-full min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900/40"
	>
		<div class="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
			<p class="text-sm font-medium text-slate-200">设备实时状态</p>
			<p class="text-xs text-slate-500">共 {{ devices.length }} 台 · 延迟判定 60 秒</p>
		</div>

		<div v-if="deviceViews.length === 0" class="flex flex-1 items-center justify-center">
			<p class="text-sm text-slate-500">{{ loading ? '数据加载中…' : '暂无设备数据' }}</p>
		</div>

		<div v-else class="grid min-h-0 flex-1 grid-cols-3 gap-3 overflow-y-auto p-3">
			<div
				v-for="view in deviceViews"
				:key="view.device.deviceId"
				class="flex flex-col rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2"
			>
				<div class="flex items-start justify-between gap-2">
					<div class="min-w-0">
						<p class="truncate text-sm font-medium text-slate-100">{{ view.device.name }}</p>
						<p class="truncate font-mono text-xs text-slate-500">{{ view.device.deviceCode }}</p>
					</div>
					<div class="flex shrink-0 flex-col items-end gap-1">
						<span class="rounded border px-2 py-0.5 text-xs" :class="view.statusClass">
							{{ view.statusLabel }}
						</span>
						<span
							v-if="view.device.delayed"
							class="rounded border border-orange-500/40 bg-orange-500/15 px-2 py-0.5 text-xs text-orange-300"
						>
							数据延迟
						</span>
					</div>
				</div>

				<dl class="mt-2 grid grid-cols-3 gap-2 border-t border-slate-800 pt-2">
					<div v-for="metric in view.metrics" :key="metric.identifier" class="min-w-0">
						<dt class="truncate text-[11px] text-slate-500" :title="metric.label">
							{{ metric.label }}
						</dt>
						<dd class="truncate font-mono text-sm tabular-nums text-slate-200">
							{{ metric.value }}
						</dd>
					</div>
				</dl>

				<p class="mt-2 truncate text-[11px] text-slate-500">
					最后上报 {{ view.lastReportedLabel }}
				</p>
			</div>
		</div>
	</div>
</template>
