<script setup lang="ts">
import type { TelemetryPoint } from '~~/shared/contracts/telemetry'
import {
	DEVICE_OPTIONS,
	PROPERTY_GROUPS,
	findProperty,
	fetchHistory,
	toLocalInput,
	fromLocalInput,
	nowIso,
	isoMinusMinutes,
} from '../../composables/useTelemetryData'

useHead({ title: '历史曲线查询 — SolMelt' })

// 查询表单状态
const selectedDeviceIds = ref<string[]>([DEVICE_OPTIONS[0]!.deviceId])
const propertyIdentifier = ref('inverter_current')
const startLocal = ref(toLocalInput(isoMinusMinutes(60)))
const endLocal = ref(toLocalInput(nowIso()))

// 结果状态
const points = ref<TelemetryPoint[]>([])
const loading = ref(false)
const error = ref('')
const hasQueried = ref(false)

const selectedProperty = computed(() => findProperty(propertyIdentifier.value))

async function handleQuery() {
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
	if (!start || !end) {
		error.value = '请填写完整的时间范围'
		return
	}
	if (new Date(start) >= new Date(end)) {
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
	} catch (err: unknown) {
		points.value = []
		error.value = err instanceof Error ? err.message : '查询失败'
	} finally {
		loading.value = false
	}
}

// 全选 / 反选设备
const allDeviceSelected = computed(() => selectedDeviceIds.value.length === DEVICE_OPTIONS.length)
function toggleAllDevices() {
	selectedDeviceIds.value = allDeviceSelected.value ? [] : DEVICE_OPTIONS.map((d) => d.deviceId)
}

// 快捷时间范围
function setRange(minutes: number) {
	startLocal.value = toLocalInput(isoMinusMinutes(minutes))
	endLocal.value = toLocalInput(nowIso())
}
</script>

<template>
	<div class="space-y-6">
		<div class="flex items-center justify-between">
			<h1 class="text-2xl font-bold text-amber-300">历史曲线查询</h1>
			<NuxtLink to="/alarms" class="text-sm text-slate-400 hover:text-amber-300">
				报警管理 →
			</NuxtLink>
		</div>

		<UCard class="border-slate-800 bg-slate-900/70">
			<template #header>
				<span class="text-base font-medium text-slate-200">查询条件</span>
			</template>

			<div class="space-y-5">
				<!-- 设备选择 -->
				<div>
					<div class="mb-2 flex items-center gap-3">
						<span class="text-sm font-medium text-slate-300">设备选择</span>
						<button class="text-xs text-amber-300 hover:underline" @click="toggleAllDevices">
							{{ allDeviceSelected ? '取消全选' : '全选' }}
						</button>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						<label
							v-for="device in DEVICE_OPTIONS"
							:key="device.deviceId"
							class="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm transition hover:border-amber-500/50"
							:class="{
								'border-amber-500/70 bg-amber-500/10': selectedDeviceIds.includes(device.deviceId),
							}"
						>
							<input
								v-model="selectedDeviceIds"
								type="checkbox"
								:value="device.deviceId"
								class="size-4 accent-amber-400"
							/>
							<div class="min-w-0">
								<p class="truncate text-slate-200">{{ device.name }}</p>
								<p class="truncate text-xs text-slate-500">{{ device.deviceCode }}</p>
							</div>
						</label>
					</div>
				</div>

				<!-- 属性选择 -->
				<div>
					<span class="mb-2 block text-sm font-medium text-slate-300">属性选择</span>
					<select
						v-model="propertyIdentifier"
						class="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
					>
						<optgroup
							v-for="group in PROPERTY_GROUPS"
							:key="group.category"
							:label="group.category"
						>
							<option v-for="item in group.items" :key="item.identifier" :value="item.identifier">
								{{ item.name }}{{ item.unit ? ` (${item.unit})` : '' }}
							</option>
						</optgroup>
					</select>
				</div>

				<!-- 时间范围 -->
				<div>
					<div class="mb-2 flex items-center gap-3">
						<span class="text-sm font-medium text-slate-300">时间范围（北京时间）</span>
						<div class="flex gap-2">
							<button class="text-xs text-amber-300 hover:underline" @click="setRange(30)">
								近30分钟
							</button>
							<span class="text-slate-600">|</span>
							<button class="text-xs text-amber-300 hover:underline" @click="setRange(60)">
								近1小时
							</button>
							<span class="text-slate-600">|</span>
							<button class="text-xs text-amber-300 hover:underline" @click="setRange(180)">
								近3小时
							</button>
						</div>
					</div>
					<div class="flex flex-wrap items-center gap-3">
						<input
							v-model="startLocal"
							type="datetime-local"
							class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
						/>
						<span class="text-slate-500">至</span>
						<input
							v-model="endLocal"
							type="datetime-local"
							class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-amber-500"
						/>
					</div>
				</div>

				<!-- 错误提示 -->
				<p v-if="error" class="text-sm text-rose-400">{{ error }}</p>

				<!-- 查询按钮 -->
				<UButton
					color="warning"
					size="lg"
					:loading="loading"
					class="w-full justify-center"
					@click="handleQuery"
				>
					查询历史曲线
				</UButton>
			</div>
		</UCard>

		<!-- 图表区域 -->
		<UCard v-if="hasQueried" class="border-slate-800 bg-slate-900/70">
			<template #header>
				<div class="flex items-center justify-between">
					<span class="text-base font-medium text-slate-200">
						{{ selectedProperty?.name ?? propertyIdentifier }}
						<span v-if="selectedProperty?.unit" class="text-slate-500">
							({{ selectedProperty.unit }})
						</span>
					</span>
					<span class="text-xs text-slate-500"> {{ points.length }} 个数据点 </span>
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
