# SolMelt Ops

SolMelt 是福建理工大学人工智能与交通工程学院实验班小组实现的光热熔盐泵智能运营管理系统。本仓库是 9 人团队共同使用的 AI Native 基准仓库。

## 固定技术栈

- Node.js 24、pnpm 11、Nuxt 4、Nuxt UI、TypeScript strict
- MySQL 8.4、Prisma 7、Zod
- ECharts 6、Python `requests`
- Nuxt Layers 领域边界、Typed EventBus、Gitee PR Review

`package.json` 固定 Node.js 24.x、pnpm 11.24.0 与核心依赖版本；`pnpm-lock.yaml` 是唯一锁文件。`pnpm-workspace.yaml` 仅用于 pnpm 构建许可，不包含多 package，也不采用 workspace 拆分业务。

完整前置环境、`.env.example` 归属、Windows/macOS 安装、Docker 与原生 MySQL 兜底见 [环境指南](docs/environment-setup.md)。老师任务书的最低验收和答辩动作见 [任务书验收基线](docs/acceptance-baseline.md)。

## 第一次启动

```bash
corepack enable
corepack prepare pnpm@11.24.0 --activate
cp .env.example .env
# 生成随机值后，手动填入 .env 的 JWT_SECRET
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
pnpm env:check
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:migrate:status
pnpm dev
```

打开 `http://localhost:3000`。健康接口为 `http://localhost:3000/api/health`。

Docker Compose 会自动拉取 `mysql:8.4`，无需手动拉镜像。只有 Docker 无法安装或运行时，才按环境指南使用原生 MySQL 8.4。

开发账号由 Seed 创建：

| 账号       | 默认密码      | 角色       |
| ---------- | ------------- | ---------- |
| `admin`    | `admin123`    | 管理员     |
| `operator` | `operator123` | 普通操作员 |

默认密码仅供课堂开发和现场演示，可通过 `.env` 的 `SEED_*_PASSWORD` 修改。不要把真实密码或私有密钥提交到仓库。

## 四个领域

| 分支             | 目录                                      | 负责内容                       |
| ---------------- | ----------------------------------------- | ------------------------------ |
| `feat/auth`      | `layers/auth/`                            | 登录、验证码、用户、角色、权限 |
| `feat/device`    | `layers/device/`                          | 产品、物模型、设备、在线状态   |
| `feat/telemetry` | `layers/telemetry/`、`scripts/simulator/` | 上报、查询、报警、模拟器       |
| `feat/dashboard` | `layers/dashboard/`                       | 大屏页面和只读聚合             |

每组开始前阅读根 `AGENTS.md`、本 Layer 的 `AGENTS.md` 和 `docs/ai/<domain>.md`。

## Agent 入门

成员可以使用自己的 Codex、Claude Code、DeepSeek Harness 或其他具备文件与终端能力的 Agent。不要把 API Key、代理地址或个人 Agent 配置写入仓库；所有 Agent 的职责声明、主线同步、新手环境配置提示词和只读确认步骤见 [Agent 入门](docs/agent-quickstart.md)。模块级验证和组员反馈见 [模块验证与反馈手册](docs/module-validation.md)。

## 提交前检查

```bash
# 仅格式化本领域允许目录，例如：pnpm exec prettier --write layers/auth
pnpm pr:check
```

`pr:check` 会阻断越界文件，并依次执行格式、Lint、类型、Prisma 和生产 Build 检查；生产 Build 未通过时不得提交、推送或合并。

## 常用脚本

| 命令                           | 用途                                     |
| ------------------------------ | ---------------------------------------- |
| `pnpm env:check`               | 只读检查环境；不会改动系统配置           |
| `pnpm dev` / `pnpm build`      | 本地开发 / 生产构建                      |
| `pnpm typecheck` / `pnpm lint` | TypeScript strict / ESLint 检查          |
| `pnpm format`                  | 写入 Prettier 格式                       |
| `pnpm verify`                  | 格式、Lint、类型、Prisma、Build 检查     |
| `pnpm pr:check`                | 在 `verify` 基础上增加当前分支作用域检查 |

## 数据库命令

```bash
pnpm db:generate
pnpm db:validate
pnpm db:migrate:dev --name change_name
pnpm db:migrate:deploy
pnpm db:migrate:status
pnpm db:seed
pnpm db:studio
```

四个业务组不得自行生成 migration。需要改动 Schema 时按 `docs/cowork-guide.md` 提交 Contract Change，由组长统一生成并验证迁移。

## 文档导航

- [总体架构](docs/architecture.md)
- [领域词汇](docs/domain-glossary.md)
- [API 契约](docs/api-contract.md)
- [事件契约](docs/event-contract.md)
- [数据库归属](docs/db-ownership.md)
- [Cowork 指南](docs/cowork-guide.md)
- [AI Review 指南](docs/ai-review.md)
- [环境指南](docs/environment-setup.md)
- [任务书验收基线](docs/acceptance-baseline.md)
