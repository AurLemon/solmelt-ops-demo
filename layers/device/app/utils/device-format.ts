/**
 * 设备领域 - 展示格式化工具
 * ---------------------------------------------------------------------------
 * 契约规定：接口传输 UTC ISO 8601 时间，页面按北京时间（Asia/Shanghai）展示。
 * 这里只做展示转换，不参与任何业务判定。
 */

const BEIJING_TIME_ZONE = 'Asia/Shanghai'

const dateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
	timeZone: BEIJING_TIME_ZONE,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
})

/**
 * 把 UTC ISO 8601 时间串格式化为北京时间文本。
 * 入参非法时返回「—」，绝不回退到当前时间，避免把刷新时间冒充数据时间。
 */
export function formatDateTime(isoText: string): string {
	const parsed = new Date(isoText)
	if (Number.isNaN(parsed.getTime())) return '—'
	return dateTimeFormatter.format(parsed)
}

/**
 * 把属性值渲染为展示文本。
 * 未上报（null / undefined）返回「—」，不得生成 0 / false 等默认数值。
 */
export function formatPropertyValue(
	value: number | boolean | null | undefined,
	unit: string,
): string {
	if (value === null || value === undefined) return '—'
	if (typeof value === 'boolean') return value ? 'true' : 'false'
	const text = String(value)
	return unit ? `${text} ${unit}` : text
}
