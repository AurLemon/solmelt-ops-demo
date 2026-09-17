# 周四课堂执行手册与个人 Prompt

## 这份手册怎么用

本手册用于周四下午第一次正式使用 WorkBuddy 或 DeepSeek Harness 开发 SolMelt。今天不要求任何人学会 Nuxt 的全部语法，也不允许把“完成整个模块”一句话丢给 Agent。每个人只需要完成一个可运行、可验证、可解释的 checkpoint，并知道数据从哪里来、经过什么接口、最后在哪里看到结果。

每组两人先现场认领 A、B 角色。A 先做前半链，B 是 Navigator；A 提交并推送后，B 在自己的电脑拉取同一领域分支，再做后半链，A 变成 Navigator。不要同时修改同一个文件。A/B 只是当天任务角色，不是固定前端或后端岗位，下次可以轮换。

**不要把一整页 Prompt 一次性发给 Agent。** 每次只复制当前编号的 Prompt，等 Agent 停下来后，由人检查它的回答或运行结果，再决定是否发送下一段。

## 开始前的五分钟

1. 两人共同确认本组固定分支和本次 A/B 角色，把姓名填入课堂反馈表。
2. 两台电脑都在仓库根目录打开 VS Code、WorkBuddy 或 DSH。
3. 确认 `.env` 已存在，但不要把内容发给 Agent、截图或群聊。
4. A 的电脑开始实现；B 的电脑只阅读需求和准备验收，暂不编辑代码。
5. 任何人看到 Agent 准备改 `shared/`、`prisma/`、根配置、依赖或其他 Layer，立即让它停止并报告组长。

## 全组统一四段式

每位成员都按以下四段完成自己的 checkpoint：

1. **理解**：只读仓库、检查 Git、复述目标和边界，禁止修改。
2. **实现**：成员确认计划正确后，Agent 只实现当前 checkpoint。
3. **验证**：成员按页面、API 或数据库现象检查；失败时把完整错误交回 Agent 修复。
4. **交付**：人工确认后才允许格式化、运行门禁、检查 diff、提交并推送。

如果 Agent 在第一段直接写代码，立即发送：

```text
停止修改。你跳过了只读确认。先恢复到只读状态，列出你已经改动的文件和 diff，不要删除、reset、clean、stash 或覆盖任何文件，等待我和 Navigator 判断。
```

如果出现解决不了的问题，不要只说“报错了”，复制完整错误并发送：

```text
当前 checkpoint 被阻塞。请保持范围不变，根据下面的完整命令、完整错误和复现动作定位原因。先解释最后一个成功状态、失败发生在哪一层、是否需要其他领域或组长维护的公共改动；未经我确认不要扩大范围、换技术栈、关闭类型规则或修改公共文件。

【执行命令或页面操作】
<粘贴>

【完整错误】
<粘贴>
```

## Auth 组

固定分支：`feat/auth`  
可写范围：`layers/auth/**`  
周四停止线：管理员和普通操作员都能完成验证码登录，通过 JWT 调用 `/api/v1/auth/me` 并进入受保护首页。用户、角色和菜单管理留到周五前两节。

### Auth A 任务卡

职责：验证码、登录、JWT、`/me` 的服务端链路。

#### Auth A 第 1 段 理解

```text
我是 SolMelt Auth 组的 Checkpoint A Driver。你必须在仓库根目录工作，当前分支必须是 feat/auth。现在只读，不要修改文件、安装依赖、启动长期服务、提交或推送。

完整阅读根 AGENTS.md、README.md、docs/agent-quickstart.md、docs/acceptance-baseline.md、docs/architecture.md、docs/api-contract.md、docs/db-ownership.md、layers/auth/AGENTS.md、layers/auth/README.md 和 docs/ai/auth.md，并查看 shared/contracts/auth.ts、server/core/auth.ts、server/core/http.ts、Prisma Auth 模型和 Seed。

执行 git fetch origin、git branch --show-current、git status --short、git remote -v，并判断当前分支是否落后 origin/main。若工作区不干净、分支不对或存在冲突，只报告并停止，不要 reset、clean、stash、覆盖或自动解决。

然后用初学者能复述的中文回答：
1. 验证码、密码、JWT、/me 的完整数据流。
2. 本 checkpoint 允许和禁止修改的目录。
3. 准备实现的 API、Service、页面外部行为和错误路径。
4. 准备修改的具体文件。
5. 我与 Navigator 应怎样验证正常登录、错误验证码和重复使用验证码。

回答后必须停止，等我确认。今天不要实现用户、角色、菜单管理，也不要试图完成整个 Auth 模块。
```

