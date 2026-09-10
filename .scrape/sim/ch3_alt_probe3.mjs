// 通道 3 · 承 ch3_alt_probe2：落盘的 HTML 里 datum/p.intro/sortList 都在，
// 所以「站上没有」这条已排除。剩下两种可能：
//   (a) 22:20 那轮取回的响应和现在这份不一样（瞬时/限流页）——那就重取即可
//   (b) 页面是同一份，是 parseBook 的正则对这个模板变体失配——那就是选择器漂了，要改正则
// 判法：把 ch3_alt_fetch.mjs 里那套正则原样拿来跑落盘 HTML。仍解不出 ⇒ (b)。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const RAW = path.join(DIR, "raw");

const files = fs.readdirSync(RAW).filter((f) => /^ch3_alt_probe_(empty|ok)_\d+\.html$/.test(f));

for (const f of files) {
  const html = fs.readFileSync(path.join(RAW, f), "utf8");
  const kind = f.includes("_empty_") ? "空" : "常";

  // —— 老正则，逐条单独判，看具体是哪一条断的 ——
  const oldIntro = html.match(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/)?.[1];
  const oldDatum = html.match(/<div class="datum">([\s\S]*?)<\/div>/)?.[1];
  const oldSort = html.match(/<div class="sortList">([\s\S]*?)<\/div>/)?.[1];
  const oldCh = html.match(/目录[\s\S]{0,40}?（(\d+)章）/)?.[1];

  // 老 datum 解析：<span><em>值</em>&nbsp;标签</span>
  const stat = {};
  if (oldDatum) {
    for (const [, val, label] of oldDatum.matchAll(/<span[^>]*>\s*<em[^>]*>([^<]*)<\/em>\s*(?:&nbsp;)*\s*([^<]*)<\/span>/g)) {
      stat[label.replace(/\s|&nbsp;/g, "")] = val.trim();
    }
  }

  console.log(`\n=== [${kind}] ${f} (${html.length} 字节) ===`);
  console.log(`  p.intro 匹配: ${oldIntro == null ? "✗ 失配" : `✓ ${oldIntro.replace(/<[^>]*>/g, "").trim().length} 字`}`);
  console.log(`  datum 匹配: ${oldDatum == null ? "✗ 失配" : `✓ ${oldDatum.length} 字节`}  解出键: ${JSON.stringify(Object.keys(stat))}`);
  console.log(`  sortList 匹配: ${oldSort == null ? "✗ 失配" : `✓`}  目录章数: ${oldCh ?? "✗"}`);

  // 失配的，把该标签在原文里的真实写法抠出来看
  if (oldIntro == null) {
    const m = html.match(/<p[^>]*class="[^"]*intro[^"]*"[^>]*>/);
    console.log(`  → 实际 <p ...intro...> 写法: ${m?.[0] ?? "(找不到带 intro 的 <p>)"}`);
    const any = html.match(/class="intro"[\s\S]{0,120}/);
    if (any) console.log(`  → class="intro" 上下文: ${any[0].replace(/\s+/g, " ").slice(0, 160)}`);
  }
  if (oldDatum == null) {
    const m = html.match(/<div[^>]*class="[^"]*datum[^"]*"[^>]*>/);
    console.log(`  → 实际 datum div 写法: ${m?.[0] ?? "(找不到)"}`);
    const seg = html.match(/class="[^"]*datum[^"]*"[\s\S]{0,600}/);
    if (seg) console.log(`  → datum 段原文: ${seg[0].replace(/\s+/g, " ").slice(0, 600)}`);
  } else if (!Object.keys(stat).length) {
    console.log(`  → datum 段原文: ${oldDatum.replace(/\s+/g, " ").slice(0, 600)}`);
  }
  if (oldSort == null) {
    const seg = html.match(/class="[^"]*sortList[^"]*"[\s\S]{0,400}/);
    console.log(`  → sortList 段原文: ${seg?.[0]?.replace(/\s+/g, " ").slice(0, 400) ?? "(找不到)"}`);
  }
  if (oldCh == null) {
    const seg = html.match(/目录[\s\S]{0,80}/);
    console.log(`  → 「目录」上下文: ${seg?.[0]?.replace(/\s+/g, " ").slice(0, 120) ?? "(找不到)"}`);
  }
}
