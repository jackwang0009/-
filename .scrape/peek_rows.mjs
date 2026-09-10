import fs from "node:fs";
import { parseCsv } from "./lib.mjs";

const rows = parseCsv(fs.readFileSync("docs/书库/番茄-档案.csv", "utf8")).filter((r) => r.length > 1);
for (const n of process.argv.slice(2)) {
  const r = rows.find((x) => x[0] === n);
  if (!r) { console.log(`--- #${n} 未找到 ---`); continue; }
  console.log(`--- #${n} ---`);
  console.log(`  书名  : ${r[1]} | 作者: ${r[2] || "(空)"}`);
  console.log(`  ID    : ${r[4] || "(空)"}`);
  console.log(`  字数  : ${r[6] || "(空)"} | 连载: ${r[7] || "(空)"} | 分类: ${r[8] || "(空)"}`);
  console.log(`  封面  : ${r[16] ? "有" : "(空)"}`);
  console.log(`  来源  : ${r[18]}`);
  console.log(`  状态  : ${r[19]}`);
}
