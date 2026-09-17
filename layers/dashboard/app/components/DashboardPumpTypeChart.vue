<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { PumpTypeCount } from '~~/shared/contracts/dashboard'

const props = defineProps<{ pumpTypes: PumpTypeCount[] }>()

const option = computed<EChartsOption>(() => ({
	backgroundColor: 'transparent',
	grid: { left: 4, right: 28, top: 6, bottom: 6, containLabel: true },
	tooltip: {
		trigger: 'axis',
		axisPointer: { type: 'shadow' },
		backgroundColor: '#0f172a',
		borderColor: '#1e293b',
		textStyle: { color: '#e2e8f0' },
	},
	xAxis: {
		type: 'value',
		minInterval: 1,
		axisLabel: { color: '#94a3b8', fontSize: 11 },
		splitLine: { lineStyle: { color: '#1e293b' } },
	},
	yAxis: {
		type: 'category',
		data: props.pumpTypes.map((item) => pumpTypeLabel(item.type)),
		axisLabel: { color: '#cbd5e1', fontSize: 12 },
		axisLine: { lineStyle: { color: '#1e293b' } },
		axisTick: { show: false },
	},
	series: [
		{
			name: '设备总数',
			type: 'bar',
			barWidth: 10,
			itemStyle: { color: '#475569', borderRadius: [0, 4, 4, 0] },
			data: props.pumpTypes.map((item) => item.total),
		},
		{
			name: '运行中',
			type: 'bar',
			barWidth: 10,
			itemStyle: { color: '#fbbf24', borderRadius: [0, 4, 4, 0] },
			data: props.pumpTypes.map((item) => item.running),
		},
	],
}))

const { container } = useEChart(option)
</script>

<template>
	<div class="flex h-full min-h-0 flex-col rounded-lg border border-slate-800 bg-slate-900/40">
		<div class="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-2">
			<p class="text-sm font-medium text-slate-200">泵型分布</p>
			<p class="text-xs text-slate-500">运行中 / 总数</p>
		</div>

		<div class="relative min-h-0 flex-1">
			<div ref="container" class="size-full" />
			<div
				v-if="pumpTypes.length === 0"
				class="pointer-events-none absolute inset-0 flex items-center justify-center"
			>
				<p class="text-sm text-slate-500">暂无泵型数据</p>
			</div>
		</div>

		<div class="flex shrink-0 items-center justify-center gap-5 border-t border-slate-800 py-2">
			<div class="flex items-center gap-2">
				<span class="size-2.5 rounded-full bg-slate-600" />
				<span class="text-xs text-slate-400">设备总数</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="size-2.5 rounded-full bg-amber-400" />
				<span class="text-xs text-slate-400">运行中</span>
			</div>
		</div>
	</div>
</template>
