// 通道 4 / 阶段 0：探活。七猫搜索 API 与书页是否还有效，知乎盐选有没有可用的公开入口。
// 只打印，不落库；结论写进 ch4.log。
import { get, sleep } from "../lib.mjs";
import fs from "node:fs";

const LOG = ".scrape/sim/ch4.log";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};

async function probe(name, url, opts = {}) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9",
        Accept: opts.json
          ? "application/json, text/plain, */*"
          : "text/html,application/xhtml+xml",
        ...(opts.referer ? { Referer: opts.referer } : {}),
      },
    });
    const body = await res.text();
    log(`[${res.status}] len=${String(body.length).padEnd(8)} ${name}`);
    log(`        ${url}`);
    if (body.length) log(`        head: ${body.slice(0, 220).replace(/\s+/g, " ")}`);
    return { status: res.status, body };
  } catch (e) {
    log(`[ERR] ${name} -> ${e.message}`);
    log(`        ${url}`);
    return { status: 0, body: "" };
  } finally {
    await sleep(1200);
  }
}

log(`\n===== ch4 probe @ ${new Date().toISOString()} =====`);

log("\n--- 七猫：搜索 API（旧资产用的那个端点）---");
for (const kw of ["模拟", "模拟器", "推演"]) {
  await probe(`qimao search ${kw}`, `https://api-www.qimao.com/api/search/result?keyword=${encodeURIComponent(kw)}&page=1`, {
    json: true,
    referer: "https://www.qimao.com/search/index/",
  });
}

log("\n--- 七猫：书页 / 书库分类页 ---");
await probe("qimao book 1880008", "https://www.qimao.com/shuku/1880008/");
await probe("qimao shuku 玄幻 click", "https://www.qimao.com/shuku/a-202-37-a-a-a-a-click-1/");
await probe("qimao robots", "https://www.qimao.com/robots.txt");

log("\n--- 知乎盐选：公开入口探活 ---");
await probe("zhihu robots", "https://www.zhihu.com/robots.txt");
await probe("zhihu search 盐选 模拟修仙", "https://www.zhihu.com/search?type=content&q=" + encodeURIComponent("盐选 模拟 修仙"));
await probe("zhihu xen market remix", "https://www.zhihu.com/xen/market/vip-privileges");
await probe("zhihu pub api search", "https://www.zhihu.com/api/v4/search_v3?t=general&q=" + encodeURIComponent("模拟修仙"), { json: true });
await probe("zhihu remix hot", "https://www.zhihu.com/market/paid_column", {});

log("\n===== probe done =====");
