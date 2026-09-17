"""SolMelt 熔盐泵数据采集模拟器。

按任务书要求，默认每 20 秒向 /api/v1/telemetry/report 发送 9 台设备的
随机游走数据，偶发注入明确标注的异常值，用于驱动 65°C / 4.5 mm/s / 60 A
三项报警闭环。模拟器只负责产生采集输入，绝不修改报警处置状态。

使用方式：
    python3 scripts/simulator/simulate.py
    python3 scripts/simulator/simulate.py --url http://127.0.0.1:3000 --interval 30

依赖：Python 3.11+、requests。首次安装可在此目录执行：
    python3 -m venv .venv && source .venv/bin/activate && pip install requests
"""

from __future__ import annotations

import argparse
import dataclasses
import random
import signal
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests

# 9 台真实设备编号（来自 prisma seed，产品 key 固定为 Z60KbveZzXk8）
DEVICE_CODES: list[str] = [
    "20WSC10AP010",
    "20WSC10AP020",
    "20WSC10AP030",
    "20WSC10AP040",
    "20WSC10AP050",
    "20WSC10AP060",
    "20WSH20AP010",
    "20WSH20AP020",
    "20WSH20AP030",
]

# 30 个物模型属性及其基线值与游走步长。
# BOOL 属性以 false 为基线、偶发翻转为 true；DOUBLE 属性以随机游走更新。
# 报警相关字段单独标注阈值，便于模拟器在注入异常时精确越界。
@dataclasses.dataclass
class PropSpec:
    identifier: str
    data_type: str  # "BOOL" 或 "DOUBLE"
    baseline: float | bool
    step: float  # 随机游走步长（仅 DOUBLE）
    inject_value: float | None  # 注入异常时使用的越界值
    is_alarm_metric: bool = False


PROP_SPECS: list[PropSpec] = [
    PropSpec("inverter_start_status", "BOOL", False, 0.0, None),
    PropSpec("inverter_stop_status", "BOOL", False, 0.0, None),
    PropSpec("inverter_alarm_status", "BOOL", False, 0.0, None),
    PropSpec("inverter_fault_status", "BOOL", False, 0.0, None),
    PropSpec("inverter_ready_status", "BOOL", True, 0.0, None),
    PropSpec("inverter_emergency_stop_status", "BOOL", False, 0.0, None),
    PropSpec("inverter_remote_control_status", "BOOL", True, 0.0, None),
    PropSpec("speed_command", "DOUBLE", 980.0, 8.0, None),
    PropSpec("speed_feedback", "DOUBLE", 985.0, 8.0, None),
    PropSpec("forward_speed", "DOUBLE", 980.0, 6.0, None),
    PropSpec("inverter_current", "DOUBLE", 42.0, 1.5, 62.0, is_alarm_metric=True),
    PropSpec("electric_meter_reading", "DOUBLE", 12345.0, 0.5, None),
    PropSpec("feeder_current", "DOUBLE", 38.0, 1.2, None),
    PropSpec("motor_temp_u1", "DOUBLE", 42.0, 0.6, None),
    PropSpec("motor_temp_u2", "DOUBLE", 41.5, 0.6, None),
    PropSpec("motor_temp_v1", "DOUBLE", 42.2, 0.6, None),
    PropSpec("motor_temp_v2", "DOUBLE", 41.8, 0.6, None),
    PropSpec("motor_temp_w1", "DOUBLE", 42.4, 0.6, None),
    PropSpec("motor_temp_w2", "DOUBLE", 41.9, 0.6, None),
    PropSpec("motor_drive_bearing_temp", "DOUBLE", 52.0, 0.8, 67.0, is_alarm_metric=True),
    PropSpec("motor_non_drive_bearing_temp", "DOUBLE", 48.0, 0.7, None),
    PropSpec("thrust_bearing_temp_x", "DOUBLE", 50.0, 0.7, None),
    PropSpec("thrust_bearing_temp_y", "DOUBLE", 49.5, 0.7, None),
    PropSpec("pump_casing_temp1", "DOUBLE", 55.0, 0.8, None),
    PropSpec("pump_casing_temp2", "DOUBLE", 54.5, 0.8, None),
    PropSpec("motor_vibration_x", "DOUBLE", 1.8, 0.15, None),
    PropSpec("motor_vibration_y", "DOUBLE", 1.7, 0.15, None),
    PropSpec("motor_vibration_z", "DOUBLE", 1.9, 0.15, None),
    PropSpec("pump_vibration_x", "DOUBLE", 2.2, 0.2, 5.0, is_alarm_metric=True),
    PropSpec("pump_vibration_y", "DOUBLE", 2.1, 0.2, None),
]