#### Auth A 第 2 段 实现

```text
只实施刚才确认的 Auth Checkpoint A：
- GET /api/v1/auth/captcha：生成四位图形验证码，答案只保存 bcrypt hash，五分钟过期。
- POST /api/v1/auth/login：使用 Zod 校验输入；验证码错误或过期失败；只有登录成功才消费验证码，成功后不能再次使用。
- 使用 Seed 用户的 bcrypt hash 校验密码；禁止返回或记录密码、hash、验证码答案、JWT_SECRET。
- 使用 server/core/auth.ts 的 issueAccessToken 签发 8 小时 JWT，不复制 JWT 实现。
- GET /api/v1/auth/me：使用 authorizeRequest，返回冻结的 AuthenticatedUser 与 ApiResult。

只修改 layers/auth/**。使用 TypeScript Interface，不使用 any、@ts-ignore、Mock 用户、静态假账号、调试日志或额外依赖。Service 只访问 Auth 表；API 只负责 HTTP 适配。完成实现后先报告改动、数据流和仍未实现的内容，不要格式化、提交或推送，等待我和 Navigator 验证。
```

#### Auth A 第 3 段 验证

```text
现在只验证 Auth Checkpoint A，不扩展功能。启动必要的本地服务，使用真实 Seed 数据验证：
1. admin 获取验证码并成功登录，响应含 JWT、8 小时 UTC expiresAt 和用户权限。
2. operator 同样能够登录。
3. 错误验证码失败。
4. 成功使用后的同一 captchaKey 再次登录失败。
5. 有效 JWT 调用 /api/v1/auth/me 成功；缺失、损坏 Token 返回统一 401。

请逐项给出操作、预期、实际和证据摘要，隐藏 Token、密码、验证码答案和 JWT_SECRET。发现失败就只修当前 checkpoint 并重新验证。全部通过后停止，不要提交或推送。
```

#### Auth A 第 4 段 交付

```text
Navigator 已确认 Auth Checkpoint A 通过。删除调试日志，只对 layers/auth/** 执行 Prettier，然后运行 pnpm pr:check 和 git diff --check。检查 git status 与 diff，确认没有越界文件、敏感信息、Mock 数据和额外功能。

如果任一门禁失败，修复并重新运行；不得关闭规则或改成 any。全部通过后，只提交本 checkpoint 的明确文件，提交信息使用：feat(auth): 完成验证码与 JWT 登录链。随后 push 到 origin/feat/auth，并报告 commit hash、实际验证结果、未完成 backlog。不要发 PR。
```

### Auth B 任务卡

职责：登录页面、Token 生命周期、受保护首页和路由守卫。

#### Auth B 第 1 段 理解与接棒

```text
我是 SolMelt Auth 组的 Checkpoint B Driver。当前分支必须是 feat/auth。先只读检查 git status --short；若有本地改动立即停止报告。工作区为空时执行 git fetch origin 和 git pull --ff-only origin feat/auth，确认已经包含 Checkpoint A 的提交。

完整阅读根 AGENTS.md、docs/ai/thursday-workshop.md 的 Auth 部分、docs/ai/auth.md、docs/api-contract.md、layers/auth/AGENTS.md，并审阅 A 的实际 diff。不要修改文件。

请用初学者能复述的中文说明：登录页怎样获得验证码、怎样调用登录接口、JWT 为什么放在 `solmelt_token` Cookie、业务 API 怎样组装 Bearer 头、什么时候必须清除、路由守卫和服务端鉴权分别解决什么问题。列出准备修改的文件和浏览器验收动作，然后停止等待我确认。今天不要实现用户、角色和菜单管理。
```

