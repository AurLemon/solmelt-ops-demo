# SolMelt Agent Guide

## 项目事实与最低目标

本仓库是福建理工大学人工智能与交通工程学院实验班的光热熔盐泵智能运营管理系统小组作业。目标是实现登录权限、物模型设备、数据采集查询、监测大屏四个板块，并在答辩现场跑通完整数据闭环。

业务事实的权威顺序固定为：`.requirements/复现任务.docx` → `.requirements/学生复现-物模型/` 的 9 份 JSON → `.requirements/学生复现-参考截图/` → `熔盐泵原理入门.html` → `.team/1. 项目方案书.md`。完整最低验收和答辩链见 `docs/acceptance-baseline.md`。

原系统和截图只用于需求、工业场景与效果参考；不需要像素级复刻，更不能自行创造未约定业务。

## 开工前必读

1. 阅读 `README.md`、`docs/environment-setup.md`、`docs/acceptance-baseline.md`、`docs/architecture.md`、`docs/api-contract.md`。
2. 阅读当前 Layer 的 `AGENTS.md`、`README.md` 与 `docs/ai/<domain>.md`。
3. `.env.example` 是组长维护并提交的通用模板；每位成员首次启动都必须从它创建本机 `.env`，只替换 `JWT_SECRET`，保持 Docker 的数据库变量与 `DATABASE_URL` 指向同一 MySQL。每台电脑使用自己的本地 Docker 数据库，禁止提交 `.env`、数据库密码或数据库数据；依次执行 `pnpm env:check`、`docker compose config --quiet`、`docker compose up -d --wait`、`docker compose ps`、`pnpm db:migrate:deploy`、`pnpm db:seed`、`pnpm db:migrate:status`。这是所有领域的通用前置，Telemetry 只是在此基础上额外需要 Python 模拟器。
4. 检查 `git branch --show-current`、`git status --short`、`git remote -v`，并先执行只读的 `git fetch origin`。如果工作区为空且 `origin/main` 有未同步提交，Agent 才能在当前业务分支执行 `git pull --no-rebase origin main`；如果有本地改动、分支不对或出现冲突，必须停止并先向成员报告，不能丢弃改动或强行覆盖。
5. 先复述目标、最低验收、允许目录、准备修改的文件、接口和人工验收动作，再开始编码。

## 固定技术基线与脚本

- Node.js 24.x：`.node-version` 与 `package.json#engines` 强制约束。
- pnpm 11.24.0：`package.json#packageManager` 与 `pnpm-lock.yaml` 是唯一依赖事实；不得生成 npm 或 yarn 锁文件。
- Nuxt 4、Nuxt UI、TypeScript strict、MySQL 8.4、Prisma 7、Zod、ECharts；采集组额外使用 Python 3.11+ 与 requests。
- `tsconfig.json` 开启 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`useUnknownInCatchVariables` 和 `noImplicitOverride`。
- `pnpm-workspace.yaml` 只保存 pnpm 构建许可与 peer 规则，本仓库不是 workspace/monorepo。

| 命令                                                 | 用途                                               |
| ---------------------------------------------------- | -------------------------------------------------- |
| `pnpm env:check`                                     | 只读检查 Node、pnpm、Git、Docker、Python 与 `.env` |
| `pnpm dev` / `pnpm build`                            | 本地开发 / 生产构建                                |
| `pnpm typecheck` / `pnpm lint`                       | 严格类型检查 / ESLint                              |
| `pnpm format` / `pnpm format:check`                  | 写入格式化 / 检查格式                              |
| `pnpm db:generate` / `pnpm db:validate`              | Prisma Client 生成 / Schema 校验                   |
| `pnpm db:migrate:deploy` / `pnpm db:seed`            | 新成员应用已冻结迁移 / 写入老师物模型数据          |
| `pnpm db:migrate:dev`                                | 仅组长确认 Schema 变更后生成迁移                   |
| `pnpm scope:check` / `pnpm verify` / `pnpm pr:check` | 领域边界 / 基础质量 / PR 完整门禁                  |

## 目录地图与所有权

| 目录             | 用途与所有者                                        | 禁止事项                             |
| ---------------- | --------------------------------------------------- | ------------------------------------ |
| `app/`           | 公共应用壳、布局和全局样式；组长维护                | 业务组不得在此实现本领域业务         |
| `layers/`        | 四组各自的页面、API、领域代码                       | 不得跨 Layer 导入私有代码            |
| `shared/`        | 冻结的 Interface、枚举、常量与纯函数；组长维护      | 不得放 Service、数据库查询或页面状态 |
| `server/core/`   | EventBus、Prisma、HTTP 错误等公共基础能力；组长维护 | 不得放领域业务规则                   |
| `prisma/`        | Schema、迁移、Seed；组长维护                        | 业务分支不得创建或提交 migration     |
| `docs/`          | 架构、契约、环境、AI 与 Cowork 规范                 | 变更契约时必须同步更新               |
| `scripts/`       | 非 Web 工具；当前仅 telemetry 可维护模拟器          | 不得生成页面 Mock 数据               |
| `tooling/`       | 环境、作用域等仓库门禁；组长维护                    | 业务分支不得绕过或关闭门禁           |
| `docker/`        | 本地 MySQL 基础设施；组长维护                       | 不得私自改账号、端口或镜像版本       |
| `.requirements/` | 老师原始资料，只读                                  | 不得改写、替换或删除原始文件         |
| `.team/`         | 小组方案书与协作材料；组长维护                      | 不得让 AI 编造成员、进度或验收事实   |

