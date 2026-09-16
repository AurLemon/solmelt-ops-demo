# 监测大屏组 AI 工作说明

```text
你只负责 SolMelt 监测大屏和只读聚合接口，目标是完成任务书最低展示，不是复制原系统或实现大数据大屏平台。

首次进入仓库先阅读 docs/agent-quickstart.md，并完成其中的只读边界确认。首次环境配置再阅读 README.md、docs/environment-setup.md，确认 Node 24、pnpm 11.24.0、数据库和 Seed 可用；运行 pnpm env:check。再完整阅读根 AGENTS.md、layers/dashboard/AGENTS.md、docs/acceptance-baseline.md、docs/domain-glossary.md、docs/api-contract.md、docs/db-ownership.md。当前分支必须是 feat/dashboard，默认只允许修改 layers/dashboard/**。

package.json 已冻结：dev/build 是运行与构建，typecheck/lint/format 是质量检查，db:* 是数据库操作，scope:check/verify/pr:check 是协作门禁。只能对 layers/dashboard/** 执行 `pnpm exec prettier --write layers/dashboard`，随后必须运行 pnpm pr:check；该命令包含生产 Build，未通过不得声明完成、提交或推送。不得修改 package.json、pnpm-lock.yaml，不得执行 db:migrate:dev。

大屏只消费真实数据库聚合，禁止生成随机数或静态业务数组。每 30 秒轮询，展示数据截至时间；最新上报超过 60 秒时保留最后真实值并显示延迟。在线、运行中、报警数量和泵型分组必须严格使用领域文档口径。

使用 Nuxt UI、Tailwind、ECharts 和强类型接口。先执行 git fetch origin，再检查 git status、git remote -v、当前分支和是否有未同步的 origin/main，再复述任务、最低验收、页面区域、API、文件和验收动作。受保护 API 调用 `server/core/auth.ts` 的 `authorizeRequest`，不得复制 JWT 逻辑或导入 Auth 私有实现。大屏不得写 Device、Telemetry、Alarm 表，不得调用其他领域 Service。

禁止修改 shared、Schema、migration、依赖、根配置和其他 Layer；需要公共变更时交由组长在 `main` 维护。不得新增健康评分、复杂运行模式、WebSocket、额外图表库、地图、3D、测试框架或随机页面数据。

完成后只格式化 layers/dashboard/** 并运行 pnpm pr:check。该检查和生产 Build 必须通过；先逐项自查范围、契约、Mock 数据、只读边界和错误路径，再演示数据更新、报警变化和模拟器停止后的延迟状态；说明实际修改文件、实际成功结果和未实现的可选项，最后交给新的只读 AI 会话 Review。
```
