// 通道 3 · 候选池覆盖面复核。过判据的书只剩个位数，交付前必须先排除「池子本身就只是全站的一角」。
// 要查三件事：
//  1) /store/{cat}-a-0-15-a-20-p-{页}-909 这串参数里有没有无意打开的筛选（字数档/更新时间/状态）
//  2) 分页是不是被截断（脚本取的是分页控件里的最大页码，控件常只显示一个窗口）
//  3) 塔读的男频分类里，除了已扫的三个，还有没有该进条件 B 的
import { get, sleep } from "../lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const RAW = path.join(DIR, "raw");

const countLis = (html) => (html.match(/href="\/book\/\d+\/"/g) ?? []).length;
const pageNums = (html) => [...html.matchAll(/-p-(\d+)-909/g)].map((m) => +m[1]);

const CASES = [
  ["cat99-p1", "https://www.tadu.com/store/99-a-0-15-a-20-p-1-909"],
  ["cat99-p30", "https://www.tadu.com/store/99-a-0-15-a-20-p-30-909"],
  ["cat99-p31", "https://www.tadu.com/store/99-a-0-15-a-20-p-31-909"],
  ["cat99-p45", "https://www.tadu.com/store/99-a-0-15-a-20-p-45-909"],
];

for (const [name, url] of CASES) {
  let html = "";
  try {
    html = await get(url, 1);
  } catch (e) {
    console.log(`[${name}] ERR ${e.status ?? e.message}`);
    await sleep(1200);
    continue;
  }
  fs.writeFileSync(path.join(RAW, `ch3_store_${name}.html`), html, "utf8");
  const nums = pageNums(html);
  const total = html.match(/共\s*<?[^>]*>?\s*(\d[\d,]*)\s*[<\s]*\/?[^>]*>?\s*[本部]/)?.[1] ?? null;
  console.log(`[${name}] ${html.length} 字节，书链接 ${countLis(html)} 条，分页控件最大 ${nums.length ? Math.max(...nums) : "-"}，页面「共N本」=${total ?? "未标"}`);
  if (name === "cat99-p1") {
    // 筛选态：塔读把当前选中的筛选项标成 class="selected"/"cur"
    const sel = [...html.matchAll(/<a[^>]*class="[^"]*(?:selected|cur|on)\b[^"]*"[^>]*>([^<]{1,12})<\/a>/g)].map((m) => m[1].trim());
    console.log(`  当前选中的筛选项: ${[...new Set(sel)].join(" | ") || "(没解出)"}`);
    // 全站男频分类清单
    const cats = [...html.matchAll(/href="\/store\/(\d+)-[^"]*"[^>]*>([^<]{2,10})<\/a>/g)].map((m) => `${m[1]}=${m[2].trim()}`);
    console.log(`  分类入口: ${[...new Set(cats)].slice(0, 40).join("  ")}`);
  }
  await sleep(1200);
}
