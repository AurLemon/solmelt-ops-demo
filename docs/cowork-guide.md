# Gitee Cowork 指南

## 分支

| 小组         | 固定分支         |
| ------------ | ---------------- |
| 登录权限     | `feat/auth`      |
| 物模型设备   | `feat/device`    |
| 数据采集查询 | `feat/telemetry` |
| 监测大屏     | `feat/dashboard` |

`main` 是可运行基线和最终演示分支，必须在 Gitee 设置为保护分支，禁止直接推送和强制推送，只通过 PR 合并。

## 第一次参与

### 组长发放前：只执行一次

组长必须先把已验证的 `main`、`v0.1.0-baseline` 标签和四个领域分支推送到 Gitee；确认 Gitee 上能看到 `main`、`feat/auth`、`feat/device`、`feat/telemetry`、`feat/dashboard` 后，才把 clone URL 发给成员。当前仓库没有远端时，先在本机核对分支和标签，配置好 Gitee remote 后再推送；禁止用 force push 覆盖远端已有初始化提交。

```bash
git branch --list
git tag --list v0.1.0-baseline
git remote -v
# 由组长在确认远端历史后配置 origin，并正常推送 main、标签和四个 feat 分支
```

### 成员克隆与启动

```bash
git clone <Gitee clone URL>
cd <克隆后的仓库目录>
git switch --track origin/<本组固定分支>
corepack enable
corepack prepare pnpm@11.24.0 --activate
cp .env.example .env
# 生成随机值后，手动替换 .env 中的 JWT_SECRET
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
pnpm env:check
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:migrate:status
```

推荐使用 VS Code Source Control 查看变更，但提交前仍执行仓库提供的检查命令。

## 每次工作

```bash
git switch <本组固定分支>
git status
git remote -v
# 若 git status 有输出，先处理本地改动，不要继续 pull
git pull origin <本组固定分支>
# 完成一个可说明的小任务
pnpm format
pnpm pr:check
git status
git diff --check
git add <明确文件>
git commit -m "feat(<scope>): 中文摘要"
git push origin <本组固定分支>
```

同组两人不要同时修改同一个文件。开始前在群里声明当前任务和文件，完成后立即推送并通知搭档同步。

## Commit 规范

提交消息采用 Conventional Commits：`<type>(<scope>): <中文摘要>`。一次提交只解决一个可说明的变更，禁止 `wip`、`update`、`fix bug` 等无法说明影响的摘要。

| type       | 使用场景               |
| ---------- | ---------------------- |
| `feat`     | 新的最低验收功能       |
| `fix`      | 修复可复现缺陷         |
| `docs`     | 文档、提示词或协作规则 |
| `refactor` | 不改变功能的结构调整   |
| `chore`    | 工具、门禁或仓库维护   |

`scope` 使用对应领域或明确公共范围：`auth`、`device`、`telemetry`、`dashboard`、`agent`、`docs`、`tooling`、`core`。例如：`feat(auth): 完成验证码一次性消费`、`fix(telemetry): 拒收停用设备上报`、`docs(agent): 补充新成员入门流程`。

## PR

1. 本组达到一条可演示验收线后，从 feat 分支向 `main` 发 PR。
2. 完整填写 PR 模板，明确 AI 工具、人工修改和验证结果。
3. 同组另一位成员先 Review。
4. 使用新 AI 会话按 `docs/ai-review.md` 做只读 Review。
5. 组长本地执行 `pnpm pr:check` 并按 auth → device → telemetry → dashboard 顺序集成。
6. 使用 merge commit，保留成员提交记录。

其他组完成合并后，在自己的 feat 分支执行：

```bash
git fetch origin
git merge origin/main
```

解决冲突后重新执行 `pnpm pr:check`。不使用 force push，不要求成员进行 rebase 或 cherry-pick。

## Contract Change

业务组不得直接修改 `shared/`、Prisma Schema、migration、根配置、依赖和其他 Layer。确有需要时使用 Gitee Contract Change 模板说明：

- 当前契约为什么阻塞功能；
- 建议的新旧字段或行为；
- 受影响领域；
- 兼容与迁移方案；
- 可复现证据。

组长确认后在 `contract/<slug>` 分支集中修改并重新发布契约。

## 常见错误

- 推送被拒绝或忘记 pull：先执行 `git status`、`git remote -v`、`git fetch origin`、`git log HEAD..origin/<本组分支>`；先保存或提交本地工作，再 `git pull origin <本组分支>`，不要 force push。
- `scope:check` 失败：撤回越界文件，或发 Contract Change。
- Build 失败：提交完整错误给 AI，不要删除类型、改成 `any` 或关闭规则。
- 数据不一致：回到老师物模型和领域文档，不要在页面临时补假数据。
- Docker 不可用：按 `docs/environment-setup.md` 使用原生 MySQL 8.4 兜底；不要同时让 Docker 和原生 MySQL 占用 3306。
