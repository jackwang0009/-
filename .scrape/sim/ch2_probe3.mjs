// 探测三：/search/{kw} 是唯一回 200 的搜索路由。看它是不是 SSR 出结果；
// 若是 SPA 壳，就从它引用的 JS 里把真实 XHR 端点抠出来。顺带看书库/分类列表页。
import fs from "node:fs";
import { UA, sleep, extractState } from "../lib.mjs";

async function hit(url, accept = "text/html,application/xhtml+xml", referer = "https://fanqienovel.com/") {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: accept, Referer: referer },
  });
  const body = await res.text();
  console.log(`[GET] ${res.status} len=${body.length} ${url}`);
  return { status: res.status, body };
}

fs.mkdirSync(".scrape/sim/raw", { recursive: true });
const q = encodeURIComponent("模拟");

// 1) 搜索页
const s = await hit(`https://fanqienovel.com/search/${q}`);
fs.writeFileSync(".scrape/sim/raw/ch2_probe_searchpage.html", s.body, "utf8");
const st = extractState(s.body);
console.log("search state:", JSON.stringify(st?.search ?? null).slice(0, 800));
const scripts = [...s.body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
console.log("scripts:", scripts.slice(0, 20).join("\n         "));
const inlineApi = [...s.body.matchAll(/\/api\/[a-zA-Z0-9_\/\-]+/g)].map((m) => m[0]);
console.log("api paths in html:", [...new Set(inlineApi)].slice(0, 30).join(", ") || "(none)");
await sleep(2000);

// 2) 书库/分类列表页：找不依赖搜索的扩池入口
for (const url of [
  "https://fanqienovel.com/library",
  "https://fanqienovel.com/library/stacks?category_id=1140",
  "https://fanqienovel.com/stacks?category_id=1140",
]) {
  const r = await hit(url);
  if (r.status === 200 && r.body.length > 12000) {
    const t = extractState(r.body);
    const lib = t?.libra ?? t?.home;
    console.log("  state.libra keys:", t?.libra ? Object.keys(t.libra).join(",") : "(none)");
    const name = url.replace(/[^a-z0-9]+/gi, "_").slice(-40);
    fs.writeFileSync(`.scrape/sim/raw/ch2_probe_lib_${name}.html`, r.body, "utf8");
  }
  await sleep(2000);
}

// 3) 搜索接口再试两种参数形态（aid 是番茄 web 端常见必带参数）
for (const url of [
  `https://fanqienovel.com/api/author/search/search_book/v1?filter=127&page_count=10&page_index=0&query_type=0&query_word=${q}&aid=1967`,
  `https://fanqienovel.com/api/author/search/search_book/v1?query_word=${q}&query_type=0&page_index=0&page_count=10`,
]) {
  const r = await hit(url, "application/json, text/plain, */*", `https://fanqienovel.com/search/${q}`);
  if (r.body.length) console.log("  body head:", r.body.slice(0, 300));
  await sleep(2000);
}
