# 监测大屏 Layer

用途：只读聚合 API、监测大屏页面和 30 秒轮询展示。由 `feat/dashboard` 两名成员维护。

默认写入：`layers/dashboard/**`。可以阅读全仓库，但禁止写入 Device、Telemetry、Alarm 数据，或修改公共契约、Prisma、根配置、依赖和其他 Layer。

最低验收见 `AGENTS.md`，AI 工作说明见 `docs/ai/dashboard.md`。

## 交付状态（2026-09-17）

A（只读聚合接口）与 B（暗色大屏页面）均已完成，全部改动限于 `layers/dashboard/**`。

| 提交      | 范围                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `bb93db3` | 三个只读聚合接口 + `api-support.ts` + `dashboard-schemas.ts` + `service.ts` |
| `e21229a` | 大屏页面 + 5 个展示组件 + 3 个 composable + 指标标签工具                    |

```text
layers/dashboard/
├─ app/
│  ├─ pages/dashboard.vue                      大屏页面（layout: false，全屏）
│  ├─ components/DashboardStatCard.vue         统计卡
│  ├─ components/DashboardDeviceGrid.vue       设备实时状态
│  ├─ components/DashboardStatusChart.vue      在线状态分布（ECharts 环形）
│  ├─ components/DashboardPumpTypeChart.vue    泵型分布（ECharts 条形）
│  ├─ components/DashboardAlarmList.vue        近期报警
│  ├─ composables/useDashboardApi.ts           只读数据通道
│  ├─ composables/useDashboardPolling.ts       定频 30 秒轮询
│  ├─ composables/useEChart.ts                 ECharts 生命周期封装
│  └─ utils/dashboard-labels.ts                指标中文名/单位、泵型名、时间格式化
└─ server/
   ├─ api/v1/dashboard/overview.get.ts
   ├─ api/v1/dashboard/realtime.get.ts
   ├─ api/v1/dashboard/alarms/recent.get.ts
   └─ services/{api-support,dashboard-schemas,dashboard.service}.ts
```

## 未完成事项

### 一、依赖其他领域才能收口

1. **大屏登录凭证通道需要替换成 Auth 的公共实现。**
   当前 `app/composables/useDashboardApi.ts` 自行读取 cookie `solmelt_token` 并附加 `Authorization: Bearer`，只做转发、不做签发与验签。
   原因是 Auth 层前端（`useAuth`、`/login`、登录 API、全局路由守卫）目前只存在于 `origin/feat/auth`，`main` 与 `feat/dashboard` 上均不存在，此时直接引用会编译失败。
   收口方式：Auth 合并后把该文件内部实现换成 `useAuth().apiFetch` 并删除本文件，页面与组件无需改动；401 的页面内提示可由全局守卫接管。

2. **端到端联调（计划周五）。**
   缺少 Telemetry 层的 HTTP 上报接口与 `scripts/simulator` Python 模拟器，本次所有展示数据都是用等效写入（Prisma/SQL）构造的，**没有走 HTTP 上报链路**。
   计划动作：启动模拟器 → 9 台设备出现在线状态 → 异常值触发报警 → 大屏在 30 秒内同步 → 停止模拟器 → 大屏保留最后一次真实值并出现延迟标记。

3. **公共变更申请：`server/core/prisma.ts` 需要增加 `allowPublicKeyRetrieval: true`。**
   MySQL 8.4 的 `caching_sha2_password` 在非 TLS 连接下必须允许取回服务端 RSA 公钥，缺失时 mariadb 驱动报 `P2039 pool timeout`，所有接口连带 `/api/health` 一起 500/503。
   当前规避手段是用官方 mysql 客户端先连接一次以预热服务端认证缓存，**每次 MySQL 容器重启后都必须重做**。
   该文件是公共文件，本 Layer 不得自行修改，需组长在 `main` 走 Contract Change。

### 二、明确不做（`AGENTS.md` 规定需组长批准）

健康评分、复杂运行模式、五路振动合成判据、WebSocket/SSE、地图、3D、额外图表库、`/dashboard/runtime-mode` 端点。
本次一律未实现，也未引入任何新依赖（ECharts、Nuxt UI、Tailwind 均为项目已有依赖）。

### 三、已知限制

1. **没有自动化测试。** 项目未引入测试框架，`AGENTS.md` 也禁止业务分支新增，因此全部验证为手工实测（命令输出 + 1920×1080 截图）。
2. **只实测了 1920×1080。** 更小窗口未逐档验收；布局为响应式 flex/grid，窗口变小时设备区与报警区各自内部滚动，不产生页面级滚动条。
3. **标签页不可见时仍每 30 秒轮询**，未做 `visibilitychange` 暂停（最低验收未要求）。
4. **跨日不强制刷新。** `今日报警` 由服务端按北京时间切自然日，页面只在下一轮轮询时体现，未做本地跨 0 点触发刷新。
5. **报警条数固定为 10 条**，页面未提供切换（契约允许 1–20）。

## 本地验证记录

| 项目     | 结果                                                                                                    |
| -------- | ------------------------------------------------------------------------------------------------------- |
| 空态     | `deviceTotal=9 / online=0 / offline=9 / running=0 / today=0 / unhandled=0 / dataUntil=null / alarms=[]` |
| 有数据   | 8 在线 / 1 离线 / 6 运行中 / 3 条未处理预警；泵型 冷盐 4(运行4)、调温 2(运行1)、热盐 3(运行1)           |
| 鉴权     | 无 token → 401；operator（无 `dashboard:read`）→ 403                                                    |
| 参数校验 | `limit=0`、`limit=21`、`limit=99` 均 → 400                                                              |
| 轮询     | 100 秒 4 轮，每轮 3 个请求，间隔 30/30/30 秒，跳过 0 次（请求不重叠）                                   |
| 延迟     | 数据推老 900 秒后：全部设备离线、显示「数据延迟 1119 秒」、**所有指标保留最后一次真实值**               |
| 布局     | 1920×1080 下 `scrollWidth/scrollHeight` 等于视口，无横向与纵向溢出；两个 ECharts 实例均正常绘制         |
| 门禁     | `pnpm pr:check`（scope:check + format:check + lint + typecheck + db:validate + 生产 Build）全部通过     |

## 维护注意事项

1. **ECharts 容器必须有真实高度。** 中间区域是 CSS grid，隐式行按内容收缩，必须保留 `auto-rows-fr`；组件根节点保留 `h-full`。否则 `echarts.init` 拿到 0 高度容器，图表静默不渲染。
2. **`useEChart` 的三个约束不要简化。** `watch` 必须 `flush: 'post'`（否则条件渲染下容器仍是 `null`）；异步引入后若仍未拿到实例，必须把 `initializing` 置回 `null` 以允许重试；图表容器应常驻 DOM，空态用绝对定位覆盖层表达，不要用 `v-if` 换掉容器。
3. **口径不要就地复制。** 在线 300 秒、延迟 60 秒、轮询 30 秒一律从 `shared/domain/thresholds.ts` 取；`dataUntil` 与 `latestReportedAt` 必须使用真实上报时间，禁止用页面刷新时间代替。
4. **页面禁止产生业务数据。** 无遥测时展示真实零值、空列表和 `—` 占位符，不补零、不造随机数、不内置静态业务数组。
