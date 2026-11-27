// VPNGate Clean Mihomo — 单文件 Cloudflare Worker（单文件即可直接粘贴部署，无需构建步骤）
// 衍生自 RememberOurPromise/OpenVPNGate4Mihomo (The Unlicense / public domain)
// Authors: @ZJH233-tech & Doubao AI — 新增 IP 纯净度/风险引擎、纯净订阅、VPS 优选配套

const HTML_PAGE = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\" />\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n<title>VPNGate 节点浏览器 · OpenVPN → Mihomo</title>\n<link rel=\"icon\" href=\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230B0F17'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='%232DD4BF' stroke-width='2.5'/%3E%3Ccircle cx='16' cy='16' r='2.5' fill='%232DD4BF'/%3E%3C/svg%3E\" />\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />\n<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />\n<link href=\"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap\" rel=\"stylesheet\" />\n<style>\n  :root{\n    --bg:#0B0F17;\n    --surface:#131A26;\n    --surface-2:#1B2434;\n    --surface-hover:#212C40;\n    --border:#263145;\n    --border-soft:#1B2434;\n    --text:#EAF0F7;\n    --text-muted:#8996AC;\n    --text-faint:#5C6A82;\n    --accent:#2DD4BF;\n    --accent-strong:#14B8A6;\n    --accent-soft:rgba(45,212,191,0.14);\n    --danger:#F87171;\n    --danger-soft:rgba(248,113,113,0.12);\n    --warning:#FBBF24;\n    --proto-tcp:#60A5FA;\n    --tier-fast:#4ADE80;\n    --tier-mid:#FBBF24;\n    --tier-warm:#FB923C;\n    --tier-slow:#F87171;\n    --radius:12px;\n    --radius-sm:7px;\n    --font-display:'Space Grotesk','PingFang SC','Microsoft YaHei',sans-serif;\n    --font-body:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;\n    --font-mono:'JetBrains Mono','SFMono-Regular',Consolas,monospace;\n  }\n  *{box-sizing:border-box;}\n  html{background:var(--bg);}\n  body.light-mode{--bg:#F4F7FB;--surface:#FFF;--surface-2:#EEF2F7;--surface-hover:#E3EAF2;--border:#D5DDE8;--border-soft:#E6EBF2;--text:#172033;--text-muted:#536176;--text-faint:#718096;--accent:#0D9488;--accent-strong:#0F766E;--accent-soft:rgba(13,148,136,.12);--danger-soft:rgba(220,38,38,.08);}\n  body.light-mode .topbar{background:rgba(255,255,255,.94);}\n  html,body{margin:0;padding:0;}\n  body{\n    background:var(--bg);\n    color:var(--text);\n    font-family:var(--font-body);\n    font-size:14px;\n    line-height:1.5;\n    overflow-x:hidden;\n    min-height:100vh;\n    display:flex;\n    flex-direction:column;\n  }\n  a{color:var(--accent);}\n  ::selection{background:var(--accent-soft);}\n\n  /* ---------- topbar ---------- */\n  .topbar{\n    position:sticky;top:0;z-index:30;\n    display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;\n    padding:16px 24px;\n    background:rgba(11,15,23,0.94);\n    backdrop-filter:blur(10px);\n    border-bottom:1px solid var(--border);\n  }\n  .brand{display:flex;align-items:center;gap:12px;}\n  .brand-mark{width:11px;height:11px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 5px var(--accent-soft);flex-shrink:0;}\n  .brand h1{\n    font-family:var(--font-display);font-size:19px;font-weight:600;letter-spacing:-0.01em;margin:0;\n  }\n  .brand p{margin:2px 0 0;font-size:12px;color:var(--text-muted);}\n  .status-cluster{display:flex;align-items:center;gap:14px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);}\n  .status-cluster .dot-ok{color:var(--tier-fast);}\n  .status-cluster .dot-bad{color:var(--danger);}\n\n  /* ---------- toolbar ---------- */\n  .toolbar{\n    position:fixed;top:65px;left:0;right:0;z-index:29;width:100%;\n    display:flex;flex-wrap:wrap;gap:10px;align-items:center;\n    padding:12px 24px;background:var(--surface);border-bottom:1px solid var(--border);\n  }\n  .toolbar input[type=search],.toolbar select{\n    background:var(--surface-2);border:1px solid var(--border);color:var(--text);\n    padding:8px 12px;border-radius:var(--radius-sm);font-size:13px;font-family:var(--font-body);\n    min-height:34px;\n  }\n  .toolbar input[type=search]{flex:1 1 220px;min-width:160px;}\n  .toolbar select{flex:0 0 auto;}\n  .toolbar input::placeholder{color:var(--text-faint);}\n  .spacer{flex:1;}\n  .count-badge{\n    font-family:var(--font-mono);font-size:12px;color:var(--text-muted);\n    padding:6px 10px;border:1px solid var(--border);border-radius:999px;white-space:nowrap;\n  }\n\n  /* ---------- buttons ---------- */\n  button{font-family:var(--font-body);cursor:pointer;}\n  .btn{\n    background:var(--surface-2);border:1px solid var(--border);color:var(--text);\n    padding:8px 14px;border-radius:var(--radius-sm);font-size:13px;font-weight:500;\n    transition:background .15s,border-color .15s,color .15s;white-space:nowrap;\n  }\n  .btn:hover{background:var(--surface-hover);border-color:var(--accent);}\n  .btn:disabled{opacity:.4;cursor:not-allowed;}\n  .btn:disabled:hover{background:var(--surface-2);border-color:var(--border);}\n  .btn-primary{background:var(--accent);border-color:var(--accent);color:#06201C;font-weight:600;}\n  .btn-primary:hover{background:var(--accent-strong);border-color:var(--accent-strong);}\n  .btn-ghost{background:transparent;}\n  .btn-sm{padding:5px 10px;font-size:12px;}\n  button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{\n    outline:2px solid var(--accent);outline-offset:2px;\n  }\n  .icon-btn{\n    background:transparent;border:none;color:var(--text-muted);font-size:20px;line-height:1;\n    padding:4px 8px;border-radius:6px;\n  }\n  .icon-btn:hover{color:var(--text);background:var(--surface-2);}\n\n  /* ---------- main / list ---------- */\n  main{padding:117px 0 12px;max-width:1280px;margin:0 auto;width:100%;flex:1 0 auto;}\n  .banner{\n    margin:16px 24px;padding:12px 16px;border-radius:var(--radius-sm);\n    background:var(--danger-soft);border:1px solid rgba(248,113,113,.35);color:#FFD9D9;font-size:13px;\n  }\n  .empty{margin:60px 24px;text-align:center;color:var(--text-muted);font-size:14px;}\n  .loading-row{margin:24px;color:var(--text-muted);font-family:var(--font-mono);font-size:13px;}\n\n  .table-scroll{\n    overflow-x:auto;\n    width:100vw;\n    margin-left:calc(50% - 50vw);\n    margin-right:calc(50% - 50vw);\n    -webkit-overflow-scrolling:touch;\n  }\n  .table-scroll::-webkit-scrollbar{height:8px;}\n  .table-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:4px;}\n  .table-scroll::-webkit-scrollbar-track{background:transparent;}\n\n  .table-head-fixed{\n    position:fixed;left:0;right:0;top:117px;z-index:28;\n    overflow:hidden;background:var(--surface);border-bottom:1px solid var(--border);\n  }\n\n  .row{\n    display:grid;\n    grid-template-columns:\n      minmax(28px,0fr) minmax(58px,0fr) minmax(150px,1.4fr) minmax(100px,0fr) minmax(78px,0fr)\n      minmax(70px,0fr) minmax(120px,0.6fr) minmax(65px,0fr) minmax(110px,0fr)\n      minmax(100px,0fr) minmax(85px,0fr) minmax(240px,2fr) minmax(200px,1.8fr)\n      minmax(70px,0fr) minmax(160px,0fr);\n    align-items:center;gap:0;\n    padding:11px 24px;border-bottom:1px solid var(--border-soft);\n  }\n  .row-head{\n    font-family:var(--font-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;\n    color:var(--text-faint);background:var(--surface);border-bottom:none;\n  }\n  .row-head .cell{cursor:default;}\n  .row-body:hover{background:var(--surface-2);}\n  .cell{padding:3px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}\n  .cell-country{display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:12.5px;}\n  .cell-host{display:flex;flex-direction:column;gap:2px;min-width:0;}\n  .cell-host .ip{font-family:var(--font-mono);font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;}\n  .cell-host .hostname{font-size:11px;color:var(--text-faint);overflow:hidden;text-overflow:ellipsis;}\n  .cell-ping{font-family:var(--font-mono);font-size:13px;display:flex;align-items:center;}\n  .cell-score{font-family:var(--font-mono);font-size:12.5px;color:var(--text-muted);}\n  .cell-clean{display:flex;align-items:center;}\n  .q-badge{font-family:var(--font-mono);font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;border:1px solid currentColor;white-space:nowrap;}\n  .q-badge.q-good{color:var(--tier-fast);background:rgba(74,222,128,.12);}\n  .q-badge.q-mid{color:var(--tier-mid);background:rgba(251,191,36,.12);}\n  .q-badge.q-bad{color:var(--tier-slow);background:rgba(248,113,113,.12);}\n  .q-badge.q-na{color:var(--text-faint);background:transparent;}\n  .cell-sessions,.cell-uptime,.cell-users,.cell-traffic{font-family:var(--font-mono);font-size:12px;color:var(--text-muted);}\n  .cell-operator{font-size:12px;color:var(--text-muted);}\n  .cell-message{font-size:12px;color:var(--text-muted);}\n  .cell-protocol{display:flex;align-items:center;}\n  .cell-actions{display:flex;justify-content:flex-end;align-items:center;gap:6px;}\n\n  .proto-badge{\n    font-family:var(--font-mono);font-size:10px;font-weight:700;\n    padding:3px 6px;border-radius:5px;letter-spacing:.03em;flex-shrink:0;\n    border:1px solid var(--border);color:var(--text-muted);background:var(--surface-2);\n  }\n  .proto-badge.proto-udp{color:var(--warning);border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.12);}\n  .proto-badge.proto-tcp{color:var(--proto-tcp);border-color:rgba(96,165,250,.4);background:rgba(96,165,250,.12);}\n\n  .tier-badge{\n    font-family:var(--font-mono);font-size:11.5px;font-weight:600;\n    padding:2px 7px;border-radius:5px;display:inline-block;border:1px solid currentColor;\n  }\n  .tier-badge.fast{color:var(--tier-fast);background:rgba(74,222,128,.12);}\n  .tier-badge.mid{color:var(--tier-mid);background:rgba(251,191,36,.12);}\n  .tier-badge.warm{color:var(--tier-warm);background:rgba(251,146,60,.12);}\n  .tier-badge.slow{color:var(--tier-slow);background:rgba(248,113,113,.12);}\n\n  .ping-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;flex-shrink:0;}\n  .ping-dot.fast{background:var(--tier-fast);box-shadow:0 0 7px rgba(74,222,128,.7);}\n  .ping-dot.mid{background:var(--tier-mid);box-shadow:0 0 7px rgba(251,191,36,.6);}\n  .ping-dot.warm{background:var(--tier-warm);box-shadow:0 0 7px rgba(251,146,60,.6);}\n  .ping-dot.slow{background:var(--tier-slow);box-shadow:0 0 7px rgba(248,113,113,.6);}\n\n  .speed-wrap{display:flex;flex-direction:column;gap:4px;width:100%;}\n  .speed-label{font-family:var(--font-mono);font-size:12.5px;}\n  .speed-track{display:block;width:100%;height:5px;background:var(--surface-2);border-radius:3px;overflow:hidden;}\n  .speed-fill{display:block;height:100%;background:linear-gradient(90deg,var(--accent-strong),var(--accent));border-radius:3px;}\n\n  input[type=checkbox]{\n    width:16px;height:16px;accent-color:var(--accent);cursor:pointer;\n  }\n\n  /* ---------- responsive card mode ---------- */\n  @media (max-width:900px){\n    .table-scroll{width:auto;margin-left:0;margin-right:0;}\n    .table-head-fixed{display:none;}\n    .row-body{\n      display:block;margin:12px 16px;padding:14px 16px;\n      border:1px solid var(--border);border-radius:var(--radius);\n    }\n    .row-body .cell{\n      display:flex;justify-content:space-between;align-items:center;gap:12px;\n      white-space:normal;padding:7px 0;border-bottom:1px dashed var(--border-soft);\n    }\n    .row-body .cell:last-child{border-bottom:none;}\n    .row-body .cell::before{\n      content:attr(data-label);font-family:var(--font-mono);font-size:10.5px;color:var(--text-faint);\n      text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;\n    }\n    .cell-checkbox::before,.cell-actions::before{content:'';}\n    .cell-actions{justify-content:flex-end;gap:8px;}\n    .cell-host{align-items:flex-end;text-align:right;}\n    .cell-sessions,.cell-uptime,.cell-users,.cell-traffic{text-align:right;}\n    .speed-wrap{align-items:flex-end;}\n  }\n  @media (max-width:480px){\n    .modal-overlay{padding:10px;}\n    .modal-header,.modal-tabs,.modal-body{padding-left:14px;padding-right:14px;}\n  }\n\n  /* ---------- modal ---------- */\n  .modal-overlay{\n    position:fixed;inset:0;background:rgba(5,8,14,.74);backdrop-filter:blur(3px);\n    display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;\n  }\n  .modal-overlay[hidden]{display:none;}\n  .modal{\n    background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);\n    width:min(780px,100%);max-height:88vh;display:flex;flex-direction:column;overflow:hidden;\n    box-shadow:0 24px 70px rgba(0,0,0,.55);\n  }\n  .modal-header{\n    display:flex;justify-content:space-between;align-items:flex-start;gap:12px;\n    padding:16px 20px;border-bottom:1px solid var(--border);\n  }\n  .modal-header h2{font-family:var(--font-display);font-size:16px;margin:0;font-weight:600;}\n  .modal-header .sub{font-size:12px;color:var(--text-muted);margin-top:3px;font-family:var(--font-mono);}\n  .modal-tabs{display:flex;gap:4px;padding:12px 20px 0;}\n  .tab{background:none;border:none;color:var(--text-muted);padding:8px 14px;border-radius:7px 7px 0 0;font-size:13px;font-weight:500;}\n  .tab.active{color:var(--text);background:var(--bg);}\n  .modal-body{padding:16px 20px 20px;overflow-y:auto;flex:1;}\n  .tab-panel{display:none;}\n  .tab-panel.active{display:block;}\n  .panel-actions{display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;}\n  textarea{\n    width:100%;min-height:380px;background:var(--bg);color:var(--text);\n    border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;\n    font-family:var(--font-mono);font-size:12.5px;line-height:1.6;resize:vertical;\n  }\n  .warnings{\n    background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.3);color:#FDE4A6;\n    padding:10px 12px;border-radius:var(--radius-sm);font-size:12.5px;margin-bottom:10px;\n  }\n  .warnings[hidden]{display:none;}\n  .warnings ul{margin:4px 0 0;padding-left:18px;}\n\n  /* ---------- footer / toast ---------- */\n  .footer{\n    max-width:1280px;margin:0 auto;padding:16px 24px;color:var(--text-faint);font-size:12px;\n    border-top:1px solid var(--border-soft);width:100%;flex-shrink:0;\n  }\n  .toast-container{position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;z-index:200;max-width:320px;}\n  .toast{\n    background:var(--surface-2);border:1px solid var(--border);color:var(--text);\n    padding:10px 16px;border-radius:var(--radius-sm);font-size:13px;\n    opacity:0;transform:translateY(8px);transition:opacity .25s ease,transform .25s ease;\n    box-shadow:0 8px 26px rgba(0,0,0,.4);\n  }\n  .toast.show{opacity:1;transform:translateY(0);}\n  .toast-success{border-left:3px solid var(--accent);}\n  .toast-error{border-left:3px solid var(--danger);}\n\n  @media (prefers-reduced-motion:reduce){\n    *{animation:none!important;transition:none!important;}\n  }\n</style>\n</head>\n<body>\n\n<header class=\"topbar\">\n  <div class=\"brand\">\n    <span class=\"brand-mark\"></span>\n    <div>\n      <h1>VPNGate 节点浏览器</h1>\n      <p>OpenVPN + SSTP 节点列表 · 住宅筛选与协议识别</p>\n    </div>\n  </div>\n  <div class=\"status-cluster\">\n    <span id=\"statusText\">正在连接 vpngate.net…</span>\n    <button id=\"themeBtn\" class=\"btn btn-sm\" type=\"button\">☀ 白天模式</button>\n    <button id=\"refreshBtn\" class=\"btn btn-sm\">↻ 刷新</button>\n  </div>\n</header>\n\n<div class=\"toolbar\">\n  <input type=\"search\" id=\"searchInput\" placeholder=\"搜索 主机名 / IP / 国家 / 运营者…\" />\n  <select id=\"countrySelect\"><option value=\"\">全部国家</option></select>\n  <select id=\"networkSelect\">\n    <option value=\"\">全部网络类型</option>\n    <option value=\"clean\">干净住宅 / 运营商</option>\n    <option value=\"proxy\">已知代理</option>\n    <option value=\"hosting\">数据中心 / 机房</option>\n    <option value=\"mobile\">移动运营商</option>\n    <option value=\"unknown\">未知 / 未识别</option>\n  </select>\n  <select id=\"sortSelect\">\n    <option value=\"clean-desc\">纯净度优先 · 从高到低</option>\n    <option value=\"score-desc\">综合评分 · 从高到低</option>\n    <option value=\"ping-asc\">延迟 Ping · 从低到高</option>\n    <option value=\"speed-desc\">速度 · 从高到低</option>\n    <option value=\"numSessions-desc\">在线人数 · 从多到少</option>\n    <option value=\"uptime-desc\">运行时长 · 从长到短</option>\n    <option value=\"clean-desc\">纯净度 · 从高到低</option>\n  </select>\n  <span class=\"spacer\"></span>\n  <span class=\"count-badge\" id=\"countBadge\">0 个节点</span>\n  <button id=\"copyAllLinksBtn\" class=\"btn btn-sm\">复制全部链接</button>\n  <a class=\"btn btn-sm\" href=\"/nodes-clean.txt\" download=\"nodes-clean.txt\">下载 nodes.txt</a>\n  <a class=\"btn btn-sm\" href=\"/run\" target=\"_blank\" rel=\"noopener\">手动检测 /run</a>\n  <a class=\"btn btn-sm\" href=\"/status\" target=\"_blank\" rel=\"noopener\">运行状态 /status</a>\n  <button id=\"bulkExportBtn\" class=\"btn\" disabled>批量导出 Mihomo (0)</button>\n</div>\n\n<div class=\"table-head-fixed\" id=\"tableHeadFixed\">\n  <div class=\"row row-head\" id=\"listHead\" hidden>\n    <span class=\"cell cell-checkbox\"><input type=\"checkbox\" id=\"selectAllCheckbox\" title=\"全选当前筛选结果\" /></span>\n    <span class=\"cell\">国家</span>\n    <span class=\"cell\">主机 / IP</span>\n    <span class=\"cell\">评分</span>\n    <span class=\"cell\">纯净度</span>\n    <span class=\"cell\">Ping</span>\n    <span class=\"cell\">速度</span>\n    <span class=\"cell\">在线会话</span>\n    <span class=\"cell\">运行时间</span>\n    <span class=\"cell\">累积用户数</span>\n    <span class=\"cell\">累积流量</span>\n    <span class=\"cell\">运营者</span>\n    <span class=\"cell\">说明</span>\n    <span class=\"cell\">协议</span>\n    <span class=\"cell cell-actions\">操作</span>\n  </div>\n</div>\n\n<main>\n  <div id=\"banner\" class=\"banner\" hidden></div>\n  <div id=\"loadingRow\" class=\"loading-row\">正在获取节点列表…</div>\n\n  <div class=\"table-scroll\" id=\"tableScroll\">\n    <div id=\"list\"></div>\n  </div>\n  <div id=\"emptyState\" class=\"empty\" hidden>没有匹配的节点,试试调整搜索或筛选条件。</div>\n</main>\n\n<footer class=\"footer\">\n  数据来源 <a href=\"https://www.vpngate.net\" target=\"_blank\" rel=\"noopener\">vpngate.net</a>(筑波大学 VPN Gate 学术实验项目,请遵守当地法律法规使用)\n  · Mihomo OpenVPN 字段参考 <a href=\"https://wiki.metacubex.one/config/proxies/openvpn/\" target=\"_blank\" rel=\"noopener\">wiki.metacubex.one</a>\n  · 本工具与上述项目均无官方关联,仅为第三方转换/浏览界面\n</footer>\n\n<!-- 单节点详情弹窗 -->\n<div class=\"modal-overlay\" id=\"modalOverlay\" hidden>\n  <div class=\"modal\">\n    <div class=\"modal-header\">\n      <div>\n        <h2 id=\"modalTitle\">节点详情</h2>\n        <div class=\"sub\" id=\"modalSub\"></div>\n      </div>\n      <button class=\"icon-btn\" id=\"modalClose\" aria-label=\"关闭\">×</button>\n    </div>\n    <div class=\"modal-tabs\">\n      <button class=\"tab active\" data-tab=\"ovpn\">OpenVPN 配置</button>\n      <button class=\"tab\" data-tab=\"mihomo\">Mihomo 配置段</button>\n    </div>\n    <div class=\"modal-body\">\n      <div class=\"tab-panel active\" id=\"tabOvpn\">\n        <div class=\"panel-actions\">\n          <button class=\"btn btn-primary btn-sm\" id=\"copyOvpnBtn\">复制到剪贴板</button>\n          <button class=\"btn btn-sm\" id=\"downloadOvpnBtn\">下载 .ovpn</button>\n        </div>\n        <textarea id=\"ovpnText\" readonly spellcheck=\"false\"></textarea>\n      </div>\n      <div class=\"tab-panel\" id=\"tabMihomo\">\n        <div class=\"warnings\" id=\"mihomoWarnings\" hidden></div>\n        <div class=\"panel-actions\">\n          <button class=\"btn btn-primary btn-sm\" id=\"copyMihomoBtn\">复制到剪贴板</button>\n          <button class=\"btn btn-sm\" id=\"downloadMihomoBtn\">下载 .yaml</button>\n        </div>\n        <textarea id=\"mihomoText\" spellcheck=\"false\"></textarea>\n      </div>\n    </div>\n  </div>\n</div>\n\n<!-- 批量导出弹窗 -->\n<div class=\"modal-overlay\" id=\"bulkModalOverlay\" hidden>\n  <div class=\"modal\">\n    <div class=\"modal-header\">\n      <div>\n        <h2>批量导出 Mihomo 配置</h2>\n        <div class=\"sub\" id=\"bulkSub\"></div>\n      </div>\n      <button class=\"icon-btn\" id=\"bulkModalClose\" aria-label=\"关闭\">×</button>\n    </div>\n    <div class=\"modal-body\">\n      <div class=\"warnings\" id=\"bulkWarnings\" hidden></div>\n      <div class=\"panel-actions\">\n        <button class=\"btn btn-primary btn-sm\" id=\"copyBulkBtn\">复制到剪贴板</button>\n        <button class=\"btn btn-sm\" id=\"downloadBulkBtn\">下载 .yaml</button>\n      </div>\n      <textarea id=\"bulkText\" spellcheck=\"false\"></textarea>\n    </div>\n  </div>\n</div>\n\n<div class=\"toast-container\" id=\"toastContainer\"></div>\n\n<script>\n(function () {\n  'use strict';\n\n  // ==================== 工具函数 ====================\n  function escapeHtml(str) {\n    if (str === null || str === undefined) return '';\n    return String(str)\n      .replace(/&/g, '&amp;')\n      .replace(/</g, '&lt;')\n      .replace(/>/g, '&gt;')\n      .replace(/\"/g, '&quot;')\n      .replace(/'/g, '&#39;');\n  }\n\n  function scrub(v,n){v=String(v==null?'':v);var o='';for(var i=0;i<v.length&&o.length<(n||80);i++){var c=v.charCodeAt(i);o+=(c<32||c===127)?' ':v[i];}return o.replace(/\\s+/g,' ').trim();}\n  function scrubHost(v){return String(v==null?'':v).replace(/[^A-Za-z0-9._:-]/g,'').slice(0,253);}\n  function scrubNum(v,d){var m=String(v==null?'':v).match(/\\d+/);return m?m[0]:d;}\n\n  function flagEmoji(code) {\n    if (!code) return '🌐';\n    const cc = String(code).toUpperCase();\n    if (!/^[A-Z]{2}$/.test(cc)) return '🌐';\n    const points = Array.from(cc).map((c) => 127397 + c.charCodeAt(0));\n    return String.fromCodePoint.apply(String, points);\n  }\n\n  function formatSpeed(bps) {\n    const mbps = bps / 1e6;\n    if (mbps >= 100) return mbps.toFixed(0) + ' Mbps';\n    return mbps.toFixed(1) + ' Mbps';\n  }\n\n  function formatBytes(bytes) {\n    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];\n    let v = Number(bytes) || 0;\n    let i = 0;\n    while (v >= 1024 && i < units.length - 1) {\n      v /= 1024;\n      i++;\n    }\n    return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + units[i];\n  }\n\n  function formatDuration(ms) {\n    const totalMinutes = Math.floor((Number(ms) || 0) / 60000);\n    const days = Math.floor(totalMinutes / 1440);\n    const hours = Math.floor((totalMinutes % 1440) / 60);\n    const minutes = totalMinutes % 60;\n    if (days > 0) return days + ' 天 ' + hours + ' 小时';\n    if (hours > 0) return hours + ' 小时 ' + minutes + ' 分钟';\n    return minutes + ' 分钟';\n  }\n\n  function formatNumber(n) {\n    return Number(n || 0).toLocaleString('zh-CN');\n  }\n\n  function tierOf(v) {\n    const n = Number(v) || 0;\n    if (n < 50) return 'fast';\n    if (n < 100) return 'mid';\n    if (n < 150) return 'warm';\n    return 'slow';\n  }\n\n  function qualityBadge(q) {\n    if (!q) return '<span class=\"q-badge q-na\" title=\"暂无风险数据；未知类型不视为住宅\">未知</span>';\n    var cls = (q.proxy || q.hosting || q.grade === 'risk') ? 'q-bad' : (q.grade === 'clean' ? 'q-good' : 'q-mid');\n    var kind = q.proxy ? '已知代理' : (q.hosting ? '数据中心/机房' : (q.mobile ? '移动运营商' : (q.kind === 'isp' || q.kind === 'residential' ? '住宅/运营商' : (q.kind || '未知'))));\n    var tip = '纯净度' + q.clean + ' / 风险' + q.risk + ' · 类型:' + kind + (q.scam !== undefined ? ' · Scamalytics:' + q.scam : '') + ' · ' + (q.isp || '');\n    return '<span class=\"q-badge ' + cls + '\" title=\"' + escapeHtml(tip) + '\">' + q.clean + '</span><span class=\"cell-message\">' + escapeHtml(kind) + '</span>';\n  }\n\n  function keyOf(server) { return server.id || (server.hostName + '|' + server.ip); }\n\n  function safeDecodeBase64(b64) {\n    try {\n      const cleaned = String(b64 || '').replace(/\\s+/g, '');\n      const binary = atob(cleaned);\n      const bytes = new Uint8Array(binary.length);\n      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);\n      return new TextDecoder('utf-8').decode(bytes);\n    } catch (err) {\n      return '# 无法解码该节点的配置数据: ' + err.message;\n    }\n  }\n\n  // ==================== OpenVPN 配置解析 ====================\n  function parseOvpnConfig(raw) {\n    const lines = raw.split(/\\r\\n|\\r|\\n/);\n    const result = {\n      remoteHost: null, remotePort: null, proto: null,\n      cipher: null, auth: null, compLzo: null, dev: null,\n      ca: null, cert: null, key: null, tlsCrypt: null, tlsAuth: null,\n      keyDirection: null, authUserPass: false, mtu: null,\n      ping: null, pingRestart: null,\n    };\n\n    let block = null;\n    let blockLines = [];\n    const blockTagMap = {\n      '<ca>': 'ca', '</ca>': 'ca',\n      '<cert>': 'cert', '</cert>': 'cert',\n      '<key>': 'key', '</key>': 'key',\n      '<tls-crypt>': 'tlsCrypt', '</tls-crypt>': 'tlsCrypt',\n      '<tls-auth>': 'tlsAuth', '</tls-auth>': 'tlsAuth',\n    };\n\n    for (const rawLine of lines) {\n      const trimmed = rawLine.trim();\n\n      if (Object.prototype.hasOwnProperty.call(blockTagMap, trimmed)) {\n        const isClose = trimmed.indexOf('</') === 0;\n        const key = blockTagMap[trimmed];\n        if (!isClose) {\n          block = key;\n          blockLines = [];\n        } else {\n          result[key] = blockLines.join('\\n').trim();\n          block = null;\n        }\n        continue;\n      }\n\n      if (block) {\n        blockLines.push(rawLine.replace(/\\r$/, ''));\n        continue;\n      }\n\n      if (!trimmed || trimmed.charAt(0) === '#' || trimmed.charAt(0) === ';') continue;\n\n      const spaceIdx = trimmed.indexOf(' ');\n      const directive = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();\n      const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();\n\n      switch (directive) {\n        case 'remote': {\n          const p = args.split(/\\s+/);\n          result.remoteHost = p[0];\n          if (p[1]) result.remotePort = p[1];\n          break;\n        }\n        case 'proto': {\n          const p = args.toLowerCase();\n          if (p.indexOf('tcp') === 0) result.proto = 'tcp';\n          else if (p.indexOf('udp') === 0) result.proto = 'udp';\n          break;\n        }\n        case 'port':\n          if (!result.remotePort) result.remotePort = args.trim();\n          break;\n        case 'cipher':\n          result.cipher = args.trim();\n          break;\n        case 'data-ciphers':\n          if (!result.cipher) result.cipher = args.split(':')[0].trim();\n          break;\n        case 'auth':\n          result.auth = args.trim();\n          break;\n        case 'comp-lzo':\n          result.compLzo = args.trim() || 'yes';\n          break;\n        case 'dev':\n        case 'dev-type': {\n          const d = args.toLowerCase();\n          if (d.indexOf('tun') === 0) result.dev = 'tun';\n          else if (d.indexOf('tap') === 0) result.dev = 'tap';\n          break;\n        }\n        case 'key-direction':\n          result.keyDirection = args.trim();\n          break;\n        case 'auth-user-pass':\n          result.authUserPass = true;\n          break;\n        case 'tun-mtu':\n        case 'link-mtu':\n          if (!result.mtu) result.mtu = args.trim();\n          break;\n        case 'ping':\n          result.ping = args.trim();\n          break;\n        case 'ping-restart':\n          result.pingRestart = args.trim();\n          break;\n        case 'keepalive': {\n          // keepalive <ping> <ping-restart> 是 ping/ping-restart 的简写指令\n          const p = args.split(/\\s+/);\n          if (p[0]) result.ping = p[0];\n          if (p[1]) result.pingRestart = p[1];\n          break;\n        }\n        default:\n          break;\n      }\n    }\n    return result;\n  }\n\n  // ==================== Mihomo openvpn 配置段生成 ====================\n  const SUPPORTED_CIPHERS = ['AES-128-GCM', 'AES-256-GCM', 'AES-128-CBC', 'AES-256-CBC', 'CHACHA20-POLY1305'];\n  const SUPPORTED_AUTH = ['MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512'];\n\n  function yamlQuote(str) {\n    return '\"' + String(str).replace(/\\\\/g, '\\\\\\\\').replace(/\"/g, '\\\\\"') + '\"';\n  }\n\n  function yamlBlock(value, indent) {\n    const pad = ' '.repeat(indent);\n    return String(value).replace(/\\r\\n/g, '\\n').split('\\n').map((l) => pad + l).join('\\n');\n  }\n\n  function buildMihomoProxySegment(server, parsed) {\n    const warnings = [];\n    const lines = [];\n    const name = `VPNGate-${scrub(server.countryShort || '??', 4)}-${scrubHost(server.ip)}`;\n\n    lines.push(`- name: ${yamlQuote(name)}`);\n    lines.push(`  type: openvpn`);\n    lines.push(`  server: ${scrubHost(parsed.remoteHost || server.ip)}`);\n    lines.push(`  port: ${scrubNum(parsed.remotePort, 1194)}`);\n\n    const proto = parsed.proto || 'udp';\n    lines.push(`  proto: ${proto}`);\n    // 注意: 这里的 udp 和上面的 proto 是两个完全不同的字段。\n    // proto 指隧道本身连接服务器所用的传输协议(对应 .ovpn 里的 proto 指令);\n    // udp 是 mihomo 所有代理类型通用的字段,表示\"是否允许 UDP 应用流量(DNS/游戏/QUIC等)通过该节点转发\"。\n    // OpenVPN 建立的是完整的 TUN 隧道,一旦连接建立,不论 proto 是 tcp 还是 udp,隧道内都能正常承载 UDP 应用流量,\n    // 因此这里恒为 true,不应跟随 proto 变化(这是早前版本的一个错误,已修正)。\n    lines.push(`  udp: true`);\n\n    if (parsed.authUserPass) {\n      lines.push(`  # 该配置需要用户名/密码认证 (auth-user-pass),请自行填写凭据`);\n      lines.push(`  # username: \"your-username\"`);\n      lines.push(`  # password: \"your-password\"`);\n    }\n\n    if (parsed.cipher) {\n      if (SUPPORTED_CIPHERS.indexOf(parsed.cipher.toUpperCase()) === -1) {\n        warnings.push(`原始 cipher \"${parsed.cipher}\" 不在 mihomo 已知支持列表(${SUPPORTED_CIPHERS.join('/')})中,请留意兼容性`);\n      }\n      lines.push(`  cipher: ${scrub(parsed.cipher, 40)}`);\n    }\n    if (parsed.auth) {\n      if (SUPPORTED_AUTH.indexOf(parsed.auth.toUpperCase()) === -1) {\n        warnings.push(`原始 auth \"${parsed.auth}\" 不在 mihomo 已知支持列表(${SUPPORTED_AUTH.join('/')})中,请留意兼容性`);\n      }\n      lines.push(`  auth: ${scrub(parsed.auth, 20)}`);\n    }\n\n    if (parsed.ca) {\n      lines.push(`  ca: |`);\n      lines.push(yamlBlock(parsed.ca, 4));\n    } else {\n      warnings.push('未在原始配置中找到 <ca> 证书块,而 mihomo 要求必须提供 ca 字段,请检查该节点配置');\n    }\n\n    if (parsed.cert) {\n      lines.push(`  cert: |`);\n      lines.push(yamlBlock(parsed.cert, 4));\n    }\n    if (parsed.key) {\n      lines.push(`  key: |`);\n      lines.push(yamlBlock(parsed.key, 4));\n    }\n    if (!parsed.cert && !parsed.key && !parsed.authUserPass) {\n      warnings.push('未找到客户端证书(cert/key),也未启用 auth-user-pass,请确认该节点的认证方式');\n    }\n\n    if (parsed.tlsCrypt) {\n      lines.push(`  tls-crypt: |`);\n      lines.push(yamlBlock(parsed.tlsCrypt, 4));\n    } else if (parsed.tlsAuth) {\n      lines.push(`  # 注意: 原配置使用的是 tls-auth(独立 HMAC 签名密钥${parsed.keyDirection ? ', key-direction ' + parsed.keyDirection : ''}),而非 tls-crypt`);\n      lines.push(`  # mihomo 文档目前只公开 tls-crypt 字段,以下为尽力映射,如连接异常请对照最新 mihomo 文档核实`);\n      lines.push(`  tls-crypt: |`);\n      lines.push(yamlBlock(parsed.tlsAuth, 4));\n      warnings.push('原始配置使用 tls-auth 而非 tls-crypt,已尽力映射,请手动确认兼容性');\n    }\n\n    if (parsed.compLzo) {\n      lines.push(`  comp-lzo: ${/^(yes|no|adaptive)$/i.test(parsed.compLzo) ? parsed.compLzo : 'yes'}`);\n    }\n\n    const dev = parsed.dev || 'tun';\n    if (dev === 'tap') {\n      warnings.push('原始配置使用 dev tap(二层网桥模式),mihomo 目前仅支持 tun,该节点可能无法通过 mihomo 使用');\n    }\n    // dev 字段不再写入配置: mihomo 只支持 tun 且这本身就是默认值,显式声明没有意义\n\n    if (parsed.mtu) lines.push(`  mtu: ${scrubNum(parsed.mtu, 1500)}`);\n    if (parsed.ping) lines.push(`  ping: ${scrubNum(parsed.ping, 10)}`);\n    if (parsed.pingRestart) lines.push(`  ping-restart: ${scrubNum(parsed.pingRestart, 60)}`);\n\n    return { yaml: lines.join('\\n'), warnings, name };\n  }\n\n  // ==================== 应用状态 ====================\n  const state = {\n    servers: [],\n    filtered: [],\n    search: '',\n    country: '',\n    sortValue: 'clean-desc',\n    network: '',\n    selected: new Set(),\n    updatedAt: null,\n  };\n\n  const el = (id) => document.getElementById(id);\n\n  // ==================== 数据获取 ====================\n  async function fetchServers(force) {\n    el('refreshBtn').disabled=true; el('statusText').textContent=force?'正在刷新统一节点池…':'正在连接节点数据源…'; hideBanner();\n    try {\n      const res=await fetch('/api/nodes'+(force?'?refresh=1':''),{cache:'no-store'}),data=await res.json();\n      if(!res.ok||data.error)throw new Error(data.message||('HTTP '+res.status));\n      state.servers=(data.nodes||[]).map(n=>{const sstp=n.protocol==='sstp',q=n.quality?Object.assign({},n.quality):null;if(q&&n.residentialClass)q.kind=n.residentialClass;\n        return {id:n.id,protocol:n.protocol,hostName:n.host,ip:n.ip||'',countryLong:n.country||'',countryShort:n.country_code||'',score:Number(n.score)||0,ping:Number(n.latency_ms)||0,\n        speed:Number(n.speed_bps)||0,numSessions:Number(n.sessions)||0,uptime:Number(n.uptime_seconds)||0,totalUsers:Number(n.total_users)||0,totalTraffic:Number(n.total_traffic)||0,\n        operator:n.operator||'',message:n.message||'',detectedProto:sstp?'tcp':(n.transport||'udp').toLowerCase(),configDataBase64:n.configDataBase64||'',quality:q,\n        residentialClass:n.residentialClass||'unknown',online:n.online,privacyFlags:n.privacyFlags||[],checkedAt:n.checked_at||null};});\n      state.updatedAt=data.updated_at||new Date().toISOString();state.selected.clear();populateCountryOptions();applyFiltersAndRender();\n      const when=new Date(state.updatedAt).toLocaleString('zh-CN'),sstpCount=(data.sources&&data.sources.sstp&&data.sources.sstp.count)||0;\n      el('statusText').innerHTML='<span class=\"dot-ok\">●</span> 已连接 · 共 '+state.servers.length+' 个节点（SSTP '+sstpCount+'）· 更新于 '+escapeHtml(when);\n      el('loadingRow').hidden=true;el('listHead').hidden=state.servers.length===0;\n    } catch(err){el('statusText').innerHTML='<span class=\"dot-bad\">●</span> 连接失败';el('loadingRow').hidden=true;showBanner('无法获取统一节点列表: '+escapeHtml(err.message)+'。请稍后点击刷新重试。');}\n    finally{el('refreshBtn').disabled=false;updateFixedOffsets();}\n  }\n\n  function showBanner(html) {\n    const b = el('banner');\n    b.innerHTML = html;\n    b.hidden = false;\n  }\n  function hideBanner() {\n    el('banner').hidden = true;\n  }\n\n  // ==================== 筛选 / 排序 / 渲染 ====================\n  function populateCountryOptions() {\n    const counts = new Map();\n    state.servers.forEach((s) => {\n      const key = s.countryShort || '??';\n      const cur = counts.get(key) || { label: s.countryLong || key, count: 0 };\n      cur.count++;\n      counts.set(key, cur);\n    });\n    const entries = Array.from(counts.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label));\n    const select = el('countrySelect');\n    const prevValue = select.value;\n    select.innerHTML = '<option value=\"\">全部国家 (' + state.servers.length + ')</option>';\n    entries.forEach(([code, info]) => {\n      const opt = document.createElement('option');\n      opt.value = code;\n      opt.textContent = flagEmoji(code) + ' ' + info.label + ' (' + info.count + ')';\n      select.appendChild(opt);\n    });\n    select.value = prevValue && counts.has(prevValue) ? prevValue : '';\n    state.country = select.value;\n  }\n\n  function applyFiltersAndRender() {\n    const q=state.search.trim().toLowerCase();\n    let list=state.servers.filter(s=>{\n      if(state.country&&s.countryShort!==state.country)return false;\n      const z=s.quality,flags=s.privacyFlags||[],blocked=flags.length>0||(z&&(z.proxy||z.hosting));\n      const network=blocked?(z&&z.proxy?'proxy':'hosting'):(s.protocol==='sstp'?(s.online===true&&s.residentialClass==='residential'?'clean':'unknown'):(z&&z.mobile?'mobile':(z&&(z.kind==='isp'||z.kind==='residential')?'clean':'unknown')));\n      if(state.network&&network!==state.network)return false;\n      return !q||[s.hostName,s.ip,s.countryLong,s.countryShort,s.operator,s.protocol].some(v=>String(v||'').toLowerCase().includes(q));\n    });\n    const [key,order]=state.sortValue.split('-'),dir=order==='asc'?1:-1;\n    list=list.slice().sort((a,b)=>{if(key==='clean'){const ok=s=>s.protocol==='sstp'?(s.online===true&&s.residentialClass==='residential'&&!(s.privacyFlags||[]).length):Boolean(s.quality&&!s.quality.proxy&&!s.quality.hosting&&(s.quality.kind==='isp'||s.quality.kind==='residential'));\n      const aa=ok(a),bb=ok(b);if(aa!==bb)return bb-aa;const ca=a.quality&&Number.isFinite(Number(a.quality.clean))?Number(a.quality.clean):-1,cb=b.quality&&Number.isFinite(Number(b.quality.clean))?Number(b.quality.clean):-1;return cb-ca||(Number(b.score)||0)-(Number(a.score)||0);}\n      const aa=Number(a[key])||0,bb=Number(b[key])||0;return aa===bb?0:(aa<bb?-1:1)*dir;});\n    state.filtered=list;renderList();updateCounts();\n  }\n\n  function renderList() {\n    const html = state.filtered.map((s) => renderRow(s)).join('');\n    el('list').innerHTML = html;\n    el('emptyState').hidden = state.filtered.length !== 0;\n  }\n\n  const SPEED_BAR_MAX_MBPS = 1000; // 速度条固定刻度: 0-1000 Mbps,超过按满格显示\n  function speedBarPercent(bps) {\n    const mbps = (Number(bps) || 0) / 1e6;\n    return Math.max(2, Math.min(100, Math.round((mbps / SPEED_BAR_MAX_MBPS) * 100)));\n  }\n\n  function renderRow(s) {\n    if(s.protocol==='sstp'){\n      const k=keyOf(s);\n      const clean=s.residentialClass==='residential'&&s.online===true&&!(s.privacyFlags||[]).length,q=s.quality||(clean?{kind:'residential'}:null);\n      const label=escapeHtml(s.countryLong||s.countryShort||'未知'),host=escapeHtml(s.hostName||'—'),ip=escapeHtml(s.ip||'出口 IP 未知'),op=escapeHtml(s.operator||'—');\n      return '<div class=\"row row-body\" data-key=\"'+escapeHtml(k)+'\"><span class=\"cell cell-checkbox\" data-label=\"选择\">—</span>'+\n      '<span class=\"cell cell-country\" data-label=\"国家\" title=\"'+label+'\">'+flagEmoji(s.countryShort)+' '+escapeHtml(s.countryShort||'??')+'</span>'+\n      '<span class=\"cell cell-host\" data-label=\"主机/IP\"><span class=\"ip\">'+ip+'</span><span class=\"hostname\">'+host+'</span></span>'+\n      '<span class=\"cell cell-score\" data-label=\"评分\">'+formatNumber(s.score)+'</span><span class=\"cell cell-clean\" data-label=\"纯净度\">'+(clean?'<span class=\"q-badge q-good\">住宅</span>':qualityBadge(q))+'</span>'+\n      '<span class=\"cell cell-ping\" data-label=\"Ping\">'+formatNumber(s.ping)+' ms</span><span class=\"cell\" data-label=\"速度\">—</span><span class=\"cell cell-sessions\" data-label=\"在线会话\">—</span>'+\n      '<span class=\"cell cell-uptime\" data-label=\"运行时间\">—</span><span class=\"cell cell-users\" data-label=\"累积用户数\">—</span><span class=\"cell cell-traffic\" data-label=\"累积流量\">—</span>'+\n      '<span class=\"cell cell-operator\" data-label=\"运营者\" title=\"'+op+'\">'+op+'</span><span class=\"cell cell-message\" data-label=\"说明\">'+(s.online===true?'检测成功':'未确认可用')+'</span>'+\n      '<span class=\"cell cell-protocol\" data-label=\"协议\"><span class=\"proto-badge proto-tcp\">SSTP</span></span><span class=\"cell cell-actions\" data-label=\"操作\">需 SSTP 客户端</span></div>';\n    }\n    const k = keyOf(s);\n    const checked = state.selected.has(k) ? 'checked' : '';\n    const pingTierName = tierOf(s.ping);\n    const sessionsTierName = tierOf(s.numSessions);\n    const speedPct = speedBarPercent(s.speed);\n    const hostSafe = escapeHtml(s.hostName);\n    const ipSafe = escapeHtml(s.ip);\n    const opSafe = escapeHtml(s.operator || '—');\n    const msgSafe = escapeHtml(s.message || '—');\n    const countryLabel = escapeHtml(s.countryLong || s.countryShort || '未知');\n    const proto = (s.detectedProto === 'tcp') ? 'tcp' : 'udp';\n\n    return (\n      '<div class=\"row row-body\" data-key=\"' + escapeHtml(k) + '\">' +\n        '<span class=\"cell cell-checkbox\"><input type=\"checkbox\" class=\"row-check\" data-key=\"' + escapeHtml(k) + '\" ' + checked + ' /></span>' +\n        '<span class=\"cell cell-country\" data-label=\"国家\" title=\"' + countryLabel + '\">' + flagEmoji(s.countryShort) + ' ' + escapeHtml(s.countryShort || '??') + '</span>' +\n        '<span class=\"cell cell-host\" data-label=\"主机/IP\">' +\n          '<span class=\"ip\">' + ipSafe + '</span>' +\n          '<span class=\"hostname\">' + hostSafe + '</span>' +\n        '</span>' +\n        '<span class=\"cell cell-score\" data-label=\"评分\">' + formatNumber(s.score) + '</span>' +\n        '<span class=\"cell cell-clean\" data-label=\"纯净度\">' + qualityBadge(s.quality) + '</span>' +\n        '<span class=\"cell cell-ping\" data-label=\"Ping\"><span class=\"ping-dot ' + pingTierName + '\"></span>' + formatNumber(s.ping) + ' ms</span>' +\n        '<span class=\"cell\" data-label=\"速度\">' +\n          '<span class=\"speed-wrap\">' +\n            '<span class=\"speed-label\">' + formatSpeed(s.speed) + '</span>' +\n            '<span class=\"speed-track\"><span class=\"speed-fill\" style=\"width:' + speedPct + '%\"></span></span>' +\n          '</span>' +\n        '</span>' +\n        '<span class=\"cell cell-sessions\" data-label=\"在线会话\"><span class=\"tier-badge ' + sessionsTierName + '\">' + formatNumber(s.numSessions) + '</span></span>' +\n        '<span class=\"cell cell-uptime\" data-label=\"运行时间\">' + formatDuration(s.uptime) + '</span>' +\n        '<span class=\"cell cell-users\" data-label=\"累积用户数\">' + formatNumber(s.totalUsers) + '</span>' +\n        '<span class=\"cell cell-traffic\" data-label=\"累积流量\">' + formatBytes(s.totalTraffic) + '</span>' +\n        '<span class=\"cell cell-operator\" data-label=\"运营者\" title=\"' + opSafe + '\">' + opSafe + '</span>' +\n        '<span class=\"cell cell-message\" data-label=\"说明\" title=\"' + msgSafe + '\">' + msgSafe + '</span>' +\n        '<span class=\"cell cell-protocol\" data-label=\"协议\"><span class=\"proto-badge proto-' + proto + '\">' + proto.toUpperCase() + '</span></span>' +\n        '<span class=\"cell cell-actions\" data-label=\"\">' +\n          '<button class=\"btn btn-sm view-ovpn-btn\" data-key=\"' + escapeHtml(k) + '\">OpenVPN</button>' +\n          '<button class=\"btn btn-sm view-mihomo-btn\" data-key=\"' + escapeHtml(k) + '\">Mihomo</button>' +\n        '</span>' +\n      '</div>'\n    );\n  }\n\n  function updateCounts() {\n    el('countBadge').textContent = state.filtered.length + ' 个节点' + (state.filtered.length !== state.servers.length ? ' (共 ' + state.servers.length + ')' : '');\n    const selCount = state.selected.size;\n    const bulkBtn = el('bulkExportBtn');\n    bulkBtn.textContent = '批量导出 Mihomo (' + selCount + ')';\n    bulkBtn.disabled = selCount === 0;\n\n    const allChecked = state.filtered.length > 0 && state.filtered.every((s) => state.selected.has(keyOf(s)));\n    el('selectAllCheckbox').checked = allChecked;\n  }\n\n  // ==================== 弹窗:节点详情 ====================\n  function showModal(id) {\n    el(id).hidden = false;\n  }\n  function hideModal(id) {\n    el(id).hidden = true;\n  }\n\n  function renderWarnings(targetId, warnings) {\n    const box = el(targetId);\n    if (!warnings || warnings.length === 0) {\n      box.hidden = true;\n      box.innerHTML = '';\n      return;\n    }\n    box.hidden = false;\n    box.innerHTML = '⚠️ 转换提示<ul>' + warnings.map((w) => '<li>' + escapeHtml(w) + '</li>').join('') + '</ul>';\n  }\n\n  function openDetailModal(server, initialTab) {\n    const raw = safeDecodeBase64(server.configDataBase64);\n    const parsed = parseOvpnConfig(raw);\n    const { yaml, warnings } = buildMihomoProxySegment(server, parsed);\n\n    el('modalTitle').textContent = flagEmoji(server.countryShort) + ' ' + (server.countryLong || server.countryShort || '未知地区');\n    el('modalSub').textContent = server.hostName + ' · ' + server.ip;\n\n    el('ovpnText').value = raw;\n    el('mihomoText').value = yamlBlock(yaml, 2);\n    renderWarnings('mihomoWarnings', warnings);\n\n    switchTab(initialTab || 'ovpn');\n    showModal('modalOverlay');\n  }\n\n  function switchTab(tab) {\n    document.querySelectorAll('#modalOverlay .tab').forEach((btn) => {\n      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);\n    });\n    el('tabOvpn').classList.toggle('active', tab === 'ovpn');\n    el('tabMihomo').classList.toggle('active', tab === 'mihomo');\n  }\n\n  // ==================== 每国择优(L1: 非 JP 每国各 1 个, 对齐后端 /sub?mode=merged) ====================\n  function perCountryPick() {\n    const MIN_SPEED = 2 * 1e6, MAX_PING = 300, MIN_CLEAN = 15, MAXC = 20;\n    const cand = [];\n    for (const s of state.servers) {\n      const cc = (s.countryShort || '').toUpperCase();\n      if (!cc || cc === 'JP') continue;\n      if (s.speed && s.speed < MIN_SPEED) continue;\n      if (s.ping > 0 && s.ping > MAX_PING) continue;\n      if (s.quality && s.quality.clean < MIN_CLEAN) continue;\n      let p = null;\n      try { p = parseOvpnConfig(safeDecodeBase64(s.configDataBase64)); } catch (e) { p = null; }\n      if (!p || !p.ca) continue;\n      cand.push(s);\n    }\n    const pv = (x) => (x.ping > 0 ? x.ping : 99999);\n    const cv = (x) => (x.quality ? Number(x.quality.clean) || 0 : 50);\n    cand.sort((a, b) => b.score - a.score || pv(a) - pv(b) || b.speed - a.speed || cv(b) - cv(a));\n    const byCc = new Map(), seenIp = new Set();\n    for (const s of cand) {\n      const cc = (s.countryShort || '').toUpperCase();\n      if (byCc.has(cc) || seenIp.has(s.ip)) continue;\n      byCc.set(cc, s); seenIp.add(s.ip);\n    }\n    let arr = Array.from(byCc.values());\n    arr.sort((a, b) => b.score - a.score || b.speed - a.speed || pv(a) - pv(b));\n    return arr.slice(0, MAXC);\n  }\n\n  function applyPerCountry() {\n    const pick = perCountryPick();\n    if (!pick.length) { showToast('当前没有符合 L1 宽松条件的其他国家节点', 'error'); return; }\n    state.search = ''; el('searchInput').value = '';\n    el('countrySelect').value = ''; state.country = '';\n    state.selected.clear();\n    pick.forEach((s) => state.selected.add(keyOf(s)));\n    applyFiltersAndRender();\n    showToast('已为 ' + pick.length + ' 个国家各选 1 个最优节点(L1 宽松)', 'success');\n    openBulkModal();\n  }\n\n  // ==================== 弹窗:批量导出 ====================\n  function openBulkModal() {\n    const selectedServers = state.servers.filter((s) => state.selected.has(keyOf(s)));\n    if (selectedServers.length === 0) {\n      showToast('请先勾选至少一个节点', 'error');\n      return;\n    }\n    const allWarnings = [];\n    const segments = selectedServers.map((s) => {\n      const raw = safeDecodeBase64(s.configDataBase64);\n      const parsed = parseOvpnConfig(raw);\n      const { yaml, warnings } = buildMihomoProxySegment(s, parsed);\n      warnings.forEach((w) => allWarnings.push('[' + s.countryShort + ' ' + s.ip + '] ' + w));\n      return yaml;\n    });\n    const full = 'proxies:\\n' + segments.map((seg) => yamlBlock(seg, 2)).join('\\n');\n    el('bulkSub').textContent = '已选 ' + selectedServers.length + ' 个节点';\n    el('bulkText').value = full;\n    renderWarnings('bulkWarnings', allWarnings);\n    showModal('bulkModalOverlay');\n  }\n\n  // ==================== 剪贴板 / 下载 / 提示 ====================\n  function legacyCopy(text) {\n    const ta = document.createElement('textarea');\n    ta.value = text;\n    ta.style.position = 'fixed';\n    ta.style.opacity = '0';\n    document.body.appendChild(ta);\n    ta.focus();\n    ta.select();\n    document.execCommand('copy');\n    document.body.removeChild(ta);\n  }\n\n  async function copyText(text, successMsg) {\n    try {\n      if (navigator.clipboard && window.isSecureContext) {\n        await navigator.clipboard.writeText(text);\n      } else {\n        legacyCopy(text);\n      }\n      showToast(successMsg || '已复制到剪贴板', 'success');\n    } catch (err) {\n      try {\n        legacyCopy(text);\n        showToast(successMsg || '已复制到剪贴板', 'success');\n      } catch (err2) {\n        showToast('复制失败,请手动选择文本复制', 'error');\n      }\n    }\n  }\n\n  function downloadText(filename, text) {\n    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });\n    const url = URL.createObjectURL(blob);\n    const a = document.createElement('a');\n    a.href = url;\n    a.download = filename;\n    document.body.appendChild(a);\n    a.click();\n    document.body.removeChild(a);\n    setTimeout(() => URL.revokeObjectURL(url), 1000);\n    showToast('已下载 ' + filename, 'success');\n  }\n\n  function showToast(msg, type) {\n    const container = el('toastContainer');\n    const item = document.createElement('div');\n    item.className = 'toast ' + (type === 'error' ? 'toast-error' : 'toast-success');\n    item.textContent = msg;\n    container.appendChild(item);\n    requestAnimationFrame(() => item.classList.add('show'));\n    setTimeout(() => {\n      item.classList.remove('show');\n      setTimeout(() => item.remove(), 300);\n    }, 2800);\n  }\n\n  // ==================== 事件绑定 ====================\n  function wireEvents() {\n    el('refreshBtn').addEventListener('click', () => fetchServers(true));\n    el('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('light-mode');el('themeBtn').textContent=document.body.classList.contains('light-mode')?'☾ 夜间模式':'☀ 白天模式';});\n    el('copyAllLinksBtn').addEventListener('click', async () => {\n      const btn = el('copyAllLinksBtn');\n      btn.disabled = true;\n      try {\n        const res = await fetch('/nodes-clean.txt?ts=' + Date.now(), { cache: 'no-store' });\n        if (!res.ok) throw new Error('HTTP ' + res.status);\n        const links = (await res.text()).trim();\n        if (!links) throw new Error('nodes-clean.txt 当前为空');\n        await copyText(links, '已复制纯净住宅 SSTP 节点链接');\n      } catch (err) {\n        showToast('读取节点链接失败：' + err.message, 'error');\n      } finally {\n        btn.disabled = false;\n      }\n    });\n\n    el('searchInput').addEventListener('input', (e) => {\n      state.search = e.target.value;\n      applyFiltersAndRender();\n    });\n    el('countrySelect').addEventListener('change', (e) => {\n      state.country = e.target.value;\n      applyFiltersAndRender();\n    });\n    el('networkSelect').addEventListener('change', (e) => {\n      state.network = e.target.value;\n      applyFiltersAndRender();\n    });\n    el('sortSelect').addEventListener('change', (e) => {\n      state.sortValue = e.target.value;\n      applyFiltersAndRender();\n    });\n\n    el('selectAllCheckbox').addEventListener('change', (e) => {\n      if (e.target.checked) {\n        state.filtered.forEach((s) => state.selected.add(keyOf(s)));\n      } else {\n        state.filtered.forEach((s) => state.selected.delete(keyOf(s)));\n      }\n      renderList();\n      updateCounts();\n    });\n\n    (function () {\n      const btn = document.createElement('button');\n      btn.id = 'perCountryBtn';\n      btn.className = 'btn';\n      btn.title = '按 L1 宽松标准, 为除日本外每个国家各选 1 个最优节点并打开导出';\n      btn.textContent = '每国择优';\n      const bulk = el('bulkExportBtn');\n      if (bulk && bulk.parentNode) bulk.parentNode.insertBefore(btn, bulk);\n      btn.addEventListener('click', applyPerCountry);\n    })();\n    el('bulkExportBtn').addEventListener('click', openBulkModal);\n\n    // 事件委托: 行内 checkbox 与 \"查看配置\" 按钮\n    el('list').addEventListener('change', (e) => {\n      if (e.target.classList.contains('row-check')) {\n        const k = e.target.getAttribute('data-key');\n        if (e.target.checked) state.selected.add(k);\n        else state.selected.delete(k);\n        updateCounts();\n      }\n    });\n    el('list').addEventListener('click', (e) => {\n      const ovpnBtn = e.target.closest('.view-ovpn-btn');\n      const mihomoBtn = e.target.closest('.view-mihomo-btn');\n      const btn = ovpnBtn || mihomoBtn;\n      if (!btn) return;\n      const k = btn.getAttribute('data-key');\n      const server = state.servers.find((s) => keyOf(s) === k);\n      if (server) openDetailModal(server, mihomoBtn ? 'mihomo' : 'ovpn');\n    });\n\n    // 详情弹窗\n    el('modalClose').addEventListener('click', () => hideModal('modalOverlay'));\n    el('modalOverlay').addEventListener('click', (e) => {\n      if (e.target.id === 'modalOverlay') hideModal('modalOverlay');\n    });\n    document.querySelectorAll('#modalOverlay .tab').forEach((btn) => {\n      btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));\n    });\n    el('copyOvpnBtn').addEventListener('click', () => copyText(el('ovpnText').value, 'OpenVPN 配置已复制'));\n    el('downloadOvpnBtn').addEventListener('click', () => {\n      const name = (el('modalSub').textContent || 'vpngate').replace(/[^\\w.\\-]+/g, '_');\n      downloadText(name + '.ovpn', el('ovpnText').value);\n    });\n    el('copyMihomoBtn').addEventListener('click', () => copyText(el('mihomoText').value, 'Mihomo 配置段已复制'));\n    el('downloadMihomoBtn').addEventListener('click', () => {\n      const name = (el('modalSub').textContent || 'vpngate').replace(/[^\\w.\\-]+/g, '_');\n      downloadText(name + '.mihomo.yaml', el('mihomoText').value);\n    });\n\n    // 批量弹窗\n    el('bulkModalClose').addEventListener('click', () => hideModal('bulkModalOverlay'));\n    el('bulkModalOverlay').addEventListener('click', (e) => {\n      if (e.target.id === 'bulkModalOverlay') hideModal('bulkModalOverlay');\n    });\n    el('copyBulkBtn').addEventListener('click', () => copyText(el('bulkText').value, '已复制 ' + state.selected.size + ' 个节点的 Mihomo 配置'));\n    el('downloadBulkBtn').addEventListener('click', () => downloadText('vpngate-mihomo-proxies.yaml', el('bulkText').value));\n\n    document.addEventListener('keydown', (e) => {\n      if (e.key === 'Escape') {\n        hideModal('modalOverlay');\n        hideModal('bulkModalOverlay');\n      }\n    });\n\n    // 横向滚动同步: 固定表头随数据区域的横向滚动一起移动\n    el('tableScroll').addEventListener(\n      'scroll',\n      () => {\n        el('tableHeadFixed').scrollLeft = el('tableScroll').scrollLeft;\n      },\n      { passive: true }\n    );\n  }\n\n  // ==================== 固定定位布局: 动态测量高度,而不是写死像素值 ====================\n  function updateFixedOffsets() {\n    const topbarEl = document.querySelector('.topbar');\n    const toolbarEl = document.querySelector('.toolbar');\n    const headFixedEl = el('tableHeadFixed');\n    const mainEl = document.querySelector('main');\n    if (!topbarEl || !toolbarEl || !headFixedEl || !mainEl) return;\n\n    const topbarH = topbarEl.offsetHeight;\n    toolbarEl.style.top = topbarH + 'px';\n\n    const toolbarH = toolbarEl.offsetHeight;\n    headFixedEl.style.top = (topbarH + toolbarH) + 'px';\n\n    const headFixedVisible = getComputedStyle(headFixedEl).display !== 'none';\n    const headFixedH = headFixedVisible ? headFixedEl.offsetHeight : 0;\n\n    mainEl.style.paddingTop = (toolbarH + headFixedH) + 'px';\n  }\n\n  function setupFixedOffsetWatchers() {\n    updateFixedOffsets();\n    window.addEventListener('resize', updateFixedOffsets);\n    if (typeof ResizeObserver !== 'undefined') {\n      const ro = new ResizeObserver(() => updateFixedOffsets());\n      ro.observe(document.querySelector('.topbar'));\n      ro.observe(document.querySelector('.toolbar'));\n      ro.observe(el('listHead'));\n    }\n  }\n\n  wireEvents();\n  setupFixedOffsetWatchers();\n  fetchServers(false);\n})();\n</script>\n</body>\n</html>\n"