#### Auth B 第 2 段 实现

```text
只实施 Auth Checkpoint B：
- 登录页包含用户名、密码、验证码输入、验证码图片刷新、提交中状态和可理解的错误提示。
- 登录成功后只把 JWT 保存到 `solmelt_token` Cookie，并进入一个受保护首页；不要保存密码或验证码。
- 提供强类型的 Auth composable/API 封装，调用 /api/v1/auth/me 获取当前用户。
- 未登录访问受保护页面跳转登录；收到 401、Token 过期或主动退出时清除 Token Cookie 并返回登录页。
- 页面不输出 Token，不把 role code 当作权限判断依据。

只修改 layers/auth/**，不改根 app、shared、Prisma、依赖或其他 Layer。完成后报告页面状态、数据流和文件，不要格式化、提交或推送。
```

#### Auth B 第 3 段 验证

```text
使用真实 admin 和 operator 分别完成浏览器验证：刷新验证码、错误验证码提示、成功登录、刷新页面仍保持登录、/me 返回当前用户、退出后 Token Cookie 被清除、直接访问受保护页会跳转。再用损坏 Token 验证 401 后自动清理。

请逐项记录预期和实际，截图不得包含 Token、密码、验证码答案或 JWT_SECRET。只修复本 checkpoint 的问题，通过后停止等待人工确认。
```

#### Auth B 第 4 段 交付

```text
Navigator 已确认 Auth Checkpoint B 通过。删除调试日志，只格式化 layers/auth/**，运行 pnpm pr:check、git diff --check，审查 diff 没有越界、Mock 和敏感信息。全部通过后提交：feat(auth): 完成登录页面与路由守卫。push 到 origin/feat/auth，报告 commit hash、浏览器证据和周五 backlog，不要发 PR。
```

## Device 组

固定分支：`feat/device`  
可写范围：`layers/device/**`  
周四停止线：真实 Seed 的 1 个产品、30 个属性、9 台设备可以通过正式 API 在列表和详情页面展示；从未上报的 latest 值显示 `—`。编辑、启停、删除和物模型导入留到周五前两节。

### Device A 任务卡

职责：产品、属性、设备和 latest/online 的只读 API。

#### Device A 第 1 段 理解

```text
我是 SolMelt Device 组的 Checkpoint A Driver。当前分支必须是 feat/device。现在只读，不修改、不提交、不推送。

阅读根 AGENTS.md、README.md、docs/acceptance-baseline.md、docs/architecture.md、docs/api-contract.md、docs/db-ownership.md、docs/domain-glossary.md、layers/device/AGENTS.md、docs/ai/device.md、shared/contracts/device.ts、server/core/auth.ts、Prisma Device 模型、Seed 和教师物模型 JSON。

检查 git fetch origin、分支、git status、remote 和与 origin/main 的差异；异常即停止。然后复述 1 个产品、30 属性、9 设备从 Seed 到 API 的数据流，解释“启用”和“在线”的区别、DeviceLatestValue 的写入权，列出文件和真实 API 验收动作。回答后停止。不要实现整个 Device 模块。
```

#### Device A 第 2 段 实现

```text
只实现 Device 真实只读 API：products、产品 properties、devices 分页列表、device detail、device latest、device online。所有受保护接口调用 server/core/auth.ts 的 authorizeRequest，并使用冻结 PermissionCode 和 ApiResult。

数据必须来自 Prisma 与真实 Seed；产品标识、设备编号、名称、泵型、30 个 identifier、类型和单位以教师资料为准。在线固定为未删除且最近 300 秒有成功上报；latest 只读 Telemetry 拥有的 DeviceLatestValue，禁止写入或导入 Telemetry 私有 Service。

只改 layers/device/**。不实现创建、编辑、删除、导入，不使用假数组或额外依赖。完成后报告查询、文件和错误路径，停止等待验证。
```

