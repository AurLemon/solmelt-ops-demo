import type { ECharts, EChartsOption } from 'echarts'
import type { MaybeRefOrGetter } from 'vue'

/**
 * ECharts 生命周期封装：动态引入避免 SSR 期求值、跟随容器尺寸自适应、卸载时释放实例。
 * 图表只渲染传入的真实聚合结果，不在此处生成任何数据。
 */
export function useEChart(option: MaybeRefOrGetter<EChartsOption>) {
	const container = ref<HTMLElement | null>(null)
	let instance: ECharts | null = null
	let observer: ResizeObserver | null = null
	let initializing: Promise<void> | null = null

	function releaseInstance(): void {
		observer?.disconnect()
		observer = null
		instance?.dispose()
		instance = null
		initializing = null
	}

	async function render(): Promise<void> {
		const target = container.value
		// 容器尚未插入 DOM（例如空态分支）时直接跳过，等 watch 在挂载后再次触发。
		if (!target) return

		// 条件渲染切换后会得到新的 DOM 节点，旧实例必须释放重建，否则图表画在被移除的节点上。
		if (instance && instance.getDom() !== target) releaseInstance()

		if (!instance) {
			initializing ??= import('echarts').then((module) => {
				if (instance || !container.value) return
				instance = module.init(container.value)
				observer = new ResizeObserver(() => instance?.resize())
				observer.observe(container.value)
			})
			await initializing
			// 异步引入期间容器仍不可用：丢弃这个已完成的 Promise，允许下次重新初始化。
			if (!instance) initializing = null
		}

		instance?.setOption(toValue(option), { notMerge: true })
	}

	onMounted(() => void render())
	// flush: 'post' 保证 DOM 已更新后再初始化，否则首个分支拿到的是 null 容器。
	watch([() => toValue(option), container], () => void render(), { deep: true, flush: 'post' })
	onBeforeUnmount(releaseInstance)

	return { container, render }
}
