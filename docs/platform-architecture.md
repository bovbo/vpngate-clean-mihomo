# 统一节点平台架构

## 最终部署拓扑：两个 Worker

本项目部署两个 Cloudflare Worker，职责固定：

1. **主 Worker：`worker/worker.js`**。集成节点浏览器、OpenVPN 数据抓取与订阅、SSTP 节点采集/检测编排、质量评分、KV 存储、`nodes.txt` 发布和定时续跑。SSTP 采集与发布代码已合并进主 Worker，不再部署独立的 `VPN Gate-worker.js`。
2. **探测 Worker：`_worker - 副本.js`**。只负责 `/check`、出口信息与探测路由。保持现有代码和部署不变，主 Worker 通过 `CHECK_WORKER` 调用它。

禁止把 SSTP Publisher 再拆成第三个 Worker。

## 数据流

~~~text
VPN Gate OpenVPN CSV ───────────────┐
                                    ├─ 主 Worker：worker/worker.js
VPN Gate SSTP 源 → SSTP 检测编排 ───┤    ├─ 节点浏览器 /api/servers /api/nodes
                                    │    ├─ OpenVPN Mihomo 订阅
                                    │    ├─ KV: data.json / nodes.txt / state
                                    │    └─ /run /status /api/step + Cron
                                    │
                                    └──── CHECK_WORKER ──> _worker - 副本.js
                                                          /check 与出口探测
~~~

## 统一节点数据契约

统一模型采用 JSON 对象，所有字段都允许缺省；不得用虚构值填充未知信息。

- `id`: 稳定节点标识，由来源、协议和节点地址组成。
- `source`: 数据来源，例如 `vpngate-openvpn`、`vpngate-sstp`。
- `protocol`: 真实协议，例如 `openvpn`、`sstp`。
- `host` / `ip` / `port`: 入口地址和端口；未知时使用 null。
- `country_code` / `country`: 国家信息。
- `online` / `latency_ms`: 可用性与延迟；未检测时使用 null。
- `quality`: IP 风险画像；无数据时保持 null/unknown，不得伪造分数。
- `capabilities`: 明确声明客户端是否支持该节点，不得将 SSTP 伪装成 OpenVPN/VLESS/VMess/Trojan。

## API 兼容策略

- `/api/servers`: 保留原有 OpenVPN 节点 API。
- `/api/nodes`: 统一返回 OpenVPN + SSTP 节点和质量画像。
- `/sub`、`/mihomo`、`/clash`、`/subscribe`: 保留原有 Mihomo/OpenVPN 订阅入口；不把 SSTP 塞入 OpenVPN 订阅。
- `/nodes.txt`: 主 Worker 从同一 KV 读取已生成的 SSTP 文本。
- `/data.json`、`/run`、`/api/step`、`/status`: 由主 Worker 内置 SSTP 子系统提供。

## 存储与故障隔离

- 主 Worker 的 SSTP 功能需要绑定 KV，变量名为 `GATE_KV`。
- SSTP 检测请求经 `CHECK_WORKER` 发往现有探测 Worker。
- 探测 Worker 暂时不可用时，OpenVPN 浏览器/API/订阅仍应正常；SSTP 检测任务报告失败并可续跑。
- IP 画像源故障时质量字段为 null/unknown，不得阻断节点列表。
- `nodes.txt` 仅发布已识别为住宅/运营商的 SSTP 节点；机房和 unknown 节点仍保留在 `data.json` 和浏览器列表中。

## 部署与验收

部署步骤和检查项以 [Cloudflare 部署与上线验收](deploy-cloudflare.md) 为准。代码语法检查与 Wrangler dry-run 不等同于真实线上验收；上线后仍须验证 KV、Cron、探测 Worker 可达性、检测结果及 `/nodes.txt`。