#### Device A 第 3 段 验证

```text
使用真实数据库和正式 API 验证：产品恰好 1 个、属性恰好 30 个、设备恰好 9 台；编号、名称、类型和单位与教师 JSON 一致；无上报时 latest 为空且 online=false；缺 Token 返回 401，operator 的 device:read Token 可读取。

逐项报告操作、预期、实际和响应摘要，隐藏 Token。发现问题只修当前只读链，通过后停止，不提交。
```

#### Device A 第 4 段 交付

```text
Navigator 已确认 Device Checkpoint A。删除调试日志，只格式化 layers/device/**，运行 pnpm pr:check 和 git diff --check。通过后提交：feat(device): 完成真实设备只读接口。push 到 origin/feat/device，报告 commit hash、1/30/9 核对结果和周五 backlog，不发 PR。
```

### Device B 任务卡

职责：设备列表和详情页面。

#### Device B 第 1 段 理解与接棒

```text
我是 SolMelt Device 组的 Checkpoint B Driver。先确认当前分支 feat/device 且工作区为空，再执行 git fetch origin、git pull --ff-only origin feat/device。若不为空或冲突就停止报告。

只读审阅 A 的 diff，并阅读 docs/ai/thursday-workshop.md、docs/api-contract.md、docs/domain-glossary.md、layers/device/AGENTS.md。请解释页面将调用哪些正式 API、1/30/9 如何对应、无 latest 为什么必须显示横线、启用和在线为何不能混用。列出文件和浏览器验收步骤后停止等待确认。
```

#### Device B 第 2 段 实现

```text
只实现设备列表与详情页面：显示真实 9 台设备的编号、名称、泵型、启用状态和在线状态；详情显示所属产品、30 个属性定义与 latest。latest 没有真实上报时显示“—”，不能生成默认数值。页面要有加载、空、错误状态，并使用冻结 Interface。

只改 layers/device/**。不实现编辑、启停、删除、导入，不写 DeviceLatestValue，不加入图表或假数据。完成后说明页面数据流和文件，停止等待验证。
```

#### Device B 第 3 段 验证

```text
使用真实 Seed 和正式 API 在浏览器验证：产品数量 1、属性 30、设备 9；逐项抽查教师编号、名称、泵型和单位；无遥测设备的 latest 显示“—”；刷新页面数据仍来自 API；未登录访问受保护页被拦截。记录预期、实际和不含 Token 的截图。只修当前页面链，通过后停止。
```

#### Device B 第 4 段 交付

```text
Navigator 已确认 Device Checkpoint B。删除调试日志，只格式化 layers/device/**，运行 pnpm pr:check、git diff --check。通过后提交：feat(device): 完成设备列表与详情展示。push 到 origin/feat/device，报告 commit hash、浏览器证据和周五 backlog，不发 PR。
```

## Telemetry 组

固定分支：`feat/telemetry`  
可写范围：`layers/telemetry/**`、`scripts/simulator/**`  
周四停止线：正式 HTTP 上报能在同一事务写入报告、属性值、latest 和三项阈值报警；最小 Python 模拟器能产生正常和超限数据。历史页面和完整查询交互留到周五前两节。

### Telemetry A 任务卡

职责：上报校验、事务持久化、报警和事件。

#### Telemetry A 第 1 段 理解

```text
我是 SolMelt Telemetry 组的 Checkpoint A Driver。当前分支必须是 feat/telemetry。现在只读，不修改、不提交、不推送。

阅读根 AGENTS.md、README.md、docs/acceptance-baseline.md、docs/architecture.md、docs/api-contract.md、docs/event-contract.md、docs/db-ownership.md、docs/domain-glossary.md、layers/telemetry/AGENTS.md、docs/ai/telemetry.md、shared/contracts/telemetry.ts、shared/events.ts、Prisma Telemetry/Device 模型和教师物模型。

检查 Git 状态和 origin/main 同步情况，异常即停止。然后画出 simulator→POST→校验→transaction→四类数据→事件的数据流，解释为什么停用设备要拒收、为什么四类写入必须原子、哪些阈值会报警、事件为什么只能在提交后发布。列出文件和验证动作后停止。不要完成整个 Telemetry 模块。
```

