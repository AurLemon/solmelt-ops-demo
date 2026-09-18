<script setup lang="ts">
import type { TelemetryPoint } from '~~/shared/contracts/telemetry'
import {
	fromLocalInput,
	groupProperties,
	isoMinusMinutes,
	nowIso,
	toLocalInput,
	type DeviceOption,
	type PropertyOption,
	useTelemetryData,
} from '../../composables/useTelemetryData'

definePageMeta({ layout: 'dashboard', permission: 'telemetry:read' })

useHead({ title: '历史曲线查询 — SolMelt' })

const { fetchHistory, loadCatalog } = useTelemetryData()
const devices = ref<DeviceOption[]>([])
const properties = ref<PropertyOption[]>([])
const catalogLoading = ref(true)
const selectedDeviceIds = ref<string[]>([])
const propertyIdentifier = ref('')
const startLocal = ref(toLocalInput(isoMinusMinutes(60)))
const endLocal = ref(toLocalInput(nowIso()))
const points = ref<TelemetryPoint[]>([])
const loading = ref(false)
const error = ref('')
const hasQueried = ref(false)

const propertyGroups = computed(() => groupProperties(properties.value))
const propertyOptions = computed(() =>
	propertyGroups.value.map((group) => [
		{ label: group.category, type: 'label' as const },
		...group.items.map((item) => ({
			label: `${item.name}${item.unit ? ` (${item.unit})` : ''}`,
			value: item.identifier,
		})),
	]),
)
const deviceSelectionOptions = computed(() =>
	devices.value.map((device) => ({
		label: device.name,
		description: device.deviceCode,
		value: device.deviceId,
	})),
)
const selectedProperty = computed(() =>
	properties.value.find((property) => property.identifier === propertyIdentifier.value),
)
const allDeviceSelected = computed(
	() => devices.value.length > 0 && selectedDeviceIds.value.length === devices.value.length,
)

async function handleQuery(): Promise<void> {
	error.value = ''
	if (selectedDeviceIds.value.length === 0) {
		error.value = '请至少选择一台设备'
		return
	}
	if (!propertyIdentifier.value) {
		error.value = '请选择属性'
		return
	}
	const start = fromLocalInput(startLocal.value)
	const end = fromLocalInput(endLocal.value)
	if (!start || !end || new Date(start) >= new Date(end)) {
		error.value = '开始时间必须早于结束时间'
		return
	}

	loading.value = true
	hasQueried.value = true
	try {
		points.value = await fetchHistory({
			deviceIds: selectedDeviceIds.value,
			propertyIdentifier: propertyIdentifier.value,
			start,
			end,
		})
	} catch (queryError: unknown) {
		points.value = []
		error.value = queryError instanceof Error ? queryError.message : '查询失败'
	} finally {
		loading.value = false
	}
}

function toggleAllDevices(): void {
	selectedDeviceIds.value = allDeviceSelected.value
		? []
		: devices.value.map((device) => device.deviceId)
}

function setRange(minutes: number): void {
	startLocal.value = toLocalInput(isoMinusMinutes(minutes))
	endLocal.value = toLocalInput(nowIso())
}

onMounted(async () => {
	try {
		const catalog = await loadCatalog()
		devices.value = catalog.devices
		properties.value = catalog.properties
		selectedDeviceIds.value = catalog.devices.length > 0 ? [catalog.devices[0]!.deviceId] : []
		propertyIdentifier.value = catalog.properties[0]?.identifier ?? ''
	} catch (catalogError: unknown) {
		error.value = catalogError instanceof Error ? catalogError.message : '加载设备与物模型失败'
	} finally {
		catalogLoading.value = false
	}
})
</script>

<template>
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
				历史曲线查询
			</h1>
			<UButton to="/alarms" color="neutral" variant="link" trailing-icon="i-lucide-arrow-right">
				报警管理
			</UButton>
		</div>

		<UCard class="border-slate-800 bg-slate-900/70">
			<template #header>
				<span class="text-base font-medium text-slate-200">查询条件</span>
			</template>

			<div class="space-y-5">
				<p v-if="catalogLoading" class="text-sm text-slate-400">正在加载真实设备与物模型…</p>

				<div>
					<div class="mb-2 flex items-center gap-3">
						<span class="text-sm font-medium text-slate-300">设备选择</span>
						<UButton
							size="xs"
							color="warning"
							variant="link"
							:disabled="catalogLoading"
							@click="toggleAllDevices"
						>
							{{ allDeviceSelected ? '取消全选' : '全选' }}
						</UButton>
					</div>
					<UCheckboxGroup
						v-model="selectedDeviceIds"
						color="warning"
						variant="card"
						:disabled="catalogLoading"
						:items="deviceSelectionOptions"
						:ui="{
							fieldset: 'grid grid-cols-2 gap-2 sm:grid-cols-3',
							item: 'min-w-0',
							label: 'truncate',
							description: 'truncate font-mono',
						}"
					/>
				</div>

				<div>
					<span class="mb-2 block text-sm font-medium text-slate-300">属性选择</span>
					<USelect
						v-model="propertyIdentifier"
						:disabled="catalogLoading"
						:items="propertyOptions"
						class="w-full"
					/>
				</div>

				<div>
					<div class="mb-2 flex items-center gap-3">
						<span class="text-sm font-medium text-slate-300">时间范围（北京时间）</span>
						<div class="flex gap-2">
							<UButton size="xs" color="warning" variant="link" @click="setRange(30)">
								近30分钟
							</UButton>
							<UButton size="xs" color="warning" variant="link" @click="setRange(60)">
								近1小时
							</UButton>
							<UButton size="xs" color="warning" variant="link" @click="setRange(180)">
								近3小时
							</UButton>
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<UInput v-model="startLocal" type="datetime-local" class="w-56" />
						<span class="text-slate-500">至</span>
						<UInput v-model="endLocal" type="datetime-local" class="w-56" />
					</div>
				</div>

				<p v-if="error" class="text-sm text-rose-400">{{ error }}</p>
				<UButton
					color="warning"
					size="lg"
					:loading="loading || catalogLoading"
					:disabled="catalogLoading || devices.length === 0 || properties.length === 0"
					class="w-full justify-center"
					@click="handleQuery"
				>
					查询历史曲线
				</UButton>
			</div>
		</UCard>

		<UCard v-if="hasQueried" class="border-slate-800 bg-slate-900/70">
			<template #header>
				<div class="flex items-center justify-between">
					<span class="text-base font-medium text-slate-200">
						{{ selectedProperty?.name ?? propertyIdentifier }}
						<span v-if="selectedProperty?.unit" class="text-slate-500"
							>({{ selectedProperty.unit }})</span
						>
					</span>
					<span class="text-xs text-slate-500">{{ points.length }} 个数据点</span>
				</div>
			</template>
			<div v-if="loading" class="flex h-[360px] items-center justify-center text-slate-500">
				加载中...
			</div>
			<HistoryChart
				v-else
				:points="points"
				:unit="selectedProperty?.unit ?? ''"
				:property-name="selectedProperty?.name ?? ''"
			/>
		</UCard>
	</div>
</template>
