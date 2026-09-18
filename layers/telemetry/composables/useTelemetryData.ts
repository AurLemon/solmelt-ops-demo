import type { ApiResult, PageResult } from '~~/shared/contracts/api'
import type {
	DeviceSummary,
	ProductPropertyDefinition,
	ProductSummary,
} from '~~/shared/contracts/device'
import type { AlarmSummary, TelemetryPoint } from '~~/shared/contracts/telemetry'

const TOKEN_COOKIE_NAME = 'solmelt_token'

export const ALL_ALARM_FILTER = '__ALL__' as const

export interface DeviceOption {
	deviceId: string
	deviceCode: string
	name: string
}

export interface PropertyOption {
	identifier: string
	name: string
	dataType: 'BOOL' | 'DOUBLE'
	unit: string
	category: string
	sort: number
}

export interface TelemetryCatalog {
	devices: DeviceOption[]
	properties: PropertyOption[]
}

/** 仅展示用的冻结枚举标签，不承载任何设备或遥测业务数据。 */
export const ALARM_LEVEL_OPTIONS = [
	{ label: '全部', value: ALL_ALARM_FILTER },
	{ label: '预警 (WARNING)', value: 'WARNING' },
	{ label: '严重 (SERIOUS)', value: 'SERIOUS' },
] as const

export const ALARM_STATUS_OPTIONS = [
	{ label: '全部', value: ALL_ALARM_FILTER },
	{ label: '未处理', value: 'UNHANDLED' },
	{ label: '已确认', value: 'ACKNOWLEDGED' },
	{ label: '已恢复', value: 'RECOVERED' },
	{ label: '已忽略', value: 'IGNORED' },
] as const

/** UTC ISO 8601 → 北京时间显示字符串。 */
export function formatBeijingTime(iso: string): string {
	const date = new Date(iso)
	const parts = new Intl.DateTimeFormat('zh-CN', {
		timeZone: 'Asia/Shanghai',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).formatToParts(date)
	const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
	return `${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

export function nowIso(): string {
	return new Date().toISOString()
}

export function isoMinusMinutes(minutes: number): string {
	return new Date(Date.now() - minutes * 60_000).toISOString()
}

export function toLocalInput(iso: string): string {
	const date = new Date(iso)
	const beijing = new Date(date.getTime() + 8 * 60 * 60_000)
	const pad = (value: number) => String(value).padStart(2, '0')
	return `${beijing.getFullYear()}-${pad(beijing.getMonth() + 1)}-${pad(beijing.getDate())}T${pad(beijing.getHours())}:${pad(beijing.getMinutes())}`
}

export function fromLocalInput(local: string): string {
	if (!local) return ''
	const beijingDate = new Date(local)
	return new Date(beijingDate.getTime() - 8 * 60 * 60_000).toISOString()
}

export function groupProperties(properties: readonly PropertyOption[]): Array<{
	category: string
	items: PropertyOption[]
}> {
	const groups = new Map<string, PropertyOption[]>()
	for (const property of properties) {
		const items = groups.get(property.category) ?? []
		items.push(property)
		groups.set(property.category, items)
	}
	return [...groups.entries()].map(([category, items]) => ({ category, items }))
}

function toDeviceOption(device: DeviceSummary): DeviceOption {
	return {
		deviceId: device.id,
		deviceCode: device.deviceCode,
		name: device.name,
	}
}

function toPropertyOption(property: ProductPropertyDefinition): PropertyOption {
	return {
		identifier: property.identifier,
		name: property.name,
		dataType: property.dataType,
		unit: property.unit,
		category: property.category,
		sort: property.sort,
	}
}

function errorMessage(error: unknown): string {
	if (typeof error === 'object' && error !== null && 'data' in error) {
		const data = (error as { data?: unknown }).data
		if (typeof data === 'object' && data !== null && 'error' in data) {
			const apiError = (data as { error?: { message?: unknown } }).error
			if (typeof apiError?.message === 'string') return apiError.message
		}
	}
	return error instanceof Error ? error.message : '请求失败'
}

export function useTelemetryData() {
	const token = useCookie<string | null>(TOKEN_COOKIE_NAME, { sameSite: 'lax' })

	function authorizationHeaders(): Record<string, string> {
		return token.value ? { Authorization: `Bearer ${token.value}` } : {}
	}

	async function request<T>(
		url: string,
		options: { query?: Record<string, string | number> } = {},
	): Promise<T> {
		try {
			const response = await $fetch<ApiResult<T>>(url, {
				...(options.query ? { query: options.query } : {}),
				headers: authorizationHeaders(),
			})
			if (response.success) return response.data
			throw new Error(response.error.message)
		} catch (error) {
			throw new Error(errorMessage(error), { cause: error })
		}
	}

	/**
	 * 页面通过冻结的 Device HTTP API 读取真实设备和物模型；不复制 Device Service，
	 * 不依赖 seed 自增 ID，也不在前端保留静态业务数组。
	 */
	async function loadCatalog(): Promise<TelemetryCatalog> {
		const [devicePage, products] = await Promise.all([
			request<PageResult<DeviceSummary>>('/api/v1/device/devices', {
				query: { page: 1, pageSize: 20 },
			}),
			request<ProductSummary[]>('/api/v1/device/products'),
		])

		const product = products[0]
		if (!product) throw new Error('未找到熔盐泵产品，无法加载遥测查询条件')

		const definitions = await request<ProductPropertyDefinition[]>(
			`/api/v1/device/products/${product.id}/properties`,
		)

		return {
			devices: devicePage.items.map(toDeviceOption),
			properties: definitions.map(toPropertyOption).sort((left, right) => left.sort - right.sort),
		}
	}

	function fetchHistory(params: {
		deviceIds: string[]
		propertyIdentifier: string
		start: string
		end: string
	}): Promise<TelemetryPoint[]> {
		return request<TelemetryPoint[]>('/api/v1/telemetry/history', {
			query: {
				deviceIds: params.deviceIds.join(','),
				propertyIdentifier: params.propertyIdentifier,
				start: params.start,
				end: params.end,
			},
		})
	}

	function fetchAlarms(params: {
		page: number
		pageSize: number
		deviceId?: string
		level?: string
		status?: string
	}): Promise<PageResult<AlarmSummary>> {
		const query: Record<string, string | number> = {
			page: params.page,
			pageSize: params.pageSize,
		}
		if (params.deviceId) query.deviceId = params.deviceId
		if (params.level) query.level = params.level
		if (params.status) query.status = params.status
		return request<PageResult<AlarmSummary>>('/api/v1/telemetry/alarms', { query })
	}

	return { fetchAlarms, fetchHistory, loadCatalog }
}
