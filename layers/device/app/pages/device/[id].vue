<script setup lang="ts">
/**
 * 物模型与设备 - 设备详情页（只读）
 * ---------------------------------------------------------------------------
 * 数据流：
 *   1. fetchDeviceDetail(id)            → GET /api/v1/device/devices/:id
 *   2. fetchProducts()                  → GET /api/v1/device/products
 *   3. fetchProductProperties(productId)→ GET /api/v1/device/products/:id/properties
 *   4. fetchDeviceLatest(id)            → GET /api/v1/device/devices/:id/latest
 *
 * 关键口径：
 *   - 30 个属性定义来自产品，设备共享同一套模板；无 latest 记录的属性显示「—」。
 *   - latest 只读，绝不写入 DeviceLatestValue，也不补默认数值。
 *   - 「启用」（人工意志，存储字段）与「在线」（300 秒窗口派生）分开展示。
 * 本页不做编辑/启停/删除/导入。
 */
import type { DeviceSummary } from '~~/shared/contracts/device'

defineOptions({ name: 'DeviceDetailPage' })

definePageMeta({
	layout: false,
	permission: 'device:read',
})

// DeviceApiError / fetchDeviceDetail / fetchDeviceLatest / fetchProducts /
// fetchProductProperties / formatDateTime / formatPropertyValue
// 均由 Nuxt 自动导入（layers/device/app/utils/ 下的导出会并入自动导入表）。

const route = useRoute()
const deviceId = String(route.params.id)

// 必须在 setup 同步阶段解析鉴权头：useRequestHeaders / useCookie 依赖 Nuxt 实例，
// 放到 useAsyncData 的多段 await 之后会丢失上下文并抛出 NUXT_E1001。
const authHeaders = resolveAuthHeaders()

const PUMP_TYPE_LABEL: Record<DeviceSummary['pumpType'], string> = {
	COLD_SALT: '冷盐泵',
	TEMPERING: '调温泵',
	HOT_SALT: '热盐泵',
}

/**
 * 用 useAsyncData 而不是顶层 await：
 * SSR 阶段服务端不带浏览器凭证，请求可能失败；useAsyncData 会在客户端 hydration 时
 * 按需重新执行，避免页面永久停留在错误状态。
 *
 * 调用顺序受契约约束：先取设备详情确认设备存在，再取唯一产品定位属性模板，
 * 最后并行取 30 个属性定义与该设备的最新值。
 */
const {
	data: detailData,
	pending,
	error: fetchError,
	refresh,
} = await useAsyncData(`device-detail-${deviceId}`, async () => {
	const detail = await fetchDeviceDetail(deviceId, authHeaders)

	// DeviceSummary 不含 productId；按契约本项目只有 1 个产品（Z60KbveZzXk8 立式熔盐泵），
	// 因此取产品列表的唯一项即可定位到该设备的属性模板。
	const products = await fetchProducts(authHeaders)
	const [product] = products
	if (!product) {
		throw new DeviceApiError(404, 'NOT_FOUND', '未找到设备所属产品')
	}

	const [propertyList, latestList] = await Promise.all([
		fetchProductProperties(product.id, authHeaders),
		fetchDeviceLatest(deviceId, authHeaders),
	])

	return {
		device: detail,
		productName: product.name,
		properties: propertyList,
		latestByIdentifier: new Map(latestList.map((item) => [item.propertyIdentifier, item])),
	}
})

const errorMessage = computed(() =>
	describeFetchError(fetchError.value, '加载设备详情失败，请稍后重试'),
)

/** 已上报的属性条数，用于提示数据完整度；不参与任何报警判定。 */
const reportedCount = computed(() => detailData.value?.latestByIdentifier.size ?? 0)

/** 无参包装：refresh 的签名接受可选 AsyncDataExecuteOptions，不能直接绑定为 click 处理器。 */
function retry() {
	void refresh()
}
</script>

