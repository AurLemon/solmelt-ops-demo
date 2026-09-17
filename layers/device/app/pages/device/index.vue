<script setup lang="ts">
/**
 * 物模型与设备 - 设备列表页（只读）
 * ---------------------------------------------------------------------------
 * 数据流：fetchDevicePage → GET /api/v1/device/devices → PageResult<DeviceSummary>
 * 契约：字段与语义来自 shared/contracts/device.ts；「在线」是服务端按 300 秒
 *       窗口派生的只读值，页面只渲染不覆写，不与「启用」混用。
 * 本页不做编辑/启停/删除/导入，不生成默认数值。
 */
import type { DeviceSummary } from '~~/shared/contracts/device'

defineOptions({ name: 'DeviceListPage' })

definePageMeta({
	layout: false,
	permission: 'device:read',
})

// fetchDevicePage / DeviceApiError / formatDateTime 由 Nuxt 自动导入
// （layers/device/app/utils/ 下的导出会并入自动导入表），此处不再显式 import。

const PAGE_SIZE = 20

const page = ref(1)

// 必须在 setup 同步阶段解析鉴权头：useRequestHeaders / useCookie 依赖 Nuxt 实例，
// 放到 useAsyncData 的多段 await 之后会丢失上下文并抛出 NUXT_E1001。
const authHeaders = resolveAuthHeaders()

/** 泵型的中文展示，值域来自冻结的 PumpType。 */
const PUMP_TYPE_LABEL: Record<DeviceSummary['pumpType'], string> = {
	COLD_SALT: '冷盐泵',
	TEMPERING: '调温泵',
	HOT_SALT: '热盐泵',
}

/**
 * 用 useAsyncData 而不是顶层 await：
 * SSR 阶段服务端不带浏览器凭证，请求可能失败；useAsyncData 会在客户端 hydration 时
 * 按需重新执行，避免页面永久停留在错误状态。分页变化由 watch 触发 refresh。
 */
const {
	data: result,
	pending,
	error: fetchError,
	refresh,
} = await useAsyncData(
	'device-list',
	() => fetchDevicePage(authHeaders, { page: page.value, pageSize: PAGE_SIZE }),
	{
		watch: [page],
	},
)

const errorMessage = computed(() =>
	describeFetchError(fetchError.value, '加载设备列表失败，请稍后重试'),
)

const totalPages = computed(() =>
	result.value ? Math.max(1, Math.ceil(result.value.total / result.value.pageSize)) : 1,
)

/** 无参包装：refresh 的签名接受可选 AsyncDataExecuteOptions，不能直接绑定为 click 处理器。 */
function retry() {
	void refresh()
}
</script>

<template>
	<section class="space-y-6">
		<header class="space-y-1">
			<h1 class="text-2xl font-semibold tracking-tight">熔盐泵设备</h1>
			<p class="text-sm text-slate-400">
				共
				<span class="font-mono text-slate-200">{{ result?.total ?? 0 }}</span>
				台设备。数据来自物模型目录，在线状态按最近 300 秒上报派生。
			</p>
		</header>

		<!-- 加载状态 -->
		<UCard v-if="pending" class="border-slate-800 bg-slate-900/70">
			<div class="flex items-center gap-3 py-8 text-slate-400">
				<UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
				<span>正在加载设备列表…</span>
			</div>
		</UCard>

		<!-- 错误状态 -->
		<UCard v-else-if="errorMessage" class="border-red-900 bg-red-950/40">
			<div class="flex items-start gap-3 py-4">
				<UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-5 shrink-0 text-red-400" />
				<div class="space-y-3">
					<p class="text-sm text-red-200">{{ errorMessage }}</p>
					<UButton size="xs" color="error" variant="soft" @click="retry">重试</UButton>
				</div>
			</div>
		</UCard>

		<!-- 空状态 -->
		<UCard
			v-else-if="!result || result.items.length === 0"
			class="border-slate-800 bg-slate-900/70"
		>
			<div class="flex flex-col items-center gap-2 py-10 text-slate-400">
				<UIcon name="i-lucide-inbox" class="size-6" />
				<p class="text-sm">暂无设备数据</p>
			</div>
		</UCard>

		<!-- 列表 -->
		<template v-else>
			<UCard class="overflow-x-auto border-slate-800 bg-slate-900/70" :ui="{ body: 'p-0' }">
				<table class="w-full text-sm">
					<thead>
						<tr class="border-b border-slate-800 text-left text-xs text-slate-400">
							<th class="px-4 py-3 font-medium">设备编号</th>
							<th class="px-4 py-3 font-medium">设备名称</th>
							<th class="px-4 py-3 font-medium">泵型</th>
							<th class="px-4 py-3 font-medium">启用状态</th>
							<th class="px-4 py-3 font-medium">在线状态</th>
							<th class="px-4 py-3 font-medium">最后上报</th>
							<th class="px-4 py-3 text-right font-medium">操作</th>
						</tr>
					</thead>
					<tbody>
						<tr
							v-for="device in result.items"
							:key="device.id"
							class="border-b border-slate-800/60 last:border-b-0 hover:bg-slate-800/30"
						>
							<td class="px-4 py-3 font-mono text-slate-200">{{ device.deviceCode }}</td>
							<td class="px-4 py-3">{{ device.name }}</td>
							<td class="px-4 py-3 text-slate-300">
								{{ PUMP_TYPE_LABEL[device.pumpType] }}
							</td>
							<td class="px-4 py-3">
								<UBadge
									:color="device.status === 'ENABLED' ? 'success' : 'neutral'"
									variant="subtle"
									size="sm"
								>
									{{ device.status === 'ENABLED' ? '已启用' : '已停用' }}
								</UBadge>
							</td>
							<td class="px-4 py-3">
								<span
									class="inline-flex items-center gap-1.5"
									:class="device.online ? 'text-emerald-400' : 'text-slate-500'"
								>
									<span
										class="inline-block size-1.5 rounded-full"
										:class="device.online ? 'bg-emerald-400' : 'bg-slate-600'"
									/>
									{{ device.online ? '在线' : '离线' }}
								</span>
							</td>
							<td class="px-4 py-3 text-slate-400">
								<!-- 未上报时 lastReportedAt 为 null，展示「—」而非编造时间 -->
								{{ device.lastReportedAt ? formatDateTime(device.lastReportedAt) : '—' }}
							</td>
							<td class="px-4 py-3 text-right">
								<UButton size="xs" color="primary" variant="link" :to="`/device/${device.id}`">
									查看详情
								</UButton>
							</td>
						</tr>
					</tbody>
				</table>
			</UCard>

			<!-- 分页 -->
			<div v-if="totalPages > 1" class="flex items-center justify-between text-sm text-slate-400">
				<span>第 {{ result.page }} / {{ totalPages }} 页</span>
				<div class="flex gap-2">
					<UButton
						size="xs"
						color="neutral"
						variant="outline"
						:disabled="page <= 1"
						@click="page -= 1"
					>
						上一页
					</UButton>
					<UButton
						size="xs"
						color="neutral"
						variant="outline"
						:disabled="page >= totalPages"
						@click="page += 1"
					>
						下一页
					</UButton>
				</div>
			</div>
		</template>
	</section>
</template>
