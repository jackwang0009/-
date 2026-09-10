import fs from "node:fs";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// setTimeout 在 Windows 上会提前触发（实测 sleep(1000) 只睡 983ms），
// 单次 setTimeout 会让请求间隔跌破 1 秒的合规红线，故循环校验到点为止。
export const sleep = (ms) =>
  new Promise((resolve) => {
    const deadline = Date.now() + ms;
    const tick = () => {
      const left = deadline - Date.now();
      if (left <= 0) resolve();
      else setTimeout(tick, left);
    };
    tick();
  });

export async function get(url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "zh-CN,zh;q=0.9",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (!res.ok) {
        const err = new Error("HTTP " + res.status);
        err.status = res.status;
        throw err;
      }
      const body = await res.text();
      // 番茄的软限流长这样：HTTP 200 + 空 body。当成硬失败会白丢一本书，必须同样退避重试。
      if (!body.length) {
        const err = new Error("empty body (soft rate limit)");
        err.softLimit = true;
        throw err;
      }
      return body;
    } catch (e) {
      lastErr = e;
      // 合规要求：被限流时退避 60 秒，不做原地重试风暴
      const throttled = e.status === 403 || e.status === 429 || e.softLimit;
      if (throttled) console.warn(`  [throttled ${e.status ?? "empty-200"}] backing off 60s`);
      await sleep(throttled ? 60000 : 1500 * (i + 1));
    }
  }
  throw lastErr;
}

// 番茄 page state 里不少字段是「JSON 字符串」而不是真数组，
// categoryV2 / chapterListWithVolume 都属于这一类，直接 .map/.flat 会抛。
export function asArray(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v.trim()) {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function extractState(html) {
  const i = html.indexOf("window.__INITIAL_STATE__");
  if (i < 0) return null;
  const start = html.indexOf("{", i);
  let depth = 0, inStr = false, esc = false;
  for (let k = start; k < html.length; k++) {
    const ch = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, k + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export const CATS = {
  1141: "西方奇幻",
  1140: "东方仙侠",
  8: "科幻末世",
  261: "都市日常",
  124: "都市修真",
  1014: "都市高武",
  273: "历史古代",
  27: "战神赘婿",
  263: "都市种田",
  258: "传统玄幻",
  272: "历史脑洞",
  539: "悬疑脑洞",
  262: "都市脑洞",
  257: "玄幻脑洞",
  751: "悬疑灵异",
  504: "抗战谍战",
  746: "游戏体育",
  718: "动漫衍生",
  1016: "男频衍生",
};

export const ts = (s) => {
  const n = Number(s);
  if (!n) return "";
  return new Date(n * 1000).toISOString().slice(0, 10);
};

// 番茄书页给的 thumbUrl 是 24 小时签名链。归一到 p6 主机并丢掉 query 即得免签名永久链，
// 实测 18/18 与签名版 sha256 逐字节一致。注意 p9 主机没有免签形式，必须换成 p6 而不是保留原前缀。
export const toPermanentCover = (url) =>
  String(url ?? "")
    .split("?")[0]
    .replace(/^https:\/\/p\d+-novel(?:-sign)?\.byteimg\.com\//, "https://p6-novel.byteimg.com/");

export function parseCsv(text) {
  const rows = [];
  let row = [], cur = "", q = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export const readJson = (p, d = null) =>
  fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : d;
export const writeJson = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2), "utf8");
