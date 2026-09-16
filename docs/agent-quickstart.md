# Agent 入门

本指南让成员可在完成本机环境与仓库初始化后，使用自己的 Codex、Claude Code、DeepSeek Harness 或其他 Agent 协作开发。它不保存 API Key、代理、账号或任何个人 Agent 配置；这些信息只能保留在成员自己的受控环境中。

## 使用前提

1. 在仓库根目录启动 Agent，不从临时目录或其他项目目录启动。
2. Agent 需要文件读取、仓库内文件修改、Git 和终端执行能力；不要授予与本项目无关的目录、凭据或生产环境权限。
3. 成员先完成 [环境安装与故障处理](environment-setup.md) 与本组分支切换；确认根目录存在本机 `.env`（没有就从 `.env.example` 创建），再确认 `pnpm env:check`、Docker MySQL ping、迁移和 Seed 已成功。
4. 不同工具和版本的指令文件加载行为可能变化；当前仓库为 Codex 提供 `AGENTS.md`，为 Claude Code 提供根 `CLAUDE.md` 引入，DeepSeek Harness 可使用这两类文件。其他 Agent 或无法确认加载结果时，必须先使用下方通用提示词。

## 新成员先告诉 Agent 的信息

成员不需要自己设计目录或 Git 流程，先把下面四项告诉 Agent：

```text
我属于 <auth/device/telemetry/dashboard> 小组。
我的个人职责是：<例如：登录页面与验证码，不负责用户管理 API>。
我这次要完成：<一句话任务和验收结果>。
我需要和这些领域协作：<无 / device / telemetry / dashboard>；只通过冻结接口、事件和 PR 协作。
```

Agent 可以阅读全仓库来理解依赖，但只能实现成员声明的职责和当前任务。发现需要修改其他 Layer、`shared/`、Prisma、根配置或依赖时，必须先停下，列出 Contract Change，不得顺手代改。

## 主线更新：成员只需一句话

成员本地没有未提交修改时，直接告诉 Agent：

```text
请负责维护 Git：先确认工作区是否为空，再把 origin/main 的最新版本同步到我当前的业务分支。不要覆盖、删除、reset、clean、stash 或擅自提交我已有的工作区内容；如果有本地改动就停止并告诉我。如果发生冲突，列出冲突文件、双方差异和涉及的业务领域，询问我自己负责的内容应保留哪一侧，得到我明确选择后再处理；禁止擅自解决冲突、force push 或丢弃文件。
```

Agent 的实际动作是先执行 `git fetch origin`、`git status --short`，确认无输出且 `origin/main` 确有未同步提交后，再执行 `git pull --no-rebase origin main`。这会把组长更新的版本、根提示词和公共文档带到当前业务分支；如果本次更新包含 `package.json` 或 `pnpm-lock.yaml`，还要执行 `pnpm install --frozen-lockfile`，再运行 `pnpm env:check` 和 `pnpm pr:check`。任何冲突都必须先交给成员判断，不得以“保持能编译”为理由替成员选择内容。

## 所有组共用的 `.env` 与 Docker 数据库

`.env.example` 由组长维护并随仓库发布；`.env` 不是某一组的私有配置，而是每位成员在自己电脑上连接本地 MySQL 的环境文件。四个领域都要自己把本机 Docker 数据库配好，不需要等待“数据库组”提供数据库文件。

新成员在仓库根目录执行：

```bash
cp .env.example .env
# 生成并仅写入本机 .env 的 JWT_SECRET；不要发到聊天、截图或 Git
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
docker compose config --quiet
docker compose up -d --wait
docker compose ps
docker compose exec -T mysql sh -c 'mysqladmin ping -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" --silent'
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:migrate:status
```

先使用 `.env.example` 的 Docker 默认数据库变量，不要自行更改端口、用户名、密码或数据库名。`DATABASE_URL` 供 Prisma migration 使用，`DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_USER`、`DATABASE_PASSWORD`、`DATABASE_NAME` 供应用和 Seed 使用；两类变量必须指向同一个数据库。`docker compose ps` 必须显示 `mysql` 服务为 `healthy`，`pnpm db:migrate:status` 必须能连接数据库后才算环境完成。Compose 不固定容器名，避免不同项目在同一台电脑上互相冲突。

Docker 本身必须真实启动且连接成功，不能只安装 Desktop 或只看到容器镜像。Docker 不可用、3306 被占用、账号权限不匹配或已有数据卷的初始化变量不生效时，按 [环境安装与故障处理](environment-setup.md) 排查；不要执行 `docker compose down -v` 清库。

数据库结构不是通过 push 数据库完成的。负责数据库契约的组长或指定成员只提交 `prisma/schema/`、迁移、Seed 或 Docker 配置的代码变更；变更合入 `main` 后，全体成员执行主线同步，再在自己的本机运行 `pnpm db:migrate:deploy`、`pnpm db:seed` 和 `pnpm db:migrate:status`，把结果反馈到 PR。当前基础环境可以先配置和验证，业务 Schema 有变更时再按 Contract Change 协作，不必为了等待数据库业务开发而延后环境安装。

## 领域负责，不是单文件夹负责

