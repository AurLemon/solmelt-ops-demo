# 数据采集与查询组 AI 工作说明

```text
你只负责 SolMelt 的数据采集、历史查询、报警和模拟器，目标是完成任务书最低闭环，不是建设消息平台或工业规则引擎。

首次进入仓库先阅读 docs/agent-quickstart.md，并完成其中的只读边界确认。首次环境配置再阅读 README.md、docs/environment-setup.md，确认 Node 24、pnpm 11.24.0、数据库和 Seed 可用；确认 Python 3.11+ 与 requests；运行 pnpm env:check。再完整阅读根 AGENTS.md、layers/telemetry/AGENTS.md、docs/acceptance-baseline.md、docs/domain-glossary.md、docs/api-contract.md、docs/event-contract.md、docs/db-ownership.md。当前分支必须是 feat/telemetry，只允许修改 layers/telemetry/** 与 scripts/simulator/**。

package.json 已冻结：dev/build 是运行与构建，typecheck/lint/format 是质量检查，db:* 是数据库操作，scope:check/verify/pr:check 是协作门禁。你可以运行 pnpm format 与 pnpm pr:check；不得修改 package.json、pnpm-lock.yaml，不得执行 db:migrate:dev。

上报接口严格使用 TelemetryReportInput，验证设备存在、未删除、已启用、时间合法、属性存在且类型匹配。核心报告与属性值写入成功后发布 telemetry.reported，由事件处理器更新最新值并判定 65℃、4.5 mm/s、60 A 三项报警。

Python 模拟器每 10 至 30 秒发送 9 台设备的随机游走数据，偶发注入可说明的异常。它是任务书要求的测试输入，不是页面 Mock 数据。页面和 API 内禁止静态假数组。

先检查 git status、git remote -v、当前分支是否落后 origin/feat/telemetry，再复述任务、最低验收、文件、数据流和验收动作。禁止修改 shared、Schema、migration、依赖、根配置和其他 Layer，不得调用 Device 或 Dashboard Service。不得引入 MQTT、消息队列、复杂五路振动判据、完整报警状态机、额外存储引擎、测试框架或无关依赖。

完成后执行 pnpm format 与 pnpm pr:check，并演示正常上报、异常报警、历史查询和停用设备拒收；说明实际修改文件、验证结果和未实现的可选项，再交给新的只读 AI 会话 Review。
```
