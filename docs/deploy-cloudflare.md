# Cloudflare Workers 部署与上线验收

本项目的 SSTP 发布链路由独立 Worker 组成。生产者与所有读取端必须绑定同一个 Cloudflare KV namespace，否则 /nodes.txt 和 SSTP 数据不会共享。

## 1. 创建共享 KV

在 Cloudflare Dashboard → Workers & Pages → KV 创建一个 namespace，例如 GATE_DATA，复制它的 Namespace ID。

把同一个 ID 填入：
- wrangler.sstp.toml 的 KV 绑定；
- 如主节点 Worker 需要聚合 SSTP，在 worker/wrangler.toml 中取消注释 KV 绑定并填同一个 ID；
- 你自己的外部消费 Worker 也绑定同一个 namespace，binding 名称使用它代码要求的名称（本项目主 Worker 使用 GATE_KV）。

不要为生产者和消费者分别创建不同 namespace。

## 2. 部署 SSTP 发布 Worker

~~~bash
cp wrangler.sstp.toml.example wrangler.sstp.toml
# 编辑 wrangler.sstp.toml：将 REPLACE_WITH_KV_NAMESPACE_ID 替换为真实 ID
npx wrangler@4 deploy --config wrangler.sstp.toml
~~~

部署后打开 Worker 的 /run，执行首次检测。首次检测可能需要多轮续跑；/status 可查看进度，/data.json 查看完整检测结果，/nodes.txt 查看只包含已识别住宅/运营商出口的发布文本。

配置中的 Cron 每 10 分钟触发一次；存在未完成任务时继续执行，没有未完成任务时按 INTERVAL_MINUTES=60 每小时启动新检测。请将 CHECK_WORKER 改为实际可用的探测 Worker 地址。

## 3. 部署主节点 Worker（可选）

~~~bash
cp worker/wrangler.toml.example worker/wrangler.toml
# 如需 SSTP 聚合，取消注释 KV 绑定并填入同一个 namespace ID
cd worker
npx wrangler@4 deploy
~~~

主 Worker 的 /api/nodes 会聚合 OpenVPN 与 KV 中的 SSTP 节点；SSTP 出口 IP 会进入同一质量画像流程。质量源不可用时节点仍返回，质量字段保持未知，不会伪造分数。

## 4. 上线验收

逐项检查，不要把 HTTP 200 当作整个链路已验收：

1. SSTP Worker 的 /status 显示检测已完成，且 /data.json 的 stats.success 大于 0。
2. SSTP Worker 的 /nodes.txt 非空；每行格式为 优选入口#节点备注$sstp://vpn:vpn@真实SSTP服务器:端口。
3. 发布文本只包含 residential="residential" 的节点；机房和 unknown 仍留在 /data.json。
4. 外部消费 Worker 绑定相同 KV namespace 后，读取到同样的 nodes.txt。
5. 主 Worker 若启用 SSTP，访问 /api/nodes，确认 sources.sstp.available=true，并检查 SSTP 节点的 quality.clean / quality.risk。若 IP 质量源对某出口无结果，分数应为 null，不能当作 100 分。
6. 检查主 Worker 原有 /、/api/servers、/sub 仍正常。

## 5. 自动检查

仓库的 GitHub Actions 会在推送到 main 后检查三个 Worker 的 JavaScript 语法、Python 语法和 shell 语法。该检查不替代 Cloudflare 实际部署后的 KV、Cron、上游可达性和真实节点验收。
