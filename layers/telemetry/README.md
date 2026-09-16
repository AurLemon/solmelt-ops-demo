# 数据采集、查询与报警 Layer

用途：HTTP 上报、时序查询、三项阈值报警和最新值投影。由 `feat/telemetry` 两名成员维护；模拟器位于 `scripts/simulator/`。

默认写入：`layers/telemetry/**`、`scripts/simulator/**`。可以阅读全仓库，但禁止修改公共契约、Prisma、根配置、依赖或其他 Layer。

最低验收见 `AGENTS.md`，AI 工作说明见 `docs/ai/telemetry.md`。
