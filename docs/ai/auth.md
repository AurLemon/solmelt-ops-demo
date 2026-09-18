# 登录与权限组 AI 工作说明

把下面内容和具体任务一起交给 AI：

```text
你只负责 SolMelt 的登录与权限领域，目标是完成任务书最低验收，不是扩展通用 IAM 平台。

首次进入仓库先阅读 docs/agent-quickstart.md，并完成其中的只读边界确认。首次环境配置再阅读 README.md、docs/environment-setup.md，确认 Node 24、pnpm 11.24.0、数据库和 Seed 可用；运行 pnpm env:check。再完整阅读根 AGENTS.md、layers/auth/AGENTS.md、docs/acceptance-baseline.md、docs/domain-glossary.md、docs/api-contract.md、docs/db-ownership.md。当前分支必须是 feat/auth，默认只允许修改 layers/auth/**。

package.json 已冻结：dev/build 是运行与构建，typecheck/lint/format 是质量检查，db:* 是数据库操作，scope:check/verify/pr:check 是协作门禁。只能对 layers/auth/** 执行 `pnpm exec prettier --write layers/auth`，随后必须运行 pnpm pr:check；该命令包含生产 Build，未通过不得声明完成、提交或推送。不得修改 package.json、pnpm-lock.yaml，不得执行 db:migrate:dev。

先执行 git fetch origin，再检查 git status、git remote -v、当前分支和是否有未同步的 origin/main。再复述：任务目标、最低验收、允许修改范围、涉及的 API、准备修改的文件、人工验收动作。未确认前不要扩大范围。

使用 Nuxt 4、Nuxt UI、TypeScript Interface、Zod、Prisma 和冻结的 ApiResult。实现验证码一次性消费、JWT、用户/角色/菜单与前后端权限双校验。JWT 必须调用组长维护的 `server/core/auth.ts`，不得在 Layer 内复制签名或解析逻辑；Token 固定 8 小时有效，前端保存在 `solmelt_token` Cookie，以便 SSR 中间件和客户端导航读取，调用业务 API 时统一组装 Bearer 头，遇到 401、过期或主动退出时清除。密码只保存 bcrypt hash。ADMIN 与 OPERATOR 是内置角色，但角色管理允许新增角色；权限判断使用 permissions，不要把 role code 写死成两种值。

禁止修改 shared、Prisma Schema、migration、package.json、锁文件、根配置和其他 Layer；需要公共变更时交由组长在 `main` 维护。禁止 Mock 用户、any、@ts-ignore、明文密码回传和只做前端菜单隐藏。不得加入 OAuth、SSO、多租户、审计平台、额外权限模型、测试框架或无关依赖。

完成后删除调试日志，只格式化 layers/auth/** 并运行 pnpm pr:check。该检查和生产 Build 必须通过；先逐项自查范围、契约、Mock 数据、鉴权和错误路径，再说明数据流、实际修改文件、实际成功结果和未实现的可选项，最后交给新的只读 AI 会话 Review。
```
