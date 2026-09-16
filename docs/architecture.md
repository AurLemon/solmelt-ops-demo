# 系统架构

## 架构目标

SolMelt 采用 Nuxt Layers 组织模块化单体。每个业务组在单一领域目录内同时维护页面、API 和本领域业务代码；公共契约、数据库迁移与基础设施由组长维护。

```text
浏览器 / Python 模拟器
        │ HTTP JSON + JWT
        ▼
Nuxt 页面与 server/api 适配层
        │ 校验、鉴权、调用本领域 Service
        ▼
领域 Service ──提交成功──▶ Typed EventBus
        │                         │
        ▼                         ▼
Prisma / MySQL          最新值、报警等事件处理器
        │
        ▼
Dashboard 只读聚合
```

## 依赖方向

1. Layer 可以依赖 `shared/` 和 `server/core/` 暴露的公共能力。
2. Layer 不得依赖其他 Layer 的私有代码。
3. `shared/` 不得反向依赖 `app/`、`server/` 或任何 Layer。
4. Server API 负责 HTTP 适配，不承载大段业务规则。
5. Service 只操作本领域表；跨领域反应通过事件处理器完成。
6. Dashboard 不写核心业务表，只查询冻结的只读口径。

## Layer 内部组织

业务组按领域负责，Layer 内部可以同时包含页面、组件、composable、`server/api` 适配器和本领域 Service；这些物理目录由 Nuxt Layer 合并到应用中，不代表 Agent 只能负责其中一个目录。根 `app/`、`server/api/`、`server/core/` 和 `shared/` 是公共面，业务组只能阅读；确需修改时由组长在 `main` 维护。

## 领域归属

| 领域      | 写模型                                                    | 发布事件                                  | 消费                       |
| --------- | --------------------------------------------------------- | ----------------------------------------- | -------------------------- |
| Auth      | User、Role、Menu、Captcha                                 | 后续按需扩展                              | 无跨领域依赖               |
| Device    | Product、ProductProperty、Device                          | `device.created`、`device.status.changed` | DeviceLatestValue 只读投影 |
| Telemetry | TelemetryReport、TelemetryValue、DeviceLatestValue、Alarm | `telemetry.reported`、`alarm.*`           | 设备存在性与状态只读契约   |
| Dashboard | 无核心写模型                                              | 无                                        | 设备、最新值和报警只读聚合 |

## 失败边界

- 数据库写入失败时不得发布成功事件。
- 事件处理失败必须让当前上报请求失败或记录为明确可重试状态，不能静默吞掉。
- API 不向客户端暴露堆栈、数据库密码或内部文件路径。
- 数据延迟不等于设备故障；页面保留最后一次真实值并单独显示延迟。
