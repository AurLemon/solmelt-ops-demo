# API 契约

本文是周三冻结的 HTTP 边界。字段的唯一事实源是 `shared/contracts/`；实现不得自行添加、重命名或改变字段语义。所有 ID 在 HTTP JSON 中均为字符串，所有时间均为 UTC ISO 8601。

统一前缀为 `/api/v1`。仅验证码、登录和设备数据上报不需要 `Authorization: Bearer <token>`；其余接口均要求 JWT，并按 `PermissionCode` 做服务端授权。页面隐藏菜单不能代替接口鉴权。

## 通用响应与分页

所有接口返回 `ApiResult<T>`：成功为 `{ success: true, data, requestId }`，失败为 `{ success: false, error: { code, message }, requestId }`。分页数据使用 `PageResult<T>`：`{ items, page, pageSize, total }`，`page` 从 1 开始。

| HTTP 状态 | `error.code`           | 固定含义                                 |
| --------- | ---------------------- | ---------------------------------------- |
| 400       | `VALIDATION_ERROR`     | 请求字段、查询参数或上传物模型不符合契约 |
| 401       | `UNAUTHENTICATED`      | 缺失、无效或过期的凭证                   |
| 403       | `FORBIDDEN`            | 已登录但没有所需 `PermissionCode`        |
| 404       | `NOT_FOUND`            | 目标资源不存在或已逻辑删除               |
| 409       | `CONFLICT`             | 唯一键重复或角色仍被用户关联             |
| 422       | `REPORT_REJECTED`      | 上报目标设备不存在、已删除或未启用       |
| 503       | `DATABASE_UNAVAILABLE` | 数据库暂时不可用                         |
| 500       | `INTERNAL_ERROR`       | 未预期的服务端错误，不返回内部细节       |

除上传物模型外，写入请求均为 `application/json`。行政列表端点的 `page` 默认 1，`pageSize` 默认 20；曲线端点例外，按时间顺序返回完整查询窗口数据。

## Auth

| 方法   | URL                                     | 授权                | 请求或查询           | 成功 data                 |
| ------ | --------------------------------------- | ------------------- | -------------------- | ------------------------- |
| GET    | `/api/v1/auth/captcha`                  | 无                  | 无                   | `CaptchaChallenge`        |
| POST   | `/api/v1/auth/login`                    | 无                  | `LoginInput`         | `LoginResult`             |
| GET    | `/api/v1/auth/me`                       | JWT                 | 无                   | `AuthenticatedUser`       |
| GET    | `/api/v1/auth/users`                    | `system:user:read`  | `UserListQuery`      | `PageResult<UserSummary>` |
| POST   | `/api/v1/auth/users`                    | `system:user:write` | `CreateUserInput`    | `UserSummary`             |
| PUT    | `/api/v1/auth/users/:id`                | `system:user:write` | `UpdateUserInput`    | `UserSummary`             |
| DELETE | `/api/v1/auth/users/:id`                | `system:user:write` | 无                   | `{ id: string }`          |
| POST   | `/api/v1/auth/users/:id/reset-password` | `system:user:write` | `ResetPasswordInput` | `{ id: string }`          |
| GET    | `/api/v1/auth/roles`                    | `system:role:read`  | `RoleListQuery`      | `PageResult<RoleSummary>` |
| POST   | `/api/v1/auth/roles`                    | `system:role:write` | `CreateRoleInput`    | `RoleSummary`             |
| PUT    | `/api/v1/auth/roles/:id`                | `system:role:write` | `UpdateRoleInput`    | `RoleSummary`             |
| DELETE | `/api/v1/auth/roles/:id`                | `system:role:write` | 无                   | `{ id: string }`          |
| GET    | `/api/v1/auth/menus`                    | JWT                 | 无                   | `MenuItem[]`              |

验证码由服务端生成四位图片，五分钟过期且成功登录后立即消费。用户删除是逻辑删除，且不得删除当前用户；角色为物理删除，仍被用户关联时必须拒绝删除。

内置管理员拥有全部 `PermissionCode`，普通操作员只拥有各业务页面的 `*:read` 权限。菜单接口返回当前角色拥有的全部菜单和操作权限，供角色维护页选择；`*:write` 是操作权限，不作为左侧导航项，前端左侧导航只渲染 `*:read` 页面菜单。JWT 的 `permissions` 与该角色实际权限一致。

## Device

