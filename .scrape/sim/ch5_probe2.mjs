// 通道 5 探活第二轮：补飞卢搜索入口、纵横书库分页、17K 绕开 WAF 的可用入口。
import { sleep } from "../lib.mjs";
import { getHtml, saveRaw, strip, log } from "./ch5_lib.mjs";
import fs from "node:fs";
import path from "node:path";

// 先从飞卢列表页里把站内搜索表单挖出来，而不是猜 URL
const faloo = fs.readFileSync(path.join(import.meta.dirname, "raw", "ch5_probe_faloo-list-b.html"), "utf8");
log("=== faloo 搜索表单");
for (const m of [...faloo.matchAll(/<form[^>]*action="([^"]+)"[\s\S]{0,600}?<\/form>/gi)]) {
  log("  action=" + m[1]);
  for (const i of [...m[0].matchAll(/<input[^>]*name="([^"]+)"[^>]*(?:value="([^"]*)")?/gi)]) log("    input " + i[1] + " = " + (i[2] ?? ""));
}
for (const m of [...faloo.matchAll(/(?:https?:)?\/\/so\.faloo\.com[^"'\s<>]{0,80}/g)].slice(0, 10)) log("  so-link " + m[0]);

const targets = [
  ["faloo-robots-plain", "https://www.faloo.com/robots.txt", { Accept: "*/*" }],
  ["faloo-xianxia", "https://b.faloo.com/y_6_0_0_0_0_0_1.html"],
  ["faloo-xianxia-p2", "https://b.faloo.com/y_6_0_0_0_0_0_2.html"],
  ["faloo-so1", "https://so.faloo.com/search?key=%E6%A8%A1%E6%8B%9F&page=1"],
  ["faloo-so2", "https://so.faloo.com/s?k=%E6%A8%A1%E6%8B%9F"],
  ["faloo-so3", "https://b.faloo.com/search.html?key=%E6%A8%A1%E6%8B%9F"],

  ["zh-store-old", "http://book.zongheng.com/store/c1/c0/b0/u0/p1/v0/s9/t0/u0/i1/ALL.html"],
  ["zh-search-p2", "https://search.zongheng.com/s?keyword=%E6%A8%A1%E6%8B%9F&pageNum=2"],
  ["zh-search-tuiyan", "https://search.zongheng.com/s?keyword=%E6%8E%A8%E6%BC%94"],
  ["zh-book-sample", "https://book.zongheng.com/book/1041397.html"],

  ["17k-www", "https://www.17k.com/"],
  ["17k-all", "https://www.17k.com/all/book/2_0_0_0_3_0_0_0_1.html"],
  ["17k-lib2", "https://www.17k.com/lib/book/2_0_0_0_0_0_0_0_1.html"],
  ["17k-book-sample", "https://www.17k.com/book/3038645.html"],
];

for (const [name, url, hdr] of targets) {
  try {
    const r = await getHtml(url, 2, hdr ?? {});
    saveRaw(`p2_${name}`, r.html);
    const title = strip(r.html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const waf = /acw_sc__v2|aliyunwaf|设置cookie/i.test(r.html) ? "  [WAF challenge]" : "";
    log(`[ok]   ${name} enc=${r.enc} len=${r.html.length} final=${r.url}${waf}`);
    log(`       title: ${title.slice(0, 80)}`);
  } catch (e) {
    log(`[fail] ${name} ${url} -> ${e.status ?? ""} ${e.message}`);
  }
  await sleep(1200);
}
