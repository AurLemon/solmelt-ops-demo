<script setup lang="ts">
import type {
	DeviceStatus,
	DeviceSummary,
	ProductPropertyDefinition,
	ProductSummary,
	PumpType,
} from '~~/shared/contracts/device'

defineOptions({ name: 'DeviceManagementPage' })
definePageMeta({ layout: 'dashboard', permission: 'device:read' })
useHead({ title: '物模型与设备管理 - SolMelt' })

type ManagementView = 'devices' | 'product'
type StatusFilter = 'ALL' | DeviceStatus

const PAGE_SIZE = 20
const PRODUCT_IDENTIFIER = 'Z60KbveZzXk8'
const PRODUCT_NAME = '立式熔盐泵'

const { hasPermission } = useAuth()
const canWrite = computed(() => hasPermission('device:write'))
const authHeaders = resolveAuthHeaders()

const view = ref<ManagementView>('devices')
const products = ref<ProductSummary[]>([])
const properties = ref<ProductPropertyDefinition[]>([])
const devices = ref<DeviceSummary[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const statusFilter = ref<StatusFilter>('ALL')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const productEditorOpen = ref(false)
const productForm = ref({ identifier: PRODUCT_IDENTIFIER, name: PRODUCT_NAME, remark: '' })
const importFile = ref<File | null>(null)
const importing = ref(false)

const deviceEditorOpen = ref(false)
const editingDevice = ref<DeviceSummary | null>(null)
const removalTarget = ref<DeviceSummary | null>(null)
const savingDevice = ref(false)
const deviceForm = ref({
	productId: '',
	deviceCode: '',
	name: '',
	pumpType: 'COLD_SALT' as PumpType,
	status: 'ENABLED' as DeviceStatus,
})

const selectedProduct = computed(() => products.value[0] ?? null)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const pumpTypeOptions = [
	{ label: '冷盐泵', value: 'COLD_SALT' },
	{ label: '调温泵', value: 'TEMPERING' },
	{ label: '热盐泵', value: 'HOT_SALT' },
] satisfies ReadonlyArray<{ label: string; value: PumpType }>

const statusOptions = [
	{ label: '启用', value: 'ENABLED' },
	{ label: '停用', value: 'DISABLED' },
] satisfies ReadonlyArray<{ label: string; value: DeviceStatus }>

const statusFilterOptions = [
	{ label: '全部状态', value: 'ALL' },
	...statusOptions,
] satisfies ReadonlyArray<{ label: string; value: StatusFilter }>

const productOptions = computed(() =>
	products.value.map((product) => ({
		label: `${product.name}（${product.identifier}）`,
		value: product.id,
	})),
)

const pumpTypeLabel: Record<PumpType, string> = {
	COLD_SALT: '冷盐泵',
	TEMPERING: '调温泵',
	HOT_SALT: '热盐泵',
}

function clearMessages(): void {
	errorMessage.value = ''
	successMessage.value = ''
}

function errorText(error: unknown, fallback: string): string {
	return error instanceof Error ? error.message : fallback
}

async function loadProducts(): Promise<void> {
	products.value = await fetchProducts(authHeaders)
	const product = products.value[0]
	properties.value = product ? await fetchProductProperties(product.id, authHeaders) : []
}

async function loadDevices(): Promise<void> {
	const result = await fetchDevicePage(authHeaders, {
		page: page.value,
		pageSize: PAGE_SIZE,
		...(keyword.value.trim() ? { keyword: keyword.value.trim() } : {}),
		...(statusFilter.value === 'ALL' ? {} : { status: statusFilter.value }),
	})
	devices.value = result.items
	total.value = result.total
}

async function loadAll(): Promise<void> {
	loading.value = true
	errorMessage.value = ''
	try {
		await Promise.all([loadProducts(), loadDevices()])
	} catch (error) {
		errorMessage.value = errorText(error, '物模型与设备数据加载失败')
	} finally {
		loading.value = false
	}
}

function search(): void {
	page.value = 1
	void loadDevices().catch((error: unknown) => {
		errorMessage.value = errorText(error, '设备列表加载失败')
	})
}

function changePage(next: number): void {
	page.value = next
	void loadDevices().catch((error: unknown) => {
		errorMessage.value = errorText(error, '设备列表加载失败')
	})
}

function openProductEditor(): void {
	productForm.value = { identifier: PRODUCT_IDENTIFIER, name: PRODUCT_NAME, remark: '' }
	productEditorOpen.value = true
}

async function submitProduct(): Promise<void> {
	clearMessages()
	try {
		await createProduct(
			{
				identifier: productForm.value.identifier,
				name: productForm.value.name,
				...(productForm.value.remark ? { remark: productForm.value.remark } : {}),
			},
			authHeaders,
		)
		productEditorOpen.value = false
		successMessage.value = '产品创建成功'
		await loadProducts()
	} catch (error) {
		errorMessage.value = errorText(error, '产品创建失败')
	}
}

function selectImportFile(event: Event): void {
	const input = event.target as HTMLInputElement
	importFile.value = input.files?.[0] ?? null
}

async function submitImport(): Promise<void> {
	if (!selectedProduct.value || !importFile.value) {
		errorMessage.value = '请选择一份老师物模型 JSON 文件'
		return
	}

	clearMessages()
	importing.value = true
	try {
		const result = await importProductProperties(
			selectedProduct.value.id,
			importFile.value,
			authHeaders,
		)
		successMessage.value = `物模型导入完成，共校验 ${result.importedPropertyCount} 个属性`
		importFile.value = null
		await loadProducts()
	} catch (error) {
		errorMessage.value = errorText(error, '物模型导入失败')
	} finally {
		importing.value = false
	}
}

function openCreateDevice(): void {
	editingDevice.value = null
	deviceForm.value = {
		productId: selectedProduct.value?.id ?? '',
		deviceCode: '',
		name: '',
		pumpType: 'COLD_SALT',
		status: 'ENABLED',
	}
	deviceEditorOpen.value = true
}

function openEditDevice(device: DeviceSummary): void {
	editingDevice.value = device
	deviceForm.value = {
		productId: selectedProduct.value?.id ?? '',
		deviceCode: device.deviceCode,
		name: device.name,
		pumpType: device.pumpType,
		status: device.status,
	}
	deviceEditorOpen.value = true
}

async function submitDevice(): Promise<void> {
	clearMessages()
	savingDevice.value = true
	try {
		if (editingDevice.value) {
			await updateDevice(
				editingDevice.value.id,
				{
					name: deviceForm.value.name,
					pumpType: deviceForm.value.pumpType,
					status: deviceForm.value.status,
				},
				authHeaders,
			)
			successMessage.value = '设备信息已更新'
		} else {
			await createDevice(
				{
					productId: deviceForm.value.productId,
					deviceCode: deviceForm.value.deviceCode,
					name: deviceForm.value.name,
					pumpType: deviceForm.value.pumpType,
					status: deviceForm.value.status,
				},
				authHeaders,
			)
			successMessage.value = '设备创建成功'
		}
		deviceEditorOpen.value = false
		await loadDevices()
	} catch (error) {
		errorMessage.value = errorText(error, '设备保存失败')
	} finally {
		savingDevice.value = false
	}
}

async function toggleDeviceStatus(device: DeviceSummary): Promise<void> {
	clearMessages()
	try {
		const nextStatus: DeviceStatus = device.status === 'ENABLED' ? 'DISABLED' : 'ENABLED'
		await updateDevice(
			device.id,
			{ name: device.name, pumpType: device.pumpType, status: nextStatus },
			authHeaders,
		)
		successMessage.value = nextStatus === 'ENABLED' ? '设备已启用' : '设备已停用'
		await loadDevices()
	} catch (error) {
		errorMessage.value = errorText(error, '设备状态更新失败')
	}
}

async function confirmRemoval(): Promise<void> {
	if (!removalTarget.value) return
	clearMessages()
	try {
		await deleteDevice(removalTarget.value.id, authHeaders)
		successMessage.value = `设备 ${removalTarget.value.deviceCode} 已逻辑删除`
		removalTarget.value = null
		await loadDevices()
	} catch (error) {
		errorMessage.value = errorText(error, '设备删除失败')
	}
}

onMounted(() => void loadAll())
</script>

<template>
	<section class="space-y-5">
		<header class="flex flex-wrap items-end justify-between gap-3">
			<div>
				<h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">物模型与设备管理</h1>
				<p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
					产品与设备身份来自老师物模型；在线状态按最近 300 秒成功上报派生。
				</p>
			</div>
			<div class="inline-flex rounded-md border border-slate-200 p-1 dark:border-slate-700">
				<UButton
					icon="i-lucide-cpu"
					color="neutral"
					:variant="view === 'devices' ? 'solid' : 'ghost'"
					@click="view = 'devices'"
				>
					设备管理
				</UButton>
				<UButton
					icon="i-lucide-box"
					color="neutral"
					:variant="view === 'product' ? 'solid' : 'ghost'"
					@click="view = 'product'"
				>
					产品与物模型
				</UButton>
			</div>
		</header>

		<UAlert
			v-if="errorMessage"
			color="error"
			variant="subtle"
			title="操作失败"
			:description="errorMessage"
		/>
		<UAlert
			v-if="successMessage"
			color="success"
			variant="subtle"
			title="操作完成"
			:description="successMessage"
		/>

		<div v-if="loading" class="flex min-h-64 items-center justify-center text-slate-500">
			<UIcon name="i-lucide-loader-circle" class="mr-2 size-5 animate-spin" />
			正在读取真实业务数据…
		</div>

		<template v-else-if="view === 'product'">
			<div
				v-if="selectedProduct"
				class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
			>
				<div
					class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800"
				>
					<div>
						<div class="flex items-center gap-2">
							<h2 class="font-semibold text-slate-900 dark:text-slate-100">
								{{ selectedProduct.name }}
							</h2>
							<UBadge color="warning" variant="subtle">{{ selectedProduct.identifier }}</UBadge>
						</div>
						<p class="mt-1 text-sm text-slate-500">
							{{ properties.length }} 个属性定义 · {{ selectedProduct.remark || '老师固定物模型' }}
						</p>
					</div>
					<label v-if="canWrite" class="flex flex-wrap items-center justify-end gap-2 text-sm">
						<input
							type="file"
							accept="application/json,.json"
							class="max-w-64 text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-slate-700 dark:file:bg-slate-800 dark:file:text-slate-200"
							@change="selectImportFile"
						/>
						<UButton
							icon="i-lucide-upload"
							color="warning"
							:disabled="!importFile"
							:loading="importing"
							@click="submitImport"
							>导入物模型</UButton
						>
					</label>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-950/50">
							<tr>
								<th class="px-4 py-3">属性名称</th>
								<th class="px-4 py-3">标识符</th>
								<th class="px-4 py-3">类型</th>
								<th class="px-4 py-3">单位</th>
								<th class="px-4 py-3">分类</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="property in properties"
								:key="property.identifier"
								class="border-t border-slate-100 dark:border-slate-800"
							>
								<td class="px-4 py-3">{{ property.name }}</td>
								<td class="px-4 py-3 font-mono text-xs text-slate-500">
									{{ property.identifier }}
								</td>
								<td class="px-4 py-3">{{ property.dataType }}</td>
								<td class="px-4 py-3">{{ property.unit || '—' }}</td>
								<td class="px-4 py-3">{{ property.category }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>

			<div v-else class="flex min-h-64 flex-col items-center justify-center gap-3 text-slate-500">
				<UIcon name="i-lucide-package-open" class="size-8" />
				<p>尚未创建立式熔盐泵产品</p>
				<UButton v-if="canWrite" icon="i-lucide-plus" color="warning" @click="openProductEditor"
					>创建固定产品</UButton
				>
			</div>
		</template>

		<template v-else>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="flex flex-1 flex-wrap items-center gap-2">
					<UInput
						v-model="keyword"
						icon="i-lucide-search"
						placeholder="按设备编号或名称搜索"
						class="min-w-64"
						@keydown.enter="search"
					/>
					<USelect v-model="statusFilter" :items="statusFilterOptions" class="w-36" />
					<UButton icon="i-lucide-search" color="neutral" variant="soft" @click="search"
						>查询</UButton
					>
				</div>
				<div class="flex items-center gap-3">
					<span class="text-sm text-slate-500">共 {{ total }} 台</span
					><UButton
						v-if="canWrite"
						icon="i-lucide-plus"
						color="warning"
						:disabled="products.length === 0"
						@click="openCreateDevice"
						>新增设备</UButton
					>
				</div>
			</div>

			<div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
				<table class="w-full text-sm">
					<thead class="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900">
						<tr>
							<th class="px-4 py-3">设备编号</th>
							<th class="px-4 py-3">设备名称</th>
							<th class="px-4 py-3">泵型</th>
							<th class="px-4 py-3">启用状态</th>
							<th class="px-4 py-3">在线状态</th>
							<th class="px-4 py-3">最后上报</th>
							<th class="px-4 py-3 text-right">操作</th>
						</tr>
					</thead>
					<tbody>
						<tr v-if="devices.length === 0">
							<td colspan="7" class="px-4 py-12 text-center text-slate-500">没有匹配的设备</td>
						</tr>
						<tr
							v-for="device in devices"
							:key="device.id"
							class="border-t border-slate-100 hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/30"
						>
							<td class="px-4 py-3 font-mono text-xs">{{ device.deviceCode }}</td>
							<td class="px-4 py-3">{{ device.name }}</td>
							<td class="px-4 py-3">{{ pumpTypeLabel[device.pumpType] }}</td>
							<td class="px-4 py-3">
								<UBadge
									:color="device.status === 'ENABLED' ? 'success' : 'neutral'"
									variant="subtle"
									>{{ device.status === 'ENABLED' ? '已启用' : '已停用' }}</UBadge
								>
							</td>
							<td class="px-4 py-3">
								<span :class="device.online ? 'text-emerald-500' : 'text-slate-500'">{{
									device.online ? '在线' : '离线'
								}}</span>
							</td>
							<td class="px-4 py-3 text-slate-500">
								{{ device.lastReportedAt ? formatDateTime(device.lastReportedAt) : '—' }}
							</td>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1">
									<UButton
										icon="i-lucide-eye"
										size="xs"
										color="neutral"
										variant="ghost"
										:to="`/devices/${device.id}`"
										title="查看详情"
									/>
									<UButton
										v-if="canWrite"
										icon="i-lucide-pencil"
										size="xs"
										color="neutral"
										variant="ghost"
										title="编辑设备"
										@click="openEditDevice(device)"
									/>
									<UButton
										v-if="canWrite"
										:icon="device.status === 'ENABLED' ? 'i-lucide-pause' : 'i-lucide-play'"
										size="xs"
										color="neutral"
										variant="ghost"
										:title="device.status === 'ENABLED' ? '停用设备' : '启用设备'"
										@click="toggleDeviceStatus(device)"
									/>
									<UButton
										v-if="canWrite"
										icon="i-lucide-trash-2"
										size="xs"
										color="error"
										variant="ghost"
										title="删除设备"
										@click="removalTarget = device"
									/>
								</div>
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<div v-if="totalPages > 1" class="flex items-center justify-between text-sm text-slate-500">
				<span>第 {{ page }} / {{ totalPages }} 页</span>
				<div class="flex gap-2">
					<UButton
						icon="i-lucide-chevron-left"
						size="xs"
						color="neutral"
						variant="outline"
						:disabled="page <= 1"
						@click="changePage(page - 1)"
					/><UButton
						icon="i-lucide-chevron-right"
						size="xs"
						color="neutral"
						variant="outline"
						:disabled="page >= totalPages"
						@click="changePage(page + 1)"
					/>
				</div>
			</div>
		</template>

		<UModal
			v-if="canWrite"
			v-model:open="productEditorOpen"
			title="创建产品"
			description="当前系统只接受老师指定的立式熔盐泵产品。"
		>
			<template #body
				><form id="product-editor" class="space-y-3" @submit.prevent="submitProduct">
					<label class="block space-y-1 text-sm"
						><span>产品标识</span><UInput v-model="productForm.identifier" class="w-full" /></label
					><label class="block space-y-1 text-sm"
						><span>产品名称</span><UInput v-model="productForm.name" class="w-full" /></label
					><label class="block space-y-1 text-sm"
						><span>备注</span><UInput v-model="productForm.remark" class="w-full"
					/></label></form
			></template>
			<template #footer
				><UButton type="submit" form="product-editor" color="warning">创建</UButton
				><UButton color="neutral" variant="soft" @click="productEditorOpen = false"
					>取消</UButton
				></template
			>
		</UModal>

		<UModal
			v-if="canWrite"
			v-model:open="deviceEditorOpen"
			:title="editingDevice ? `编辑设备：${editingDevice.deviceCode}` : '新增设备'"
			description="设备编号、名称和泵型必须与老师物模型目录一致。"
			:ui="{ content: 'max-w-2xl' }"
		>
			<template #body
				><form id="device-editor" class="grid gap-3 md:grid-cols-2" @submit.prevent="submitDevice">
					<label v-if="!editingDevice" class="space-y-1 text-sm md:col-span-2"
						><span>所属产品</span
						><USelect v-model="deviceForm.productId" :items="productOptions" class="w-full"
					/></label>
					<label class="space-y-1 text-sm"
						><span>设备编号</span
						><UInput
							v-model="deviceForm.deviceCode"
							class="w-full"
							:disabled="Boolean(editingDevice)"
					/></label>
					<label class="space-y-1 text-sm"
						><span>设备名称</span><UInput v-model="deviceForm.name" class="w-full"
					/></label>
					<label class="space-y-1 text-sm"
						><span>泵型</span
						><USelect v-model="deviceForm.pumpType" :items="pumpTypeOptions" class="w-full"
					/></label>
					<label class="space-y-1 text-sm"
						><span>启用状态</span
						><USelect v-model="deviceForm.status" :items="statusOptions" class="w-full"
					/></label></form
			></template>
			<template #footer
				><UButton type="submit" form="device-editor" color="warning" :loading="savingDevice"
					>保存</UButton
				><UButton color="neutral" variant="soft" @click="deviceEditorOpen = false"
					>取消</UButton
				></template
			>
		</UModal>

		<UModal
			:open="Boolean(removalTarget)"
			title="逻辑删除设备"
			:description="
				removalTarget
					? `确认删除「${removalTarget.name}（${removalTarget.deviceCode}）」？历史遥测与报警会保留。`
					: ''
			"
			@update:open="
				(open) => {
					if (!open) removalTarget = null
				}
			"
		>
			<template #footer
				><UButton icon="i-lucide-trash-2" color="error" @click="confirmRemoval">确认删除</UButton
				><UButton color="neutral" variant="soft" @click="removalTarget = null"
					>取消</UButton
				></template
			>
		</UModal>
	</section>
</template>
