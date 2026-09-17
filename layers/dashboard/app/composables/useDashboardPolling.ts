import { DOMAIN_THRESHOLDS } from '~~/shared/domain/thresholds'

export interface DashboardPollingOptions {
	/** 轮询间隔（秒），默认取冻结的 dashboardRefreshSeconds = 30。 */
	intervalSeconds?: number
	/** 是否在挂载时立即执行首轮，默认 true。 */
	immediate?: boolean
}

/**
 * 定频轮询：按冻结的 30 秒间隔刷新，且保证任意时刻最多只有一轮请求在途。
 * 若上一轮尚未结束（例如数据库慢查询），本轮直接跳过并计入 skippedRounds，
 * 因此不会出现请求堆叠或结果乱序覆盖。
 */
export function useDashboardPolling(
	task: () => Promise<void>,
	options: DashboardPollingOptions = {},
) {
	const intervalSeconds = options.intervalSeconds ?? DOMAIN_THRESHOLDS.dashboardRefreshSeconds
	const intervalMs = intervalSeconds * 1_000

	const inFlight = ref(false)
	const completedRounds = ref(0)
	const skippedRounds = ref(0)
	const lastFinishedAt = ref<Date | null>(null)

	let timer: ReturnType<typeof setInterval> | null = null

	async function runOnce(): Promise<void> {
		if (inFlight.value) {
			skippedRounds.value += 1
			return
		}
		inFlight.value = true
		try {
			await task()
		} catch {
			// 单轮失败不中断轮询；错误态由调用方的 task 自行记录并展示。
		} finally {
			completedRounds.value += 1
			lastFinishedAt.value = new Date()
			inFlight.value = false
		}
	}

	function start(): void {
		if (timer !== null) return
		if (options.immediate !== false) void runOnce()
		timer = setInterval(() => void runOnce(), intervalMs)
	}

	function stop(): void {
		if (timer === null) return
		clearInterval(timer)
		timer = null
	}

	onMounted(start)
	onBeforeUnmount(stop)

	return {
		intervalSeconds,
		inFlight,
		completedRounds,
		skippedRounds,
		lastFinishedAt,
		runOnce,
		start,
		stop,
	}
}
