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
 *   /nodes.txt   原始订阅文件（保持原行为）
 *   /nodes-clean.txt   纯净出口订阅（支持 ?maxrisk=0..100）
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

// 检测 Worker 默认域名；可用 CHECK_WORKER 覆盖。DOMAIN 仅用于主站域名。
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
    throw new ConfigError("未配置检测 Worker 地址。请设置环境变量 CHECK_WORKER（例如 https://check.boxo.eu.org/check?sstp=vpn:vpn@）。");
  }
  const lowered = value.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((m) => lowered.includes(m.toLowerCase()))) {
    throw new ConfigError("检测地址仍是占位符。请把环境变量 CHECK_WORKER 设成真实的检测 Worker 地址。");
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
  const rawWorker = envStr(
    env,
    "CHECK_WORKER",
    `https://${DEFAULT_DOMAIN}/check?sstp=vpn:vpn@`
  );
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
function classifyNetwork(org, isDatacenter) {
  if (isDatacenter === true) return "datacenter";
  if (isDatacenter === false) return "residential";
  const upper = (org || "").toUpperCase();
  if (upper) {
    if (DATA_CENTER_ORG_KEYWORDS.some((k) => upper.includes(k))) return "datacenter";
    if (RESIDENTIAL_ORG_KEYWORDS.some((k) => upper.includes(k))) return "residential";
  }
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
      };
      result.residential = classifyNetwork(org, exitInfo.is_datacenter);
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
// 出口 IP 纯净度画像（移植自 worker/worker.js；画像目标为检测结果 exit.ip）
// ---------------------------------------------------------------------------
const QUALITY_TTL_SECONDS = 21600;
const QUALITY_BATCH_SIZE = 100;
const QUALITY_MAX_BATCHES = 15;
const HOSTING_KEYWORDS = /\b(vps|hosting|hosted|datacenter|data center|cloud|cloud compute|server|colo|colocation|dedicated|digital ocean|amazon|aws|google cloud|azure|ovh|hetzner|vultr|linode|leaseweb|contabo|choopa|m247|online sas|oracle cloud|腾讯云|阿里云|华为云|机房|云计算|服务器)\b/i;

function assessGateQuality(r) {
  if (!r) return null;
  const proxy = r.proxy === true, hosting = r.hosting === true, mobile = r.mobile === true;
  const kind = String(r.type || "").toLowerCase();
  const orgText = [r.isp, r.org, r.as, r.asname, r.type].filter(Boolean).join(" ");
  let risk = 0;
  if (proxy) risk += 45;
  if (hosting) risk += 25;
  if (kind === "business") risk += 6;
  if (HOSTING_KEYWORDS.test(orgText)) risk += 15;
  if (mobile) risk = Math.max(0, risk - 20);
  if (kind === "isp" && !proxy && !hosting) risk = Math.min(risk, 10);
  risk = Math.max(0, Math.min(100, risk));
  const clean = 100 - risk;
  return { proxy, hosting, mobile, kind: kind || "unknown", isp: r.isp || r.org || r.as || "",
    risk, clean, grade: clean < 50 ? "risk" : clean < 80 ? "mid" : "clean",
    country_code: r.countryCode || null, source: "ip-api.com", checked_at: Date.now() };
}

async function enrichGateExitQuality(results, store, budget, log) {
  const targets = new Map();
  for (const node of results) {
    const ip = node && node.success && node.exit && node.exit.ip ? String(node.exit.ip).trim() : "";
    if (!ip) continue;
    if (!targets.has(ip)) targets.set(ip, []);
    targets.get(ip).push(node);
  }
  if (!targets.size) {
    log("IP QUALITY", "没有有效出口 IP，跳过纯净度画像");
    return { checked: 0, cached: 0, failed: 0 };
  }
  const qualityByIp = new Map();
  let cached = 0, failed = 0;
  const ips = [...targets.keys()];
  for (const ip of ips) {
    try {
      const saved = await store.get("quality:" + encodeURIComponent(ip), "json");
      if (saved && typeof saved.risk === "number" && Date.now() - (saved.checked_at || 0) < QUALITY_TTL_SECONDS * 1000) {
        qualityByIp.set(ip, saved); cached++;
      }
    } catch (e) { /* KV 读取失败时走实时画像 */ }
  }
  const uncached = ips.filter((ip) => !qualityByIp.has(ip));
  const limited = uncached.slice(0, QUALITY_BATCH_SIZE * QUALITY_MAX_BATCHES);
  if (uncached.length > limited.length) {
    log("IP QUALITY", `出口 IP ${ips.length} 个；本轮画像上限 ${limited.length} 个，其他节点保留原始结果`);
  }
  for (let i = 0; i < limited.length; i += QUALITY_BATCH_SIZE) {
    const chunk = limited.slice(i, i + QUALITY_BATCH_SIZE);
    if (!budget.take()) {
      log("IP QUALITY", "子请求额度不足，剩余 IP 跳过画像；原始订阅照常发布");
      failed += limited.length - i; break;
    }
    try {
      const response = await fetch("http://ip-api.com/batch?fields=status,message,query,countryCode,isp,org,as,asname,type,mobile,proxy,hosting", {
        method: "POST",
        headers: { "content-type": "application/json", "User-Agent": "VPNGateSub/3.0" },
        body: JSON.stringify(chunk.map((ip) => ({ query: ip }))),
        signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("响应格式不是数组");
      const returned = new Set();
      for (const row of rows) {
        if (!row || row.status !== "success" || !row.query) continue;
        const ip = String(row.query).trim();
        if (!targets.has(ip)) continue;
        const quality = assessGateQuality(row);
        qualityByIp.set(ip, quality); returned.add(ip);
        try {
          await store.put("quality:" + encodeURIComponent(ip), JSON.stringify(quality), { expirationTtl: QUALITY_TTL_SECONDS });
        } catch (e) { /* 缓存写入失败不影响本轮 */ }
      }
      for (const ip of chunk) if (!returned.has(ip)) failed++;
    } catch (e) {
      failed += chunk.length;
      log("IP QUALITY", `画像批次失败，降级继续：${e && e.message ? e.message : e}`);
    }
  }
  for (const [ip, nodes] of targets) {
    const quality = qualityByIp.get(ip) || null;
    for (const node of nodes) node.quality = quality;
  }
  log("IP QUALITY", `出口 IP ${ips.length} 个，画像成功 ${qualityByIp.size} 个（缓存 ${cached}），未画像 ${Math.max(0, ips.length - qualityByIp.size)} 个`);
  return { checked: qualityByIp.size, cached, failed };
}

function isCleanGateNode(node, maxRisk = 50) {
  const q = node && node.quality;
  if (!node || !node.success || !q || q.proxy === true || q.hosting === true) return false;
  if (Number(q.risk) > maxRisk || Number(q.clean) < 50) return false;
  return node.residential === "residential" || q.kind === "isp" || q.mobile === true;
}

function buildCleanNodesText(data, edgeHosts, cfg, maxRisk = 50) {
  const filtered = { ...data, countries: {} };
  for (const [code, group] of Object.entries(data.countries || {})) {
    const nodes = (group.nodes || []).filter((node) => isCleanGateNode(node, maxRisk));
    if (!nodes.length) continue;
    filtered.countries[code] = { ...group, nodes, count: nodes.length,
      residential: nodes.filter((n) => n.residential === "residential").length,
      datacenter: nodes.filter((n) => n.residential === "datacenter").length,
      unknown: nodes.filter((n) => n.residential !== "residential" && n.residential !== "datacenter").length };
  }
  return buildNodesText(filtered, edgeHosts, cfg, { annotateQuality: true, includeAll: true });
}

// /sub 输出完整可导入配置；clean=1 时仅保留已验证的低风险住宅/运营商出口。
function buildSubscriptionText(data, edgeHosts, cfg, cleanOnly = false) {
  if (cleanOnly) {
    const filtered = { ...data, countries: {} };
    for (const [code, group] of Object.entries(data.countries || {})) {
      const nodes = (group.nodes || []).filter((node) => isCleanGateNode(node, 50));
      if (nodes.length) filtered.countries[code] = { ...group, nodes, count: nodes.length };
    }
    return buildNodesText(filtered, edgeHosts, cfg, { annotateQuality: true, includeAll: true });
  }
  return buildNodesText(data, edgeHosts, cfg, { annotateQuality: true, includeAll: true });
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
    quality_checked: available.filter((n) => n.quality && typeof n.quality.risk === "number").length,
    clean_eligible: available.filter((n) => isCleanGateNode(n, 50)).length,
    high_risk: available.filter((n) => n.quality && n.quality.risk > 50).length,
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

function buildNodesText(data, edgeHosts, cfg, options = {}) {
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
    const residential = nodes.filter((n) => n.residential === "residential");
    const others = nodes.filter((n) => n.residential !== "residential");
    const chosen = options.includeAll ? nodes : [
      ...residential.slice(0, cfg.maxResidentialPerCountry),
      ...others.slice(0, cfg.maxDatacenterPerCountry),
    ];
    const counters = { residential: 0, datacenter: 0, unknown: 0 };
    for (const node of chosen) {
      const link = `sstp://vpn:vpn@${node.host}:${node.port}`;
      if (seenLinks.has(link)) continue;
      seenLinks.add(link);
      const kindKey = Object.prototype.hasOwnProperty.call(counters, node.residential) ? node.residential : "unknown";
      counters[kindKey] += 1;
      const kind = { residential: "住宅", datacenter: "机房", unknown: "未知" }[kindKey];
      const entry = edgeHosts[index % edgeHosts.length];
      index += 1;
      const q = node.quality && Number.isFinite(Number(node.quality.clean)) ? Math.max(0, Math.min(100, Math.round(Number(node.quality.clean)))) : null;
      const purity = q === null ? "P?" : `P${pad(q, 3)}`;
      const remark = `${name}-${kind}-${pad(counters[kindKey])}${options.annotateQuality ? `-${purity}` : ""}`;
      lines.push(`${entry}#${sanitizeRemark(remark)}${link}`);
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
    const qualityReserve = batch.length === pending.length ? Math.min(QUALITY_MAX_BATCHES, Math.ceil(state.nodes.length / QUALITY_BATCH_SIZE), Math.max(0, cfg.subrequestLimit - cfg.optimalUrls.length - 1)) : 0;
    budget.reserve = batch.length === pending.length ? cfg.optimalUrls.length + qualityReserve : 0;
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

  const edgeHosts = await getCombinedEdgeHosts(cfg, budget, log);
  // 只用检测 Worker 返回的真实出口 IP exit.ip 画像，不使用 VPN Gate 入口 IP。
  await enrichGateExitQuality(results, store, budget, log);

  const workerHost = (() => {
    try { return new URL(cfg.workerBase).host || "unknown"; }
    catch (e) { return "unknown"; }
  })();
  const data = buildOutputs({
    results, rawCount: state.rawCount, sstpCount: state.sstpCount, source: state.source,
    workerHost, durationS: (Date.now() - state.startedAt) / 1000, timedOut: state.timedOut,
  });
  const nodesText = buildNodesText(data, edgeHosts, cfg);
  const cleanNodesText = buildCleanNodesText(data, edgeHosts, cfg, 50);
  const nodesCount = nodesText.split("\n").filter((l) => l.trim()).length;
  const cleanNodesCount = cleanNodesText.split("\n").filter((l) => l.trim()).length;

  await store.put("data.json", JSON.stringify(data));
  await store.put("nodes.txt", nodesText);
  await store.put("nodes-clean.txt", cleanNodesText);
  await store.put("edge-hosts.json", JSON.stringify(edgeHosts));

  const nodesUrl = cfg.nodesUrl || (meta.origin ? `${meta.origin}/nodes.txt` : "https://<你的Worker域名>/nodes.txt");
  log("RESULT", `可用节点 ${data.stats.success}, 国家/地区 ${data.stats.countries}, nodes.txt ${nodesCount} 行`);
  log("WEBSITE", "生成 data.json");
  log("WEBSITE", "生成 index.html");
  log("WEBSITE", "生成 nodes.txt");
  log("WEBSITE", `生成 nodes-clean.txt（默认 maxrisk=50，${cleanNodesCount} 行）`);
  log("USAGE", `把 ${nodesUrl} 填入 edgetunnel 后台「自定义优选 IP」`);
  log("WEBSITE", "完成（已发布到本 Worker）");

  await store.delete("state");
  meta.lastFinishedAt = Date.now();
  meta.lastStatus = "published";
  meta.lastMessage = `可用 ${data.stats.success} / 已检测 ${data.stats.checked}`;
  meta.summary = buildSummary(data, nodesCount, nodesUrl) + `\n\n纯净订阅：${meta.origin ? meta.origin + "/nodes-clean.txt" : "/nodes-clean.txt"}（${cleanNodesCount} 行；可用 ?maxrisk=30 调整风险阈值）`;
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
      <a class="btn" href="nodes-clean.txt" download="nodes-clean.txt">下载纯净订阅</a>
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    try {
      if (path === "/" || path === "/index.html") {
        return textResponse(INDEX_HTML, "text/html; charset=utf-8", 200, NO_CACHE);
      }
      if (path === "/sub") {
        const store = getKV(env);
        const [rawData, rawHosts] = await Promise.all([store.get("data.json", "json"), store.get("edge-hosts.json", "json")]);
        if (!rawData || !Array.isArray(rawHosts)) {
          return textResponse("尚未生成订阅：请先打开 /run 执行一次检测\\n", "text/plain; charset=utf-8", 404, NO_CACHE);
        }
        const cfg = loadConfig(env);
        const cleanOnly = url.searchParams.get("clean") === "1";
        const body = buildSubscriptionText(rawData, rawHosts, cfg, cleanOnly);
        return textResponse(body, "text/plain; charset=utf-8", 200, {
          "access-control-allow-origin": "*",
          "content-disposition": 'inline; filename="vpngate-sub.txt"',
          ...NO_CACHE
        });
      }
      if (path === "/nodes-clean.txt") {
        const store = getKV(env);
        const [rawData, rawHosts] = await Promise.all([store.get("data.json", "json"), store.get("edge-hosts.json", "json")]);
        if (!rawData || !Array.isArray(rawHosts)) {
          return textResponse("尚未生成纯净订阅：请先打开 /run 执行一次检测\n", "text/plain; charset=utf-8", 404, NO_CACHE);
        }
        const parsed = Number.parseInt(url.searchParams.get("maxrisk") || "50", 10);
        const maxRisk = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 50;
        const cfg = loadConfig(env);
        const body = buildCleanNodesText(rawData, rawHosts, cfg, maxRisk);
        return textResponse(body, "text/plain; charset=utf-8", 200, { "access-control-allow-origin": "*", ...NO_CACHE });
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