#### Telemetry A 第 2 段 实现

```text
只实现 POST /api/v1/telemetry/report 及本领域 Service：
- Zod 校验 deviceCode、UTC ISO reportedAt 和 props。
- 设备必须存在、未删除、启用；属性必须属于该产品且 BOOL/DOUBLE 类型匹配。
- 同一 Prisma transaction 写 TelemetryReport、TelemetryValue、DeviceLatestValue upsert、Device.lastReportedAt 和 Alarm。
- motor_drive_bearing_temp > 65、pump_vibration_x > 4.5、inverter_current > 60 时创建 WARNING、UNHANDLED 报警。
- transaction 提交后发布一次 telemetry.reported，并为每条新报警发布 alarm.created；Handler 不得回写本次核心数据。

只改 layers/telemetry/**。不调用 Device Service，不实现历史页面，不增加 MQTT、消息队列或复杂判据。完成后报告事务边界、错误路径和文件，停止等待验证。
```

#### Telemetry A 第 3 段 验证

```text
使用真实 Seed 设备和正式 POST 验证：正常数值成功写报告、属性值和 latest；超限温度/振动/电流分别产生 WARNING、UNHANDLED 报警；停用、不存在、已删除设备或错误属性/类型被拒收，失败时不能留下部分数据；重复 deviceId+reportedAt 不重复入库。

逐项报告 API、数据库前后数量和事件结果，不显示数据库密码。只修当前上报链，通过后停止，不提交。
```

#### Telemetry A 第 4 段 交付

```text
Navigator 已确认 Telemetry Checkpoint A。删除调试日志，只格式化 layers/telemetry/**，运行 pnpm pr:check、git diff --check。通过后提交：feat(telemetry): 完成遥测上报与阈值报警。push 到 origin/feat/telemetry，报告 commit hash、事务验证和周五 backlog，不发 PR。
```

### Telemetry B 任务卡

职责：最小 Python 模拟器和真实上报验证。

#### Telemetry B 第 1 段 理解与接棒

```text
我是 SolMelt Telemetry 组的 Checkpoint B Driver。确认当前分支 feat/telemetry 且工作区为空，再执行 git fetch origin、git pull --ff-only origin feat/telemetry。异常或冲突立即停止。

只读审阅 A 的 diff，阅读 docs/ai/thursday-workshop.md、docs/api-contract.md、docs/domain-glossary.md、docs/environment-setup.md 的 Python 部分和教师物模型。解释 Python 模拟器为何是正式测试数据源而不是页面 Mock、随机游走与偶发异常分别用于验证什么、请求如何满足 TelemetryReportInput。列出文件和验收动作后停止。
```

#### Telemetry B 第 2 段 实现

```text
只实现可运行的最小 Python 模拟器：使用项目专用 .venv 与 requests，读取教师 9 台设备和 30 属性事实，按 10 至 30 秒间隔生成有界随机游走数据，通过正式 /api/v1/telemetry/report 上报；提供可说明的异常注入方式，能稳定触发三项阈值之一；输出成功/失败摘要但不输出密码、Token 或完整敏感配置。

只改 scripts/simulator/**，必要的领域内说明可放 layers/telemetry/**。不要硬编码页面数据，不安装到系统 Python，不实现历史页面。完成后报告运行方式和数据流，停止等待验证。
```

#### Telemetry B 第 3 段 验证

```text
启动正式 API 和模拟器，记录开始时间。确认 9 台真实设备出现成功上报、报告和 latest 持续增加；执行一次可复现的异常注入并确认报警；停止模拟器并确认不再产生新数据。记录开始/停止时间、一次正常结果、一次报警结果和数据库摘要。若失败，只修当前模拟器链。通过后停止。
```

#### Telemetry B 第 4 段 交付

