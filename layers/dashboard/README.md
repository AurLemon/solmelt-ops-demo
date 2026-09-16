# 监测大屏 Layer

用途：只读聚合 API、监测大屏页面和 30 秒轮询展示。由 `feat/dashboard` 两名成员维护。

默认写入：`layers/dashboard/**`。可以阅读全仓库，但禁止写入 Device、Telemetry、Alarm 数据，或修改公共契约、Prisma、根配置、依赖和其他 Layer。

最低验收见 `AGENTS.md`，AI 工作说明见 `docs/ai/dashboard.md`。
