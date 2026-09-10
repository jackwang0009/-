// 通道 4 · 收口第一件：核对「report 里写的 86 本」与「raw_ch4_qimao.json 里实际 92 本」差的那 6 本。
// 零请求，纯本地比对 ch4_qm_hits.json（1221 本原始池）与 raw_ch4_qimao.json（交付的 92 本）。
//
// 判定依据：命中池里每条 _hitBy 记的是「哪个搜索词把这本书带回来的」。
// 第三轮（反向召回：搜修仙词再过模拟词）的关键词在抓取时统一加了 `rev:` 前缀，
// 所以「只被 rev: 词命中」= 前两轮搜不到、第三轮才捞上来的书。这是可机器判定的，不用靠回忆。
//
// 用法：node .scrape/sim/ch4_bench_reconcile.mjs

import fs from "node:fs";
import { fileURLToPath } from "node:url";

// 中文路径下不要取 .pathname，见 SCHEMA.md 第 4 节
const DIR = fileURLToPath(new URL(".", import.meta.url));

const hits = Object.values(JSON.parse(fs.readFileSync(DIR + "ch4_qm_hits.json", "utf8")));
const deliv = JSON.parse(fs.readFileSync(DIR + "raw_ch4_qimao.json", "utf8"));

const hitById = new Map(hits.map((h) => [String(h.book_id), h]));
const isRev = (k) => k.startsWith("rev:");

const rows = deliv.books.map((b) => {
  const h = hitById.get(String(b.platformBookId));
  const hitBy = h?._hitBy ?? [];
  return {
    id: b.platformBookId,
    title: b.title,
    author: b.author,
    wordCount: b.wordCount,
    status: b.status,
    matchedIn: (b.simEvidence?.matchedIn ?? []).slice().sort().join("+"),
    keywords: (b.simEvidence?.keywords ?? []).join("/"),
    hitBy,
    inPool: Boolean(h),
    revOnly: hitBy.length > 0 && hitBy.every(isRev),
  };
});

const missingFromPool = rows.filter((r) => !r.inPool);
const revOnly = rows.filter((r) => r.revOnly);
const abstractOnly = rows.filter((r) => r.matchedIn === "abstract");

const allKw = [...new Set(hits.flatMap((h) => h._hitBy ?? []))];

console.log("=== 池与交付 ===");
console.log("命中池 ch4_qm_hits.json:", hits.length, "本");
console.log("交付 raw_ch4_qimao.json books:", deliv.books.length, "本; nearMiss:", deliv.nearMiss.length, "本");
console.log("交付里在池中找不到的:", missingFromPool.length, "本", missingFromPool.map((r) => r.title));
console.log("池中出现过的关键词:", allKw.length, "个 (前两轮", allKw.filter((k) => !isRev(k)).length, "/ 第三轮 rev:", allKw.filter(isRev).length, ")");

console.log("\n=== 只被第三轮(rev:)召回的书 —— 这就是 86→92 那一批 ===");
console.log("本数:", revOnly.length);
for (const r of revOnly) {
  console.log(
    ` · ${r.title}｜${r.author}｜${(r.wordCount / 10000).toFixed(1)}万字｜${r.status}｜matchedIn=${r.matchedIn}｜kw=${r.keywords}｜hitBy=${r.hitBy.join(",")}`
  );
}

console.log("\n=== 交叉验证：meta.notes 声称「这 6 本全部是仅简介命中」「该亚群 5→11」 ===");
console.log("仅简介命中(matchedIn=abstract)总数:", abstractOnly.length);
console.log("其中属第三轮新增:", abstractOnly.filter((r) => r.revOnly).length);
console.log("其中前两轮就有:", abstractOnly.filter((r) => !r.revOnly).length);
console.log("第三轮新增里非「仅简介命中」的:", revOnly.filter((r) => r.matchedIn !== "abstract").length);

console.log("\n=== 反推前两轮口径下的本数 ===");
console.log("去掉第三轮新增后:", rows.length - revOnly.length, "本  ← 与 report 里的 86 本对不对得上");

const dist = {};
for (const r of rows) dist[r.matchedIn] = (dist[r.matchedIn] || 0) + 1;
console.log("\nmatchedIn 分布:", JSON.stringify(dist));