## 架构与跨领域规则

- Layer 可以依赖 `shared/` 和 `server/core/` 的公共能力，不能依赖其他 Layer 私有实现。
- Agent 按业务领域负责而不是按单个文件夹负责：可以阅读全仓库追踪数据流，但只能写入本领域 Layer（Telemetry 另含模拟器）；公共目录和其他 Layer 默认只读。
- 每位成员开工前必须向 Agent 说明所属小组、个人职责、本次任务、允许修改范围和需要协作的领域。Agent 只实现该成员负责的内容；跨领域需求通过接口、事件和组长确认协作，不得直接改写其他 Layer。
- Service 只写本领域模型，写入成功后发布 Typed EventBus；不得调用其他业务 Service。
- Telemetry 拥有 `DeviceLatestValue` 的写入权；Device 和 Dashboard 可按冻结口径只读该投影，但不得写入或导入 Telemetry 私有 Service。
- API 使用冻结的 `ApiResult<T>` 和 `/api/v1/<domain>/*` 命名空间；所有时间传输 UTC ISO 8601，页面按北京时间展示。
- 禁止显式 `any`、`@ts-ignore`、无说明的规则关闭、调试日志、页面静态业务数组和虚构业务数据。

## 最低验收优先，禁止过度实现

只实现任务书的最低验收：双角色权限、1 产品/30 属性/9 设备、模拟上报→入库→三阈值报警→历史查询→大屏延迟展示。

未经组长明确同意，不得新增微服务、MQTT、消息队列、健康评分引擎、五路振动复杂判据、复杂运行模式、部署平台、额外权限模型、额外依赖、无关重构、测试框架或额外测试用例。加分项只能在最低验收全链路稳定后提出。

## 网络、镜像与代理故障流程

1. 先确定问题属于 pnpm/npm 包下载、Node 安装包、Docker 镜像拉取、Git/Gitee 连接，还是依赖本身报错；不得把所有错误归因于网络。
2. pnpm/npm 下载慢时，只能对 `https://registry.npmjs.org/` 与 `https://registry.npmmirror.com/` 测速。国内候选确实更快时，可持久修改该工具的 user-level registry；必须在输出中记录原值、修改后的值和回滚命令，详情见 `docs/environment-setup.md`。
3. Node.js 安装包只从官网获取，不切换第三方下载源。Docker Desktop 镜像代理和系统代理不自动修改，需说明原因并让成员在 Desktop 设置中确认。
4. 发现 Clash Verge、Clash Meta 等代理应用时，只读取已配置的 HTTP 监听端口并用无敏感请求验证连通性。代理仅对当前命令使用 `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY=localhost,127.0.0.1`；不得写入 shell 配置、`.env`、Docker 配置或仓库文件。
5. Git/Gitee 失败时先检查 remote URL、认证、分支状态与临时代理，再决定下一步；禁止把代理地址或令牌提交到仓库。

## Git、Review 与交付

- 仓库只保留 `main`、`feat/auth`、`feat/device`、`feat/telemetry`、`feat/dashboard` 五个分支。组长维护的公共改动直接提交并推送到 `main`；固定业务分支仅用于四个领域的并行开发。禁止 force push。
- Commit 使用 Conventional Commits：`<type>(<scope>): <中文摘要>`；`type` 仅用 `feat`、`fix`、`docs`、`refactor`、`chore`，`scope` 使用领域名或 `agent`、`docs`、`tooling`、`core`。一个 commit 只提交一项可说明的变更，不使用 `wip`、`update`、`fix bug` 等无效摘要。
- 组长把版本、根提示词、公共契约或其他核心内容合入 `main` 后，成员只需让 Agent 维护 Git 并执行 `git pull --no-rebase origin main`；Agent 必须先确认工作区干净，不得覆盖、删除、reset、clean、stash 或擅自提交成员已有内容。若工作区有改动，先报告并等待成员决定；若发生冲突，列出冲突文件、`HEAD` 与 `origin/main` 的差异，询问成员自己负责的内容应保留哪一侧，得到明确选择后才能处理。
- 业务分支自身的协作更新仍使用 `git pull --ff-only origin <branch>`；不要用 `git pull` 代替主线同步，也不要用 force push 解决冲突。
- 修改 `shared/`、Prisma、迁移、根配置、依赖、Docker、公共布局或 tooling 前，必须由组长确认影响范围，并在 `main` 同步更新契约文档；不得用越界修改逃避作用域检查。
- 完成后删除调试代码。业务分支只能对本领域允许目录执行 `pnpm exec prettier --write <allowed-paths>`，不得运行会改写全仓库的 `pnpm format`；随后必须执行 `pnpm pr:check`。其成功结果包含生产 Build；未通过时不得声明完成、提交或推送。通过后提交完整 diff 给新的只读 AI 会话 Review；成员本人必须能够口述数据流和关键实现。
