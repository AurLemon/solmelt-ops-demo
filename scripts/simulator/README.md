# 数据模拟器

## 用途

由 `feat/telemetry` 实现 Python 采集网关模拟器。它每 10 至 30 秒向正式上报 API 发送 9 台设备的真实物模型字段，是任务书要求的测试输入。

## 允许内容与所有者

仅允许模拟器源码、其说明和与 HTTP 上报相关的最小依赖清单；由 Telemetry 组维护。

## 依赖边界

前置：Python 3.11+、`requests`、已启动的 API 与数据库。首次安装在本目录执行 `python3 -m venv .venv`、激活虚拟环境后执行 `python -m pip install requests`；`.venv` 已被 Git 忽略。实现前阅读 `layers/telemetry/AGENTS.md`、`docs/ai/telemetry.md` 和 `docs/acceptance-baseline.md`。

## 禁止事项

禁止把数据写入页面静态数组、绕过 HTTP 上报接口或扩展为 MQTT/消息队列；不修改 Schema、公共契约或其他 Layer。

## 快速启动

首次执行一次初始化；之后始终从仓库根目录启动，不需要手动激活环境：

```bash
# 仅首次：创建项目专用 .venv 并安装 requests
pnpm simulator:setup

# 持续向默认本地 API（http://127.0.0.1:3000）上报，按 Ctrl-C 停止
pnpm simulator

# 只发一轮，用于验证上报通路
pnpm simulator:once

# 持续发送正常数据，不随机触发报警
pnpm simulator:normal

# 向其他端口的本地 Nuxt 服务发送
pnpm simulator -- --url http://127.0.0.1:3109 --interval 20
```

大屏是只读消费者，保持模拟器运行后会在最多 30 秒内轮询到最新数据；`simulator:once` 退出后不会产生持续变化。
