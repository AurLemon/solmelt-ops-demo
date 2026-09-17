# Gitee Cowork 指南

## 分支

| 小组         | 固定分支         |
| ------------ | ---------------- |
| 登录权限     | `feat/auth`      |
| 物模型设备   | `feat/device`    |
| 数据采集查询 | `feat/telemetry` |
| 监测大屏     | `feat/dashboard` |

`main` 是可运行基线和最终演示分支。组长维护公共内容时直接提交并推送到 `main`；禁止 force push。四个 `feat/*` 分支只用于业务组并行开发。

## 第一次参与

### 组长发放前：只执行一次

组长必须先把已验证的 `main` 和四个领域分支推送到 Gitee；确认 Gitee 上能看到 `main`、`feat/auth`、`feat/device`、`feat/telemetry`、`feat/dashboard` 后，才把 clone URL 发给成员。当前仓库没有远端时，先在本机核对分支，配置好 Gitee remote 后再推送；禁止用 force push 覆盖远端已有初始化提交。

```bash
git branch --list
git remote -v
# 由组长在确认远端历史后配置 origin，并正常推送 main 和四个 feat 分支
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
docker compose config --quiet
docker compose up -d --wait
docker compose ps
docker compose exec -T mysql sh -c 'mysqladmin ping -h 127.0.0.1 -u root -p"$MYSQL_ROOT_PASSWORD" --silent'
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:migrate:status
```

推荐使用 VS Code Source Control 查看变更，但提交前仍执行仓库提供的检查命令。

每位成员都在自己的电脑上运行 Docker MySQL；不要等待其他成员导出数据库，也不要把 `.env`、数据库密码或 Docker 数据卷提交到 Gitee。数据库结构、迁移、Seed 或 Docker 配置由组长/指定负责人以代码形式 push；全体成员 pull 主线后，在本机执行 `pnpm db:migrate:deploy`、`pnpm db:seed`、`pnpm db:migrate:status` 并反馈结果。

## 每次工作

```bash
git switch <本组固定分支>
git fetch origin
git status --short
git remote -v
# 若有输出，先让 Agent 报告本地改动，不要继续同步
# 组长更新版本、提示词或公共文档后，工作区为空时执行：
git pull --no-rebase origin main
# 只同步同组成员的分支时才执行：
git pull --ff-only origin <本组固定分支>
# 完成一个可说明的小任务；仅格式化本领域允许目录
pnpm exec prettier --write <本领域允许目录>
pnpm pr:check
git status
git diff --check
git add <明确文件>
git commit -m "feat(<scope>): 中文摘要"
git push origin <本组固定分支>
```

同组两人不要同时修改同一个文件。开始前在群里声明当前任务和文件，完成后立即推送并通知搭档同步。

首次课堂开发采用 Driver/Navigator 轮换：A 在自己的电脑完成前半 checkpoint，通过门禁后提交并推送；B 保持工作区为空，在自己的电脑执行 `git pull --ff-only origin <本组固定分支>` 后接手后半 checkpoint，A 转为 Navigator。两人各保留一个可解释的原子提交；A/B 可在下一次任务中互换，但一个未完成的 checkpoint 不得由两台电脑并行编辑。

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
5. 组长先对照菜单路径、页面路由、权限码、Token 存储、API 字段、主题和数据源建立集成检查表；临时自签 Token、路由别名、Layer 全局配置和 Mock 数据不得进入最终主线。
6. 组长本地执行 `pnpm pr:check`（其中生产 Build 必须通过）并按 auth → device → telemetry → dashboard 顺序集成；未通过不得合并。
7. 使用 merge commit，保留成员提交记录。
8. 合并后的 `main` 重新执行门禁，并从正式登录与侧栏开始复走完整数据闭环；至少检查暗色/浅色、桌面/移动端和显式错误反馈。各分支单独 Build 通过不能替代这一步。

其他组完成合并后，组员不需要手动理解 fetch/merge；在自己的 feat 分支直接让 Agent 执行：

```bash
git status --short
git pull --no-rebase origin main
```

仅当 `git status --short` 没有输出时执行。组员让 Agent 负责 Git 同步，但 Agent 不得覆盖、删除、reset、clean、stash 或擅自提交已有工作区内容；有本地改动时先报告。发生冲突时列出冲突文件和双方差异，询问组员自己负责的内容应保留哪一侧，确认后才能处理；处理后重新执行 `pnpm pr:check`。不使用 force push，不要求成员进行 rebase 或 cherry-pick。

## 公共改动

业务组不得直接修改 `shared/`、Prisma Schema、migration、根配置、依赖和其他 Layer。确有需要时说明受影响的字段、接口、领域和兼容方案；组长确认后直接在 `main` 集中修改并同步文档。

全局主题、字体 Provider、公共 Head、路由默认值和应用壳属于根配置或 `app/`。业务 Layer 不得通过自己的 `nuxt.config.ts` 长期承载全局兜底；如果课堂阶段确需临时兼容，PR 中必须标注清理条件，并在合并前由组长收口。

## 常见错误

- 推送被拒绝或忘记同步：先执行 `git status --short` 和 `git remote -v`；工作区为空时让 Agent 执行 `git pull --no-rebase origin main` 或 `git pull --ff-only origin <本组分支>`，不要 force push。
- `scope:check` 失败：撤回越界文件，或请组长在 `main` 维护公共改动。
- Build 失败：提交完整错误给 AI，不要删除类型、改成 `any` 或关闭规则。
- 数据不一致：回到老师物模型和领域文档，不要在页面临时补假数据。
- Docker 不可用：按 `docs/environment-setup.md` 使用原生 MySQL 8.4 兜底；不要同时让 Docker 和原生 MySQL 占用 3306。
