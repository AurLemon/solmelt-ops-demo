# 物模型与设备 Layer

用途：产品、30 个物模型属性、9 台设备、状态和设备详情。由 `feat/device` 两名成员维护。

默认写入：`layers/device/**`。可以阅读全仓库并只读冻结的最新值投影；禁止写入 Telemetry 表、调用其私有 Service，或修改公共契约、Prisma、根配置、依赖和其他 Layer。

最低验收见 `AGENTS.md`，AI 工作说明见 `docs/ai/device.md`。
