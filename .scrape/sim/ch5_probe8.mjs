// 通道 5 探活第八轮：验证飞卢「完本」书的 og:novel:status 怎么填，好把状态判准。
import { sleep } from "../lib.mjs";
import { getHtml, strip, log } from "./ch5_lib.mjs";

// 玄幻奇幻 + 已经完本 筛选页：y_{大类}_0_0_0_{状态=2}_0_{页}
const r = await getHtml("https://b.faloo.com/y_1_0_0_0_2_0_1.html", 3);
log("完本列表 len=" + r.html.length);
const ids = [...new Set([...r.html.matchAll(/b\.faloo\.com\/(\d{4,})\.html/g)].map((m) => m[1]))].slice(0, 3);
log("取样 " + ids.join(","));
await sleep(1200);

for (const id of ids) {
  try {
    const b = await getHtml(`https://b.faloo.com/${id}.html`, 3);
    const st = /<meta[^>]+name="og:novel:status"[^>]*content="([^"]*)"/.exec(b.html)?.[1];
    const flat = strip(b.html).replace(/\n+/g, " ");
    log(`  ${id} og:status="${st}" len=${b.html.length}`);
    log(`    已写字数: ${/已有(\d+)人读过已写(\d+)个字/.exec(flat)?.[2] ?? "?"}  入站: ${/入站时间[：:]\s*(\d{4}-\d{2}-\d{2})/.exec(flat)?.[1] ?? "?"}`);
    for (const kw of ["完本", "已完结", "连载"]) {
      const k = flat.indexOf(kw + "");
      if (k > 0) log(`    [${kw}] …${flat.slice(Math.max(0, k - 60), k + 40).replace(/\s+/g, " ")}…`);
    }
  } catch (e) {
    log(`  ${id} 失败 ${e.message}`);
  }
  await sleep(1300);
}
