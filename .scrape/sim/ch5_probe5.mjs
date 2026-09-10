// 通道 5 探活第五轮：飞卢首章日期从哪来、17K 还有没有不过 WAF 的面。
import fs from "node:fs";
import path from "node:path";
import { sleep, UA } from "../lib.mjs";
import { getHtml, strip, saveRaw, log } from "./ch5_lib.mjs";

const fb = fs.readFileSync(path.join(import.meta.dirname, "raw", "ch5_p4_faloo-book.html"), "utf8");
log("=== faloo 书页章节区：首章附近原文");
const c1 = fb.indexOf("1118376_1.html");
log(fb.slice(c1 - 700, c1 + 700));
log("=== faloo 书页里出现的日期形态统计");
const dates = [...fb.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((m) => m[0]);
log("  yyyy-mm-dd 共 " + dates.length + " 个，最早 " + [...dates].sort()[0] + "，最晚 " + [...dates].sort().at(-1));
log("  章节链接数 = " + new Set([...fb.matchAll(/1118376_(\d+)\.html/g)].map((m) => m[1])).size);

log("\n=== 17K 其它面试探");
for (const url of [
  "http://www.17k.com/book/3038645.html",
  "https://www.17k.com/list/3038645.html",
  "https://api.17k.com/book/3038645",
  "https://book.17k.com/book/3038645.html",
  "https://www.17k.com/top/refactor/top100/06_vipclick/06_click_top_100_pc.html",
]) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*", "Accept-Language": "zh-CN,zh;q=0.9" }, redirect: "follow" });
    const body = await res.text();
    const waf = /acw_sc__v2|aliyunwaf/i.test(body);
    log(`  ${res.status} len=${body.length} waf=${waf} ${url}`);
    if (!waf && res.ok) {
      saveRaw("p5_17k_" + url.replace(/\W+/g, "_").slice(-40), body);
      log("    title: " + strip(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 70));
    }
  } catch (e) {
    log(`  FAIL ${url} ${e.message}`);
  }
  await sleep(1200);
}
