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
Prisma / MySQL          审计、通知等后续 Handler
报告、属性值、最新值、报警
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

## 公共鉴权边界

`server/core/auth.ts` 是组长维护的 JWT 公共基础能力。Auth 领域负责验证码、账号、角色、菜单和登录业务；其他领域只调用公共鉴权函数，不复制 JWT 解析逻辑，也不读取 Auth 私有 Service。

- `issueAccessToken(claims)` 使用本机 `JWT_SECRET` 签发 8 小时有效的 HS256 Token，返回 Token 和 UTC 到期时间。
- `authorizeRequest(event, permission?)` 返回显式判别结果。成功分支携带 `AuthClaims`；失败分支携带冻结格式的 `ApiFailure`。
- 缺失、空白、无效或过期 Token 返回 `401 UNAUTHENTICATED`；凭证有效但缺少权限返回 `403 FORBIDDEN`。
- 浏览器端由 Auth Layer 使用 `localStorage` 保存 Token；收到 401、Token 过期或主动退出时必须清除。密码、验证码、Token 和 `JWT_SECRET` 不得写入日志、截图或协作反馈。

## Layer 内部组织

业务组按领域负责，Layer 内部可以同时包含页面、组件、composable、`server/api` 适配器和本领域 Service；这些物理目录由 Nuxt Layer 合并到应用中，不代表 Agent 只能负责其中一个目录。根 `app/`、`server/api/`、`server/core/` 和 `shared/` 是公共面，业务组只能阅读；确需修改时由组长在 `main` 维护。

## 领域归属

| 领域      | 写模型                                                    | 发布事件                                  | 消费                       |
| --------- | --------------------------------------------------------- | ----------------------------------------- | -------------------------- |
| Auth      | User、Role、Menu、Captcha                                 | 后续按需扩展                              | 无跨领域依赖               |
| Device    | Product、ProductProperty、Device                          | `device.created`、`device.status.changed` | DeviceLatestValue 只读投影 |
| Telemetry | TelemetryReport、TelemetryValue、DeviceLatestValue、Alarm | `telemetry.reported`、`alarm.created`     | 设备存在性与状态只读契约   |
| Dashboard | 无核心写模型                                              | 无                                        | 设备、最新值和报警只读聚合 |

## 失败边界

- 数据库写入失败时不得发布成功事件。
- Telemetry 的报告、属性值、最新值和报警在同一 transaction 内提交；后续事件 Handler 失败不得否定已成功的上报，必须由其自身明确记录或重试，不能静默吞掉。
- API 不向客户端暴露堆栈、数据库密码或内部文件路径。
- 数据延迟不等于设备故障；页面保留最后一次真实值并单独显示延迟。