```text
Navigator 已确认 Telemetry Checkpoint B。停止本次模拟器和开发服务，保留数据库数据。删除调试日志，只格式化 layers/telemetry/** 与 scripts/simulator/**，运行 pnpm pr:check、git diff --check。通过后提交：feat(telemetry): 添加熔盐泵数据模拟器。push 到 origin/feat/telemetry，报告 commit hash、运行证据和周五 backlog，不发 PR。
```

## Dashboard 组

固定分支：`feat/dashboard`  
可写范围：`layers/dashboard/**`  
周四停止线：三个正式只读聚合 API 驱动至少六张统计卡、设备状态和近期报警，并每 30 秒轮询。Telemetry 尚无数据时展示真实空态；接通模拟器后再复验实时值和 60 秒延迟。

### Dashboard A 任务卡

职责：overview、realtime、recent alarms 聚合 API。

#### Dashboard A 第 1 段 理解

```text
我是 SolMelt Dashboard 组的 Checkpoint A Driver。当前分支必须是 feat/dashboard。现在只读，不修改、不提交、不推送。

阅读根 AGENTS.md、README.md、docs/acceptance-baseline.md、docs/architecture.md、docs/api-contract.md、docs/db-ownership.md、docs/domain-glossary.md、layers/dashboard/AGENTS.md、docs/ai/dashboard.md、shared/contracts/dashboard.ts、Device/Telemetry/Alarm Prisma 模型和 Seed。

检查 Git 状态与 origin/main，同步异常立即停止。请解释 Dashboard 为何只能读、在线/运行中/延迟/dataUntil 的冻结定义、六张统计卡分别来自哪些真实查询、Telemetry 无数据时应该显示什么。列出文件和 API 验收动作后停止。不要完成整个 Dashboard 模块。
```

#### Dashboard A 第 2 段 实现

```text
只实现 GET /api/v1/dashboard/overview、/realtime、/alarms/recent 和本领域只读聚合 Service。调用 authorizeRequest(event, 'dashboard:read')；严格返回冻结的 DashboardOverview、DashboardRealtimeDevice[] 和 AlarmSummary[]。

设备总数来自未删除设备；在线为 300 秒内成功上报；运行中为在线且最新 inverter_start_status=true；延迟为最新真实上报距当前超过 60 秒；dataUntil/latestReportedAt 只能来自真实数据。近期报警默认 10、最多 20，UNHANDLED 优先再按 occurredAt 降序。

只改 layers/dashboard/**。不得写 Device、Telemetry、Alarm 表，不调用其他领域 Service，不生成随机值、默认遥测或静态业务数组。完成后报告查询口径与空态，停止等待验证。
```

#### Dashboard A 第 3 段 验证

```text
使用真实 Seed 和正式 API 验证：无遥测时 deviceTotal=9、online/running/alarm 为真实零值、dataUntil=null、realtime 中 latestReportedAt=null 且 metrics 为空；缺 Token 返回 401；operator 的 dashboard:read Token 可以读取；limit 超范围被校验。若本机已经有正式模拟器数据，则再核对统计与数据库一致。只修当前聚合链，通过后停止。
```

#### Dashboard A 第 4 段 交付

```text
Navigator 已确认 Dashboard Checkpoint A。删除调试日志，只格式化 layers/dashboard/**，运行 pnpm pr:check、git diff --check。通过后提交：feat(dashboard): 完成监测大屏只读聚合接口。push 到 origin/feat/dashboard，报告 commit hash、空态/真实数据证据和周五 backlog，不发 PR。
```

### Dashboard B 任务卡

职责：暗色监测大屏、轮询和延迟展示。

#### Dashboard B 第 1 段 理解与接棒

```text
我是 SolMelt Dashboard 组的 Checkpoint B Driver。确认当前分支 feat/dashboard 且工作区为空，再执行 git fetch origin、git pull --ff-only origin feat/dashboard。异常或冲突立即停止。

只读审阅 A 的 diff，阅读 docs/ai/thursday-workshop.md、docs/api-contract.md、docs/domain-glossary.md、layers/dashboard/AGENTS.md。解释六张卡、设备状态、近期报警的数据来源，30 秒轮询和 60 秒延迟为什么不是同一件事，无遥测时为什么不能生成看起来漂亮的数值。列出页面区域、文件和浏览器验收后停止。
```