class DeviceState:
    """单台设备的运行态：保存上一轮值，按随机游走推进。"""

    def __init__(self, device_code: str) -> None:
        self.device_code = device_code
        # 每个属性维护当前值；BOOL 用 0/1 表示，发送时映射为 True/False
        self.values: dict[str, float] = {
            spec.identifier: (1.0 if spec.baseline is True else 0.0)
            if spec.data_type == "BOOL"
            else float(spec.baseline)
            for spec in PROP_SPECS
        }

    def step(self) -> dict[str, Any]:
        """推进一轮随机游走，返回 props 字典。"""
        props: dict[str, Any] = {}
        for spec in PROP_SPECS:
            if spec.data_type == "BOOL":
                # 基线为 True 的属性极少翻转；基线为 False 的属性偶发短暂为 True
                flip_rate = 0.02 if spec.baseline is False else 0.01
                current = self.values[spec.identifier]
                if random.random() < flip_rate:
                    current = 1.0 - current
                self.values[spec.identifier] = current
                props[spec.identifier] = current > 0.5
            else:
                value = self.values[spec.identifier]
                value += random.uniform(-spec.step, spec.step)
                # 防止漂移到不合理区间：温度不为负，振动不为负，电流不为负
                floor = 0.0
                value = max(floor, value)
                self.values[spec.identifier] = value
                # 保留 3 位小数，避免上报冗余精度
                props[spec.identifier] = round(value, 3)
        return props

    def inject_abnormal(self) -> list[str]:
        """对报警指标注入明确越界值，返回被注入的属性名列表。"""
        injected: list[str] = []
        for spec in PROP_SPECS:
            if spec.is_alarm_metric and spec.inject_value is not None:
                self.values[spec.identifier] = spec.inject_value
                injected.append(spec.identifier)
        return injected


def iso_now() -> str:
    """当前 UTC ISO 8601 带偏移，符合 Zod datetime({ offset: true })。"""
    return datetime.now(timezone.utc).isoformat()


def build_payload(device: DeviceState, injected: bool) -> dict[str, Any]:
    props = device.step()
    if injected:
        # 注入异常：覆盖三项报警指标为越界值
        for spec in PROP_SPECS:
            if spec.is_alarm_metric and spec.inject_value is not None:
                props[spec.identifier] = round(spec.inject_value, 3)
    return {
        "deviceCode": device.device_code,
        "reportedAt": iso_now(),
        "props": props,
    }


def send_report(
    base_url: str,
    payload: dict[str, Any],
    timeout: float,
    session: requests.Session,
) -> tuple[bool, str]:
    url = f"{base_url.rstrip('/')}/api/v1/telemetry/report"
    try:
        resp = session.post(url, json=payload, timeout=timeout)
    except requests.RequestException as exc:
        return False, f"网络异常: {exc}"
    if resp.status_code == 200:
        body = resp.json()
        if body.get("success"):
            data = body.get("data", {})
            return True, (
                f"reportId={data.get('reportId')} "
                f"accepted={data.get('acceptedPropertyCount')} "
                f"alarm={data.get('alarmTriggered')}"
            )
        return False, f"业务失败: {body.get('error', {}).get('message', body)}"
    try:
        err = resp.json().get("error", {}).get("message", resp.text)
    except ValueError:
        err = resp.text
    return False, f"HTTP {resp.status_code} {err}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="SolMelt 熔盐泵数据采集模拟器")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:3000",
        help="API 基址，默认 http://127.0.0.1:3000",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=20.0,
        help="固定发送间隔（秒），默认 20 秒",
    )
    parser.add_argument(
        "--abnormal-rate",
        type=float,
        default=0.1,
        help="单次发送触发异常注入的概率，默认 0.1",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=5.0,
        help="单次 HTTP 请求超时，默认 5 秒",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="只发一轮就退出，用于冒烟测试",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.abnormal_rate < 0 or args.abnormal_rate > 1:
        print("abnormal-rate 必须在 [0, 1] 区间", file=sys.stderr)
        return 2
    if args.interval <= 0:
        print("interval 必须 > 0", file=sys.stderr)
        return 2

    devices = [DeviceState(code) for code in DEVICE_CODES]
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    running = True

    def _handle_sigint(_signum: int, _frame: Any) -> None:
        nonlocal running
        running = False
        print("\n[Simulator] 收到 Ctrl-C，准备退出...", flush=True)

    signal.signal(signal.SIGINT, _handle_sigint)

    print(
        f"[Simulator] 启动：base_url={args.url} "
        f"devices={len(devices)} "
        f"interval={args.interval}s "
        f"abnormal_rate={args.abnormal_rate}",
        flush=True,
    )

    round_index = 0
    while running:
        round_index += 1
        # 每轮决定是否整体注入异常：触发后所有设备都越界上报
        abnormal = random.random() < args.abnormal_rate
        for device in devices:
            if not running:
                break
            payload = build_payload(device, injected=abnormal)
            ok, detail = send_report(args.url, payload, args.timeout, session)
            tag = "ABNORMAL" if abnormal else "NORMAL"
            ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
            status_line = "OK" if ok else "FAIL"
            print(
                f"[{ts}] round={round_index} {tag} {status_line} "
                f"device={device.device_code} {detail}",
                flush=True,
            )

        if args.once:
            break
        if not running:
            break
        delay = args.interval
        # 分段 sleep 以便 Ctrl-C 能尽快响应
        end = time.monotonic() + delay
        while running and time.monotonic() < end:
            time.sleep(0.2)

    print(f"[Simulator] 已退出，共发送 {round_index} 轮。", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