// ============================================================
// 端点：
//   /  /index.html   节点浏览器（表格含“纯净度”列，单节点/批量转 聚合通用订阅链接：homeproxy、 v2rayN、Mihomo等）
//   /api/servers     实时节点 JSON（边缘缓存；每节点附 quality 风险画像）
//   /sub /mihomo /clash /subscribe   输出完整可直接订阅的 聚合通用订阅链接 配置
//       参数: n=1..30(默认8)  cc=国家码  proto=tcp|udp|any(默认tcp)
//             sort=score|speed|ping|clean(默认score)  min=最低Mbps(默认3)
//             clean=1(只留非代理/非机房且clean>=50)  maxrisk=0..100 风险上限
//             name=选择组名  refresh=1(绕过缓存)
// 质量源: ip-api.com 批量接口；画像内存缓存6h，故障自动降级为 null，不阻断出节点
// ============================================================
const VPNGATE_API_URL = 'https://www.vpngate.net/api/iphone/';
const UPSTREAM_TTL = 120; // 上游列表边缘缓存 2 分钟，兼顾实时性与响应速度

// ============================================================
// 合并订阅(?mode=merged)专用：自建「日本承载IP落地」VLESS-Reality 节点
//   该节点落在 VPS 本机出口 IP(承载IP)，不经过 VPNGate tun0 住宅落地
// ⚠️ 私有参数请自行填写后再部署,切勿把真实 IP/UUID/密钥提交到公开仓库
// ============================================================
const SELF_JP_NODE = {
  name: '日本-自建承载落地',
  server: 'YOUR_SERVER_IP',
  port: 443,
  uuid: 'YOUR_UUID',
  network: 'tcp',
  flow: 'xtls-rprx-vision',
  sni: 'www.ibm.com',
  pbk: 'YOUR_REALITY_PUBLIC_KEY',
  sid: 'YOUR_REALITY_SHORT_ID',
  fp: 'chrome',
};
const PER_COUNTRY_MAX = 20;   // 非日本国家最多各取 1 个的国家数上限
const L1_MIN_CLEAN = 15;      // L1 宽松: 仅当“有画像且 clean<15(极脏)”才剔除; 无画像保留
const OTHER_MIN_SPEED = 2;    // 其他国家默认最低速度 Mbps
const OTHER_MAX_PING = 300;   // 其他国家默认最大延迟 ms

