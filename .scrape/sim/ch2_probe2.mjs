// 探测二：search_book 接口连续回 200+空 body。先冷却，再验证
// (a) 书页通道是否仍然健康（整个任务的关键路径）
// (b) 带首页 cookie 后搜索接口是否恢复
// (c) 其它搜索路由是否存在
// 探测模式：每个 URL 只打一次，间隔 2.5 秒，不做 60 秒退避重试（否则一轮探测要几十分钟）。
import fs from "node:fs";
import { UA, sleep, extractState } from "../lib.mjs";

let COOKIE = "";

async function hit(name, url, accept, referer) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "zh-CN,zh;q=0.9",
      Accept: accept,
      ...(referer ? { Referer: referer } : {}),
      ...(COOKIE ? { Cookie: COOKIE } : {}),
    },
    redirect: "follow",
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) {
    COOKIE = sc.map((c) => c.split(";")[0]).join("; ");
  }
  const body = await res.text();
  console.log(
    `[${name}] ${res.status} len=${body.length} ct=${(res.headers.get("content-type") || "").split(";")[0]}` +
      (sc.length ? ` set-cookie=${sc.length}` : ""),
  );
  return { res, body };
}

console.log("冷却 60 秒后开始探测...");
await sleep(60000);

fs.mkdirSync(".scrape/sim/raw", { recursive: true });
const q = encodeURIComponent("模拟");

// 1) 首页：拿 cookie
const home = await hit("home", "https://fanqienovel.com/", "text/html,application/xhtml+xml");
console.log("  cookie ->", COOKIE.slice(0, 160) || "(none)");
await sleep(2500);

// 2) 书页：关键路径体检（用种子里已知存在的一本）
const probeId = "7583949514948496409";
const bp = await hit("book-page", `https://fanqienovel.com/page/${probeId}`, "text/html,application/xhtml+xml", "https://fanqienovel.com/");
if (bp.body.length) {
  const st = extractState(bp.body);
  const p = st?.page;
  console.log("  bookName:", p?.bookName, "| abstractLen:", String(p?.abstract || "").length, "| cats:", (p?.categoryV2 ? "yes" : "no"));
  fs.writeFileSync(".scrape/sim/raw/ch2_probe_bookpage.html", bp.body, "utf8");
}
await sleep(2500);

// 3) 搜索接口：带 cookie 重试
for (const [name, url, accept, ref] of [
  ["api-filter127", `https://fanqienovel.com/api/author/search/search_book/v1?filter=127&page_count=10&page_index=0&query_type=0&query_word=${q}`, "application/json, text/plain, */*", "https://fanqienovel.com/"],
  ["html-/search/kw", `https://fanqienovel.com/search/${q}`, "text/html,application/xhtml+xml", "https://fanqienovel.com/"],
  ["html-?q=", `https://fanqienovel.com/search?q=${q}`, "text/html,application/xhtml+xml", "https://fanqienovel.com/"],
  ["html-searchPage", `https://fanqienovel.com/searchPage?query=${q}`, "text/html,application/xhtml+xml", "https://fanqienovel.com/"],
  ["api-search-v1", `https://fanqienovel.com/api/search/search_book/v1?query_word=${q}&page_index=0&page_count=10`, "application/json, text/plain, */*", "https://fanqienovel.com/"],
]) {
  try {
    const r = await hit(name, url, accept, ref);
    if (r.body.length) {
      fs.writeFileSync(`.scrape/sim/raw/ch2_probe_${name}.txt`, r.body.slice(0, 400000), "utf8");
      if (r.body.trimStart().startsWith("{")) {
        const j = JSON.parse(r.body);
        const list = j?.data?.search_book_data_list || j?.data?.book_data_list || [];
        console.log(`  code=${j?.code} total=${j?.data?.total_count} n=${list.length}`);
        if (list[0]) console.log("  keys:", Object.keys(list[0]).join(","));
      } else {
        const st = extractState(r.body);
        console.log("  state keys:", st ? Object.keys(st).join(",") : "(none)");
      }
    }
  } catch (e) {
    console.log(`[${name}] FAIL ${e.message}`);
  }
  await sleep(2500);
}