#### Dashboard B 第 2 段 实现

```text
只实现周四大屏竖切：1920×1080 暗色自适应页面，至少六张真实统计卡、9 台设备状态和近期报警区域；调用 A 的三个正式 API；每 30 秒轮询，前一次请求未结束时不重叠发起；展示数据截至时间。无遥测时显示“暂无上报”或“—”，不生成随机数据。

使用 Nuxt UI、Tailwind、ECharts 和冻结 Interface，只改 layers/dashboard/**。周四不做地图、3D、健康评分、复杂运行模式和额外图表库。完成后报告页面数据流、状态处理和文件，停止等待验证。
```

#### Dashboard B 第 3 段 验证

```text
以 1920×1080 打开大屏，验证布局无横向滚动或遮挡，真实显示 deviceTotal=9 与当前数据库统计；检查加载、空、错误状态；通过浏览器网络面板确认 30 秒轮询且请求不重叠。若 Telemetry 模拟器已可用，再观察一次数据更新；若尚不可用，明确记录“等待周五真实联调”，不能用假数据替代。通过后停止。
```

#### Dashboard B 第 4 段 交付

```text
Navigator 已确认 Dashboard Checkpoint B。停止本次开发服务，删除调试日志，只格式化 layers/dashboard/**，运行 pnpm pr:check、git diff --check。通过后提交：feat(dashboard): 完成监测大屏轮询页面。push 到 origin/feat/dashboard，报告 commit hash、浏览器尺寸与轮询证据、待联调项，不发 PR。
```

## 周四下课反馈

每组完成后向组长提交，不允许只写“完成了”：

```text
【小组与分支】auth/device/telemetry/dashboard，feat/<domain>
【A/B 与提交】A 姓名 + commit；B 姓名 + commit
【今天的真实停止线】一句话
【执行步骤】命令、API 或页面动作
【预期与实际】逐项对照
【证据】截图、响应摘要、数据库数量或网络面板；隐藏 Token 和密码
【状态】PASS / PARTIAL / BLOCKED
【最后一个成功状态】数据最后到达哪里
【未完成 backlog】明确留到周五的项目
【需要协作】接口、事件或组长公共改动
```

## 周五下午流程

### 前两节 补齐最低验收

- Auth：验证码错误、过期、重放，用户/角色/菜单管理，管理员与操作员前后端权限差异。
- Device：物模型导入，设备编辑、启停、逻辑删除，latest 与 300 秒在线判定。
- Telemetry：完整 9 台随机游走、历史查询与曲线、报警查询、停用设备拒收。
- Dashboard：真实实时值和报警更新、1920×1080 完整布局、停止模拟器 60 秒后的延迟标识。

每组完成领域手册的全部最低验收，运行 `pnpm pr:check`，由同组成员 Review，再开一个新的只读 AI 会话按 `docs/ai-review.md` Review。通过后才向 `main` 发 PR。

### 后两节 集成与彩排

组长按 `Auth → Device → Telemetry → Dashboard` 顺序合并。每次合并后都运行 `pnpm pr:check`；失败就退回对应组修复，不由组长静默代写。

最终固定彩排：

```text
管理员和普通操作员登录
→ 查看 1 个产品、30 个属性、9 台设备
→ 启动 Python 模拟器
→ 上报入库并更新 latest/在线状态
→ 超限生成报警
→ 查看历史曲线和大屏更新
→ 停止模拟器
→ 超过 60 秒显示数据延迟并保留最后真实值
```

每位成员最后用自己的话说明：数据从哪里进入、经过哪个 API、读写哪些表、发布什么事件、页面怎样消费、失败时怎样表现、本人怎样验证 Agent 的输出。不会背语法没有关系，但不能只回答“AI 做的”。
