# Cloudflare Workers 部署与上线验收

## 最终架构：只部署两个 Worker

1. **主 Worker：** `worker/worker.js`。它同时提供原有节点浏览器、OpenVPN API/订阅，以及 SSTP 检测、KV 存储、`/nodes.txt` 发布和手动运行页面。SSTP 逻辑已合并进主 Worker，不再部署独立的 `VPN Gate-worker.js`。
2. **检测 Worker：** `_worker - 副本.js`。这是 SSTP 探测依赖，保持原样，不修改、不合并，也不替换。

不要部署第三个 SSTP Publisher Worker。

## 1. KV

主 Worker 需要一个 KV namespace，binding 名称必须为 `GATE_KV`。如果你已经有存放 SSTP 数据的 namespace，继续使用原来的 Namespace ID，不要另建一个导致旧数据分离。

## 2. 配置并部署唯一主 Worker

在 `worker/` 目录：

~~~bash
cp wrangler.toml.example wrangler.toml
~~~

编辑 `wrangler.toml`：
- 将 `REPLACE_WITH_KV_NAMESPACE_ID` 替换为现有 GATE_KV namespace ID；
- 将 `CHECK_WORKER` 改为你现有检测 Worker 的实际域名（即 `_worker - 副本.js` 对应的地址）；
- 将 `name` 改成你当前主 Worker 的 Cloudflare 服务名，确保更新现有 Worker，而不是新建一个服务。

部署：

~~~bash
cd worker
npx wrangler@4 deploy
~~~

生产环境设置手动检测令牌：

~~~bash
npx wrangler@4 secret put TOKEN
~~~

输入随机生成的长令牌。访问主 Worker 的 `/run` 时在页面填写同一个令牌。

## 3. 合并后的路由

| 路径 | 功能 |
|---|---|
| `/` | 原有节点浏览器 |
| `/api/servers` | 原有 OpenVPN 节点 API |
| `/api/nodes` | OpenVPN + SSTP 统一节点 API，包含风险评分 |
| `/sub`、`/mihomo` 等 | 原有 OpenVPN 订阅功能 |
| `/run` | SSTP 手动检测页面 |
| `/api/step` | SSTP 分批检测执行入口（受 TOKEN 保护） |
| `/status` | SSTP 检测进度 |
| `/data.json` | SSTP 完整检测数据 |
| `/nodes.txt` | 只发布已识别住宅/运营商出口的 SSTP 文本 |

Cron 每 10 分钟触发一次：有未完成任务则续跑；没有任务时按 `INTERVAL_MINUTES=60` 每小时启动新一轮。检测 Worker 仅作为 `CHECK_WORKER` 指向的探测依赖，不承担 SSTP 发布或 KV 存储。

## 4. 上线验收

1. 主 Worker 的 `/` 正常显示原有节点浏览器。
2. `/run` 可打开；设置 TOKEN 后能启动检测。
3. `/status` 显示运行状态；检测完成后 `/data.json` 有结果。
4. `/nodes.txt` 非空，格式为 `优选入口#节点备注$sstp://vpn:vpn@真实SSTP服务器:端口`。
5. `nodes.txt` 只包含 `residential="residential"` 的节点；机房和 unknown 仍保留在 `data.json` 和节点浏览器数据中。
6. `/api/nodes` 返回 OpenVPN 与 SSTP；SSTP 有可用质量画像时返回 `quality.clean` / `quality.risk`，质量源无结果时分数保持 `null`。
7. 原有 `/api/servers`、`/sub`、`/mihomo` 继续正常。

GitHub Actions 的语法检查和 Wrangler dry-run 只能证明代码可解析、可打包；以上 HTTP、KV、Cron 和真实节点检查必须在 Cloudflare 部署后完成。
