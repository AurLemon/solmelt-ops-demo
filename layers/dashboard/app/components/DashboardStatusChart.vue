<script setup lang="ts">
import type { EChartsOption } from 'echarts'

const props = defineProps<{
	deviceTotal: number
	onlineCount: number
	offlineCount: number
}>()

/** 在线 / 离线严格取自接口返回的冻结口径，不在此处重新推导判定规则。 */
const option = computed<EChartsOption>(() => ({
	backgroundColor: 'transparent',
	tooltip: {
		trigger: 'item',
		backgroundColor: '#0f172a',
		borderColor: '#1e293b',
		textStyle: { color: '#e2e8f0' },
	},
	series: [
		{
			type: 'pie',
			radius: ['58%', '80%'],
			center: ['50%', '50%'],
			label: { show: false },
			labelLine: { show: false },
			emphasis: { scale: false },
			data: [
				{ name: '在线', value: props.onlineCount, itemStyle: { color: '#34d399' } },
				{ name: '离线', value: props.offlineCount, itemStyle: { color: '#475569' } },
			],
		},
	],
}))

const { container } = useEChart(option)
</script>

<template>
	<div class="flex h-full min-h-0 flex-col rounded-lg border border-slate-800 bg-slate-900/40">
		<div class="shrink-0 border-b border-slate-800 px-4 py-2">
			<p class="text-sm font-medium text-slate-200">在线状态分布</p>
		</div>
		<div class="relative min-h-0 flex-1">
			<div ref="container" class="size-full" />
			<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
				<p class="text-2xl leading-none font-semibold tabular-nums text-slate-100">
					{{ deviceTotal === 0 ? '—' : `${onlineCount}/${deviceTotal}` }}
				</p>
				<p class="mt-1 text-xs text-slate-500">
					{{ deviceTotal === 0 ? '暂无设备' : '在线 / 总数' }}
				</p>
			</div>
		</div>
		<div class="flex shrink-0 items-center justify-center gap-5 border-t border-slate-800 py-2">
			<div class="flex items-center gap-2">
				<span class="size-2.5 rounded-full bg-emerald-400" />
				<span class="text-xs text-slate-400">在线</span>
				<span class="font-mono text-xs tabular-nums text-slate-200">{{ onlineCount }}</span>
			</div>
			<div class="flex items-center gap-2">
				<span class="size-2.5 rounded-full bg-slate-600" />
				<span class="text-xs text-slate-400">离线</span>
				<span class="font-mono text-xs tabular-nums text-slate-200">{{ offlineCount }}</span>
			</div>
		</div>
	</div>
</template>
