# 统一 VPN Gate 节点平台架构

> 状态：整合设计基线。本文定义目标边界，不代表所有模块已经完成接线或部署。

## 目标

将 OpenVPN 主订阅、SSTP 检测、IP 质量画像、节点浏览器、VPS 出口和运维工具纳入统一节点平台。保留现有独立 Worker 的可部署性，按能力逐步接入主 Worker。

## 分层结构

| 层 | 职责 | 当前来源 |
| --- | --- | --- |
| 数据采集 | 拉取 VPN Gate OpenVPN / SSTP 候选节点 | `worker/worker.js`、`VPN Gate-worker.js` |
| 探测与质量 | 连通性、延迟、IP/ASN 风险画像、住宅/机房分类 | `_worker - 副本.js`、主 Worker 质量引擎、SSTP 检测流水线 |
| 统一节点模型 | 规范化字段、来源、协议、能力和时间戳 | 整合阶段新增适配层 |
| 浏览器与 API | 统一查询、筛选、排序和状态展示 | 主 Worker 页面与 API |
| 订阅适配器 | 根据客户端能力输出真实支持的配置 | Mihomo/OpenVPN 适配器；其他协议独立适配 |
| 运维控制 | 定时任务、续跑、拨测、Telegram、VPS 看门狗 | `VPN Gate-worker.js`、`extras/`、`vps-relay/` |

## 统一节点数据契约

统一模型采用 JSON 对象，所有字段都允许缺省；不得用虚构值填充未知信息。

- `id`: 稳定节点标识，建议由来源、协议、主机和端口生成
- `source`: 数据来源标识，例如 `vpngate-openvpn`、`vpngate-sstp`
- `protocol`: 真实传输/隧道协议，例如 `openvpn`、`sstp`
- `host` / `ip` / `port`: 连接端点
- `country_code` / `country`: 国家代码和显示名称
- `online` / `checked_at` / `latency_ms`: 探测状态、时间和延迟
- `quality`: 质量画像；至少包含 `clean`、`risk`、`proxy`、`hosting`、`mobile`、`kind`、`isp`
- `capabilities`: 客户端/订阅适配能力，不支持时必须明确为 false
- `raw`: 仅在确有必要时保留来源字段，禁止把原始密钥或敏感控制令牌放入公开 API

## 协议与客户端兼容规则

1. OpenVPN 节点只能由支持 OpenVPN 的订阅适配器输出。
2. SSTP 节点保持 `sstp` 类型。不能把 `sstp://` 改写成 VLESS、VMess、Trojan、Shadowsocks 或 SOCKS5。
3. HomeProxy 与 v2rayN 的输出必须经过客户端真实支持能力校验；没有对应运行时/网关时，SSTP 不进入这两类订阅。
4. VPS 中继若把上游 VPN 流量转换为代理入口，必须单独标注为 VPS 代理服务，不能将上游 SSTP 端点冒充代理节点。

## API 兼容策略

现有端点先保持向后兼容：

- `/api/servers`: 现有 OpenVPN 节点 API
- `/sub`、`/mihomo`、`/clash`、`/subscribe`: 现有 Mihomo 订阅入口
- `/nodes.txt`: 现有 SSTP 文本发布入口（当前依赖共享 `GATE_KV`）
- SSTP Worker 的 `/data.json`、`/run`、`/api/step`、`/status`: 继续保留

新增统一接口建议为 `/api/nodes`，返回 `schema_version`、`updated_at`、`sources`、`capabilities` 和规范化的 `nodes[]`。各来源是可选适配器：未绑定 KV 或来源暂时故障时，OpenVPN 基础服务仍须正常响应，并在 `sources` 中报告降级状态。

## 存储与故障隔离

- 基础 OpenVPN Worker 不要求 KV、D1 或自定义环境变量即可运行。
- SSTP 的 KV、检测 Worker 服务绑定和 Telegram 凭据属于可选扩展配置。
- 读取可选来源失败时返回部分数据和来源错误，不得让基础节点列表/订阅整体失败。
- IP 画像源故障时质量字段为 null/unknown，不得阻断节点列表；不得仅凭 ISP/residential 标签无条件判定 clean=100。
- 公开 API 不得暴露检测令牌、Telegram Token、VPS 私钥或内部控制配置。

## 分阶段实施与验收

### 阶段 1：基线与兼容性
- [x] 盘点主 Worker、SSTP Worker、探测 Worker、VPS 和运维工具的职责
- [x] 定义统一节点契约和可选适配器边界
- [ ] 为现有端点建立回归清单

### 阶段 2：统一数据 API
- [ ] 新增规范化节点适配层
- [ ] 新增 `/api/nodes`，聚合 OpenVPN 与可选 SSTP 数据
- [ ] 增加来源级缓存、超时、降级状态和去重
- [ ] 在无 KV 环境下验证基础 API 正常

### 阶段 3：浏览器与订阅
- [ ] 节点浏览器切换到统一 API，并保留现有字段和交互
- [ ] 增加协议筛选和来源标识
- [ ] 订阅适配器按客户端能力过滤，不输出伪兼容协议
- [ ] 验证旧订阅 URL 输出不回归

### 阶段 4：运维统一
- [ ] 为 SSTP 检测、拨测和 Telegram 定义统一状态/控制接口
- [ ] 保留现有独立运行方式，增加可选接入
- [ ] 统一中文日志、错误信息和部署文档

### 阶段 5：验收与发布
- [ ] 自动化检查 JSON/YAML/文本输出
- [ ] 测试无 KV、KV 未生成、来源超时、质量源故障等降级场景
- [ ] HomeProxy 与 v2rayN 实际导入/连接验证
- [ ] Cloudflare 部署后检查线上域名和关键路由
