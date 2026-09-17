import type { PropertyDataType, PumpType } from '~~/shared/contracts/device'

export interface CatalogDevice {
	deviceCode: string
	name: string
	pumpType: PumpType
}

export interface CatalogProperty {
	identifier: string
	dataType: PropertyDataType
	unit: string
}

/**
 * 冻结目录：唯一事实源为 `.requirements/学生复现-物模型/` 内 9 份教师 JSON。
 * 九份文件的属性定义完全一致，此处仅内联 identifier、dataType、unit 三个校验字段，
 * 用于设备创建与物模型导入的服务端校验，不属于页面静态业务数据。
 */
export const DEVICE_CATALOG: readonly CatalogDevice[] = [
	{ deviceCode: '20WSC10AP010', name: '1号冷盐泵', pumpType: 'COLD_SALT' },
	{ deviceCode: '20WSC10AP020', name: '2号冷盐泵', pumpType: 'COLD_SALT' },
	{ deviceCode: '20WSC10AP030', name: '3号冷盐泵', pumpType: 'COLD_SALT' },
	{ deviceCode: '20WSC10AP040', name: '4号冷盐泵', pumpType: 'COLD_SALT' },
	{ deviceCode: '20WSC10AP050', name: '1号调温泵', pumpType: 'TEMPERING' },
	{ deviceCode: '20WSC10AP060', name: '2号调温泵', pumpType: 'TEMPERING' },
	{ deviceCode: '20WSH20AP010', name: '1号热盐泵', pumpType: 'HOT_SALT' },
	{ deviceCode: '20WSH20AP020', name: '2号热盐泵', pumpType: 'HOT_SALT' },
	{ deviceCode: '20WSH20AP030', name: '3号热盐泵', pumpType: 'HOT_SALT' },
]

export const CANONICAL_PROPERTIES: readonly CatalogProperty[] = [
	{ identifier: 'inverter_start_status', dataType: 'BOOL', unit: '' },
	{ identifier: 'inverter_stop_status', dataType: 'BOOL', unit: '' },
	{ identifier: 'inverter_alarm_status', dataType: 'BOOL', unit: '' },
	{ identifier: 'inverter_fault_status', dataType: 'BOOL', unit: '' },
	{ identifier: 'inverter_ready_status', dataType: 'BOOL', unit: '' },
	{ identifier: 'inverter_emergency_stop_status', dataType: 'BOOL', unit: '' },
	{ identifier: 'inverter_remote_control_status', dataType: 'BOOL', unit: '' },
	{ identifier: 'speed_command', dataType: 'DOUBLE', unit: 'rpm' },
	{ identifier: 'speed_feedback', dataType: 'DOUBLE', unit: 'rpm' },
	{ identifier: 'forward_speed', dataType: 'DOUBLE', unit: 'rpm' },
	{ identifier: 'inverter_current', dataType: 'DOUBLE', unit: 'A' },
	{ identifier: 'electric_meter_reading', dataType: 'DOUBLE', unit: 'kWh' },
	{ identifier: 'feeder_current', dataType: 'DOUBLE', unit: 'A' },
	{ identifier: 'motor_temp_u1', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_temp_u2', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_temp_v1', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_temp_v2', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_temp_w1', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_temp_w2', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_drive_bearing_temp', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_non_drive_bearing_temp', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'thrust_bearing_temp_x', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'thrust_bearing_temp_y', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'pump_casing_temp1', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'pump_casing_temp2', dataType: 'DOUBLE', unit: '℃' },
	{ identifier: 'motor_vibration_x', dataType: 'DOUBLE', unit: 'mm/s' },
	{ identifier: 'motor_vibration_y', dataType: 'DOUBLE', unit: 'mm/s' },
	{ identifier: 'motor_vibration_z', dataType: 'DOUBLE', unit: 'mm/s' },
	{ identifier: 'pump_vibration_x', dataType: 'DOUBLE', unit: 'mm/s' },
	{ identifier: 'pump_vibration_y', dataType: 'DOUBLE', unit: 'mm/s' },
]
