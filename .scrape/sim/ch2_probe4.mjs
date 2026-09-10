// 探测四：搜索页是 SPA 壳（search.loading=true, searchBookList=null）。
// 真实端点在 Search.*.js 里，把它抠出来。
import fs from "node:fs";
import { UA, sleep } from "../lib.mjs";

const bundles = [
  "https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/Search.53ebdaa2.js",
  "https://lf-fe.fqnovelstatic.com/obj/novel-fanqie-fe/toutiao/muye/js/muye_a2c8e2a7.js",
];

fs.mkdirSync(".scrape/sim/raw", { recursive: true });

for (const url of bundles) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://fanqienovel.com/" } });
  const js = await res.text();
  const name = url.split("/").pop();
  console.log(`\n===== ${name} ${res.status} len=${js.length}`);
  fs.writeFileSync(`.scrape/sim/raw/ch2_bundle_${name}`, js, "utf8");

  const paths = [...new Set([...js.matchAll(/["'`](\/api\/[a-zA-Z0-9_\/\-{}$.]+)["'`]/g)].map((m) => m[1]))];
  console.log("api paths:", paths.length);
  for (const p of paths) if (/search|book|rank|categ|stack|libra/i.test(p)) console.log("   ", p);

  // 搜索相关的参数名，判断要不要签名
  const params = [...new Set([...js.matchAll(/\b(query_word|query_type|page_index|page_count|filter|tab_type|search_source|aid|msToken|a_bogus|_signature)\b/g)].map((m) => m[1]))];
  if (params.length) console.log("params seen:", params.join(", "));
  await sleep(1500);
}
