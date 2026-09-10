// 通道 5 探活第四轮：飞卢书页详情字段、纵横分类页/搜索接口、17K sitemap 子表。
import { sleep, UA } from "../lib.mjs";
import { getHtml, saveRaw, strip, log } from "./ch5_lib.mjs";

const pages = [
  ["faloo-book", "https://b.faloo.com/1118376.html"],
  ["zh-cat-xuanhuan", "https://www.zongheng.com/category/1.html"],
  ["zh-store-filter", "http://book.zongheng.com/store.html"],
  ["17k-sitemap-sub", "https://www.17k.com/sitemap/3_5_10.xml"],
];

for (const [name, url] of pages) {
  try {
    const r = await getHtml(url, 2);
    saveRaw(`p4_${name}`, r.html);
    log(`[ok]   ${name} enc=${r.enc} len=${r.html.length} final=${r.url}`);
    log(`       title: ${strip(r.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 90)}`);
  } catch (e) {
    log(`[fail] ${name} ${url} -> ${e.status ?? ""} ${e.message}`);
  }
  await sleep(1200);
}

// 纵横搜索接口猜测：新版页面是 JS 渲染，看有没有可直接取的 JSON 面
log("=== zongheng 搜索接口试探");
for (const url of [
  "https://search.zongheng.com/api/search/book?keyword=%E6%A8%A1%E6%8B%9F&pageNum=1&pageSize=20",
  "https://search.zongheng.com/search/book?keyword=%E6%A8%A1%E6%8B%9F",
  "https://www.zongheng.com/api/search?keyword=%E6%A8%A1%E6%8B%9F",
  "https://search.zongheng.com/s/ajax?keyword=%E6%A8%A1%E6%8B%9F",
]) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*", "X-Requested-With": "XMLHttpRequest", Referer: "https://search.zongheng.com/" } });
    const body = await res.text();
    log(`  ${res.status} len=${body.length} ${url}`);
    if (res.ok && body.length < 4000) log("    " + body.slice(0, 400).replace(/\s+/g, " "));
    else if (res.ok) log("    head: " + body.slice(0, 200).replace(/\s+/g, " "));
  } catch (e) {
    log(`  FAIL ${url} ${e.message}`);
  }
  await sleep(1100);
}
