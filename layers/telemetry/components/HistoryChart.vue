<script setup lang="ts">
import type { ECharts } from 'echarts'
import type { TelemetryPoint } from '~~/shared/contracts/telemetry'
import { formatBeijingTime } from '../composables/useTelemetryData'

const props = defineProps<{
	points: TelemetryPoint[]
	unit: string
	propertyName: string
}>()

const chartEl = ref<HTMLElement | null>(null)
let chart: ECharts | null = null

// 鲜艳色板，暗色背景下高可见度
const COLORS = [
	'#fbbf24',
	'#34d399',
	'#60a5fa',
	'#f472b6',
	'#a78bfa',
	'#facc15',
	'#2dd4bf',
	'#fb7185',
	'#c084fc',
]

function buildOption() {
	const deviceMap = new Map<string, TelemetryPoint[]>()
	for (const p of props.points) {
		const list = deviceMap.get(p.deviceCode) ?? []
		list.push(p)
		deviceMap.set(p.deviceCode, list)
	}

	const allTimes = [...new Set(props.points.map((p) => p.reportedAt))].sort()
	const timeLabels = allTimes.map((t) => formatBeijingTime(t))

	const series = [...deviceMap.entries()].map(([code, pts], idx) => {
		const pointMap = new Map(pts.map((p) => [p.reportedAt, p]))
		return {
			name: code,
			type: 'line' as const,
			data: allTimes.map((t) => {
				const p = pointMap.get(t)
				if (!p) return null
				return typeof p.value === 'boolean' ? (p.value ? 1 : 0) : p.value
			}),
			smooth: false,
			symbol: 'circle',
			symbolSize: 4,
			lineStyle: { width: 2 },
			itemStyle: { color: COLORS[idx % COLORS.length] },
			connectNulls: true,
		}
	})

	return {
		backgroundColor: 'transparent',
		textStyle: { color: '#cbd5e1' },
		color: COLORS,
		tooltip: {
			trigger: 'axis',
			backgroundColor: '#0f172a',
			borderColor: '#334155',
			textStyle: { color: '#e2e8f0' },
			axisPointer: { type: 'line', lineStyle: { color: '#475569' } },
		},
		legend: {
			data: [...deviceMap.keys()],
			textStyle: { color: '#cbd5e1', fontSize: 12 },
			bottom: 0,
		},
		grid: { left: 55, right: 20, top: 20, bottom: 50 },
		xAxis: {
			type: 'category',
			data: timeLabels,
			axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 30 },
			axisLine: { lineStyle: { color: '#334155' } },
		},
		yAxis: {
			type: 'value',
			name: props.unit || '',
			nameTextStyle: { color: '#94a3b8' },
			axisLabel: { color: '#94a3b8' },
			splitLine: { lineStyle: { color: '#1e293b' } },
			axisLine: { show: false },
		},
		series,
	}
}

async function renderChart() {
	if (!chartEl.value) return
	if (!chart) {
		const echarts = await import('echarts')
		chart = echarts.init(chartEl.value)
	}
	chart.setOption(buildOption(), true)
}

onMounted(() => {
	renderChart()
})

watch(
	() => props.points,
	() => renderChart(),
)

onUnmounted(() => {
	chart?.dispose()
	chart = null
})
</script>

<template>
	<div v-if="points.length === 0" class="flex h-[360px] items-center justify-center text-slate-500">
		暂无数据，请调整查询条件后重试
	</div>
	<div v-else ref="chartEl" class="h-[360px] w-full" />
</template>
