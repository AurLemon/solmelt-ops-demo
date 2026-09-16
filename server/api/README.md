# 公共 API

用途：放置不属于四个业务命名空间的基础接口；当前仅有健康检查。

允许：`/api/health` 等基础设施接口。禁止：把 Auth、Device、Telemetry、Dashboard 的业务接口写在这里。