Agent 的职责按业务领域划分，不按“一个 Agent 只能看一个文件夹”划分。为了理解完整数据流，Agent 可以阅读整个仓库；为了避免越界，Agent 只能写入本领域私有实现目录。

| 范围                                                       | Agent 行为                                  |
| ---------------------------------------------------------- | ------------------------------------------- |
| `layers/<domain>/**`                                       | 本领域页面、API 和 Service 的默认可写实现区 |
| `scripts/simulator/**`                                     | 仅 `feat/telemetry` 可写的模拟器区          |
| `app/`、`server/core/`、`shared/`、`prisma/`、根配置和依赖 | 可阅读；默认只读，由组长维护                |
| 其他 `layers/*`                                            | 可阅读以理解契约；禁止写入或导入私有实现    |

如果一个功能确实需要跨目录或跨领域修改，先说明受影响的契约、数据流和兼容方案，提交 Contract Change；不要为了让目录看起来集中而移动文件。`feat/telemetry` 对 `scripts/simulator/**` 的写入是已授权的领域例外，不需要为此重复提交 Contract Change。

## 首次只读确认

无论使用哪种 Agent，首次会话先发送以下任务，禁止它修改文件：

```text
你正在 SolMelt 仓库根目录工作。只读，不要修改文件、安装依赖、启动服务、创建提交或推送。

请阅读 README.md、docs/environment-setup.md、docs/acceptance-baseline.md、docs/architecture.md、docs/domain-glossary.md、docs/api-contract.md、docs/event-contract.md、docs/db-ownership.md、根 AGENTS.md，以及当前领域的 layers/<domain>/AGENTS.md 和 docs/ai/<domain>.md。

然后用简洁中文确认：当前 Git 分支、最低验收目标、允许修改目录、禁止修改目录、涉及的 API 和事件、提交前必须运行的命令。若信息不足或分支不对，停止并指出缺失项。
```

成员核对 Agent 的回答正确后，才给出具体开发任务。任务必须说明领域、验收动作与允许修改范围；不要只说“优化一下”或让 Agent 自行扩展业务。

## 实现提示词模板

将以下文本与具体任务一同发送给不自动读取项目指令的 Agent：

```text
你负责 SolMelt 的 <domain> 业务领域，不是只负责某一个文件夹。当前分支必须是 feat/<domain>；可写范围是 <allowed-paths>，其他目录只能阅读，不能修改。

先阅读 docs/agent-quickstart.md、README.md、docs/environment-setup.md、docs/acceptance-baseline.md、docs/architecture.md、docs/api-contract.md、根 AGENTS.md、layers/<domain>/AGENTS.md、docs/ai/<domain>.md，以及与任务直接相关的冻结契约。

先执行 git fetch origin，再检查 git status、git remote -v、当前分支，以及当前分支是否有未同步的 origin/main。先复述任务目标、最低验收、允许文件、接口/事件、人工验收动作；未经确认不要扩大范围。

禁止修改 shared、Prisma Schema、migration、package.json、pnpm-lock.yaml、根配置和其他 Layer；需要公共改动时提出 Contract Change。禁止 Mock 数据、显式 any、@ts-ignore、静默吞错、调试日志、额外依赖和任务书外的框架或协议。

完成后删除调试代码，只对 <allowed-paths> 执行 `pnpm exec prettier --write <allowed-paths>`，不得运行全仓 `pnpm format`。随后必须执行 pnpm pr:check；该命令包含生产 Build，未通过时不得声明完成、提交或推送。通过后先用本提示词逐项自查范围、契约、Mock 数据、鉴权与错误路径，再交给新的只读 AI 会话 Review。使用 Conventional Commits：<type>(<scope>): <中文摘要>；一个提交只包含一个可说明的变更。报告实际修改文件、pnpm pr:check 成功结果、数据流和未完成项。
```

其中 `<domain>` 和 `<allowed-paths>` 必须替换为本组实际值：`auth`/`layers/auth/**`、`device`/`layers/device/**`、`telemetry`/`layers/telemetry/**` 与 `scripts/simulator/**`、`dashboard`/`layers/dashboard/**`。四组都可以读取公共目录，但公共目录和其他 Layer 默认不可写。

## 新手环境配置提示词

下面的提示词可以直接发送给 WorkBuddy、Trae、Codex、Claude Code、DeepSeek Harness 或其他具备终端能力的 Agent。它会先复用已经安装的工具，只安装缺失项；不能自动安装或需要系统权限时，必须明确告诉成员下一步，不能假装成功。