// SSTP publisher integrated from VPN Gate-worker.js; isolated scope avoids collisions with browser Worker.
const SSTP_SUBSYSTEM = (() => {
/**
 * VPN Gate SSTP 节点检测 —— Cloudflare Worker 版（逐函数移植自 hezhanleiok/gate 的 vpngate.py）
 *
 * 原版流程（GitHub Actions + Python）→ 本 Worker 内全部完成：
 *   1. 抓取 VPN Gate 原始节点（官方 API，失败回退 GitHub 镜像）
 *   2. 只保留带 TCP 入口的 SSTP 节点
 *   3. 去重 → 按 Ping 预排序 →（可选）截断
 *   4. 并发调用检测 Worker：<CHECK_WORKER>/check?sstp=vpn:vpn@host%3Aport
 *   5. 合并静态优选域名与优选 API 端点
 *   6. 生成 data.json + index.html + nodes.txt（存 KV，由本 Worker 直接对外提供）
 *
 * 路径：
 *   /            仪表盘（原版 index.html 原样内嵌）
 *   /data.json   结构化数据（schema_version = 1，与原版一致）
 *   /nodes.txt   订阅文件（填入 edgetunnel「自定义优选 IP」）
 *   /run         手动检测页面（浏览器里点一下，实时显示日志，自动分批跑完）
 *   /status      运行状态 JSON
 *
 * 必需绑定：KV 命名空间，变量名 GATE_KV
 * 可选环境变量见下方 loadConfig()，全部与原版同名。
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------
const SCHEMA_VERSION = 1;

// 检测 Worker 默认值（可用环境变量 CHECK_WORKER 或 DOMAIN 覆盖）
const DEFAULT_DOMAIN = "check.boxo.eu.org";

// VPN Gate 没有 HTTPS 接口，官方 API 只提供 HTTP。
const DEFAULT_VPNGATE_API = "http://www.vpngate.net/api/iphone/";
const DEFAULT_VPNGATE_MIRROR =
  "https://raw.githubusercontent.com/fdciabdul/Vpngate-Scraper-API/main/json/data.json";
const DEFAULT_OPTIMAL_API = "";

const PLACEHOLDER_MARKERS = ["你的", "YOUR_", "YOUR-", "example.com", "yourdomain"];

const DEFAULT_EDGE_HOSTS = [
  "saas.sin.fan:443",
  "www.mfyx.cn:443",
  "cf.nyanya.moe:443",
  "cf.877774.xyz:443",
  "cdn.204910.best:443",
  "cdn.ctn32.us.kg:443",
  "p.etime.vip:443",
  "cmcc.vvvv.ee:443",
  "cfsaas.080112.xyz:443",
  "cdn.aneko.ink:443",
  "hk.cf.3666888.xyz:443",
  "best.hzample.kdns.fr:443",

];

const DATA_CENTER_ORG_KEYWORDS = [
  "GOOGLE", "AMAZON", "AWS", "MICROSOFT", "OVH", "HETZNER", "DIGITALOCEAN",
  "AKAMAI", "CLOUDFLARE", "FASTLY", "RACKSPACE", "EQUINIX", "LINODE", "VULTR",
  "HURRICANE", "TENCENT", "ALIBABA", "ALIYUN", "LEASEWEB",
];

const RESIDENTIAL_ORG_KEYWORDS = [
  "NTT EAST", "NTT WEST", "NTT COMMUNICATIONS", "NTT BROADBAND", "KDDI", "DOCOMO",
  "SOFTBANK", "AU COMMUNICATIONS", "J:COM", "JCOM", "OCN", "BIGLOBE",
  "IIJ", "SEIKO", "CLEVER-NET", "AT&T", "COMCAST", "XFINITY", "VERIZON",
  "TELUS", "ROGERS", "BELL CANADA", "VODAFONE", "ORANGE", "DEUTSCHE TELEKOM",
  "BREEZE", "TIM S.P.A", "LIBERO", "FASTWEB", "FREE FRANCE", "BT OPEN",
];

const COUNTRY_ZH = {
  JP: "日本", KR: "韩国", US: "美国", CA: "加拿大", RU: "俄罗斯",
  RO: "罗马尼亚", TH: "泰国", VN: "越南", DE: "德国", FR: "法国",
  GB: "英国", UK: "英国", SG: "新加坡", TW: "台湾", HK: "香港",
  CN: "中国", AU: "澳大利亚", NL: "荷兰", SE: "瑞典", CH: "瑞士",
  IT: "意大利", ES: "西班牙", PL: "波兰", IN: "印度", BR: "巴西",
  MX: "墨西哥", ID: "印度尼西亚", MY: "马来西亚", PH: "菲律宾",
  TR: "土耳其", UA: "乌克兰", CZ: "捷克", GR: "希腊", PT: "葡萄牙",
  FI: "芬兰", NO: "挪威", DK: "丹麦", IE: "爱尔兰", BE: "比利时",
  AT: "奥地利", HU: "匈牙利", AR: "阿根廷", CL: "智利", CO: "哥伦比亚",
  NZ: "新西兰", ZA: "南非", IL: "以色列", AE: "阿联酋", SA: "沙特",
  EG: "埃及", HR: "克罗地亚", BY: "白俄罗斯", GD: "格林纳达",
  LV: "拉脱维亚", EE: "爱沙尼亚", LT: "立陶宛", SK: "斯洛伐克",
  SI: "斯洛文尼亚", BG: "保加利亚", RS: "塞尔维亚", GE: "格鲁吉亚",
  MD: "摩尔多瓦", AM: "亚美尼亚", KZ: "哈萨克斯坦", UZ: "乌兹别克斯坦",
  MN: "蒙古", NP: "尼泊尔", LK: "斯里兰卡", MM: "缅甸",
};

const PROTO_TCP_RE = /^proto\s+(tcp|tcp4|tcp6|tcp-client)\b/m;
const REMOTE_RE = /^remote\s+(\S+)\s+(\d+)/m;

const USER_AGENT = "Mozilla/5.0 (compatible; gate-checker)";
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const STATE_MAX_AGE_MS = 3 * 3600 * 1000;

// ---------------------------------------------------------------------------
// 通用工具
// ---------------------------------------------------------------------------
class ConfigError extends Error {}
class Die extends Error {
  constructor(section, message) {
    super(message);
    this.section = section;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pad = (n, w = 2) => String(n).padStart(w, "0");

function utcStamp(withSeconds) {
  const d = new Date();
  const base =
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getUTCSeconds())} UTC` : `${base} UTC`;
}

// Python quote(s, safe="") 的等价实现
function pyQuote(text) {
  return encodeURIComponent(text).replace(
    /[!*'()]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function compareTuples(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

function makeLogger(sink) {
  let section = null;
  return (name, msg = "") => {
    if (name !== section) {
      sink(`========== ${name} ==========`);
      section = name;
    }
    if (msg) sink(msg);
  };
}

function die(section, msg) {
  throw new Die(section, msg);
}

// ---------------------------------------------------------------------------
// 配置（环境变量名与原版一致）
// ---------------------------------------------------------------------------
function envStr(env, name, def = "") {
  const v = env[name];
  if (v === undefined || v === null) return def;
  const s = String(v).trim();
  return s === "" ? def : s;
}

function envInt(env, name, def, minimum = 0) {
  const raw = envStr(env, name, "");
  if (!raw) return def;
  if (!/^[+-]?\d+$/.test(raw)) throw new ConfigError(`${name} 需要是整数，当前值：${JSON.stringify(raw)}`);
  const value = parseInt(raw, 10);
  if (value < minimum) throw new ConfigError(`${name} 不能小于 ${minimum}，当前值：${value}`);
  return value;
}

function envFloat(env, name, def, minimum = 0) {
  const raw = envStr(env, name, "");
  if (!raw) return def;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new ConfigError(`${name} 需要是数字，当前值：${JSON.stringify(raw)}`);
  if (value < minimum) throw new ConfigError(`${name} 不能小于 ${minimum}，当前值：${value}`);
  return value;
}

function normalizeWorkerBase(raw) {
  let value = (raw || "").trim();
  if (!value) {
    throw new ConfigError("未配置检测 Worker 地址。请设置环境变量 CHECK_WORKER 或 DOMAIN（只填 host，例如 check.example.net）。");
  }
  const lowered = value.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((m) => lowered.includes(m.toLowerCase()))) {
    throw new ConfigError("检测地址仍是占位符。请把环境变量 DOMAIN 设成真实的检测 Worker host。");
  }
  if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) value = "https://" + value;
  let url;
  try {
    url = new URL(value);
  } catch (e) {
    throw new ConfigError(`无法解析检测 Worker 地址：${JSON.stringify(value)}`);
  }
  if (!url.host) throw new ConfigError(`无法解析检测 Worker 地址：${JSON.stringify(value)}`);

  let path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/check")) path = path + "/check";

  let query = url.search.replace(/^\?/, "");
  if (!query.includes("sstp=")) {
    query = (query ? query + "&" : "") + "sstp=vpn:vpn@";
  } else {
    const params = query.split("&").filter((x) => x);
    for (let i = 0; i < params.length; i++) {
      if (params[i].startsWith("sstp=")) {
        const target = params[i].slice("sstp=".length);
        if (!target.includes("@")) params[i] = "sstp=" + (target || "vpn:vpn") + "@";
      }
    }
    query = params.join("&");
  }
  return `${url.protocol}//${url.host}${path}?${query}`;
}

function normalizeEndpoint(raw) {
  let text = String(raw || "").trim();
  if (!text) return null;
  text = text.split("#")[0].trim().split("/")[0].trim();
  if (!text) return null;

  let host;
  let port;
  if (text.startsWith("[")) {
    const m = /^\[([0-9A-Fa-f:.]+)\](?::(\d{1,5}))?$/.exec(text);
    if (!m) return null;
    host = m[1];
    port = m[2] || "443";
  } else {
    const colons = (text.match(/:/g) || []).length;
    if (colons === 0) {
      host = text;
      port = "443";
    } else if (colons === 1) {
      const i = text.lastIndexOf(":");
      host = text.slice(0, i);
      port = text.slice(i + 1);
    } else {
      host = text;
      port = "443";
    }
    if (colons <= 1 && !/^[A-Za-z0-9.-]+$/.test(host)) return null;
  }
  if (!/^\d+$/.test(port)) return null;
  const portNumber = parseInt(port, 10);
  if (portNumber < 1 || portNumber > 65535) return null;
  return host.includes(":") ? `[${host}]:${portNumber}` : `${host}:${portNumber}`;
}

function parseEdgeHosts(raw) {
  const endpoints = [];
  const seen = new Set();
  for (const item of raw.split(",")) {
    const endpoint = normalizeEndpoint(item);
    if (endpoint && !seen.has(endpoint)) {
      seen.add(endpoint);
      endpoints.push(endpoint);
    }
  }
  return endpoints;
}

function loadConfig(env) {
  let rawWorker = envStr(env, "CHECK_WORKER");
  if (!rawWorker) {
    const domain = envStr(env, "DOMAIN", DEFAULT_DOMAIN).replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
    rawWorker = `https://${domain}/check?sstp=vpn:vpn@`;
  }
  const workerBase = normalizeWorkerBase(rawWorker);

  let staticRaw = envStr(env, "HOSTS_ENTRY");
  if (!staticRaw) staticRaw = envStr(env, "EDGE_HOSTS");
  let edgeHosts = staticRaw ? parseEdgeHosts(staticRaw) : [];
  if (!edgeHosts.length) edgeHosts = DEFAULT_EDGE_HOSTS.map(normalizeEndpoint).filter(Boolean);

  const optimalApi = envStr(env, "OPTIMAL_API", DEFAULT_OPTIMAL_API);
  const optimalUrls = optimalApi.split(",").map((u) => u.trim()).filter(Boolean);

  return {
    vpngateApi: envStr(env, "VPNGATE_API", DEFAULT_VPNGATE_API),
    vpngateMirror: envStr(env, "VPNGATE_MIRROR", DEFAULT_VPNGATE_MIRROR),
    workerBase,
    // Workers 同时只能有 6 个出站连接，超过会排队并导致误判超时，所以默认 6
    concurrency: envInt(env, "CHECK_CONCURRENCY", 6, 1),
    checkTimeout: envFloat(env, "CHECK_TIMEOUT", 25.0, 1.0),
    deadlineS: envFloat(env, "CHECK_DEADLINE", 1200.0, 30.0),
    httpTimeout: envFloat(env, "HTTP_TIMEOUT", 60.0, 5.0),
    maxCheckNodes: envInt(env, "MAX_CHECK_NODES", 0),
    edgeHosts,
    optimalUrls,
    minSuccessRatio: envFloat(env, "MIN_SUCCESS_RATIO", 0.0, 0.0),
    maxResidentialPerCountry: envInt(env, "MAX_RESIDENTIAL_PER_COUNTRY", 20),
    maxDatacenterPerCountry: envInt(env, "MAX_DATACENTER_PER_COUNTRY", 10),
    // —— Worker 版新增 ——
    retries: envInt(env, "HTTP_RETRIES", 2, 0),          // 对应原版 requests Retry(total=2)
    subrequestLimit: envInt(env, "SUBREQUEST_LIMIT", 45, 5), // 免费版 50；付费版可设 900
    batchSize: envInt(env, "BATCH_SIZE", 0),             // 每轮最多检测几个，0 = 受子请求上限自动决定
    stepSeconds: envFloat(env, "STEP_SECONDS", 300.0, 20.0), // 每轮最长运行时间
    intervalMinutes: envInt(env, "INTERVAL_MINUTES", 0), // >0 时 Cron 到点自动开始新一轮；0 = 只续跑，不自动开始
    nodesUrl: envStr(env, "NODES_URL"),
    token: envStr(env, "TOKEN"),
  };
}

// ---------------------------------------------------------------------------
// HTTP（带原版 requests Retry 语义：429/5xx 与网络错误重试，退避 0.5s、1s）
// ---------------------------------------------------------------------------
function makeBudget(limit) {
  return {
    subs: 0,
    limit,
    reserve: 0,
    take() {
      if (this.subs >= this.limit - this.reserve) return false;
      this.subs++;
      return true;
    },
  };
}

async function dropBody(resp) {
  try {
    if (resp.body) await resp.body.cancel();
  } catch (e) {
    /* ignore */
  }
}

