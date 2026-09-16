# 数据模拟器

## 用途

由 `feat/telemetry` 实现 Python 采集网关模拟器。它每 10 至 30 秒向正式上报 API 发送 9 台设备的真实物模型字段，是任务书要求的测试输入。

## 允许内容与所有者

仅允许模拟器源码、其说明和与 HTTP 上报相关的最小依赖清单；由 Telemetry 组维护。

## 依赖边界

前置：Python 3.11+、`requests`、已启动的 API 与数据库。首次安装在本目录执行 `python3 -m venv .venv`、激活虚拟环境后执行 `python -m pip install requests`；`.venv` 已被 Git 忽略。实现前阅读 `layers/telemetry/AGENTS.md`、`docs/ai/telemetry.md` 和 `docs/acceptance-baseline.md`。

## 禁止事项

禁止把数据写入页面静态数组、绕过 HTTP 上报接口或扩展为 MQTT/消息队列；不修改 Schema、公共契约或其他 Layer。
