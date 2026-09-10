// Stage 1.5：召回率抽检。列表页的 bookIntro 是截断摘要，用它判条件 A 会漏掉「模拟」只出现在
// 简介后半段的书。先抽样取书页全文简介，量出漏检率，再决定是否值得对全池 1054 本逐本取页。
import { get, sleep, readJson, writeJson } from "../lib.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KW_SIM } from "./ch3_alt_list.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const pool = readJson(path.join(DIR, "ch3_alt_candidates.json")).books;
// 只在条件 B 相关的三个分类里抽（现代都市那批本来就只用于 nearMiss）
const relevant = pool.filter((b) => ["东方玄幻", "武侠仙侠", "脑洞创意"].includes(b.cat) && !b.condA);

// 固定种子的等距抽样，可复现
const N = 80;
const step = Math.floor(relevant.length / N);
const sample = Array.from({ length: N }, (_, i) => relevant[i * step]).filter(Boolean);
console.log(`相关池 ${relevant.length} 本（已排除列表页已命中的），等距抽 ${sample.length} 本，step=${step}`);

export const grabAbstract = (html) => {
  const m =
    html.match(/<div[^>]*class="[^"]*bookIntro[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
    html.match(/<div[^>]*id="bookIntro"[^>]*>([\s\S]*?)<\/div>/i);
  return (m?.[1] ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
};

const missed = [];
let ok = 0;
for (const [i, b] of sample.entries()) {
  try {
    const html = await get(`https://www.tadu.com/book/${b.id}/`, 2);
    ok++;
    const full = grabAbstract(html);
    const hit = KW_SIM.filter((k) => full.includes(k) || b.title.includes(k));
    if (hit.length) {
      missed.push({ id: b.id, title: b.title, cat: b.cat, hit, introLen: b.intro.length, fullLen: full.length });
      console.log(`  [漏检] ${b.title} (${b.cat}) 命中 ${hit.join("/")}  截断简介 ${b.intro.length} 字 → 全文 ${full.length} 字`);
    }
  } catch (e) {
    console.log(`  [fail] ${b.id} ${b.title} -> ${e.status ?? e.message}`);
  }
  process.stdout.write(`  ${i + 1}/${sample.length} 取回 ${ok}，漏检 ${missed.length}\r`);
  await sleep(1100);
}

const rate = missed.length / (ok || 1);
console.log(`\n\n--- 召回抽检 ---`);
console.log(`成功取回 ${ok} 本，其中列表页漏判的 ${missed.length} 本，漏检率 ${(rate * 100).toFixed(1)}%`);
console.log(`按此外推，未扫的 ${relevant.length} 本里约有 ${Math.round(rate * relevant.length)} 本被列表页漏掉`);
console.log(rate > 0.02 ? ">> 漏检显著，应对三个相关分类全量取书页" : ">> 漏检可忽略，列表页判据够用");
writeJson(path.join(DIR, "ch3_alt_recall.json"), { sampled: ok, missed, rate, relevantTotal: relevant.length });
