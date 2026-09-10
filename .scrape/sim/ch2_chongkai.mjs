// 取证：交付里靠「重开」入选的书，逐本摘出原句，供通道 6 判词义。纯离线。
// 关键区分：只有「重开」是唯一条件A 证据的书才有降级风险；
// 同时命中模拟器/推演/模拟的书，即便「重开」判成假阳性也照样过 A，不该被一起降。
import { readJson } from "../lib.mjs";
import fs from "node:fs";

const d = readJson(".scrape/sim/raw_ch2_fanqie.json");
const arc = {
  ...readJson(".scrape/sim/ch2_info_noncult.json", {}),
  ...readJson(".scrape/sim/ch2_info.json", {}),
};

const hits = d.books.filter((b) => b.simEvidence.keywords.includes("重开"));
const soleRisk = hits.filter((b) => b.simEvidence.keywords.length === 1);

const lines = [];
const out = (s) => { lines.push(s); console.log(s); };

out(`交付 ${d.books.length} 本中命中「重开」的：${hits.length} 本`);
out(`其中「重开」是唯一条件A 证据、有降级风险的：${soleRisk.length} 本`);
out(`其余 ${hits.length - soleRisk.length} 本另有强词兜底，「重开」判假也不影响入选\n`);

hits.forEach((b, i) => {
  const r = arc[b.platformBookId];
  const abs = String(r?.abstract ?? b.abstract ?? "");
  // 摘出每一处「重开」的原句：按中文句读切分，保留含该词的整句
  const sents = abs
    .split(/[\n。！？；]/)
    .map((s) => s.trim())
    .filter((s) => s.includes("重开"));
  const sole = b.simEvidence.keywords.length === 1;
  out(`${String(i + 1).padStart(2)}. ${b.title}`);
  out(`    bookId ${b.platformBookId} | 分类 ${(b.categories ?? []).concat(b.tags ?? []).slice(0, 6).join("/")}`);
  out(`    条件A 命中词 ${b.simEvidence.keywords.join("/")} ${sole ? "← 仅「重开」，有降级风险" : "（另有强词，不受影响）"}`);
  sents.forEach((s) => out(`    原句：${s}`));
  if (!sents.length) out(`    原句：（简介里切不出含「重开」的句子，需人工看全文）`);
  out("");
});

fs.writeFileSync(".scrape/sim/ch2_chongkai_evidence.txt", lines.join("\n"), "utf8");
console.log("已写出 .scrape/sim/ch2_chongkai_evidence.txt");
