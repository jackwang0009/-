// 通道 5 共用件：飞卢 / 纵横 / 17K。
// lib.mjs 的 get() 用 res.text() 按 UTF-8 解，老站的 GBK 页面会解成乱码，
// 所以这里只重做「取字节 + 按声明编码解」这一层，退避纪律与间隔仍照抄 lib.mjs。
import { UA, sleep } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";

const DEC = new Map();
const dec = (enc) => {
  const key = String(enc || "utf-8").toLowerCase().replace(/^gb2312$|^gb18030$/, "gbk");
  if (!DEC.has(key)) {
    try {
      DEC.set(key, new TextDecoder(key));
    } catch {
      DEC.set(key, new TextDecoder("utf-8"));
    }
  }
  return DEC.get(key);
};

// 声明可能在 Content-Type，也可能只在 <meta charset>；后者要先用 latin1 把头部试解出来才看得到。
function sniff(buf, ctype) {
  const fromHeader = /charset=\s*"?([\w-]+)/i.exec(ctype || "")?.[1];
  if (fromHeader) return fromHeader;
  const head = Buffer.from(buf.slice(0, 2048)).toString("latin1");
  return /<meta[^>]+charset=["']?\s*([\w-]+)/i.exec(head)?.[1] || "utf-8";
}

// 飞卢连续取几页后会插一张 357 字节的过渡页：它把 C3VK 的值明文写在 script 里再自跳转。
// 浏览器天然会存下这个 cookie 再请求一次，这里做的就是同一件事——存 cookie、原样重取，不解混淆、不伪造。
const JAR = new Map();
const cookieFor = (host) => [...(JAR.get(host) ?? new Map())].map(([k, v]) => `${k}=${v}`).join("; ");
const putCookie = (host, k, v) => {
  if (!JAR.has(host)) JAR.set(host, new Map());
  JAR.get(host).set(k, v);
};
// 拦截页里 document 是十六进制转义拼出来的，只有 .cookie="C3VK=…" 这段是明文，按它匹配。
const INTERSTITIAL = /\.cookie\s*=\s*"(C3VK=[^;"]+)/;

// HTTP 200 + 极短 body 是飞卢限流的第三种样子（前两种是空 body 和 357 字节 C3VK 过渡页）。
// 实测连抓约 90 次后会连续返回 55–56 字节的响应，隔十几次自行恢复——这是节流不是死链，
// 证据是失败序号成两段连续区间（92–101、132–144）而不是零散分布。
// SCHEMA 第 4 节的口径本来就是「403/429/空 body 退 60 秒」，这一种同类，之前只吃到 1.5 秒退避才会整段丢。
// robots.txt 这类本来就短的响应用 minBytes:0 关掉该断言。
const SHORT_BODY = 200;

export async function getHtml(url, tries = 3, extraHeaders = {}, { minBytes = SHORT_BODY } = {}) {
  let lastErr;
  const host = new URL(url).host;
  let gates = 0;
  for (let i = 0; i < tries; i++) {
    try {
      const jar = cookieFor(host);
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "zh-CN,zh;q=0.9",
          Accept: "text/html,application/xhtml+xml",
          ...(jar ? { Cookie: jar } : {}),
          ...extraHeaders,
        },
      });
      if (!res.ok) {
        const err = new Error("HTTP " + res.status);
        err.status = res.status;
        throw err;
      }
      for (const c of res.headers.getSetCookie?.() ?? []) {
        const kv = c.split(";")[0];
        const at = kv.indexOf("=");
        if (at > 0) putCookie(host, kv.slice(0, at).trim(), kv.slice(at + 1).trim());
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      if (!buf.length) {
        const err = new Error("empty body (soft rate limit)");
        err.softLimit = true;
        throw err;
      }
      const enc = sniff(buf, res.headers.get("content-type"));
      const html = dec(enc).decode(buf);

      const gate = INTERSTITIAL.exec(html);
      if (gate && html.length < 2000 && gates < 3) {
        gates++;
        i--; // 过闸不算失败重试，否则一次拦截就吃掉一次机会
        const [k, v] = gate[1].split("=");
        putCookie(host, k, v);
        await sleep(1200);
        continue; // 拿着 cookie 原样再请求一次，浏览器也是这么做的
      }
      if (minBytes && buf.length < minBytes) {
        const err = new Error(`abnormally short body (${buf.length}B, soft rate limit)`);
        err.softLimit = true;
        throw err;
      }
      return { html, enc, url: res.url, status: res.status };
    } catch (e) {
      lastErr = e;
      const throttled = e.status === 403 || e.status === 429 || e.softLimit;
      if (throttled) console.warn(`  [throttled ${e.status ?? "empty-200"}] backing off 60s`);
      await sleep(throttled ? 60000 : 1500 * (i + 1));
    }
  }
  throw lastErr ?? new Error("interstitial loop exhausted");
}

// 飞卢的搜索参数是 GBK 百分号编码（作者链接里的 %c6%bc%cb%ae 即「萍水」）。
// Node 只带 UTF-8 编码器，这里用解码器反查建表——双字节区共两万余对，一次建完即可。
let GBK_ENC = null;
function gbkTable() {
  if (GBK_ENC) return GBK_ENC;
  GBK_ENC = new Map();
  const d = new TextDecoder("gbk", { fatal: false });
  for (let hi = 0x81; hi <= 0xfe; hi++) {
    for (let lo = 0x40; lo <= 0xfe; lo++) {
      if (lo === 0x7f) continue;
      const ch = d.decode(new Uint8Array([hi, lo]));
      if (ch.length === 1 && ch !== "\ufffd" && !GBK_ENC.has(ch)) GBK_ENC.set(ch, [hi, lo]);
    }
  }
  return GBK_ENC;
}

