import fs from "node:fs";

const parse = (line) => {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
};

const raw = fs.readFileSync("docs/书库/玄幻书库-100本.csv", "utf8").replace(/^\uFEFF/, "");
const lines = raw.split(/\r?\n/).filter((x) => x.trim());
const hdr = parse(lines[0]);
const rows = lines.slice(1).map(parse);

console.log(`列数 ${hdr.length} | 数据行 ${rows.length}`);

const seqs = new Set(rows.map((r) => Number(r[0])));
const missing = [];
for (let i = 1; i <= 100; i++) if (!seqs.has(i)) missing.push(i);
console.log(`序号 1-100 缺号: ${missing.length ? missing.join(",") : "无"}`);
console.log(`字段数不等于 20 的行: ${rows.filter((r) => r.length !== 20).length}`);
console.log(`重复序号: ${rows.length - seqs.size}`);

console.log("\n未满 100 的列：");
hdr.forEach((h, i) => {
  const n = rows.filter((r) => (r[i] || "").trim()).length;
  if (n < 100) console.log(`  ${h.padEnd(18)} ${n}/100`);
});

const tally = (fn) => {
  const m = {};
  rows.forEach((r) => { const k = fn(r) || "(空)"; m[k] = (m[k] || 0) + 1; });
  return m;
};
console.log("\n核验状态前缀:", JSON.stringify(tally((r) => (r[19] || "").split("-")[0]), null, 0));
console.log("平台分布:", JSON.stringify(tally((r) => r[3]), null, 0));
console.log("是否核心玄幻盘:", JSON.stringify(tally((r) => r[17]), null, 0));

const badUrl = rows.filter((r) => (r[5] || "").trim() && !/^https:\/\//.test(r[5]));
console.log(`\nURL 格式异常: ${badUrl.length}`);
const signed = rows.filter((r) => /x-signature|x-expires/.test(r[16] || ""));
console.log(`封面仍为签名链: ${signed.length}`);