async function fetchRetry(url, { timeoutMs, retries, budget, service }) {
  let lastErr = null;
  let lastResp = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    if (!budget.take()) {
      if (attempt === 0) return { deferred: true };
      break;
    }
    try {
      const init = {
        headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      };
      const resp = service ? await service.fetch(url, init) : await fetch(url, init);
      if (RETRY_STATUS.has(resp.status) && attempt < retries) {
        await dropBody(resp);
        lastResp = resp;
        continue;
      }
      return { resp };
    } catch (e) {
      lastErr = e;
      // Worker 版调整：超时不再重试（原版会对超时重试 2 次，一个死节点会占 75 秒和 3 个子请求额度）
      if (e && (e.name === "TimeoutError" || e.name === "AbortError")) break;
    }
  }
  if (lastResp) return { resp: lastResp };
  throw lastErr || new Error("请求失败");
}

// ---------------------------------------------------------------------------
// 数据抓取与解析
// ---------------------------------------------------------------------------
async function fetchVpngate(cfg, budget, log) {
  try {
    log("VPN GATE", `获取官方 API: ${cfg.vpngateApi}`);
    const r = await fetchRetry(cfg.vpngateApi, { timeoutMs: cfg.httpTimeout * 1000, retries: cfg.retries, budget });
    if (r.deferred) throw new Error("子请求额度不足");
    if (!r.resp.ok) throw new Error(`HTTP ${r.resp.status}`);
    const rows = parseCsv(await r.resp.text());
    if (rows.length) {
      log("VPN GATE", `主源(官方 API) 获取到 ${rows.length} 个原始节点`);
      return [rows, "vpngate.net/api/iphone"];
    }
    throw new Error("官方 API 返回 0 行数据");
  } catch (e) {
    log("VPN GATE", `官方 API 获取失败: ${e && e.message ? e.message : e}`);
  }

  try {
    log("VPN GATE", `回退镜像: ${cfg.vpngateMirror}`);
    const r = await fetchRetry(cfg.vpngateMirror, { timeoutMs: cfg.httpTimeout * 1000, retries: cfg.retries, budget });
    if (r.deferred) throw new Error("子请求额度不足");
    if (!r.resp.ok) throw new Error(`HTTP ${r.resp.status}`);
    const rows = parseMirrorJson(JSON.parse(await r.resp.text()));
    if (rows.length) {
      log("VPN GATE", `回退源(镜像) 获取到 ${rows.length} 个原始节点`);
      return [rows, "github-mirror"];
    }
  } catch (e) {
    log("VPN GATE", `回退镜像也失败: ${e && e.message ? e.message : e}`);
  }
  die("VPN GATE", "官方 API 与回退镜像均不可用，数据源完全失败");
}

