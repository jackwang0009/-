// 通道 5 补漏：飞卢 46 本的 abstract 是列表页截断版（64–78 字，尾部 "..."），
// 书页 T-L-T-C-Box1 里的简介全文早在 09-08 21:49 那轮就随 HTML 存档到 raw/ch5_faloo_{id}.html 了，
// ch5_build.mjs 的 `d.abstract ?? meta.listIntro` 只是因为当时 stage.details 里没有 abstract 这一格才回退的。
// 所以这里纯离线重解存档 HTML，零网络请求。
//
//   node .scrape/sim/ch5_abstract_fix.mjs          空转，只打印差异
//   node .scrape/sim/ch5_abstract_fix.mjs --apply  写回 raw_ch5_feilu.json
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "../lib.mjs";
import { strip, simHit, log } from "./ch5_lib.mjs";

const DIR = import.meta.dirname;
const RAW = path.join(DIR, "raw");
const FILE = path.join(DIR, "raw_ch5_feilu.json");
const APPLY = process.argv.includes("--apply");

// 与 ch5_faloo.mjs 的 detail() 逐字同一套解析，不另起一套口径。
const boxAbstract = (h) =>
  strip(/<div class="T-L-T-C-Box1">([\s\S]*?)<\/div>/.exec(h)?.[1] ?? "")
    .replace(/飞卢小说网提醒您：.*$/s, "")
    .trim() || null;

const raw = fs.readFileSync(FILE, "utf8");
const data = JSON.parse(raw);

// 先确认「读进来再 stringify」和磁盘上的字节一致，否则写回会顺手改掉别处的格式。
if (JSON.stringify(data, null, 2) !== raw) {
  log("[abstract-fix] 中止：round-trip 不一致，写回会污染 books 以外的内容");
  process.exit(1);
}

const rows = [];
let hit = 0;
let miss = 0;
for (const b of data.books) {
  if (b.platform !== "faloo") continue;
  const p = path.join(RAW, `ch5_faloo_${b.platformBookId}.html`);
  if (!fs.existsSync(p)) {
    miss++;
    rows.push(`  ✗ ${b.title} — 存档 HTML 缺失，保持原值`);
    continue;
  }
  const full = boxAbstract(fs.readFileSync(p, "utf8"));
  if (!full) {
    miss++;
    rows.push(`  ✗ ${b.title} — Box1 解不出，保持原值`);
    continue;
  }
  if (full === b.abstract) continue;
  if (full.length < (b.abstract?.length ?? 0)) {
    miss++;
    rows.push(`  ✗ ${b.title} — 新值反而更短（${b.abstract.length}→${full.length}），不覆盖`);
    continue;
  }

  // 判据留痕按最终 abstract 重算，与 ch5_build.mjs 同一套逻辑。
  const ev = { title: simHit(b.title), abstract: simHit(full), tag: simHit((b.tags ?? []).join(" ")) };
  const matchedIn = ["title", "tag", "abstract"].filter((k) => ev[k].length);
  const keywords = [...new Set(Object.values(ev).flat())];
  if (!matchedIn.length) {
    miss++;
    rows.push(`  ✗ ${b.title} — 换全文后判据留痕会变空，不覆盖`);
    continue;
  }
  const lost = b.simEvidence.matchedIn.filter((x) => !matchedIn.includes(x));
  rows.push(
    `  ✓ ${b.title}  ${b.abstract?.length ?? 0}→${full.length} 字` +
      (lost.length ? `  ⚠ matchedIn 丢了 ${lost.join("+")}` : "") +
      (matchedIn.join("+") !== b.simEvidence.matchedIn.join("+") ? `  留痕 ${b.simEvidence.matchedIn.join("+")}→${matchedIn.join("+")}` : ""),
  );
  hit++;
  if (APPLY) {
    b.abstract = full;
    b.simEvidence = { matchedIn, keywords };
  }
}

for (const r of rows) log(r);
const fal = data.books.filter((b) => b.platform === "faloo");
const lens = fal.map((b) => b.abstract?.length ?? 0).sort((a, b) => a - b);
log(`[abstract-fix] ${APPLY ? "已写回" : "空转"}：可补 ${hit} 本，跳过 ${miss} 本`);
log(`[abstract-fix] 飞卢 abstract 长度（${APPLY ? "补后" : "补前"}）最短 ${lens[0]} / 中位 ${lens[Math.floor(lens.length / 2)]} / 最长 ${lens.at(-1)}`);
log(`[abstract-fix] 仍以 "..." 结尾：${fal.filter((b) => b.abstract?.endsWith("...")).length} 本`);

if (APPLY && hit) {
  writeJson(FILE, data);
  log("[abstract-fix] 已写 raw_ch5_feilu.json（只动 faloo 的 abstract 与 simEvidence，纵横与 meta 未动）");
}