export function gbkEncodeURI(s) {
  const t = gbkTable();
  let out = "";
  for (const ch of String(s)) {
    const code = ch.codePointAt(0);
    if (/[A-Za-z0-9_.~-]/.test(ch)) out += ch;
    else if (code < 0x80) out += "%" + code.toString(16).padStart(2, "0");
    else {
      const b = t.get(ch);
      if (!b) throw new Error("字符不在 GBK 表内，不能用于飞卢搜索: " + ch);
      out += "%" + b[0].toString(16).padStart(2, "0") + "%" + b[1].toString(16).padStart(2, "0");
    }
  }
  return out;
}

export const strip = (s) =>
  String(s ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/[ \t\u3000]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// 「198.5万字」→ 1985000。拿不到数字一律 null，不猜。
export function toWords(s) {
  const t = String(s ?? "").replace(/[,\s]/g, "");
  const wan = /([\d.]+)\s*(万|萬)/.exec(t);
  if (wan) return Math.round(Number(wan[1]) * 10000);
  const n = /(\d{3,})/.exec(t);
  return n ? Number(n[1]) : null;
}

export function toNum(s) {
  const t = String(s ?? "").replace(/[,\s]/g, "");
  const wan = /([\d.]+)\s*(万|萬)/.exec(t);
  if (wan) return Math.round(Number(wan[1]) * 10000);
  const n = /([\d.]+)/.exec(t);
  return n ? Number(n[1]) : null;
}

// 「3天前」「昨天」这类相对时间折算成绝对日期
export function toDate(s, now = new Date()) {
  const t = String(s ?? "").trim();
  let m = /(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
  const shift = (days) => new Date(now.getTime() - days * 864e5).toISOString().slice(0, 10);
  if ((m = /(\d+)\s*天前/.exec(t))) return shift(Number(m[1]));
  if ((m = /(\d+)\s*(小时|分钟)前/.exec(t))) return shift(0);
  if (/昨天|昨日/.test(t)) return shift(1);
  if (/今天|刚刚/.test(t)) return shift(0);
  if ((m = /^(\d{1,2})[-/月.](\d{1,2})/.exec(t))) {
    return `${now.getFullYear()}-${String(m[1]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`;
  }
  return null;
}

export const SIM_WORDS = ["模拟器", "模拟", "推演", "演算", "沙盘", "预演", "重开", "无限重生", "人生模拟"];
export const CULT_WORDS = ["修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根", "大道", "仙侠", "玄幻", "洪荒", "仙帝", "仙尊", "道法", "长生"];

export function simHit(text) {
  const hits = SIM_WORDS.filter((w) => String(text ?? "").includes(w));
  // 「模拟器」命中时「模拟」必然也命中，只留更具体的那个
  return hits.includes("模拟器") ? hits.filter((w) => w !== "模拟") : hits;
}

// 飞卢书页解析。放这里是因为它有两个调用方（ch5_faloo.mjs 现抓、ch5_expand.mjs 重解存档），
// 各写一份迟早会分叉——abstract 那一格就是这么丢的：detail() 补了解析，重解存档的那条路没有。
export function parseFalooDetail(html, bookId) {
  const meta = (k) => new RegExp(`<meta[^>]+name="${k}"[^>]*content="([^"]*)"`).exec(html)?.[1] ?? null;
  const flat = strip(html).replace(/\n+/g, " ");
  const counts = /已有(\d+)人读过已写(\d+)个字/.exec(flat);
  const abstract =
    strip(/<div class="T-L-T-C-Box1">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "")
      .replace(/飞卢小说网提醒您：.*$/s, "")
      .trim() || null;

  return {
    ogCategory: meta("og:novel:category"),
    ogAuthor: meta("og:novel:author"),
    ogUpdate: meta("og:novel:update_time"),
    cover: meta("og:image"),
    click: toNum(meta("og:novel:click_cnt")) ?? (counts ? Number(counts[1]) : null),
    wordCount: counts ? Number(counts[2]) : null,
    subCategory: /小说子类[：:]\s*([^\s入]+)/.exec(flat)?.[1] ?? null,
    firstPublishDate: /入站时间[：:]\s*(\d{4}-\d{2}-\d{2})/.exec(flat)?.[1] ?? null,
    abstract,
    tags: [...html.matchAll(/<a class="LXbq"[^>]*title="([^"]+)"/g)].map((m) => strip(m[1])),
    chapterTotal: new Set([...html.matchAll(new RegExp(`${bookId}_(\\d+)\\.html`, "g"))].map((m) => m[1])).size || null,
    latestChapter: meta("og:novel:latest_chapter_name"),
    score: Number(/好评指数[：:]([\d.]+)分/.exec(strip(html).replace(/\s+/g, ""))?.[1]) || null,
  };
}

export const saveRaw = (name, html) => {
  const dir = path.join(import.meta.dirname, "raw");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `ch5_${name}.html`), html, "utf8");
};

export const LOG = path.join(import.meta.dirname, "ch5.log");
export const log = (...a) => {
  const line = a.join(" ");
  console.log(line);
  fs.appendFileSync(LOG, line + "\n", "utf8");
};