// 等价于 Python csv.reader 对单行的解析
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"' && cur === "") {
      inQuote = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((ln) => ln.trim());
  let headerIdx = null;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].replace(/^#+/, "").startsWith("HostName")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === null) throw new Error("找不到 CSV 表头行 (HostName)");

  const header = lines[headerIdx].replace(/^#+/, "").split(",").map((h) => h.trim().replace(/^\*+/, "").toLowerCase());
  const column = {};
  header.forEach((name, idx) => {
    if (name) column[name] = idx;
  });

  const pick = (names, def = null) => {
    for (const name of names) {
      if (Object.prototype.hasOwnProperty.call(column, name)) return column[name];
    }
    return def;
  };

  const idxHost = pick(["hostname"], 0);
  const idxIp = pick(["ip"], 1);
  const idxLong = pick(["countrylong"], 5);
  const idxShort = pick(["countryshort"], 6);
  const idxPing = pick(["ping"]);
  const idxScore = pick(["score"]);
  let idxConfig = pick(["openvpn_configdata_base64"]);
  if (idxConfig === null) {
    const found = header.findIndex((name) => name.includes("base64"));
    idxConfig = found >= 0 ? found : header.length - 1;
  }

  const rows = [];
  for (const line of lines.slice(headerIdx + 1)) {
    if (line.startsWith("*") || line.startsWith("#")) continue;
    let fields;
    try {
      fields = parseCsvLine(line);
    } catch (e) {
      continue;
    }
    if (fields.length <= Math.max(idxHost || 0, idxIp || 0)) continue;

    const cell = (index) => (index === null || index >= fields.length ? "" : fields[index].trim());
    const host = cell(idxHost);
    const ip = cell(idxIp);
    if (!host || !ip) continue;
    const toInt = (index) => {
      const raw = cell(index);
      return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
    };
    rows.push({
      host,
      ip,
      country_long: cell(idxLong),
      country_short: cell(idxShort),
      config_b64: cell(idxConfig),
      ping: toInt(idxPing),
      score: toInt(idxScore),
    });
  }
  return rows;
}

function parseMirrorJson(data) {
  const servers = [];
  const items = Array.isArray(data) ? data : [data];
  for (const item of items) {
    if (item && typeof item === "object" && Array.isArray(item.servers)) {
      servers.push(...item.servers);
    } else if (item && typeof item === "object" && item.hostname) {
      servers.push(item);
    }
  }

  const rows = [];
  for (const server of servers) {
    if (!server || typeof server !== "object" || Array.isArray(server)) continue;
    const host = String(server.hostname || server.host || "").trim();
    const ip = String(server.ip || "").trim();
    if (!host || !ip) continue;
    const asInt = (key) => {
      const raw = String(server[key] || "").trim();
      return /^[+-]?\d+$/.test(raw) ? parseInt(raw, 10) : null;
    };
    rows.push({
      host,
      ip,
      country_long: String(server.countrylong || server.country_long || server.country || "").trim(),
      country_short: String(server.countryshort || server.country_short || "").trim(),
      config_b64: String(server.openvpn_configdata_base64 || server.config_b64 || "").trim(),
      ping: asInt("ping"),
      score: asInt("score"),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 筛选 SSTP 节点
// ---------------------------------------------------------------------------
function b64DecodeLoose(text) {
  // 与 Python b64decode(validate=False) 一致：丢弃字母表之外的字符
  const clean = text.replace(/[^A-Za-z0-9+/]/g, "");
  const padded = clean + "=".repeat((4 - (clean.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

function toSstpNodes(rows) {
  const nodes = [];
  for (const row of rows) {
    const configB64 = row.config_b64 || "";
    if (!configB64) continue;
    let config;
    try {
      config = b64DecodeLoose(configB64);
    } catch (e) {
      continue;
    }
    if (!PROTO_TCP_RE.test(config)) continue;
    const match = REMOTE_RE.exec(config);
    if (!match) continue;
    const port = parseInt(match[2], 10);
    if (!(port >= 1 && port <= 65535)) continue;

    let host = (row.host || "").trim().toLowerCase();
    if (!host) continue;
    if (!host.includes(".")) host = `${host}.opengw.net`;

    nodes.push({
      host,
      port,
      ip: (row.ip || "").trim(),
      country: (row.country_long || "").trim(),
      country_code: (row.country_short || "").trim().toUpperCase(),
      ping: row.ping === undefined ? null : row.ping,
      score: row.score === undefined ? null : row.score,
    });
  }
  return nodes;
}

function dedupeNodes(nodes) {
  const seen = new Set();
  const unique = [];
  for (const node of nodes) {
    const key = `${node.host}\u0000${node.port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(node);
  }
  return unique;
}

function prioritize(nodes) {
  const key = (n) => [n.ping === null ? 1 : 0, n.ping || 0, -(n.score || 0), n.host];
  return [...nodes].sort((a, b) => compareTuples(key(a), key(b)));
}

// ---------------------------------------------------------------------------
// 分类（以 Worker 的出口信息为准，缺失时才看 Operator 关键字）
// ---------------------------------------------------------------------------
function classifyNetwork(org, isDatacenter, exitInfo = {}) {
  if (isDatacenter === true) return "datacenter";
  // 已知代理/VPN/Tor/滥用/黑洞出口不能因 ASN 名称像运营商而进入住宅发布池。
  if (
    exitInfo.is_proxy === true ||
    exitInfo.is_vpn === true ||
    exitInfo.is_tor === true ||
    exitInfo.is_abuser === true ||
    exitInfo.is_bogon === true ||
    exitInfo.is_crawler === true
  ) return "unknown";
  const upper = (org || "").toUpperCase();
  if (upper) {
    if (DATA_CENTER_ORG_KEYWORDS.some((k) => upper.includes(k))) return "datacenter";
    if (RESIDENTIAL_ORG_KEYWORDS.some((k) => upper.includes(k))) return "residential";
  }
  // is_datacenter=false 只表示未标记为机房，不足以证明是住宅/运营商网络。
  return "unknown";
}

// ---------------------------------------------------------------------------
// 检测
// ---------------------------------------------------------------------------
const nodeKey = (n) => `${n.host}:${n.port}`;

function baseResult(node) {
  return {
    host: node.host,
    port: node.port,
    ip: node.ip,
    country: node.country,
    country_code: node.country_code,
    ping: node.ping,
    score: node.score,
    protocol: "sstp",
    link: `sstp://vpn:vpn@${node.host}:${node.port}`,
    status: "failed",
    success: false,
    checked_at: utcStamp(false),
    exit: null,
    latency_ms: null,
    colo: null,
    error: null,
    worker_error: false,
    residential: "unknown",
  };
}

// 返回 null 表示本轮子请求额度用完，该节点留到下一轮
async function checkOne(node, cfg, budget, service) {
  const result = baseResult(node);
  const url = cfg.workerBase + pyQuote(`${node.host}:${node.port}`);
  try {
    const r = await fetchRetry(url, { timeoutMs: cfg.checkTimeout * 1000, retries: cfg.retries, budget, service });
    if (r.deferred) return null;
    const response = r.resp;
    if (response.status !== 200) {
      await dropBody(response);
      result.error = `HTTP ${response.status}`;
      result.worker_error = true;
      return result;
    }

    const payload = JSON.parse(await response.text());
    const success = Boolean(payload.success);
    result.success = success;
    result.status = success ? "success" : "failed";
    result.latency_ms = payload.responseTime === undefined ? null : payload.responseTime;
    result.colo = payload.colo === undefined ? null : payload.colo;
    result.error = success ? null : payload.error || payload.message || "check failed";

    const exitInfo = payload.exit || {};
    if (success && Object.keys(exitInfo).length) {
      const asn = exitInfo.asn || {};
      if (typeof asn !== "object") throw new TypeError("'asn' 字段格式异常");
      const org = String(asn.org || asn.name || "");
      const get = (v) => (v === undefined ? null : v);
      result.exit = {
        ip: get(exitInfo.ip),
        country: get(exitInfo.country),
        country_code: get(exitInfo.country_code),
        city: get(exitInfo.city),
        continent: get(exitInfo.continent),
        asn: get(asn.asn),
        org,
        is_datacenter: get(exitInfo.is_datacenter),
        is_proxy: get(exitInfo.is_proxy ?? exitInfo.privacy?.is_proxy),
        is_vpn: get(exitInfo.is_vpn ?? exitInfo.privacy?.is_vpn),
        is_tor: get(exitInfo.is_tor ?? exitInfo.privacy?.is_tor),
        is_abuser: get(exitInfo.is_abuser ?? exitInfo.privacy?.is_abuser),
        is_bogon: get(exitInfo.is_bogon ?? exitInfo.privacy?.is_bogon),
        is_crawler: get(exitInfo.is_crawler),
        is_mobile: get(exitInfo.is_mobile ?? exitInfo.privacy?.is_mobile),
        is_satellite: get(exitInfo.is_satellite ?? exitInfo.privacy?.is_satellite),
      };
      result.residential = classifyNetwork(org, exitInfo.is_datacenter, result.exit);
    } else if (success) {
      result.residential = "unknown";
    }
    return result;
  } catch (e) {
    result.error = `${e && e.name ? e.name : "Error"}: ${e && e.message ? e.message : e}`;
    result.worker_error = true;
    return result;
  }
}

function timeoutStub(node) {
  const stub = baseResult(node);
  stub.error = "整体检测超时，未完成";
  return stub;
}

// 并发检测（Worker 限制：同时 6 个出站连接）。在 stopAt 之前取节点，额度用完则返回。
async function checkAll(nodes, cfg, budget, service, stopAt, onResult) {
  let next = 0;
  const lanes = Math.min(cfg.concurrency, nodes.length);
  async function lane() {
    for (;;) {
      if (Date.now() >= stopAt) return;
      if (budget.subs >= budget.limit - budget.reserve) return;
      const i = next++;
      if (i >= nodes.length) return;
      const result = await checkOne(nodes[i], cfg, budget, service);
      if (result) await onResult(result);
    }
  }
  await Promise.all(Array.from({ length: lanes }, lane));
}

// ---------------------------------------------------------------------------
// 优选入口
// ---------------------------------------------------------------------------
async function fetchOptimalEndpoints(cfg, budget, log) {
  if (!cfg.optimalUrls.length) return [];
  const endpoints = [];
  const seen = new Set();
  for (const url of cfg.optimalUrls) {
    try {
      log("OPTIMAL API", `请求优选 API: ${url}`);
      const r = await fetchRetry(url, {
        timeoutMs: Math.min(cfg.httpTimeout, 15) * 1000,
        retries: cfg.retries,
        budget,
      });
      if (r.deferred) throw new Error("子请求额度不足");
      if (r.resp.status !== 200) {
        await dropBody(r.resp);
        log("OPTIMAL API", `API 返回状态码异常: ${r.resp.status}`);
        continue;
      }
      let count = 0;
      for (const line of (await r.resp.text()).split(/\r\n|\r|\n/)) {
        const endpoint = normalizeEndpoint(line);
        if (endpoint && !seen.has(endpoint)) {
          seen.add(endpoint);
          endpoints.push(endpoint);
          count++;
        }
      }
      log("OPTIMAL API", `成功从 API 获取到 ${count} 个优选端点`);
    } catch (e) {
      log("OPTIMAL API", `拉取优选 API 失败 (${url}): ${e && e.message ? e.message : e}`);
    }
  }
  return endpoints;
}

async function getCombinedEdgeHosts(cfg, budget, log) {
  const apiEndpoints = await fetchOptimalEndpoints(cfg, budget, log);
  let combined = [];
  const seen = new Set();
  for (const endpoint of [...cfg.edgeHosts, ...apiEndpoints]) {
    if (endpoint && !seen.has(endpoint)) {
      seen.add(endpoint);
      combined.push(endpoint);
    }
  }
  if (!combined.length) combined = DEFAULT_EDGE_HOSTS.map(normalizeEndpoint).filter(Boolean);
  log("EDGE POOL", `入口地址池: 静态/配置 ${cfg.edgeHosts.length} 个, API ${apiEndpoints.length} 个, 合并 ${combined.length} 个`);
  return combined;
}

// ---------------------------------------------------------------------------
// 产物
// ---------------------------------------------------------------------------
function sanitizeRemark(text) {
  return text.replace(/[#$\r\n]/g, "").trim() || "节点";
}

const nodeSortKey = (n) => [n.residential !== "residential" ? 1 : 0, n.latency_ms === null || n.latency_ms === undefined ? 1 : 0, n.latency_ms || 0];

function buildOutputs({ results, rawCount, sstpCount, source, workerHost, durationS, timedOut }) {
  const available = results.filter((r) => r.success);
  const countries = {};
  for (const node of available) {
    const code = (node.country_code || "").toUpperCase() || "??";
    const name = node.country || COUNTRY_ZH[code] || code;
    if (!countries[code]) {
      countries[code] = { code, name, count: 0, residential: 0, datacenter: 0, unknown: 0, nodes: [] };
    }
    const group = countries[code];
    if (group.name === code && name) group.name = name;
    group.nodes.push(node);
  }

  for (const group of Object.values(countries)) {
    group.count = group.nodes.length;
    group.residential = group.nodes.filter((n) => n.residential === "residential").length;
    group.datacenter = group.nodes.filter((n) => n.residential === "datacenter").length;
    group.unknown = group.count - group.residential - group.datacenter;
    group.nodes.sort((a, b) => compareTuples(nodeSortKey(a), nodeSortKey(b)));
  }

  const stats = {
    raw_nodes: rawCount,
    sstp_nodes: sstpCount,
    checked: results.length,
    success: available.length,
    failed: results.length - available.length,
    worker_errors: results.filter((r) => r.worker_error).length,
    timed_out: timedOut,
    countries: Object.keys(countries).length,
    residential_est: available.filter((n) => n.residential === "residential").length,
    datacenter_est: available.filter((n) => n.residential === "datacenter").length,
    unknown_est: available.filter((n) => n.residential === "unknown").length,
  };
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: utcStamp(true),
    source,
    worker_host: workerHost,
    duration_s: Math.round(durationS * 10) / 10,
    stats,
    countries,
  };
}

function buildNodesText(data, edgeHosts, cfg) {
  if (!edgeHosts.length) throw new ConfigError("优选入口池为空，无法生成 nodes.txt");
  const lines = [];
  const seenLinks = new Set();
  let index = 0;
  const ordered = Object.entries(data.countries).sort((a, b) =>
    compareTuples([-(Number(a[1].count) || 0), String(a[1].code || a[0])], [-(Number(b[1].count) || 0), String(b[1].code || b[0])])
  );
  for (const [code, group] of ordered) {
    const name = COUNTRY_ZH[code] || group.name || code;
    const nodes = [...group.nodes].sort((a, b) => compareTuples(nodeSortKey(a), nodeSortKey(b)));
    // nodes.txt 只发布已识别为住宅/运营商网络的节点；机房与未知节点仍保留在 data.json 供浏览器查看。
    const residential = nodes.filter((n) => n.residential === "residential");
    const chosen = residential.slice(0, cfg.maxResidentialPerCountry);
    const counters = { residential: 0, datacenter: 0, unknown: 0 };
    for (const node of chosen) {
      const link = `sstp://vpn:vpn@${node.host}:${node.port}`;
      if (seenLinks.has(link)) continue;
      seenLinks.add(link);
      const kindKey = Object.prototype.hasOwnProperty.call(counters, node.residential) ? node.residential : "unknown";
      counters[kindKey] += 1;
      const kind = { residential: "住宅", datacenter: "机房", unknown: "未知" }[kindKey];
      const entry = edgeHosts[index % edgeHosts.length];
      const entryEndpoint = normalizeEndpoint(entry) || entry;
      index += 1;
      lines.push(`${entryEndpoint}#${sanitizeRemark(`${name}-${kind}-${pad(counters[kindKey])}`)}$${link}`);
    }
  }
  return lines.join("\n") + (lines.length ? "\n" : "");
}

function buildSummary(data, nodesCount, nodesUrl) {
  const s = data.stats;
  const rows = [
    "| 指标 | 数值 |",
    "| :--- | ---: |",
    `| 原始节点 | ${s.raw_nodes} |`,
    `| SSTP 候选 | ${s.sstp_nodes} |`,
    `| 已检测 | ${s.checked} |`,
    `| 可用 | ${s.success} |`,
    `| 失败 | ${s.failed}（Worker 异常 ${s.worker_errors}）|`,
    `| 国家/地区 | ${s.countries} |`,
    `| 住宅 / 机房 / 未知 | ${s.residential_est} / ${s.datacenter_est} / ${s.unknown_est} |`,
    `| 发布节点行数 | ${nodesCount} |`,
    `| 用时 | ${data.duration_s}s |`,
    `| 数据源 | ${data.source} |`,
  ];
  const top = Object.values(data.countries).sort((a, b) => b.count - a.count).slice(0, 5);
  if (top.length) {
    rows.push("", "**节点最多的 5 个国家/地区**", "", "| 国家/地区 | 数量 | 住宅 |", "| :--- | ---: | ---: |");
    for (const g of top) rows.push(`| ${g.name}（${g.code}）| ${g.count} | ${g.residential} |`);
  }
  rows.push("", `订阅地址：${nodesUrl}`);
  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// KV 存储
// ---------------------------------------------------------------------------
function getKV(env) {
  if (!env.GATE_KV) {
    throw new ConfigError("未绑定 KV：请在 Worker → Settings → Bindings → Add → KV namespace，变量名填 GATE_KV。");
  }
  return env.GATE_KV;
}

// ---------------------------------------------------------------------------
// 流水线（一次调用 = 一轮；免费版会分多轮跑完，状态存 KV）
// ---------------------------------------------------------------------------
async function runStep(env, opts) {
  const { emit = () => {}, origin = "", trigger = "manual", force = false } = opts;
  const store = getKV(env);
  const lines = [];
  const log = makeLogger((line) => {
    lines.push(line);
    emit(line);
  });

  let cfg;
  try {
    cfg = loadConfig(env);
  } catch (e) {
    if (e instanceof ConfigError) {
      log("配置", `[失败] ${e.message}`);
      return { done: true, status: "error", message: e.message };
    }
    throw e;
  }

  const now = Date.now();
  const lock = await store.get("lock", "json");
  if (lock && lock.until > now && !force) {
    log("LOCK", `已有检测在运行（${Math.ceil((lock.until - now) / 1000)} 秒后锁自动过期）`);
    return { done: false, status: "busy" };
  }
  const lockSec = Math.ceil(cfg.stepSeconds + cfg.checkTimeout * (cfg.retries + 1) + 30);
  await store.put("lock", JSON.stringify({ until: now + lockSec * 1000, trigger }), { expirationTtl: Math.max(60, lockSec) });

  const meta = (await store.get("meta", "json")) || {};
  if (origin && meta.origin !== origin) meta.origin = origin;

  try {
    return await runStepInner({ env, store, cfg, log, lines, meta, trigger, emit });
  } catch (e) {
    if (e instanceof Die) {
      log(e.section, `[失败] ${e.message}`);
      await store.delete("state");
      meta.lastFinishedAt = Date.now();
      meta.lastStatus = "failed";
      meta.lastMessage = e.message;
      meta.lastLogs = lines.slice(-400);
      await store.put("meta", JSON.stringify(meta));
      return { done: true, status: "refused", message: e.message };
    }
    const msg = `程序异常: ${e && e.name ? e.name : "Error"}: ${e && e.message ? e.message : e}`;
    log("FATAL", `[失败] ${msg}`);
    try {
      await store.delete("state");
      meta.lastFinishedAt = Date.now();
      meta.lastStatus = "failed";
      meta.lastMessage = msg;
      meta.lastLogs = lines.slice(-400);
      await store.put("meta", JSON.stringify(meta));
    } catch (e2) {
      /* ignore */
    }
    return { done: true, status: "error", message: msg };
  } finally {
    try {
      await store.delete("lock");
    } catch (e) {
      /* ignore */
    }
  }
}

async function runStepInner({ env, store, cfg, log, lines, meta, trigger, emit }) {
  const budget = makeBudget(cfg.subrequestLimit);
  const service = env.CHECK_SERVICE && typeof env.CHECK_SERVICE.fetch === "function" ? env.CHECK_SERVICE : null;

  let state = await store.get("state", "json");
  if (state && Date.now() - state.startedAt > STATE_MAX_AGE_MS) {
    log("RESUME", "上次未完成的检测已过期，重新开始");
    state = null;
  }

  log("CONFIG", `检测地址: ${cfg.workerBase.split("?")[0]}?sstp=***`);
  log("CONFIG", `并发 ${cfg.concurrency}, 单节点超时 ${cfg.checkTimeout}s, 整体截止 ${cfg.deadlineS}s, 每轮子请求上限 ${cfg.subrequestLimit}`);

  let logBase = [];
  if (!state) {
    const [rows, source] = await fetchVpngate(cfg, budget, log);
    const rawCount = rows.length;
    if (rawCount === 0) die("VPN GATE", "VPN Gate 返回 0 个原始节点，拒绝生成空结果");

    const sstpNodes = toSstpNodes(rows);
    const sstpCount = sstpNodes.length;
    if (sstpCount === 0) die("VPN GATE", `从 ${rawCount} 个原始节点中没有解析出任何 SSTP(TCP) 节点`);

    let unique = prioritize(dedupeNodes(sstpNodes));
    if (cfg.maxCheckNodes > 0) unique = unique.slice(0, cfg.maxCheckNodes);

    log("VPN GATE", `原始节点 ${rawCount}, SSTP ${sstpCount}, 去重后 ${unique.length}`);
    log("CLOUDFLARE WORKER", `提交检测: ${unique.length}`);

    state = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      checkStartedAt: Date.now(),
      source,
      rawCount,
      sstpCount,
      nodes: unique,
      results: [],
      timedOut: 0,
      logs: [],
    };
  } else {
    logBase = state.logs || [];
    log("RESUME", `继续上次未完成的检测：已完成 ${state.results.length}/${state.nodes.length}`);
  }

  let saving = false;
  let sinceSave = 0;
  const saveState = async () => {
    state.logs = logBase.concat(lines).slice(-400);
    await store.put("state", JSON.stringify(state));
  };

  const doneKeys = () => new Set(state.results.map(nodeKey));
  let pending = state.nodes.filter((n) => !doneKeys().has(nodeKey(n)));

  if (pending.length && Date.now() - state.checkStartedAt > cfg.deadlineS * 1000) {
    log("CLOUDFLARE WORKER", `整体检测超时（${cfg.deadlineS.toFixed(0)}s），未完成的节点按失败处理`);
    for (const node of pending) {
      state.results.push(timeoutStub(node));
      state.timedOut += 1;
    }
    pending = [];
  }

  if (pending.length) {
    const batch = cfg.batchSize > 0 ? pending.slice(0, cfg.batchSize) : pending;
    budget.reserve = batch.length === pending.length ? cfg.optimalUrls.length : 0;
    log("CLOUDFLARE WORKER", `本轮检测 ${batch.length}/${pending.length} 个节点`);
    const stopAt = Math.min(Date.now() + cfg.stepSeconds * 1000, state.checkStartedAt + cfg.deadlineS * 1000);
    // 心跳：检测期间每 5 秒向页面发一行进度，避免连接因长时间无数据被切断
    const heartbeat = setInterval(() => {
      emit(`… 检测中 ${state.results.length}/${state.nodes.length}`);
    }, 5000);
    try {
      await checkAll(batch, cfg, budget, service, stopAt, async (result) => {
        state.results.push(result);
        sinceSave += 1;
        if (sinceSave >= 15 && !saving) {
          saving = true;
          sinceSave = 0;
          try {
            await saveState();
          } finally {
            saving = false;
          }
        }
      });
    } finally {
      clearInterval(heartbeat);
    }
    budget.reserve = 0;
    const keys = doneKeys();
    pending = state.nodes.filter((n) => !keys.has(nodeKey(n)));
  }

  if (pending.length) {
    log("CLOUDFLARE WORKER", `已完成 ${state.results.length}/${state.nodes.length}，剩余 ${pending.length} 个留待下一轮`);
    await saveState();
    meta.lastStatus = "running";
    meta.lastMessage = `检测中 ${state.results.length}/${state.nodes.length}`;
    await store.put("meta", JSON.stringify(meta));
    return { done: false, status: "continue", total: state.nodes.length, completed: state.results.length };
  }

  // ---- 全部检测完毕：与原版 main() 后半段一致 ----
  if (budget.subs > 0 && budget.subs + cfg.optimalUrls.length > budget.limit) {
    log("CLOUDFLARE WORKER", "本轮子请求额度已用完，发布留到下一轮");
    await saveState();
    return { done: false, status: "continue", total: state.nodes.length, completed: state.results.length };
  }

  const results = state.results;
  const uniqueCount = state.nodes.length;
  const success = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);
  const workerErrors = failed.filter((r) => r.worker_error);
  const elapsed = (Date.now() - state.checkStartedAt) / 1000;

  log("CLOUDFLARE WORKER", `成功 ${success.length}, 失败 ${failed.length}（Worker 异常 ${workerErrors.length}）, 用时 ${elapsed.toFixed(1)}s`);

  if (uniqueCount && !success.length && workerErrors.length === uniqueCount) {
    die("CLOUDFLARE WORKER", "检测 Worker 全部请求异常，本次不发布（保留上一次产物）");
  }
  if (uniqueCount && !success.length) {
    die("RESULT", "所有节点检测失败，本次不发布（保留上一次产物）");
  }
  const ratio = uniqueCount ? success.length / uniqueCount : 0.0;
  if (cfg.minSuccessRatio > 0 && ratio < cfg.minSuccessRatio) {
    die(
      "RESULT",
      `成功率 ${(ratio * 100).toFixed(1)}% 低于阈值 ${(cfg.minSuccessRatio * 100).toFixed(1)}%，` +
        "本次不发布（保留上一次产物）；确认无误可调低 MIN_SUCCESS_RATIO"
    );
  }

  const workerHost = (() => {
    try {
      return new URL(cfg.workerBase).host || "unknown";
    } catch (e) {
      return "unknown";
    }
  })();
  const data = buildOutputs({
    results,
    rawCount: state.rawCount,
    sstpCount: state.sstpCount,
    source: state.source,
    workerHost,
    durationS: (Date.now() - state.startedAt) / 1000,
    timedOut: state.timedOut,
  });

  const edgeHosts = await getCombinedEdgeHosts(cfg, budget, log);
  const nodesText = buildNodesText(data, edgeHosts, cfg);
  const nodesCount = nodesText.split("\n").filter((l) => l.trim()).length;

  await store.put("data.json", JSON.stringify(data));
  await store.put("nodes.txt", nodesText);

  const nodesUrl = cfg.nodesUrl || (meta.origin ? `${meta.origin}/nodes.txt` : "https://<你的Worker域名>/nodes.txt");
  log("RESULT", `可用节点 ${data.stats.success}, 国家/地区 ${data.stats.countries}, nodes.txt ${nodesCount} 行`);
  log("WEBSITE", "生成 data.json");
  log("WEBSITE", "生成 index.html");
  log("WEBSITE", "生成 nodes.txt");
  log("USAGE", `把 ${nodesUrl} 填入 edgetunnel 后台「自定义优选 IP」`);
  log("WEBSITE", "完成（已发布到本 Worker）");

  await store.delete("state");
  meta.lastFinishedAt = Date.now();
  meta.lastStatus = "published";
  meta.lastMessage = `可用 ${data.stats.success} / 已检测 ${data.stats.checked}`;
  meta.summary = buildSummary(data, nodesCount, nodesUrl);
  meta.lastLogs = state.logs.concat(lines).slice(-400);
  await store.put("meta", JSON.stringify(meta));
  return { done: true, status: "published", message: meta.lastMessage };
}

// ---------------------------------------------------------------------------
// 定时触发：只在「有未完成的检测」或「到达 INTERVAL_MINUTES」时才动手
// ---------------------------------------------------------------------------
async function scheduledTick(env) {
  const store = getKV(env);
  const cfg = loadConfig(env);
  const state = await store.get("state", "json");
  const meta = (await store.get("meta", "json")) || {};
  let should = false;
  if (state) {
    should = true;
  } else if (cfg.intervalMinutes > 0) {
    const last = meta.lastFinishedAt || 0;
    should = Date.now() - last >= cfg.intervalMinutes * 60000;
  }
  if (!should) return;
  await runStep(env, { trigger: "cron", origin: meta.origin || "" });
}

// ---------------------------------------------------------------------------
// 页面：原版 web/index.html 原样内嵌
// ---------------------------------------------------------------------------
const INDEX_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VPN Gate SSTP 节点检测 · 住宅/机房</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      color: #1f2328;
      background: #f6f8fa;
      line-height: 1.6;
    }
    .wrap { max-width: 1120px; margin: 0 auto; }
    header { margin-bottom: 20px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    .sub { color: #656d76; font-size: 13px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin: 18px 0;
    }
    .stat {
      background: #fff;
      border: 1px solid #d0d7de;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .stat .k { font-size: 12px; color: #656d76; }
    .stat .v { font-size: 22px; font-weight: 600; margin-top: 2px; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 16px 0;
    }
    .toolbar input {
      flex: 1 1 220px;
      min-width: 180px;
      padding: 8px 10px;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      font-size: 14px;
      background: #fff;
    }
    button, .btn {
      padding: 7px 12px;
      border: 1px solid #d0d7de;
      border-radius: 8px;
      background: #fff;
      font-size: 13px;
      cursor: pointer;
      color: #1f2328;
      text-decoration: none;
    }
    button:hover, .btn:hover { background: #f3f4f6; }
    button.active { background: #0969da; border-color: #0969da; color: #fff; }
    .country {
      background: #fff;
      border: 1px solid #d0d7de;
      border-radius: 10px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    .country-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 12px 14px;
      border-bottom: 1px solid #eaeef2;
    }
    .country-head strong { font-size: 15px; }
    .pill {
      font-size: 11px;
      padding: 1px 8px;
      border-radius: 999px;
      border: 1px solid #d0d7de;
      color: #656d76;
      background: #f6f8fa;
    }
    .pill.res { color: #1a7f37; border-color: #b7e4c7; background: #eefbf1; }
    .pill.dc { color: #9a6700; border-color: #f0d69a; background: #fff8e5; }
    .node {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      padding: 9px 14px;
      border-top: 1px solid #f0f2f4;
      font-size: 13px;
    }
    .node:first-child { border-top: none; }
    .host { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .muted { color: #656d76; }
    .grow { flex: 1 1 auto; }
    .empty { color: #656d76; text-align: center; padding: 40px 0; }
    footer { margin-top: 24px; color: #656d76; font-size: 12px; }
    footer code { background: #eef1f4; padding: 1px 6px; border-radius: 6px; }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      background: #1f2328;
      color: #fff;
      padding: 8px 16px;
      border-radius: 999px;
      font-size: 13px;
      opacity: 0;
      transition: opacity .2s;
      pointer-events: none;
    }
    .toast.show { opacity: 1; }
    @media (max-width: 520px) {
      body { padding: 14px; }
      .node { padding: 8px 12px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>VPN Gate SSTP 节点检测</h1>
      <div class="sub">
        数据来自 VPN Gate（TCP/SSTP 端口），由 Cloudflare Worker 实测出口。
        <span id="meta">加载中…</span>
      </div>
    </header>

    <div class="stats" id="stats"></div>

    <div class="toolbar">
      <input id="search" type="search" placeholder="搜索主机 / 国家 / 运营商，例如 japan、ntt" />
      <button data-filter="all" class="active">全部</button>
      <button data-filter="residential">住宅</button>
      <button data-filter="datacenter">机房</button>
      <button data-filter="unknown">未识别</button>
      <button id="copy-all">复制全部链接</button>
      <a class="btn" href="nodes.txt" download="nodes.txt">下载 nodes.txt</a>
      <button id="refresh">刷新</button>
      <a class="btn" href="run">手动检测 /run</a>
      <a class="btn" href="status" target="_blank">运行状态 /status</a>
    </div>

    <div id="list"><div class="empty">加载中…</div></div>

    <footer>
      <div>订阅地址：<code id="sub-url">…</code></div>
      <div id="foot">本页面每 5 分钟自动检查一次更新；数据仅供参考，节点可用性与出口属性可能随时变化。</div>
    </footer>
  </div>
  <div class="toast" id="toast"></div>

  <script>
    (function () {
      'use strict';

      var state = { data: null, filter: 'all', keyword: '', timer: null };

      function esc(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function toast(message) {
        var el = document.getElementById('toast');
        el.textContent = message;
        el.classList.add('show');
        setTimeout(function () { el.classList.remove('show'); }, 1800);
      }

      function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () {
            toast('已复制 ' + text.split('\n').length + ' 行');
          }, function () { toast('复制失败，请手动选择'); });
          return;
        }
        var area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand('copy');
          toast('已复制 ' + text.split('\n').length + ' 行');
        } catch (err) {
          toast('复制失败，请手动选择');
        }
        document.body.removeChild(area);
      }

      function statCard(label, value) {
        return '<div class="stat"><div class="k">' + esc(label) + '</div><div class="v">' + esc(value) + '</div></div>';
      }

      function renderStats() {
        var d = state.data;
        if (!d) return;
        var s = d.stats || {};
        var items = [
          ['可用节点', s.success != null ? s.success : 0],
          ['国家/地区', s.countries != null ? s.countries : 0],
          ['住宅出口', s.residential_est != null ? s.residential_est : 0],
          ['机房出口', s.datacenter_est != null ? s.datacenter_est : 0],
          ['已检测', s.checked != null ? s.checked : 0],
          ['失败', s.failed != null ? s.failed : 0],
          ['耗时', (d.duration_s != null ? d.duration_s : '?') + 's']
        ];
        document.getElementById('stats').innerHTML = items.map(function (it) {
          return statCard(it[0], it[1]);
        }).join('');
        document.getElementById('meta').textContent =
          '最后更新：' + (d.generated_at || '未知') +
          '｜数据源：' + (d.source || '未知') +
          '｜Worker：' + (d.worker_host || '未知');
        document.getElementById('sub-url').textContent =
          location.origin + location.pathname.replace(/[^/]*$/, '') + 'nodes.txt';
      }

      function nodeMatches(node, country) {
        if (state.filter !== 'all' && node.residential !== state.filter) return false;
        if (!state.keyword) return true;
        var text = [
          node.host, node.port, country.code, country.name,
          node.exit && node.exit.org, node.exit && node.exit.country,
          node.exit && node.exit.city
        ].join(' ').toLowerCase();
        return text.indexOf(state.keyword) !== -1;
      }

      function render() {
        var d = state.data;
        var list = document.getElementById('list');
        if (!d) return;
        var groups = Object.keys(d.countries || {}).map(function (key) {
          return d.countries[key];
        }).sort(function (a, b) { return (b.count || 0) - (a.count || 0); });

        var html = '';
        var total = 0;
        groups.forEach(function (g) {
          var nodes = (g.nodes || []).filter(function (n) { return nodeMatches(n, g); });
          if (!nodes.length) return;
          total += nodes.length;
          var name = g.name || g.code || '未知';
          html += '<section class="country"><div class="country-head">' +
            '<strong>' + esc(name) + '</strong>' +
            '<span class="pill">' + esc(g.code || '??') + '</span>' +
            '<span class="pill">共 ' + esc(nodes.length) + ' 个</span>' +
            '<span class="pill res">住宅 ' + esc(g.residential || 0) + '</span>' +
            '<span class="pill dc">机房 ' + esc(g.datacenter || 0) + '</span>' +
            '</div>';
          nodes.forEach(function (n) {
            var kind = n.residential === 'residential' ? '住宅'
              : (n.residential === 'datacenter' ? '机房' : '未知');
            var latency = n.latency_ms != null ? esc(n.latency_ms) + ' ms' : '—';
            var org = n.exit && n.exit.org ? esc(n.exit.org) : '';
            var exitCountry = n.exit && n.exit.country ? esc(n.exit.country) : '';
            html += '<div class="node">' +
              '<span class="host">' + esc(n.host) + ':' + esc(n.port) + '</span>' +
              '<span class="pill ' + (n.residential === 'residential' ? 'res' : (n.residential === 'datacenter' ? 'dc' : '')) + '">' + kind + '</span>' +
              '<span class="muted">' + latency + '</span>' +
              (exitCountry ? '<span class="muted">出口 ' + exitCountry + '</span>' : '') +
              (org ? '<span class="muted grow">' + org + '</span>' : '<span class="grow"></span>') +
              '<button class="copy" data-link="' + esc('sstp://vpn:vpn@' + n.host + ':' + n.port) + '">复制</button>' +
              '</div>';
          });
          html += '</section>';
        });

        if (!html) {
          html = '<div class="empty">没有匹配的节点</div>';
        }
        list.innerHTML = html;

        list.querySelectorAll('button.copy').forEach(function (btn) {
          btn.addEventListener('click', function () {
            copyText(btn.getAttribute('data-link'));
          });
        });

        var allLinks = [];
        groups.forEach(function (g) {
          (g.nodes || []).forEach(function (n) {
            allLinks.push('sstp://vpn:vpn@' + n.host + ':' + n.port);
          });
        });
        document.getElementById('copy-all').onclick = function () { copyText(allLinks.join('\n')); };
        document.getElementById('foot').textContent =
          '当前显示 ' + total + ' 个节点；共 ' + allLinks.length + ' 个可用节点，每 5 分钟自动刷新。';
      }

      function load() {
        var url = 'data.json?ts=' + Date.now();
        fetch(url, { cache: 'no-store' })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
          })
          .then(function (data) {
            var same = state.data && state.data.generated_at === data.generated_at;
            state.data = data;
            if (!same) {
              renderStats();
              render();
            }
          })
          .catch(function (err) {
            document.getElementById('list').innerHTML =
              '<div class="empty">数据加载失败：' + esc(err.message) +
              '<br /><br />若刚部署完成，请等待 1–2 分钟后刷新。</div>';
          });
      }

      document.getElementById('search').addEventListener('input', function (e) {
        state.keyword = String(e.target.value || '').trim().toLowerCase();
        render();
      });

      document.querySelectorAll('.toolbar button[data-filter]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          document.querySelectorAll('.toolbar button[data-filter]').forEach(function (b) {
            b.classList.remove('active');
          });
          btn.classList.add('active');
          state.filter = btn.getAttribute('data-filter');
          render();
        });
      });

      document.getElementById('refresh').addEventListener('click', function () {
        load();
        toast('已刷新');
      });

      load();
      state.timer = setInterval(load, 5 * 60 * 1000);
    })();
  </script>
</body>
</html>`;

const RUN_HTML = String.raw`<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>VPN Gate 手动检测</title>
<style>
  body{margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#f6f8fa;color:#1f2328}
  .wrap{max-width:960px;margin:0 auto}
  h1{font-size:22px;margin:0 0 6px}
  .sub{color:#656d76;font-size:13px;margin-bottom:14px}
  .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  input{padding:8px 10px;border:1px solid #d0d7de;border-radius:8px;font-size:14px;background:#fff;min-width:160px}
  button,a.btn{padding:8px 14px;border:1px solid #d0d7de;border-radius:8px;background:#fff;font-size:14px;cursor:pointer;color:#1f2328;text-decoration:none}
  button.primary{background:#0969da;border-color:#0969da;color:#fff}
  button:disabled{opacity:.5;cursor:not-allowed}
  #bar{height:8px;background:#e5e9ee;border-radius:99px;overflow:hidden;margin:14px 0 4px}
  #fill{height:100%;width:0;background:#1a7f37;transition:width .3s}
  #state{font-size:13px;color:#656d76;margin-bottom:10px}
  pre{background:#0d1117;color:#c9d1d9;padding:14px;border-radius:10px;font-size:12.5px;line-height:1.55;height:60vh;overflow:auto;white-space:pre-wrap;word-break:break-all}
</style>
</head>
<body>
<div class="wrap">
  <h1>VPN Gate 手动检测</h1>
  <div class="sub">点击开始后，页面会自动分批跑完整个流程。请保持本页打开，直到显示「完成」。连接中断时服务器仍会继续，页面会自动改为查询进度。</div>
  <div class="row">
    <input id="token" type="password" placeholder="TOKEN（没设置就留空）" autocomplete="off" />
    <button id="go" class="primary">开始检测</button>
    <a class="btn" href="./">返回仪表盘</a>
    <a class="btn" href="status" target="_blank">运行状态</a>
  </div>
  <div id="bar"><div id="fill"></div></div>
  <div id="state">未开始</div>
  <pre id="log"></pre>
</div>
<script>
(function () {
  var params = new URLSearchParams(location.search);
  var tokenEl = document.getElementById('token');
  var logEl = document.getElementById('log');
  var stateEl = document.getElementById('state');
  var fillEl = document.getElementById('fill');
  var goEl = document.getElementById('go');
  var running = false;

  try { tokenEl.value = params.get('token') || localStorage.getItem('gate_token') || ''; } catch (e) { tokenEl.value = params.get('token') || ''; }

  function add(text) {
    logEl.textContent += text + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function tokenQuery() {
    var t = tokenEl.value.trim();
    return t ? '&token=' + encodeURIComponent(t) : '';
  }

  async function step() {
    var res = await fetch('api/step?ts=' + Date.now() + tokenQuery(), { cache: 'no-store' });
    if (res.status === 401) throw new Error('需要 TOKEN：请在上面的输入框填写');
    if (!res.body) throw new Error('浏览器不支持流式读取');
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = '';
    var result = null;
    function handle(line) {
      if (line.indexOf('##RESULT ') === 0) {
        try { result = JSON.parse(line.slice(9)); } catch (e) {}
      } else if (line) {
        add(line);
      }
    }
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });
      var idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        handle(buf.slice(0, idx));
        buf = buf.slice(idx + 1);
      }
    }
    if (buf) handle(buf);
    return result;
  }

  // 连接中断后：不再依赖那条长连接，改为轮询 /status，等服务器自己跑完这一轮
  async function waitServer(startedAt) {
    for (var i = 0; i < 400; i++) {
      await sleep(3000);
      var s;
      try {
        var res = await fetch('status?ts=' + Date.now(), { cache: 'no-store' });
        s = await res.json();
      } catch (e) {
        stateEl.textContent = '查询进度失败，3 秒后重试…';
        continue;
      }
      var p = s.in_progress;
      if (p && p.total) fillEl.style.width = Math.round(p.completed * 100 / p.total) + '%';
      if (s.running) {
        stateEl.textContent = '服务器仍在检测' + (p ? '（' + p.completed + '/' + p.total + '）' : '') + '，等待中…';
        continue;
      }
      var finishedAt = s.last_finished_at ? Date.parse(s.last_finished_at) : 0;
      if (finishedAt >= startedAt && !p) {
        return { done: true, status: s.last_status, message: s.last_message };
      }
      return { done: false, status: 'continue', total: p ? p.total : 0, completed: p ? p.completed : 0 };
    }
    return { done: true, status: 'timeout', message: '等待服务器超时，请稍后查看 /status' };
  }

  async function loop() {
    if (running) return;
    running = true;
    goEl.disabled = true;
    logEl.textContent = '';
    try { localStorage.setItem('gate_token', tokenEl.value.trim()); } catch (e) {}
    var startedAt = Date.now() - 2000;
    var round = 0;
    try {
      for (;;) {
        round++;
        stateEl.textContent = '第 ' + round + ' 轮运行中…';
        var r = null;
        try {
          r = await step();
        } catch (err) {
          if (/TOKEN/.test(err.message)) throw err;
          add('[连接中断] ' + err.message + '，服务器会继续运行，改为查询进度…');
        }
        if (!r) r = await waitServer(startedAt);
        if (r.total) fillEl.style.width = Math.round((r.completed || 0) * 100 / r.total) + '%';
        if (r.status === 'busy') { stateEl.textContent = '另一个检测正在运行，10 秒后重试…'; await sleep(10000); continue; }
        if (r.done) {
          if (r.status === 'published') fillEl.style.width = '100%';
          stateEl.textContent = (r.status === 'published' ? '完成：' : '已结束（' + r.status + '）：') + (r.message || '');
          break;
        }
        stateEl.textContent = '已完成 ' + (r.completed || 0) + '/' + (r.total || '?') + '，继续下一轮…';
        await sleep(800);
      }
    } catch (err) {
      stateEl.textContent = '出错：' + err.message;
      add('[错误] ' + err.message);
    }
    running = false;
    goEl.disabled = false;
  }

  goEl.addEventListener('click', loop);
  if (params.get('auto') === '1') loop();
})();
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// HTTP 入口
// ---------------------------------------------------------------------------
const NO_CACHE = { "cache-control": "no-store" };

function textResponse(body, type, status = 200, extra = {}) {
  return new Response(body, { status, headers: { "content-type": type, ...extra } });
}

function authorized(env, url) {
  const token = envStr(env, "TOKEN");
  return !token || url.searchParams.get("token") === token;
}

async function handleStep(request, env, ctx, url) {
  if (!authorized(env, url)) return textResponse("401 需要 token", "text/plain; charset=utf-8", 401, NO_CACHE);

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const enc = new TextEncoder();
  const emit = (line) => {
    writer.write(enc.encode(line + "\n")).catch(() => {});
  };

  ctx.waitUntil(
    (async () => {
      let result;
      try {
        result = await runStep(env, { emit, origin: url.origin, trigger: "web", force: url.searchParams.get("force") === "1" });
      } catch (e) {
        const message = e && e.message ? e.message : String(e);
        emit(`[失败] ${message}`);
        result = { done: true, status: "error", message };
      }
      emit("##RESULT " + JSON.stringify(result));
      try {
        await writer.close();
      } catch (e) {
        /* ignore */
      }
    })()
  );

  return new Response(readable, {
    headers: { "content-type": "text/plain; charset=utf-8", "x-accel-buffering": "no", ...NO_CACHE },
  });
}

async function handleStatus(env) {
  const store = getKV(env);
  const [state, meta, lock, hasData] = await Promise.all([
    store.get("state", "json"),
    store.get("meta", "json"),
    store.get("lock", "json"),
    store.get("data.json"),
  ]);
  const body = {
    has_data: hasData !== null,
    running: Boolean(lock && lock.until > Date.now()),
    in_progress: state ? { completed: state.results.length, total: state.nodes.length, started_at: new Date(state.startedAt).toISOString() } : null,
    last_status: meta ? meta.lastStatus || null : null,
    last_message: meta ? meta.lastMessage || null : null,
    last_finished_at: meta && meta.lastFinishedAt ? new Date(meta.lastFinishedAt).toISOString() : null,
    summary: meta ? meta.summary || null : null,
    logs: (state && state.logs) || (meta && meta.lastLogs) || [],
  };
  return textResponse(JSON.stringify(body, null, 2), "application/json; charset=utf-8", 200, NO_CACHE);
}


return {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/" || path === "/index.html") {
        return textResponse(INDEX_HTML, "text/html; charset=utf-8", 200, NO_CACHE);
      }
      if (path === "/data.json" || path === "/nodes.txt") {
        const store = getKV(env);
        const key = path.slice(1);
        const value = await store.get(key);
        if (value === null) {
          return textResponse("尚未生成：请先打开 /run 执行一次检测\n", "text/plain; charset=utf-8", 404, NO_CACHE);
        }
        const type = key === "data.json" ? "application/json; charset=utf-8" : "text/plain; charset=utf-8";
        return textResponse(value, type, 200, { "access-control-allow-origin": "*", ...NO_CACHE });
      }
      if (path === "/run") {
        // 页面本身不含机密；TOKEN 只在 /api/step 校验，页面里有输入框
        return textResponse(RUN_HTML, "text/html; charset=utf-8", 200, NO_CACHE);
      }
      if (path === "/api/step") return await handleStep(request, env, ctx, url);
      if (path === "/status") return await handleStatus(env);
      return textResponse("404 Not Found\n", "text/plain; charset=utf-8", 404, NO_CACHE);
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      return textResponse(`配置错误：${message}\n`, "text/plain; charset=utf-8", 500, NO_CACHE);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      scheduledTick(env).catch((e) => {
        console.log("scheduled error:", e && e.message ? e.message : e);
      })
    );
  },
};

})();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    try {
      if (p === '/nodes-clean.txt') return await handleCleanNodesText(env);
      if (p === '/nodes.txt') return await SSTP_SUBSYSTEM.fetch(request, env, ctx);
      if (p === '/data.json' || p === '/run' || p === '/api/step' || p === '/status') {
        return await SSTP_SUBSYSTEM.fetch(request, env, ctx);
      }
      if (p === '/api/servers') return await handleServersApi(request, ctx);
      if (p === '/api/nodes') {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return new Response('仅支持 GET/HEAD 请求', { status: 405, headers: { Allow: 'GET, HEAD' } });
        }
        if (request.method === 'HEAD') return new Response(null, { status: 200, headers: { 'cache-control': 'public, max-age=30', 'access-control-allow-origin': '*' } });
        return await handleUnifiedNodesApi(request, env, ctx);
      }
      if (p === '/sub' || p === '/mihomo' || p === '/clash' || p === '/subscribe') {
        return await handleSubscription(url, ctx);
      }
      if (p === '/' || p === '/index.html') {
        return new Response(HTML_PAGE, {
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
        });
      }
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response('Worker error: ' + (err && err.message ? err.message : String(err)), {
        status: 500,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  },
  async scheduled(event, env, ctx) {
    return SSTP_SUBSYSTEM.scheduled(event, env, ctx);
  },
};


async function handleCleanNodesText(env) {
  const headers={'content-type':'text/plain; charset=utf-8','cache-control':'no-store','access-control-allow-origin':'*'};
  if(!env.GATE_KV)return new Response('GATE_KV 未绑定\\n',{status:503,headers});
  const raw=await env.GATE_KV.get('data.json');if(!raw)return new Response('# 暂无检测数据；请先运行 /run\\n',{status:200,headers});
  let data;try{data=typeof raw==='string'?JSON.parse(raw):raw;}catch(e){return new Response('data.json 格式错误\\n',{status:502,headers});}
  const denied=['is_proxy','is_vpn','is_tor','is_abuser','is_bogon','is_crawler'],rows=[];
  for(const [code,group] of Object.entries(data.countries||{}))for(const n of (group&&Array.isArray(group.nodes)?group.nodes:[])){
    const ex=n&&n.exit||{};if(!n||n.success!==true||n.residential!=='residential'||!n.host||!(Number(n.port)>0)||denied.some(k=>ex[k]===true))continue;
    rows.push({code:String(n.country_code||code).toUpperCase(),country:n.country||group.name||code,host:n.host,port:Number(n.port),latency:Number(n.latency_ms)||Number(n.ping)||999999});
  }
  rows.sort((a,b)=>a.code.localeCompare(b.code)||a.latency-b.latency||a.host.localeCompare(b.host));
  const counts={},lines=rows.map(n=>{counts[n.code]=(counts[n.code]||0)+1;const label=String(n.country).replace(/[#$\\r\\n]/g,'').trim()||n.code;return 'sstp://vpn:vpn@'+n.host+':'+n.port+'#'+encodeURIComponent(label+'-住宅-'+String(counts[n.code]).padStart(2,'0'));});
  return new Response(lines.length?lines.join('\\n')+'\\n':'# 当前没有检测成功且明确识别为住宅/运营商网络的 SSTP 节点\\n',{status:200,headers});
}

// ------------------------------------------------------------
// 上游 VPNGate CSV 拉取 + 边缘缓存
// ------------------------------------------------------------
async function getServers(ctx, force) {
  const hasCache = typeof caches !== 'undefined' && caches.default;
  const cacheKey = new Request('https://vpngate-cache.internal/raw?v=1');
  let stale = null;
  if (hasCache) {
    const hit = await caches.default.match(cacheKey);
    if (hit) {
      if (!force) return { servers: parseVpnGateCsv(await hit.text()), cached: true };
      stale = hit; // 强制刷新时保留旧缓存作为失败兜底
    }
  }
  let text;
  try {
    const upstream = await fetch(VPNGATE_API_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VPNGateSubWorker/2.0)', Accept: 'text/plain,*/*' },
    });
    if (!upstream.ok) throw new Error('HTTP ' + upstream.status);
    text = await upstream.text();
    const parsed = parseVpnGateCsv(text);
    if (!parsed.length) throw new Error('empty');
    if (hasCache) {
      ctx.waitUntil(
        caches.default.put(
          cacheKey,
          new Response(text, { headers: { 'cache-control': 'public, max-age=' + UPSTREAM_TTL } })
        )
      );
    }
    return { servers: parsed, cached: false };
  } catch (err) {
    if (stale) return { servers: parseVpnGateCsv(await stale.text()), cached: true, stale: true };
    throw new Error('vpngate.net 拉取失败(' + (err && err.message) + ')且无可用缓存');
  }
}

// 统一节点 API：OpenVPN 为基础来源，SSTP 为可选来源；任一可选来源故障不阻断基础列表。
async function handleUnifiedNodesApi(request, env, ctx) {
  const u = new URL(request.url);
  const includeSstp = u.searchParams.get('sstp') !== '0';
  // OpenVPN 上游故障不能阻断 SSTP：两类来源独立加载，任一来源可用即可返回统一列表。
  let servers = [];
  let cached = false;
  let openvpnError = null;
  try {
    const upstream = await getServers(ctx, u.searchParams.get('refresh') === '1');
    servers = upstream.servers || [];
    cached = Boolean(upstream.cached);
  } catch (e) {
    openvpnError = e && e.message ? e.message : String(e);
    console.warn('[api/nodes] OpenVPN 来源读取失败，继续返回 SSTP：', openvpnError);
  }
  let sstpRawNodes = [];
  let sstpSource = {
    enabled: includeSstp && Boolean(env.GATE_KV),
    available: false,
    count: 0,
  };

  // SSTP 是可选来源：KV/数据格式异常不能影响 OpenVPN 基础节点。
  if (includeSstp && env.GATE_KV) {
    try {
      const raw = await env.GATE_KV.get('data.json');
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (data && data.countries && typeof data.countries === 'object') {
        for (const [code, group] of Object.entries(data.countries)) {
          for (const n of (group && Array.isArray(group.nodes) ? group.nodes : [])) {
            if (!n || !n.host || !Number(n.port)) continue;
            const exit = n.exit || {};
            sstpRawNodes.push({
              _sourceNode: n,
              _exit: exit,
              ip: exit.ip || n.ip || null,
              host: n.host,
              port: Number(n.port),
              country_code: String(exit.country_code || n.country_code || code).toUpperCase(),
              country: exit.country || n.country || group.name || code,
            });
          }
        }
        sstpSource = {
          enabled: true,
          available: sstpRawNodes.length > 0,
          count: sstpRawNodes.length,
          generated_at: data.generated_at || null,
          ...(sstpRawNodes.length ? {} : { reason: 'SSTP 检测结果中暂无可用节点' }),
        };
      } else {
        sstpSource = { enabled: true, available: false, count: 0, reason: 'SSTP 数据尚未生成或格式无效' };
      }
    } catch (e) {
      console.warn('[api/nodes] SSTP 可选来源读取失败：', e && e.message ? e.message : e);
      sstpSource = { enabled: true, available: false, count: 0, reason: 'SSTP 数据暂时不可用' };
      sstpRawNodes = [];
    }
  } else if (includeSstp) {
    sstpSource.reason = '未配置可选 GATE_KV，已跳过 SSTP 来源';
  }

  // OpenVPN 与 SSTP 出口 IP 共用一次画像流程，避免 SSTP 节点长期只有分类标签而没有 risk/clean。
  const qualityTargets = servers.concat(sstpRawNodes.filter((n) => n.ip));
  try {
    await enrichQuality(qualityTargets, ctx);
  } catch (e) {
    console.warn('[api/nodes] 质量画像增强失败，已降级继续返回节点：', e && e.message ? e.message : e);
    for (const server of qualityTargets) server._q = server._q || null;
  }

  const nodes = servers.map((s) => ({
    id: 'openvpn:' + String(s.ip || s.hostName || ''),
    source: 'vpngate-openvpn',
    protocol: 'openvpn',
    host: s.hostName || s.ip,
    configDataBase64: s.configDataBase64 || '',
    ip: s.ip || null,
    port: null,
    country_code: (s.countryShort || '').toUpperCase(),
    country: s.countryLong || '',
    online: null,
    status: 'source-listed',
    latency_ms: Number.isFinite(Number(s.ping)) && Number(s.ping) > 0 ? Number(s.ping) : null,
    score: Number(s.score) || 0,
    speed_bps: Number(s.speed) || 0,
    sessions: Number(s.numSessions) || 0,
    uptime_seconds: Number(s.uptime) || 0,
    total_users: Number(s.totalUsers) || 0,
    total_traffic: Number(s.totalTraffic) || 0,
    operator: s.operator || '',
    message: s.message || '',
    transport: s.logType || '',
    quality: s._q || null,
    capabilities: { mihomo_openvpn: true, homeproxy: false, v2rayn: false },
    checked_at: null,
  }));

  const sstpNodes = sstpRawNodes.map((s) => {
    const n = s._sourceNode;
    const exit = s._exit;
    const q = s._q || null;
    const networkKind = n.residential || 'unknown';
    let quality = q ? { ...q } : {
      kind: networkKind,
      proxy: null,
      hosting: networkKind === 'datacenter',
      mobile: null,
      clean: null,
      risk: null,
      isp: exit.org || '',
    };

    // SSTP 检测 Worker 的 is_datacenter/运营商分类是独立信号，补入统一风险分；
    // 已确认的住宅 ISP 在非代理、非机房前提下执行风险封顶 10。
    if (q) {
      let risk = Number(q.risk);
      const exitProxy = exit.is_proxy === true || exit.is_vpn === true || exit.is_tor === true;
      if (exitProxy && !q.proxy) {
        risk += 45;
        quality.proxy = true;
      }
      if (networkKind === 'datacenter' && !q.hosting) {
        risk += 25;
        quality.hosting = true;
      }
      if (exit.is_mobile === true && !q.mobile) {
        risk = Math.max(0, risk - 20);
        quality.mobile = true;
      }
      if (networkKind === 'residential' && !quality.proxy && !quality.hosting) {
        risk = Math.min(risk, 10);
      }
      risk = Math.max(0, Math.min(100, risk));
      quality.risk = risk;
      quality.clean = 100 - risk;
      quality.grade = quality.clean < 50 ? 'risk' : quality.clean < 80 ? 'mid' : 'clean';
      if (!quality.isp) quality.isp = exit.org || '';
    }

    return {
      id: 'sstp:' + String(s.host).toLowerCase() + ':' + s.port,
      source: 'vpngate-sstp',
      protocol: 'sstp',
      host: s.host,
      ip: s.ip,
      port: s.port,
      country_code: s.country_code,
      country: s.country,
      online: n.success === true,
      residentialClass: n.residential || 'unknown',
      privacyFlags: ['is_proxy','is_vpn','is_tor','is_abuser','is_bogon','is_crawler'].filter((key) => exit[key] === true),
      checked_at: n.checked_at || null,
      latency_ms: n.latency_ms != null && Number.isFinite(Number(n.latency_ms)) ? Number(n.latency_ms) : (n.ping != null && Number.isFinite(Number(n.ping)) ? Number(n.ping) : null),
      score: Number(n.score) || 0,
      speed_bps: null,
      sessions: null,
      uptime_seconds: null,
      total_users: null,
      total_traffic: null,
      operator: exit.org || '',
      message: n.error || '',
      transport: 'TCP',
      quality,
      capabilities: { mihomo_openvpn: false, homeproxy: false, v2rayn: false, sstp_client_required: true },
      checked_at: null,
    };
  });
  nodes.push(...sstpNodes);

  return jsonResponse({
    schema_version: 1,
    updated_at: new Date().toISOString(),
    count: nodes.length,
    sources: {
      openvpn: {
        enabled: true,
        available: servers.length > 0,
        cached,
        count: servers.length,
        ...(openvpnError ? { reason: openvpnError } : {}),
      },
      sstp: { ...sstpSource, count: sstpNodes.length },
    },
    nodes,
  }, 200, 30);
}

async function handleServersApi(request, ctx) {
  const u = new URL(request.url);
  const { servers, cached } = await getServers(ctx, u.searchParams.get('refresh') === '1');
  // 附带 IP 纯净度/风险画像(一次批量 + 长缓存; 质量源故障时自动降级为 null, 不影响列表)
  try { await enrichQuality(servers, ctx); } catch (e) {}
  const out = servers.map((s) => {
    const o = Object.assign({}, s);
    o.quality = s._q || null;
    delete o._q;
    return o;
  });
  return jsonResponse(
    { error: false, updatedAt: new Date().toISOString(), cached, count: out.length, servers: out },
    200,
    60
  );
}

// ------------------------------------------------------------
// IP 纯净度 / 风险(欺诈)画像
//   主源 ip-api.com 批量接口(免 key): proxy/hosting/mobile/isp/asn/type
//   risk 0-100 越高越"脏", clean=100-risk 即纯净度; grade: clean/mid/risk
//   Scamalytics 有 Cloudflare 反爬, 云端无法稳定自动抓取,
//   故用业界通用的代理/机房/ASN 多信号合成可解释的风险(欺诈)分, 并长缓存
// ------------------------------------------------------------
const QUALITY_TTL_MS = 6 * 3600 * 1000; // IP 风险属性变化慢, 缓存 6 小时
const qualityMem = new Map();           // isolate 级内存缓存 ip -> {t, q}
const HOSTING_KEYWORDS = /(vpn|proxy|softether|hosting|datacenter|data.?center|cloud|vps|colocation|m247|digitalocean|ovh|hetzner|choopa|vultr|linode|amazon|aws|google|microsoft|azure|oracle|alibaba|tencent|quadranet|reliablesite|psychz|netcup|contabo|leaseweb|nforce|server|servers?)/i;

function assessQuality(r) {
  if (!r) return null;
  const proxy = r.proxy === true;
  const hosting = r.hosting === true;
  const mobile = r.mobile === true;
  const kind = String(r.type || '').toLowerCase();
  const orgText = [r.isp, r.org, r.as, r.asname, r.type].filter(Boolean).join(' ');
  let risk = 0;
  if (proxy) risk += 45;                 // 已知匿名代理/VPN 出口
  if (hosting) risk += 25;               // 机房/数据中心
  if (kind === 'business') risk += 6;
  if (HOSTING_KEYWORDS.test(orgText)) risk += 15; // ISP/ORG/AS 命中托管或 VPN 关键词
  if (mobile) risk = Math.max(0, risk - 20);      // 移动网络风险减 20
  // 普通住宅/运营商 ISP 仅在未命中代理、机房时封顶风险 10；不将其直接视为 100 分。
  const ordinaryIsp = (kind === 'isp' || kind === 'residential') && !proxy && !hosting;
  if (ordinaryIsp) risk = Math.min(risk, 10);
  risk = Math.max(0, Math.min(100, risk));
  const clean = 100 - risk;
  let grade = 'clean';
  if (clean < 50) grade = 'risk';
  else if (clean < 80) grade = 'mid';
  return { proxy, hosting, mobile, kind: kind || 'unknown', isp: r.isp || r.org || r.as || '', risk, clean, grade };
}

async function batchIpaQuality(ips) {
  // ip-api 批量接口一次最多 100 个; 免费版仅 http(Worker 可发起 http 子请求), 15 次/分
  const out = new Map();
  for (let i = 0; i < ips.length; i += 100) {
    const chunk = ips.slice(i, i + 100);
    try {
      const resp = await fetch('http://ip-api.com/batch?fields=query,countryCode,isp,org,as,asname,type,mobile,proxy,hosting', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'User-Agent': 'VPNGateSub/2.1' },
        body: JSON.stringify(chunk.map((ip) => ({ query: ip }))),
      });
      if (!resp.ok) continue;
      const rows = await resp.json();
      for (const r of rows) if (r && r.query) out.set(r.query, assessQuality(r));
    } catch (e) { /* 单批失败忽略, 该批质量降级为 null */ }
  }
  return out;
}

async function enrichQuality(servers, ctx) {
  const now = Date.now();
  const need = [];
  for (const s of servers) {
    const c = qualityMem.get(s.ip);
    if (!c || now - c.t > QUALITY_TTL_MS) need.push(s.ip);
  }
  if (need.length) {
    const got = await batchIpaQuality([...new Set(need)]);
    for (const ip of need) qualityMem.set(ip, { t: now, q: got.get(ip) || null });
  }
  for (const s of servers) s._q = (qualityMem.get(s.ip) || {}).q || null;
  try { await loadScamCache(); await enrichScam(servers, ctx); } catch (e) {}
  return servers;
}

// ------------------------------------------------------------
// Scamalytics 欺诈分(2026-09-10 实测 Worker 直连可达,无403):
//   仅对 ip-api 预筛后的头部候选做增量抓取,单请求子请求预算内(免费版50,留余量),
//   isolate 内存 + 边缘缓存 24h;score>=75 一票否决,50-74 重罚,25-49 中罚
// ------------------------------------------------------------
const SCAM_TTL_MS = 24 * 3600 * 1000;
const SCAM_FETCH_BATCH = 5;   // 并发
const SCAM_MAX_NEW = 28;      // 单次请求最多新抓的 IP 数
const scamMem = new Map();    // ip -> {t, score|null}

async function fetchScamScore(ip) {
  try {
    const r = await fetch('https://scamalytics.com/ip/' + ip, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36' },
    });
    if (!r.ok) return null;
    const t = await r.text();
    const m = t.match(/Fraud Score[^0-9]{0,40}([0-9]{1,3})/);
    const v = m ? parseInt(m[1], 10) : null;
    return v === null || isNaN(v) ? null : Math.min(100, v);
  } catch (e) { return null; }
}

async function enrichScam(servers, ctx) {
  const now = Date.now();
  const cands = servers
    .filter((s) => s._q && s._q.risk < 90)
    .sort((a, b) => a._q.risk - b._q.risk)
    .slice(0, 30);
  const need = [];
  for (const s of cands) {
    const c = scamMem.get(s.ip);
    if (!c || now - c.t > SCAM_TTL_MS) need.push(s.ip);
  }
  const budget = need.slice(0, SCAM_MAX_NEW);
  for (let i = 0; i < budget.length; i += SCAM_FETCH_BATCH) {
    const chunk = budget.slice(i, i + SCAM_FETCH_BATCH);
    const rs = await Promise.all(chunk.map((ip) => fetchScamScore(ip)));
    for (let j = 0; j < chunk.length; j++) {
      if (rs[j] !== null) scamMem.set(chunk[j], { t: now, score: rs[j] });
      else scamMem.set(chunk[j], { t: now - SCAM_TTL_MS / 2, score: null }); // 失败半期后重试
    }
  }
  for (const s of servers) {
    const c = scamMem.get(s.ip);
    if (!c || c.score === null || c.score === undefined || !s._q) continue;
    const scam = c.score;
    s._q.scam = scam;
    let risk = s._q.risk;
    if (scam >= 75) risk = Math.max(risk, 90);
    else if (scam >= 50) risk = Math.max(risk, 65);
    else if (scam >= 25) risk = Math.max(risk, 45);
    s._q.risk = Math.max(0, Math.min(100, risk));
    s._q.clean = 100 - s._q.risk;
    s._q.grade = s._q.clean < 50 ? 'risk' : s._q.clean < 80 ? 'mid' : 'clean';
  }
  if (ctx && typeof caches !== 'undefined' && caches.default && budget.length) {
    try {
      const dump = {};
      for (const [ip, c] of scamMem) dump[ip] = c;
      ctx.waitUntil(caches.default.put(
        new Request('https://vpngate-cache.internal/scam?v=1'),
        new Response(JSON.stringify(dump), { headers: { 'cache-control': 'public, max-age=86400' } })
      ));
    } catch (e) {}
  }
}

async function loadScamCache() {
  if (typeof caches === 'undefined' || !caches.default) return;
  try {
    const hit = await caches.default.match(new Request('https://vpngate-cache.internal/scam?v=1'));
    if (hit) {
      const dump = await hit.json();
      const now = Date.now();
      for (const ip of Object.keys(dump)) {
        const c = dump[ip];
        if (c && c.t && now - c.t < SCAM_TTL_MS && !scamMem.has(ip)) scamMem.set(ip, c);
      }
    }
  } catch (e) {}
}
const qRisk = (s) => (s && s._q ? s._q.risk : 999); // 无质量数据的排最后
const qGradeCN = (g) => (g === 'clean' ? '干净' : g === 'mid' ? '中等' : '高风险');

// ------------------------------------------------------------
// 自动优选订阅
// ------------------------------------------------------------
async function handleSubscription(url, ctx) {
  const q = url.searchParams;
  const mode = (q.get('mode') || '').trim().toLowerCase();
  if (mode === 'merged' || q.get('merge') === '1') return await handleMergedSubscription(q, ctx, false);
  if (mode === 'self') return await handleMergedSubscription(q, ctx, true);
  const opts = {
    n: clampInt(q.get('n'), 1, 30, 8),
    cc: (q.get('cc') || '').trim().toUpperCase(),
    proto: (q.get('proto') || 'tcp').trim().toLowerCase(), // 默认 tcp，更稳；udp / any
    sort: (q.get('sort') || 'score').trim().toLowerCase(),
    minSpeed: clampInt(q.get('min'), 0, 100000, 3) * 1e6, // 默认 ≥3Mbps
    group: q.get('name') || 'VPNGate',
    clean: q.get('clean') === '1',                        // 纯净模式: 只留非代理/非机房低风险 IP
    maxRisk: (() => { const v = clampInt(q.get('maxrisk'), 0, 100, -1); return v; })(),
  };
  const { servers, cached } = await getServers(ctx, q.get('refresh') === '1');
  await enrichQuality(servers, ctx);
  const picked = pickBest(servers, opts);
  if (!picked.length) {
    return new Response('# 当前没有符合条件的 VPNGate 节点，请稍后重试或放宽参数（如 ?proto=any&min=0，纯净模式无节点时去掉 clean=1）', {
      status: 502,
      headers: yamlHeaders(0),
    });
  }
  const yaml = buildMihomoSubscription(picked, opts);
  const qualityDesc = opts.clean
    ? `纯净模式=开(仅非代理/非机房/clean≥50${opts.maxRisk >= 0 ? ' 且 risk≤' + opts.maxRisk : ''})`
    : (opts.maxRisk >= 0 ? `风险上限=risk≤${opts.maxRisk}` : '纯净模式=关(速度优先,标注风险)');
  const headerNote =
    `# VPNGate 实时优选订阅（Cloudflare Worker 生成）\n` +
    `# 生成时间(UTC): ${new Date().toISOString()}  上游缓存: ${cached ? '命中' : '最新拉取'}\n` +
    `# 筛选: 国家=${opts.cc || '全球'} 协议=${opts.proto} 数量=${opts.n} 排序=${opts.sort} 最低=${opts.minSpeed / 1e6}Mbps  ${qualityDesc}\n` +
    `# 纯净度=100-风险分(代理/机房/ASN多信号合成); 想要更干净的出口加 clean=1\n` +
    `# 入选 ${picked.length} 个节点；客户端(Mihomo/ClashMeta内核)会在其中自动测速选最快\n\n`;
  return new Response(headerNote + yaml, { status: 200, headers: yamlHeaders(120) });
}

function yamlHeaders(ttl) {
  return {
    'content-type': 'text/yaml; charset=utf-8',
    'cache-control': 'public, max-age=' + ttl,
    'profile-update-interval': '12',
    'content-disposition': "attachment; filename*=utf-8''vpngate.yaml",
    'access-control-allow-origin': '*',
  };
}

// 综合优选：质量过滤 -> 过滤 -> 解析校验 -> 排序 -> IP 去重 -> 取前 N
function pickBest(servers, opts) {
  const ok = [];
  for (const s of servers) {
    if (opts.cc && (s.countryShort || '').toUpperCase() !== opts.cc) continue;
    if (s.speed && s.speed < opts.minSpeed) continue;
    // 纯净度/风险过滤
    const q = s._q;
    if (opts.clean) {
      // 纯净模式: 质量数据缺失时保守跳过; 必须非代理、非机房、clean≥50
      if (!q || q.proxy || q.hosting || q.clean < 50) continue;
    }
    if (opts.maxRisk >= 0) {
      if (!q || q.risk > opts.maxRisk) continue;
    }
    let parsed;
    try {
      parsed = parseOvpnConfig(b64Utf8(s.configDataBase64));
    } catch (e) {
      continue;
    }
    if (!parsed.ca) continue; // mihomo openvpn 必须有 CA
    const proto = parsed.proto || 'udp';
    if (opts.proto !== 'any' && proto !== opts.proto) continue;
    s._p = parsed;
    ok.push(s);
  }
  const pingV = (x) => (x.ping && x.ping > 0 ? x.ping : 99999);
  ok.sort((a, b) => {
    // 纯净优先: 风险升序, 同分再比综合分/延迟/速度
    if (opts.sort === 'clean') {
      return qRisk(a) - qRisk(b) || b.score - a.score || pingV(a) - pingV(b) || b.speed - a.speed;
    }
    if (opts.sort === 'speed') return b.speed - a.speed || qRisk(a) - qRisk(b) || pingV(a) - pingV(b) || b.score - a.score;
    if (opts.sort === 'ping') return pingV(a) - pingV(b) || qRisk(a) - qRisk(b) || b.score - a.score;
    // 默认 score 综合分; 同档时风险更低者优先
    return b.score - a.score || qRisk(a) - qRisk(b) || pingV(a) - pingV(b) || b.speed - a.speed;
  });
  const seen = new Set();
  const out = [];
  for (const s of ok) {
    if (seen.has(s.ip)) continue;
    seen.add(s.ip);
    out.push(s);
    if (out.length >= opts.n) break;
  }
  return out;
}

// ------------------------------------------------------------
// 合并订阅: 1 个自建日本承载落地(VLESS) + 非 JP 每个国家各 1 个 L1 宽松优选
// ------------------------------------------------------------
async function handleMergedSubscription(q, ctx, selfOnly) {
  const opts = {
    proto: (q.get('proto') || 'tcp').trim().toLowerCase(), // 其他国家优先协议, 默认 tcp; any=不限
    minSpeed: clampInt(q.get('min'), 0, 100000, OTHER_MIN_SPEED) * 1e6,
    maxPing: clampInt(q.get('maxping'), 0, 100000, OTHER_MAX_PING),
    group: q.get('name') || 'VPNGate',
  };
  let others = [], cached = false, ccList = '';
  if (!selfOnly) {
    // merged: 日本自建 + 非 JP 每国 L1 优选
    const got = await getServers(ctx, q.get('refresh') === '1');
    cached = got.cached;
    await enrichQuality(got.servers, ctx);
    others = pickPerCountry(got.servers, opts);
    if (!others.length) {
      return new Response('# 当前没有符合条件的非日本 VPNGate 节点，请稍后重试，或放宽参数（如 ?proto=any&min=0&maxping=500）', {
        status: 502,
        headers: yamlHeaders(0),
      });
    }
    ccList = others.map((s) => s._cc).join(',');
  }
  // selfOnly: 仅日本自建 VLESS, 不依赖 vpngate 上游, 最稳、兼容性最好
  const yaml = buildMergedSubscription(SELF_JP_NODE, others, opts);
  const headerNote = selfOnly
    ? `# VPNGate 日本自建承载落地订阅（Cloudflare Worker 生成）\n` +
      `# 生成时间(UTC): ${new Date().toISOString()}\n` +
      `# 仅含 1 个自建 VLESS-Reality 节点(出口=VPS 本机承载 IP), 不依赖公共节点池, 用于最稳接入/客户端导入自检\n\n`
    : `# VPNGate 全球合并优选订阅（Cloudflare Worker 生成）\n` +
      `# 生成时间(UTC): ${new Date().toISOString()}  上游缓存: ${cached ? '命中' : '最新拉取'}\n` +
      `# 结构: 日本=1 个自建 VLESS 承载落地(VPS 本机 IP 出口); 其余 ${others.length} 国各 1 个 L1 宽松优选\n` +
      `# L1 宽松口径: 允许机房/已知代理、画像缺失不剔除, 仅剔除有画像且 clean<${L1_MIN_CLEAN} 的极脏节点; 国内按 综合分→延迟→速度→风险 择优, 优先 ${opts.proto === 'any' ? '任意' : opts.proto} 协议(无则回退)\n` +
      `# 其他国家(${others.length}): ${ccList}\n` +
      `# 客户端在 VPNGate-Auto 组内自动测速选最快; 也可在选择组手动固定「日本自建」或某个国家\n\n`;
  return new Response(headerNote + yaml, { status: 200, headers: yamlHeaders(selfOnly ? 300 : 120) });
}

// 非 JP 每国择优(L1): 硬门槛(速度/延迟/配置完整/极脏) -> 全局择优排序 -> 每国取 1(优先指定协议) -> 国家排序截断
function pickPerCountry(servers, opts) {
  const pingV = (x) => (x.ping && x.ping > 0 ? x.ping : 99999);
  const riskV = (x) => (x._q ? x._q.risk : 50); // 无画像按中性风险, 不因其缺失而被歧视
  const ok = [];
  for (const s of servers) {
    const cc = (s.countryShort || '').toUpperCase();
    if (!cc || cc === 'JP') continue;                 // 日本走自建节点, 不取公共池
    if (s.speed && s.speed < opts.minSpeed) continue; // 速度门槛
    if (s.ping && s.ping > 0 && s.ping > opts.maxPing) continue; // 延迟门槛
    let parsed;
    try { parsed = parseOvpnConfig(b64Utf8(s.configDataBase64)); } catch (e) { continue; }
    if (!parsed.ca) continue;                         // mihomo openvpn 必须有 CA
    const q = s._q;
    if (q && q.clean < L1_MIN_CLEAN) continue;        // L1: 仅踢极脏; 无画像/机房/代理均保留
    s._p = parsed;
    s._cc = cc;
    ok.push(s);
  }
  // 全局择优: 综合分↓ -> 延迟↑ -> 速度↓ -> 风险↑(同档更干净者优先)
  ok.sort((a, b) => b.score - a.score || pingV(a) - pingV(b) || b.speed - a.speed || riskV(a) - riskV(b));
  const preferred = new Map(); // cc -> 协议匹配的最优
  const fallback = new Map();  // cc -> 任意协议兜底
  const seenIp = new Set();
  for (const s of ok) {
    if (seenIp.has(s.ip)) continue;
    const cc = s._cc;
    const proto = s._p.proto || 'udp';
    if (!fallback.has(cc)) { fallback.set(cc, s); seenIp.add(s.ip); }
    if ((opts.proto === 'any' || proto === opts.proto) && !preferred.has(cc)) preferred.set(cc, s);
  }
  const chosen = [];
  for (const [cc, fb] of fallback) chosen.push(preferred.get(cc) || fb);
  // 国家之间排序: 选中节点综合分↓ -> 速度↓ -> 延迟↑
  chosen.sort((a, b) => b.score - a.score || b.speed - a.speed || pingV(a) - pingV(b));
  return chosen.slice(0, PER_COUNTRY_MAX);
}

// 自建日本承载落地节点的 Mihomo VLESS-Reality 段
function selfVlessYaml(n) {
  const L = [];
  L.push(`  - name: ${yq(n.name)}`);
  L.push(`    type: vless`);
  L.push(`    server: ${scrubHost(n.server)}`);
  L.push(`    port: ${scrubNum(n.port, 443)}`);
  L.push(`    uuid: ${scrub(n.uuid, 64)}`);
  L.push(`    network: ${scrub(n.network || 'tcp', 8)}`);
  L.push(`    tls: true`);
  L.push(`    udp: true`);
  L.push(`    flow: ${scrub(n.flow, 40)}`);
  L.push(`    servername: ${scrub(n.sni, 80)}`);
  L.push(`    reality-opts:`);
  L.push(`      public-key: ${scrub(n.pbk, 64)}`);
  L.push(`      short-id: ${scrub(n.sid, 32)}`);
  L.push(`    client-fingerprint: ${scrub(n.fp || 'chrome', 16)}`);
  return L.join('\n');
}

// 合并订阅完整 Mihomo 配置: proxies=[自建日本 VLESS, ...每国 OpenVPN], Auto 自动测速 + 手动选择组
function buildMergedSubscription(self, others, opts) {
  const g = scrub(opts.group || 'VPNGate', 40) || 'VPNGate';
  const auto = 'VPNGate-Auto';
  const proxies = [selfVlessYaml(self), ...others.map(proxyYaml)].join('\n');
  const allNames = [self.name, ...others.map(nodeName)];
  const nameList = allNames.map(yq).join(', ');
  return [
    'mixed-port: 7890',
    'allow-lan: false',
    'bind-address: "*"',
    'mode: rule',
    'log-level: info',
    'ipv6: false',
    'unified-delay: true',
    'tcp-concurrent: true',
    'find-process-mode: off',
    'proxies:',
    proxies,
    'proxy-groups:',
    `  - name: ${yq(auto)}`,
    '    type: url-test',
    '    url: http://www.gstatic.com/generate_204',
    '    interval: 300',
    '    tolerance: 120',
    `    proxies: [${nameList}]`,
    `  - name: ${yq(g)}`,
    '    type: select',
    `    proxies: [${yq(auto)}, ${nameList}, "DIRECT"]`,
    'rules:',
    '  - GEOIP,LAN,DIRECT,no-resolve',
    '  - GEOIP,CN,DIRECT',
    `  - MATCH,${g}`,
    '',
  ].join('\n');
}

// ------------------------------------------------------------
// Mihomo(Clash Meta) 完整订阅生成，type: openvpn
// ------------------------------------------------------------
function nodeName(s, i) {
  return `VG-${s.countryShort || 'UN'}-${s.ip}`;
}
function yq(str) {
  return '"' + String(str == null ? '' : str).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}
// 清洗来自第三方(VPNGate/ip-api/用户参数)的自由文本：去控制字符(含换行)、折叠空白、限长，防止 YAML 断行注入
function scrub(v, n = 80) {
  return String(v == null ? '' : v).replace(/[\x00-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
}
// 仅保留主机名/IP 合法字符
function scrubHost(v) {
  return String(v == null ? '' : v).replace(/[^A-Za-z0-9._:\-]/g, '').slice(0, 253);
}
// 仅保留数字（端口/数值类指令），非法时回退默认值
function scrubNum(v, d) {
  const m = String(v == null ? '' : v).match(/\d+/);
  return m ? m[0] : d;
}
function block(value, indent) {
  const pad = ' '.repeat(indent);
  return String(value).replace(/\r\n/g, '\n').split('\n').map((l) => pad + l).join('\n');
}
function proxyYaml(s) {
  const p = s._p;
  const L = [];
  const q = s._q;
  const qNote = q
    ? ` 纯净度${q.clean}/风险${q.risk}(${qGradeCN(q.grade)}${q.proxy ? ',代理' : ''}${q.hosting ? ',机房' : ''}${q.mobile ? ',移动' : ''}; ${scrub(q.isp, 60)})`
    : ' 纯净度未知';
  L.push(`  - name: ${yq(nodeName(s))}`);
  L.push(`    type: openvpn`);
  L.push(`    server: ${scrubHost(p.remoteHost || s.ip)}`);
  L.push(`    port: ${scrubNum(p.remotePort, 1194)}`);
  L.push(`    proto: ${p.proto === 'tcp' ? 'tcp' : 'udp'}`);
  L.push(`    udp: true`);
  L.push(`    # score=${s.score} ping=${s.ping}ms speed=${(s.speed / 1e6).toFixed(1)}Mbps uptime_min=${Math.round(s.uptime / 60000)} country=${s.countryShort};${qNote}`);
  if (p.cipher) L.push(`    cipher: ${scrub(p.cipher, 40)}`);
  if (p.auth) L.push(`    auth: ${scrub(p.auth, 20)}`);
  if (p.ca) {
    L.push(`    ca: |`);
    L.push(block(p.ca, 6));
  }
  if (p.cert) {
    L.push(`    cert: |`);
    L.push(block(p.cert, 6));
  }
  if (p.key) {
    L.push(`    key: |`);
    L.push(block(p.key, 6));
  }
  if (p.tlsCrypt) {
    L.push(`    tls-crypt: |`);
    L.push(block(p.tlsCrypt, 6));
  } else if (p.tlsAuth) {
    L.push(`    tls-crypt: |`);
    L.push(block(p.tlsAuth, 6));
  }
  if (p.compLzo) L.push(`    comp-lzo: ${/^(yes|no|adaptive)$/i.test(p.compLzo) ? scrub(p.compLzo,10) : 'yes'}`);
  if (p.mtu) L.push(`    mtu: ${scrubNum(p.mtu, 1500)}`);
  if (p.ping) L.push(`    ping: ${scrubNum(p.ping, 10)}`);
  if (p.pingRestart) L.push(`    ping-restart: ${scrubNum(p.pingRestart, 60)}`);
  return L.join('\n');
}
function buildMihomoSubscription(list, opts) {
  const names = list.map(nodeName);
  const auto = 'VPNGate-Auto';
  const g = scrub(opts.group || 'VPNGate', 40) || 'VPNGate';
  const sel = yq(g);
  const proxies = list.map(proxyYaml).join('\n');
  const nameList = names.map(yq).join(', ');
  return [
    'mixed-port: 7890',
    'allow-lan: false',
    'bind-address: "*"',
    'mode: rule',
    'log-level: info',
    'ipv6: false',
    'unified-delay: true',
    'tcp-concurrent: true',
    'find-process-mode: off',
    'proxies:',
    proxies,
    'proxy-groups:',
    `  - name: ${yq(auto)}`,
    '    type: url-test',
    '    url: http://www.gstatic.com/generate_204',
    '    interval: 300',
    '    tolerance: 120',
    `    proxies: [${nameList}]`,
    `  - name: ${sel}`,
    '    type: select',
    `    proxies: [${yq(auto)}, ${nameList}, "DIRECT"]`,
    'rules:',
    '  - GEOIP,LAN,DIRECT,no-resolve',
    '  - GEOIP,CN,DIRECT',
    `  - MATCH,${g}`,
    '',
  ].join('\n');
}

// ------------------------------------------------------------
// OpenVPN 配置解析（移植自原项目 page.html，Worker 端可用）
// ------------------------------------------------------------
function parseOvpnConfig(raw) {
  const lines = raw.split(/\r\n|\r|\n/);
  const r = {
    remoteHost: null, remotePort: null, proto: null,
    cipher: null, auth: null, compLzo: null, dev: null,
    ca: null, cert: null, key: null, tlsCrypt: null, tlsAuth: null,
    keyDirection: null, authUserPass: false, mtu: null, ping: null, pingRestart: null,
  };
  let block = null;
  let blockLines = [];
  const tagMap = {
    '<ca>': 'ca', '</ca>': 'ca',
    '<cert>': 'cert', '</cert>': 'cert',
    '<key>': 'key', '</key>': 'key',
    '<tls-crypt>': 'tlsCrypt', '</tls-crypt>': 'tlsCrypt',
    '<tls-auth>': 'tlsAuth', '</tls-auth>': 'tlsAuth',
  };
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (Object.prototype.hasOwnProperty.call(tagMap, trimmed)) {
      const close = trimmed.indexOf('</') === 0;
      const k = tagMap[trimmed];
      if (!close) { block = k; blockLines = []; }
      else { r[k] = blockLines.join('\n').trim(); block = null; }
      continue;
    }
    if (block) { blockLines.push(rawLine.replace(/\r$/, '')); continue; }
    if (!trimmed || trimmed.charAt(0) === '#' || trimmed.charAt(0) === ';') continue;
    const si = trimmed.indexOf(' ');
    const dir = (si === -1 ? trimmed : trimmed.slice(0, si)).toLowerCase();
    const args = si === -1 ? '' : trimmed.slice(si + 1).trim();
    switch (dir) {
      case 'remote': {
        const p = args.split(/\s+/);
        r.remoteHost = p[0];
        if (p[1]) r.remotePort = p[1];
        break;
      }
      case 'proto':
        if (args.toLowerCase().indexOf('tcp') === 0) r.proto = 'tcp';
        else if (args.toLowerCase().indexOf('udp') === 0) r.proto = 'udp';
        break;
      case 'port':
        if (!r.remotePort) r.remotePort = args.trim();
        break;
      case 'cipher': r.cipher = args.trim(); break;
      case 'data-ciphers': if (!r.cipher) r.cipher = args.split(':')[0].trim(); break;
      case 'auth': r.auth = args.trim(); break;
      case 'comp-lzo': r.compLzo = args.trim() || 'yes'; break;
      case 'dev':
      case 'dev-type':
        if (args.toLowerCase().indexOf('tun') === 0) r.dev = 'tun';
        else if (args.toLowerCase().indexOf('tap') === 0) r.dev = 'tap';
        break;
      case 'key-direction': r.keyDirection = args.trim(); break;
      case 'auth-user-pass': r.authUserPass = true; break;
      case 'tun-mtu':
      case 'link-mtu': if (!r.mtu) r.mtu = args.trim(); break;
      case 'ping': r.ping = args.trim(); break;
      case 'ping-restart': r.pingRestart = args.trim(); break;
      case 'keepalive': {
        const p = args.split(/\s+/);
        if (p[0]) r.ping = p[0];
        if (p[1]) r.pingRestart = p[1];
        break;
      }
      default: break;
    }
  }
  return r;
}

// ------------------------------------------------------------
// VPNGate CSV 解析（沿用原项目稳健策略：前13固定 + 末尾base64）
// ------------------------------------------------------------
function parseVpnGateCsv(text) {
  const out = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.charAt(0) === '*' || line.charAt(0) === '#') continue;
    const parts = rawLine.split(',');
    if (parts.length < 15) continue;
    const num = (x) => Number(x) || 0;
    out.push({
      hostName: parts[0],
      ip: parts[1],
      score: num(parts[2]),
      ping: num(parts[3]),
      speed: num(parts[4]),
      countryLong: parts[5],
      countryShort: parts[6],
      numSessions: num(parts[7]),
      uptime: num(parts[8]),
      totalUsers: num(parts[9]),
      totalTraffic: num(parts[10]),
      logType: parts[11],
      operator: parts[12],
      message: parts.slice(13, parts.length - 1).join(','),
      configDataBase64: parts[parts.length - 1].trim(),
    });
  }
  return out;
}

// base64 -> UTF-8 字符串（Worker 运行时）
function b64Utf8(b64) {
  const clean = String(b64).replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8').decode(bytes);
}
function clampInt(v, lo, hi, dft) {
  const n = parseInt(v, 10);
  if (isNaN(n)) return dft;
  return Math.max(lo, Math.min(hi, n));
}
function jsonResponse(obj, status, ttl) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': ttl ? 'public, max-age=' + ttl : 'no-store',
    },
  });
}
