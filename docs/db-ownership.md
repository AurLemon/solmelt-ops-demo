# 数据库归属与迁移规则

| 领域      | 拥有的模型                                                |
| --------- | --------------------------------------------------------- |
| Auth      | User、Role、Menu、RoleMenu、Captcha                       |
| Device    | Product、ProductProperty、Device                          |
| Telemetry | TelemetryReport、TelemetryValue、DeviceLatestValue、Alarm |
| Dashboard | 无核心写模型，只读聚合                                    |

`DeviceLatestValue` 的写入权只属于 Telemetry。Device 和 Dashboard 为完成任务书中的“设备最新值”和“大屏实时状态”，可以按已冻结的字段只读该投影；它们不得写入该表，也不得 import Telemetry 私有 Service。

## 迁移流程

1. 业务组说明当前阻塞、目标字段、影响接口和兼容方式。
2. 相关领域负责人和组长确认。
3. 组长在 `main` 修改 `prisma/schema/` 并执行 `pnpm db:migrate:dev --name <change>`。
4. 检查 SQL，不接受意外删除表、列或数据。
5. 执行 Seed、`pnpm pr:check` 和对应人工演示。
6. Schema、migration 与契约文档在同一次组长维护提交中同步。

禁止业务组在 feat 分支提交 migration、手写生产 SQL 或修改其他领域模型。
