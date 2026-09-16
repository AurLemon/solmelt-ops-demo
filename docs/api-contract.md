# API 契约

统一前缀为 `/api/v1`。除验证码、登录和设备数据上报外，所有接口都需要 `Authorization: Bearer <token>`。数据上报不使用用户 JWT，但必须只接受已启用且存在的设备。

## 通用响应

成功：

```json
{
	"success": true,
	"data": {},
	"requestId": "uuid"
}
```

失败：

```json
{
	"success": false,
	"error": {
		"code": "STABLE_ERROR_CODE",
		"message": "面向用户的中文说明"
	},
	"requestId": "uuid"
}
```

分页固定返回 `{ items, page, pageSize, total }`，`page` 从 1 开始。

## Auth

| 方法       | URL                                     | 请求/查询         | 主要响应            |
| ---------- | --------------------------------------- | ----------------- | ------------------- |
| GET        | `/api/v1/auth/captcha`                  | 无                | `CaptchaChallenge`  |
| POST       | `/api/v1/auth/login`                    | `LoginInput`      | `LoginResult`       |
| GET        | `/api/v1/auth/me`                       | JWT               | `AuthenticatedUser` |
| GET/POST   | `/api/v1/auth/users`                    | 分页筛选/用户字段 | 用户分页/用户详情   |
| PUT/DELETE | `/api/v1/auth/users/:id`                | 用户字段          | 更新结果            |
| POST       | `/api/v1/auth/users/:id/reset-password` | 新密码            | 更新结果            |
| GET/POST   | `/api/v1/auth/roles`                    | 分页/角色字段     | 角色列表/详情       |
| PUT/DELETE | `/api/v1/auth/roles/:id`                | 角色与 menuIds    | 更新结果            |
| GET        | `/api/v1/auth/menus`                    | 无                | 菜单树              |

## Device

| 方法           | URL                                      | 请求/查询         | 主要响应                  |
| -------------- | ---------------------------------------- | ----------------- | ------------------------- |
| GET/POST       | `/api/v1/device/products`                | 产品筛选/字段     | 产品列表/详情             |
| GET            | `/api/v1/device/products/:id/properties` | 无                | 30 个属性                 |
| POST           | `/api/v1/device/products/:id/import`     | 老师物模型文件    | 校验与导入结果            |
| GET/POST       | `/api/v1/device/devices`                 | 分页筛选/设备字段 | `DeviceSummary` 分页/详情 |
| GET/PUT/DELETE | `/api/v1/device/devices/:id`             | 设备字段          | 设备详情/更新结果         |
| GET            | `/api/v1/device/devices/:id/latest`      | 无                | `DeviceLatestValue[]`     |
| GET            | `/api/v1/device/devices/:id/online`      | 无                | 在线与最后上报时间        |

## Telemetry

| 方法 | URL                                   | 请求/查询                                 | 主要响应                |
| ---- | ------------------------------------- | ----------------------------------------- | ----------------------- |
| POST | `/api/v1/telemetry/report`            | `TelemetryReportInput`                    | `TelemetryReportResult` |
| GET  | `/api/v1/telemetry/history`           | deviceIds、propertyIdentifier、start、end | `TelemetryPoint[]`      |
| GET  | `/api/v1/telemetry/alarms`            | deviceId、level、status、分页             | `AlarmSummary` 分页     |
| PUT  | `/api/v1/telemetry/alarms/:id/status` | 目标状态                                  | 更新后的报警            |

上报请求必须严格校验 ISO 时间、设备、启用状态、属性 identifier 与对应数据类型。

## Dashboard

| 方法 | URL                               | 主要响应                    |
| ---- | --------------------------------- | --------------------------- |
| GET  | `/api/v1/dashboard/overview`      | `DashboardOverview`         |
| GET  | `/api/v1/dashboard/realtime`      | `DashboardRealtimeDevice[]` |
| GET  | `/api/v1/dashboard/alarms/recent` | `AlarmSummary[]`            |
| GET  | `/api/v1/dashboard/runtime-mode`  | 模式、原因、dataUntil       |

接口实现不得擅自重命名字段。确需调整时提交 Contract Change，并同步 TypeScript Interface 与本文档。
