# 事件契约

事件通过 `server/core/event-bus.ts` 的同步 Typed EventBus 在单进程内分发。它用于领域解耦，不代表分布式消息队列。

| 事件                    | 发布者                 | Payload                                | 典型消费者           |
| ----------------------- | ---------------------- | -------------------------------------- | -------------------- |
| `device.created`        | Device                 | deviceId、deviceCode、occurredAt       | 后续扩展审计         |
| `device.status.changed` | Device                 | 新旧状态、设备标识、时间               | Telemetry 清理/审计  |
| `telemetry.reported`    | Telemetry 上报 Service | reportId、设备、reportedAt、props      | 最新值投影、报警规则 |
| `alarm.created`         | 报警处理器             | alarmId、deviceId、metric、level、时间 | 大屏通知/审计        |
| `alarm.status.changed`  | Telemetry              | alarmId、新旧状态、handledAt           | 审计/统计刷新        |

## 规则

- 数据库核心写入提交成功后才能 emit。
- Payload 必须使用 `shared/events.ts` 中的 Interface。
- Handler 不得反向调用发布者 Service。
- 同一事件 Handler 应可重复执行或通过唯一约束避免重复数据。
- 新增或修改事件属于 Contract Change。