<template>
	<section class="space-y-6">
		<UButton to="/device" size="xs" color="neutral" variant="link" icon="i-lucide-arrow-left">
			返回设备列表
		</UButton>

		<!-- 加载状态 -->
		<UCard v-if="pending" class="border-slate-800 bg-slate-900/70">
			<div class="flex items-center gap-3 py-8 text-slate-400">
				<UIcon name="i-lucide-loader-circle" class="size-5 animate-spin" />
				<span>正在加载设备详情…</span>
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

		<template v-else-if="detailData?.device">
			<!-- 设备概览 -->
			<UCard class="border-slate-800 bg-slate-900/70">
				<div class="space-y-4">
					<div class="flex flex-wrap items-center gap-3">
						<h1 class="text-2xl font-semibold tracking-tight">{{ detailData!.device.name }}</h1>
						<UBadge
							:color="detailData!.device.status === 'ENABLED' ? 'success' : 'neutral'"
							variant="subtle"
							size="sm"
						>
							{{ detailData!.device.status === 'ENABLED' ? '已启用' : '已停用' }}
						</UBadge>
						<span
							class="inline-flex items-center gap-1.5 text-sm"
							:class="detailData!.device.online ? 'text-emerald-400' : 'text-slate-500'"
						>
							<span
								class="inline-block size-1.5 rounded-full"
								:class="detailData!.device.online ? 'bg-emerald-400' : 'bg-slate-600'"
							/>
							{{ detailData!.device.online ? '在线' : '离线' }}
						</span>
					</div>

					<dl class="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
						<div class="flex gap-2">
							<dt class="w-24 shrink-0 text-slate-400">设备编号</dt>
							<dd class="font-mono text-slate-200">{{ detailData!.device.deviceCode }}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="w-24 shrink-0 text-slate-400">泵型</dt>
							<dd>{{ PUMP_TYPE_LABEL[detailData!.device.pumpType] }}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="w-24 shrink-0 text-slate-400">所属产品</dt>
							<dd>{{ detailData!.productName || '—' }}</dd>
						</div>
						<div class="flex gap-2">
							<dt class="w-24 shrink-0 text-slate-400">最后上报</dt>
							<!-- 未上报时为 null，展示「—」，不使用刷新时间代替 -->
							<dd class="text-slate-300">
								{{
									detailData!.device.lastReportedAt
										? formatDateTime(detailData!.device.lastReportedAt)
										: '—'
								}}
							</dd>
						</div>
					</dl>

					<p class="text-xs text-slate-500">
						「启用」由管理员设置，决定是否接收新上报；「在线」由最近 300
						秒内是否存在成功上报派生，二者相互独立。
					</p>
				</div>
			</UCard>

			<!-- 属性定义与最新值 -->
			<UCard class="border-slate-800 bg-slate-900/70">
				<template #header>
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<p class="font-semibold">物模型属性</p>
							<p class="text-xs text-slate-400">
								共 {{ detailData!.properties.length }} 个属性定义，已上报
								{{ reportedCount }} 个。未上报显示「—」。
							</p>
						</div>
					</div>
				</template>

				<!-- 属性定义空状态 -->
				<div
					v-if="detailData!.properties.length === 0"
					class="flex flex-col items-center gap-2 py-10 text-slate-400"
				>
					<UIcon name="i-lucide-inbox" class="size-6" />
					<p class="text-sm">暂无属性定义</p>
				</div>

				<div v-else class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b border-slate-800 text-left text-xs text-slate-400">
								<th class="px-4 py-3 font-medium">属性名称</th>
								<th class="px-4 py-3 font-medium">标识符</th>
								<th class="px-4 py-3 font-medium">数据类型</th>
								<th class="px-4 py-3 font-medium">单位</th>
								<th class="px-4 py-3 font-medium">最新值</th>
								<th class="px-4 py-3 font-medium">数据时间</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="property in detailData!.properties"
								:key="property.identifier"
								class="border-b border-slate-800/60 last:border-b-0 hover:bg-slate-800/30"
							>
								<td class="px-4 py-3">{{ property.name }}</td>
								<td class="px-4 py-3 font-mono text-xs text-slate-400">
									{{ property.identifier }}
								</td>
								<td class="px-4 py-3 text-slate-400">{{ property.dataType }}</td>
								<td class="px-4 py-3 text-slate-400">{{ property.unit || '—' }}</td>
								<td class="px-4 py-3">
									<!-- 无 latest 记录 → undefined → 渲染「—」，绝不补默认数值 -->
									{{
										formatPropertyValue(
											detailData!.latestByIdentifier.get(property.identifier)?.value,
											property.unit,
										)
									}}
								</td>
								<td class="px-4 py-3 text-slate-400">
									{{
										detailData!.latestByIdentifier.get(property.identifier)
											? formatDateTime(
													detailData!.latestByIdentifier.get(property.identifier)!.reportedAt,
												)
											: '—'
									}}
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</UCard>
		</template>
	</section>
</template>
