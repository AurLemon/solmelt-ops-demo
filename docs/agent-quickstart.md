# Agent 入门

本指南让成员可在完成本机环境与仓库初始化后，使用自己的 Codex、Claude Code、DeepSeek Harness 或其他 Agent 协作开发。它不保存 API Key、代理、账号或任何个人 Agent 配置；这些信息只能保留在成员自己的受控环境中。

## 使用前提

1. 在仓库根目录启动 Agent，不从临时目录或其他项目目录启动。
2. Agent 需要文件读取、仓库内文件修改、Git 和终端执行能力；不要授予与本项目无关的目录、凭据或生产环境权限。
3. 成员先完成 [环境安装与故障处理](environment-setup.md) 与本组分支切换，确认 `pnpm env:check`、迁移和 Seed 已成功。
4. 不同工具和版本的指令文件加载行为可能变化；当前仓库为 Codex 提供 `AGENTS.md`，为 Claude Code 提供根 `CLAUDE.md` 引入，DeepSeek Harness 可使用这两类文件。其他 Agent 或无法确认加载结果时，必须先使用下方通用提示词。

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

请阅读 README.md、docs/environment-setup.md、docs/acceptance-baseline.md、docs/architecture.md、docs/api-contract.md、根 AGENTS.md，以及当前领域的 layers/<domain>/AGENTS.md 和 docs/ai/<domain>.md。

然后用简洁中文确认：当前 Git 分支、最低验收目标、允许修改目录、禁止修改目录、涉及的 API 和事件、提交前必须运行的命令。若信息不足或分支不对，停止并指出缺失项。
```

成员核对 Agent 的回答正确后，才给出具体开发任务。任务必须说明领域、验收动作与允许修改范围；不要只说“优化一下”或让 Agent 自行扩展业务。

## 实现提示词模板

将以下文本与具体任务一同发送给不自动读取项目指令的 Agent：

```text
你负责 SolMelt 的 <domain> 业务领域，不是只负责某一个文件夹。当前分支必须是 feat/<domain>；可写范围是 <allowed-paths>，其他目录只能阅读，不能修改。

先阅读 docs/agent-quickstart.md、README.md、docs/environment-setup.md、docs/acceptance-baseline.md、docs/architecture.md、docs/api-contract.md、根 AGENTS.md、layers/<domain>/AGENTS.md、docs/ai/<domain>.md，以及与任务直接相关的冻结契约。

先检查 git status、git remote -v 和当前分支是否落后 origin/feat/<domain>。先复述任务目标、最低验收、允许文件、接口/事件、人工验收动作；未经确认不要扩大范围。

禁止修改 shared、Prisma Schema、migration、package.json、pnpm-lock.yaml、根配置和其他 Layer；需要公共改动时提出 Contract Change。禁止 Mock 数据、显式 any、@ts-ignore、静默吞错、调试日志、额外依赖和任务书外的框架或协议。

完成后删除调试代码，运行 pnpm format 与 pnpm pr:check。使用 Conventional Commits：<type>(<scope>): <中文摘要>；一个提交只包含一个可说明的变更。报告实际修改文件、验证结果、数据流和未完成项，然后交给新的只读 AI 会话 Review。
```

其中 `<domain>` 和 `<allowed-paths>` 必须替换为本组实际值：`auth`/`layers/auth/**`、`device`/`layers/device/**`、`telemetry`/`layers/telemetry/**` 与 `scripts/simulator/**`、`dashboard`/`layers/dashboard/**`。四组都可以读取公共目录，但公共目录和其他 Layer 默认不可写。

## 每次修改后的动作

1. 先审阅 Agent 提出的计划和文件范围；涉及公共契约时先走 Contract Change。
2. 完成实现后执行 `pnpm format`、`pnpm pr:check`、`git diff --check`。
3. 使用 `git status` 确认没有 Agent 意外生成的无关文件；只 `git add` 明确审核过的文件。
4. 使用 Conventional Commit 提交并推送固定领域分支，再按 [Cowork 指南](cowork-guide.md) 发起 PR 和独立只读 Review。

`AGENTS.md` 和提示词负责提供上下文，不是安全边界。真正阻止越权合并的是 `pnpm scope:check`、Gitee 保护分支、PR Review 与成员对实际 diff 的确认。
