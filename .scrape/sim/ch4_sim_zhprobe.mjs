// 通道 4 / 阶段 0c：知乎盐选合规入口攻坚。
// 已知：/search 被 robots.txt 明确 Disallow 且 403；api 侧多要求登录。
// 这里只试「robots 未禁止 + 不需要登录」的公开路径，并把 robots.txt 存档以便在 meta.notes 里引用。
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
        ...(opts.headers ?? {}),
      },
    });
    const body = await res.text();
    const login = body.includes("need_login") || body.includes("unhuman");
    log(`[${res.status}]${login ? "[LOGIN]" : "       "} len=${String(body.length).padEnd(7)} ${name}`);
    if (opts.save && body.length > 500) {
      fs.writeFileSync(`.scrape/sim/raw/${opts.save}`, body, "utf8");
      log(`        saved -> .scrape/sim/raw/${opts.save}`);
    }
    if (body.length && !login) log(`        ${body.slice(0, 260).replace(/\s+/g, " ")}`);
    return { status: res.status, body, login };
  } catch (e) {
    log(`[ERR] ${name} -> ${e.message}`);
    return { status: 0, body: "", login: false };
  } finally {
    await sleep(1200);
  }
}

fs.mkdirSync(".scrape/sim/raw", { recursive: true });
log(`\n===== ch4 zhihu probe @ ${new Date().toISOString()} =====`);

log("\n--- robots.txt 存档（后面 meta.notes 要引用）---");
const rb = await probe("zhihu robots", "https://www.zhihu.com/robots.txt", { save: "ch4_zhihu_robots.txt" });
const disallow = [...rb.body.matchAll(/Disallow:\s*(\S+)/g)].map((m) => m[1]);
log(`        Disallow 条目 ${disallow.length} 条，含 /search = ${disallow.includes("/search")}`);

log("\n--- 盐选内容页是否需要登录（拿真实已知页做判定）---");
// zhuanlan 文章页与回答页是盐选故事最常见的公开载体
await probe("zhuanlan article", "https://zhuanlan.zhihu.com/p/34592651");
await probe("zhihu question page", "https://www.zhihu.com/question/264622100");
await probe("zhihu xen market home", "https://www.zhihu.com/xen/market");
await probe("zhihu pub api article", "https://www.zhihu.com/api/v4/articles/34592651", { json: true });

log("\n--- 换搜索引擎侧入口（robots 允许，走公开索引找盐选书目）---");
for (const [n, u] of [
  ["bing site:zhihu 盐选 模拟 修仙", "https://www.bing.com/search?q=" + encodeURIComponent("site:zhihu.com 盐选 模拟 修仙")],
  ["bing 知乎盐选 模拟器 小说", "https://www.bing.com/search?q=" + encodeURIComponent("知乎盐选 模拟器 修仙 小说")],
  ["so.com 知乎盐选 模拟修仙", "https://www.so.com/s?q=" + encodeURIComponent("知乎盐选 模拟 修仙 小说")],
]) {
  await probe(n, u, { save: n.startsWith("bing site") ? "ch4_bing_1.html" : undefined });
}

log("\n===== zhihu probe done =====");
