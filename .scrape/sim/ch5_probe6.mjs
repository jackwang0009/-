// 通道 5 探活第六轮：飞卢书页那三个日期分别是什么、api.17k.com 是不是可用面。
import fs from "node:fs";
import path from "node:path";
import { sleep, UA } from "../lib.mjs";
import { getHtml, strip, log } from "./ch5_lib.mjs";

const fb = fs.readFileSync(path.join(import.meta.dirname, "raw", "ch5_p4_faloo-book.html"), "utf8");
log("=== faloo 书页 yyyy-mm-dd 出现处");
for (const m of fb.matchAll(/\d{4}-\d{2}-\d{2}/g)) {
  log("  " + m[0] + " ← " + strip(fb.slice(Math.max(0, m.index - 220), m.index + 90)).replace(/\n/g, " ").slice(-190));
}

log("\n=== faloo 目录页（首章日期的可能来源）");
try {
  const r = await getHtml("https://b.faloo.com/html_1118_1118376/", 2);
  fs.writeFileSync(path.join(import.meta.dirname, "raw", "ch5_p6_faloo-toc.html"), r.html, "utf8");
  log(`  ok enc=${r.enc} len=${r.html.length}`);
  const d = [...r.html.matchAll(/\d{4}-\d{2}-\d{2}/g)].map((x) => x[0]).sort();
  log(`  日期数=${d.length} 最早=${d[0]} 最晚=${d.at(-1)}`);
  const i = r.html.indexOf("_1.html");
  log("  首章附近: " + strip(r.html.slice(i - 400, i + 400)).replace(/\n/g, " "));
} catch (e) {
  log("  fail " + e.message);
}
await sleep(1200);

log("\n=== api.17k.com 试探");
for (const url of [
  "https://api.17k.com/book/3038645",
  "https://api.17k.com/v1/book/3038645",
  "https://api.17k.com/book/3038645.json",
  "https://api.17k.com/search/book?q=%E6%A8%A1%E6%8B%9F",
]) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,*/*" } });
    const body = await res.text();
    log(`  ${res.status} len=${body.length} ${url}`);
    log("    " + body.slice(0, 300).replace(/\s+/g, " "));
  } catch (e) {
    log(`  FAIL ${url} ${e.message}`);
  }
  await sleep(1100);
}