| 方法   | URL                                      | 授权           | 请求或查询                                       | 成功 data                                  |
| ------ | ---------------------------------------- | -------------- | ------------------------------------------------ | ------------------------------------------ |
| GET    | `/api/v1/device/products`                | `device:read`  | 无                                               | `ProductSummary[]`                         |
| POST   | `/api/v1/device/products`                | `device:write` | `CreateProductInput`                             | `ProductSummary`                           |
| GET    | `/api/v1/device/products/:id/properties` | `device:read`  | 无                                               | `ProductPropertyDefinition[]`              |
| POST   | `/api/v1/device/products/:id/import`     | `device:write` | `multipart/form-data` 的 `file`（单份老师 JSON） | `ProductImportResult`                      |
| GET    | `/api/v1/device/devices`                 | `device:read`  | `DeviceListQuery`                                | `PageResult<DeviceSummary>`                |
| POST   | `/api/v1/device/devices`                 | `device:write` | `CreateDeviceInput`                              | `DeviceSummary`                            |
| GET    | `/api/v1/device/devices/:id`             | `device:read`  | 无                                               | `DeviceSummary`                            |
| PUT    | `/api/v1/device/devices/:id`             | `device:write` | `UpdateDeviceInput`                              | `DeviceSummary`                            |
| DELETE | `/api/v1/device/devices/:id`             | `device:write` | 无                                               | `{ id: string }`                           |
| GET    | `/api/v1/device/devices/:id/latest`      | `device:read`  | 无                                               | `DeviceLatestValue[]`                      |
| GET    | `/api/v1/device/devices/:id/online`      | `device:read`  | 无                                               | `{ online: boolean, lastReportedAt: string | null }` |

产品标识、九台设备和三十个属性均以 `.requirements/学生复现-物模型.zip` 为唯一事实源。产品创建只接受标识为 `Z60KbveZzXk8` 的立式熔盐泵；设备创建只接受物模型 ZIP 中的九个编号、名称和泵型，重复创建返回冲突。物模型导入只接受 ZIP 内任意一份 JSON：服务端须校验产品标识和名称，以及恰好 30 个属性的 `identifier`、`dataType`、`unit` 均与规范完全一致；重复导入幂等，不得新增、删除或覆盖既有定义。设备删除为逻辑删除；在线表示未删除且最近 300 秒存在成功上报，启用状态只决定是否接受新上报。

## Telemetry

| 方法 | URL                         | 授权             | 请求或查询              | 成功 data                  |
| ---- | --------------------------- | ---------------- | ----------------------- | -------------------------- |
| POST | `/api/v1/telemetry/report`  | 无               | `TelemetryReportInput`  | `TelemetryReportResult`    |
| GET  | `/api/v1/telemetry/history` | `telemetry:read` | `TelemetryHistoryQuery` | `TelemetryPoint[]`         |
| GET  | `/api/v1/telemetry/alarms`  | `alarm:read`     | `AlarmListQuery`        | `PageResult<AlarmSummary>` |

`TelemetryReportInput` 固定为 `{ deviceCode, reportedAt, props }`。`props` 的 key 必须属于该产品三十个属性，值必须匹配 `BOOL` 或 `DOUBLE`；设备不存在、已删除或停用时拒收。一次成功上报须在同一 Prisma transaction 内原子写入报告、属性值、最新值投影和报警；成功提交后才发布 `telemetry.reported` 通知。三项阈值超限均写入 `WARNING` 级 `UNHANDLED` 报警，`SERIOUS` 仅为获组长批准后的扩展保留。

历史查询中 `deviceIds` 在 URL 使用英文逗号分隔，`propertyIdentifier`、`start`、`end` 必填，且 `start < end`；结果按 `reportedAt` 升序，不分页。报警处理状态机与写接口不属于最低验收；最低验收只要求生成、查询并展示报警。

## Dashboard

| 方法 | URL                               | 授权             | 请求或查询         | 成功 data                   |
| ---- | --------------------------------- | ---------------- | ------------------ | --------------------------- |
| GET  | `/api/v1/dashboard/overview`      | `dashboard:read` | 无                 | `DashboardOverview`         |
| GET  | `/api/v1/dashboard/realtime`      | `dashboard:read` | 无                 | `DashboardRealtimeDevice[]` |
| GET  | `/api/v1/dashboard/alarms/recent` | `dashboard:read` | `RecentAlarmQuery` | `AlarmSummary[]`            |

大屏只能读取设备、最新值与报警投影；前端每 30 秒轮询。`dataUntil` 和 `latestReportedAt` 必须来自真实上报数据，超过 60 秒仅标记延迟并保留最后真实值。近期报警默认返回 10 条、最多 20 条，固定按 `UNHANDLED` 优先、再按 `occurredAt` 降序。运行模式、健康评分、WebSocket 和额外 `/dashboard/runtime-mode` 端点均不属于最低验收，未获批准不得实现。

## 维护规则

新增端点、字段或语义变化须由组长确认，并在 `main` 同步本文、`shared/contracts/`、事件契约以及受影响 Layer 的 AI 说明。业务分支不得绕过该流程。
