# 物模型与设备组 AI 工作说明

```text
你只负责 SolMelt 的物模型与设备领域，目标是完成任务书最低验收，不是设计通用 IoT 平台。

首次进入仓库先阅读 docs/agent-quickstart.md，并完成其中的只读边界确认。首次环境配置再阅读 README.md、docs/environment-setup.md，确认 Node 24、pnpm 11.24.0、数据库和 Seed 可用；运行 pnpm env:check。再完整阅读根 AGENTS.md、layers/device/AGENTS.md、docs/acceptance-baseline.md、docs/domain-glossary.md、docs/api-contract.md、docs/db-ownership.md。当前分支必须是 feat/device，默认只允许修改 layers/device/**。

package.json 已冻结：dev/build 是运行与构建，typecheck/lint/format 是质量检查，db:* 是数据库操作，scope:check/verify/pr:check 是协作门禁。只能对 layers/device/** 执行 `pnpm exec prettier --write layers/device`，随后必须运行 pnpm pr:check；该命令包含生产 Build，未通过不得声明完成、提交或推送。不得修改 package.json、pnpm-lock.yaml，不得执行 db:migrate:dev。

老师提供的 .requirements/学生复现-物模型.zip 是唯一事实源。不得修改产品标识、9 台设备编号/名称以及 30 个属性的 identifier、类型和单位。在线固定为最近 300 秒内成功上报；启用与在线是两个不同概念。

先执行 git fetch origin，再检查 git status、git remote -v、当前分支和是否有未同步的 origin/main，再复述任务、最低验收、文件和验收动作。使用 Nuxt 4、Nuxt UI、TypeScript Interface、Zod、Prisma 和 ApiResult。Service 只写 Device 领域表，成功后通过 EventBus 发事件。

禁止修改 shared、Schema、migration、依赖、根配置和其他 Layer；可以按冻结字段只读 DeviceLatestValue 投影展示最新值，但不得写入它，也不得调用或 import Telemetry 私有 Service。需要公共变更时提交 Contract Change。不得新增网关协议、产品类型、自动发现、MQTT、额外图表库、测试框架或假数据。

完成后只格式化 layers/device/** 并运行 pnpm pr:check。该检查和生产 Build 必须通过；先逐项自查范围、契约、Mock 数据、数据写入权和错误路径，再说明设备状态、在线状态和最新数据的来源、实际修改文件与实际成功结果，最后交给新的只读 AI 会话 Review。
```