```text
你是 SolMelt 项目的环境配置助手。我已经注册 Gitee，并打开或进入了 SolMelt 仓库；我的业务领域是 <auth/device/telemetry/dashboard>。请在当前电脑上完成开发环境准备，但不要修改业务代码、不要删除文件、不要执行 git reset --hard、git clean、docker compose down -v、force push，也不要索要或输出任何 API Key、密码、代理密钥。

先做只读检查并报告：操作系统和 CPU 架构、当前目录是否为 Git 仓库、git remote -v、当前分支、git status --short，以及 Git、Node.js、pnpm、Docker、Python（仅 telemetry 需要）的版本。已满足要求的工具直接使用，不要重复安装。

目标版本：Node.js 24.x、pnpm 11.24.0、Docker Desktop、Git；telemetry 组还需要 Python 3.11+。安装缺失工具时优先使用操作系统官方安装方式或官方包管理器；Node.js 只使用 nodejs.org 官方 24 LTS，Docker 使用 Docker Desktop 官方版本。若安装需要管理员权限、图形界面确认或重启，请暂停并给我明确的手动操作，完成后继续，不要绕过权限。

下载源处理：先读取 npm/pnpm 当前 registry，并分别测试 registry.npmjs.org 与 registry.npmmirror.com。只有国内源请求明显更快且成功时，才设置用户级 pnpm/npm registry；记录修改前、修改后和回滚命令。不要自动修改 Docker Desktop 镜像代理、系统代理、shell 配置、.env 或仓库文件中的代理地址。

仓库初始化：
1. 如果当前目录不是目标仓库，先确认目录为空或不存在，再使用 Gitee clone URL 克隆；不要覆盖已有非空目录。
2. 进入仓库后阅读 AGENTS.md、README.md、docs/environment-setup.md、docs/agent-quickstart.md 和当前领域文档。
3. 配置 origin（若已正确配置则不改），执行 git fetch origin。
4. 切换到 origin/<本组分支> 对应的本地分支；已有本地改动时停止，不要自动覆盖。
5. 工作区为空时执行 git pull --no-rebase origin main，把组长最新主线同步到当前业务分支；若冲突立即停止并报告。
6. 若没有 .env，严格以 .env.example 创建。只替换 JWT_SECRET；不要自行修改 DATABASE_URL、DATABASE_HOST、DATABASE_PORT、DATABASE_USER、DATABASE_PASSWORD、DATABASE_NAME 或 MYSQL_ROOT_PASSWORD。检查 DATABASE_URL 与拆分的 DATABASE_* 变量指向同一 MySQL；不得提交 .env，也不得在聊天、日志或截图中输出其内容。
7. 执行 corepack enable 和 corepack prepare pnpm@11.24.0 --activate，然后执行 pnpm env:check、pnpm install --frozen-lockfile、docker compose config --quiet。
8. 启动 Docker Compose：docker compose up -d --wait；随后执行 docker compose ps，确认 mysql 服务为 healthy；再执行 `docker compose exec -T mysql sh -c 'mysqladmin ping -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" --silent'`，验证 MySQL 可连接。若 Docker 镜像拉取失败、Docker daemon 未启动、3306 被占用或数据库账号错误，只报告完整错误并指导我处理；不要删除数据卷、不要自动切换到原生 MySQL、不要修改 Docker Desktop 代理。
9. 数据库连接通过后，执行 pnpm db:migrate:deploy、pnpm db:seed、pnpm db:migrate:status。只有这些命令成功才算所有组通用环境完成。telemetry 组再按 scripts/simulator/README.md 创建 Python .venv 并安装 requests；不要把依赖装进系统 Python。
10. 最后执行 pnpm env:check、pnpm pr:check（该命令包含生产 Build；如果数据库或依赖仍未就绪，记录阻塞原因）。未通过时不得报告环境完成，并报告当前分支、工具版本、registry、.env 是否已存在但不显示内容、Docker 容器健康状态、数据库迁移状态、实际执行命令和未完成项。

完成后不要启动长期后台服务，不要提交或推送。请用“已完成 / 需我手动完成 / 阻塞原因”三段格式反馈，并隐藏密码、令牌、JWT_SECRET 和代理凭据。
```

如果 Agent 无法识别当前工具的指令文件加载规则，仍必须先阅读本仓库的 `AGENTS.md` 和本提示词，不得以“工具不支持”为理由扩大修改范围。

## 四个模块的验证与反馈

具体的人工验证步骤、跨模块联调顺序和组员反馈模板见 [模块验证与反馈手册](module-validation.md)。每个模块完成后，必须提交“预期、实际、证据、阻塞项、需要哪个组协作”五项反馈，不能只回复“已完成”。

## 每次修改后的动作

1. 先审阅 Agent 提出的计划和文件范围；涉及公共契约时先走 Contract Change。
2. 完成实现后，仅对本领域允许目录执行 `pnpm exec prettier --write <allowed-paths>`，再执行 `pnpm pr:check`、`git diff --check`。`pnpm pr:check` 的生产 Build 必须通过；未通过不得提交、推送或标记完成。
3. 使用 `git status` 确认没有 Agent 意外生成的无关文件；只 `git add` 明确审核过的文件。
4. 使用 Conventional Commit 提交并推送固定领域分支，再按 [Cowork 指南](cowork-guide.md) 发起 PR 和独立只读 Review。

`AGENTS.md` 和提示词负责提供上下文，不是安全边界。`pnpm scope:check` 只约束四个固定业务分支，`contract/*` 与 `chore/*` 由组长维护且脚本会跳过范围校验；这些分支的授权必须依赖 Gitee 保护分支、组长批准记录、PR Review 与成员对实际 diff 的确认。
