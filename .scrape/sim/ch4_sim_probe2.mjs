// 通道 4 / 阶段 0b：专项探活。
// 目标一：七猫 HTML 全被 WAF 挡住，找 API 侧能不能补 chapterTotal / 热度 / 分类榜。
// 目标二：知乎 /search 被 robots 禁止且 403，找盐选侧的合规入口。
import { sleep } from "../lib.mjs";
import fs from "node:fs";

const LOG = ".scrape/sim/ch4.log";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function probe(name, url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "zh-CN,zh;q=0.9",
        Accept: opts.json ? "application/json, text/plain, */*" : "text/html,application/xhtml+xml",
        ...(opts.referer ? { Referer: opts.referer } : {}),
      },
    });
    const body = await res.text();
    const waf = body.includes("aliyun_waf") || body.includes("renderData");
    log(`[${res.status}]${waf ? "[WAF]" : "     "} len=${String(body.length).padEnd(7)} ${name}`);
    if (body.length && !waf) log(`        ${body.slice(0, 300).replace(/\s+/g, " ")}`);
    return { status: res.status, body, waf };
  } catch (e) {
    log(`[ERR] ${name} -> ${e.message}`);
    return { status: 0, body: "", waf: false };
  } finally {
    await sleep(1200);
  }
}

log(`\n===== ch4 probe2 @ ${new Date().toISOString()} =====`);

log("\n--- 七猫 API：书籍详情 / 榜单 候选端点 ---");
const BID = "1880008";
for (const u of [
  `https://api-www.qimao.com/api/book/detail?id=${BID}`,
  `https://api-www.qimao.com/api/book/book-detail?id=${BID}`,
  `https://api-www.qimao.com/api/book/info?book_id=${BID}`,
  `https://api-www.qimao.com/api/book/chapter-list?id=${BID}`,
  `https://api-www.qimao.com/api/shuku/detail?id=${BID}`,
  `https://api-www.qimao.com/api/v1/book/detail?id=${BID}`,
  `https://api-www.qimao.com/api/rank/list?type=1&page=1`,
  `https://api-www.qimao.com/api/shuku/list?category=202&page=1`,
  `https://api-www.qimao.com/api/search/hot-words`,
]) {
  await probe(u.replace("https://api-www.qimao.com/api/", "qm:"), u, {
    json: true,
    referer: "https://www.qimao.com/",
  });
}

log("\n--- 七猫：搜索 API 深翻页是否稳定（第 5、10 页）---");
for (const p of [5, 10]) {
  await probe(
    `qm search 模拟器 page=${p}`,
    `https://api-www.qimao.com/api/search/result?keyword=${encodeURIComponent("模拟器")}&page=${p}`,
    { json: true, referer: "https://www.qimao.com/search/index/" }
  );
}

log("\n--- 知乎：盐选合规入口候选（避开 robots 禁止的 /search）---");
for (const [n, u] of [
  ["zh xen market remix nav", "https://www.zhihu.com/xen/market/remix"],
  ["zh api market recommend", "https://api.zhihu.com/market/recommend"],
  ["zh api remix search", "https://api.zhihu.com/search_v3?t=general&q=" + encodeURIComponent("模拟修仙")],
  ["zh salt column list", "https://www.zhihu.com/api/v4/market/salt_selection/recommend"],
  ["zh xen market info", "https://www.zhihu.com/xen/market/vip-privileges"],
  ["zhuanlan topic", "https://www.zhihu.com/topic/20033161/hot"],
  ["zh api v4 topic novels", "https://www.zhihu.com/api/v4/topics/20033161/feeds/top_activity"],
]) {
  await probe(n, u, { json: n.includes("api"), referer: "https://www.zhihu.com/" });
}

log("\n===== probe2 done =====");
