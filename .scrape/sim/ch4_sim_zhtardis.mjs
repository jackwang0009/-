// 通道 4 / 阶段 0d：知乎最后一条合规路。
// robots.txt 里唯一一条 Allow 是 /tardis/jm —— 那是知乎给搜索引擎爬虫的轻量渲染页，
// 不需要登录。先从搜索引擎 SERP 里挖出真实的盐选 URL / id，再看 tardis 能不能渲染出来。
import { sleep } from "../lib.mjs";
import fs from "node:fs";

const LOG = ".scrape/sim/ch4.log";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function fetchText(url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": opts.ua ?? UA,
        "Accept-Language": "zh-CN,zh;q=0.9",
        Accept: opts.json ? "application/json,*/*" : "text/html,application/xhtml+xml",
      },
    });
    return { status: res.status, body: await res.text() };
  } catch (e) {
    return { status: 0, body: "", err: e.message };
  }
}

log(`\n===== ch4 zhihu tardis @ ${new Date().toISOString()} =====`);

// ---------- 1. 从 SERP 里挖 zhihu 链接 ----------
const QUERIES = [
  "site:zhihu.com 盐选 模拟器 修仙",
  "知乎盐选 人生模拟 修仙 小说",
  "知乎盐选 推演 修真 短篇",
  "site:zhihu.com 盐选专栏 模拟 修仙 小说",
  "知乎盐选 重开 修仙",
];
const found = new Map(); // url -> {title, snippet, q}

for (const q of QUERIES) {
  for (const eng of [
    (s) => "https://www.bing.com/search?q=" + encodeURIComponent(s) + "&count=30",
    (s) => "https://www.so.com/s?q=" + encodeURIComponent(s),
  ]) {
    const { status, body } = await fetchText(eng(q));
    await sleep(1300);
    if (status !== 200 || !body) {
      log(`[${status}] SERP fail: ${q}`);
      continue;
    }
    // 抓 zhihu 域下的结果链接（含 SERP 常见的重定向包装）
    const urls = new Set();
    for (const m of body.matchAll(
      /https?:\/\/(?:www\.|zhuanlan\.)?zhihu\.com\/(?:market\/paid_column|xen\/market|zhuanlan|p|question|answer|tardis)[^\s"'<>&\\]{0,90}/g
    )) {
      urls.add(m[0].replace(/[.,;)]+$/, ""));
    }
    for (const u of urls) if (!found.has(u)) found.set(u, { q });
    log(`[${status}] ${q.slice(0, 34).padEnd(34)} -> zhihu links: ${urls.size} (pool ${found.size})`);
  }
}

fs.writeFileSync(
  ".scrape/sim/ch4_zh_serp.json",
  JSON.stringify([...found.entries()].map(([url, v]) => ({ url, ...v })), null, 1),
  "utf8"
);
log(`\nSERP 池共 ${found.size} 条 -> .scrape/sim/ch4_zh_serp.json`);

// ---------- 2. tardis 渲染路径探活 ----------
log("\n--- tardis / SEO 渲染路径探活（robots 唯一 Allow 的那条）---");
// 用一个公开的知乎回答/文章 id 做判定
const IDS = { art: "34592651", ans: "1030401693", q: "264622100" };
const CANDIDATES = [
  ["tardis/zm/art", `https://www.zhihu.com/tardis/zm/art/${IDS.art}`],
  ["tardis/bd/art", `https://www.zhihu.com/tardis/bd/art/${IDS.art}`],
  ["tardis/sogou/art", `https://www.zhihu.com/tardis/sogou/art/${IDS.art}`],
  ["tardis/jm/art", `https://www.zhihu.com/tardis/jm/art/${IDS.art}`],
  ["tardis/zm/ans", `https://www.zhihu.com/tardis/zm/ans/${IDS.ans}`],
  ["tardis/bd/ans", `https://www.zhihu.com/tardis/bd/ans/${IDS.ans}`],
  ["tardis/landing/q", `https://www.zhihu.com/tardis/landing/quest/${IDS.q}`],
];
const GOOGLEBOT =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

for (const [name, url] of CANDIDATES) {
  for (const [uaName, ua] of [["chrome", UA], ["googlebot", GOOGLEBOT]]) {
    const { status, body } = await fetchText(url, { ua });
    await sleep(1300);
    const blocked = body.includes("zh-zse-ck") || body.includes("unhuman");
    log(
      `[${status}]${blocked ? "[BLOCK]" : "       "} len=${String(body.length).padEnd(7)} ${name} (${uaName})`
    );
    if (status === 200 && !blocked && body.length > 2000) {
      const t = body.match(/<title>([^<]*)<\/title>/);
      log(`        title: ${t ? t[1].slice(0, 80) : "?"}`);
      fs.writeFileSync(`.scrape/sim/raw/ch4_tardis_${name.replace(/\//g, "_")}_${uaName}.html`, body, "utf8");
      log(`        saved`);
    }
  }
}

log("\n===== zhihu tardis probe done =====");
