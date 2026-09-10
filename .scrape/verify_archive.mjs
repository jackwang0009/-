import fs from "node:fs";
import { parseCsv } from "./lib.mjs";

const P = "docs/书库/番茄-档案.csv";
const buf = fs.readFileSync(P);
const text = buf.toString("utf8");
const rows = parseCsv(text).filter((r) => r.length > 1);
const head = rows[0], body = rows.slice(1);

const EXPECT = [
  "序号", "书名", "作者", "平台", "书籍ID", "官方书页URL", "字数(万)", "连载状态",
  "平台分类", "内容标签", "总章节数", "首发时间", "最近更新", "榜位快照20260826",
  "核心设定", "简介摘要", "封面URL", "是否核心玄幻盘", "数据来源", "核验状态",
];

const problems = [];
if (!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)) problems.push("缺少 UTF-8 BOM");
if (head.join(",") !== EXPECT.join(",")) problems.push("表头与规范不一致");
if (body.length !== 30) problems.push(`行数 ${body.length} != 30`);

body.forEach((r, i) => {
  if (r.length !== 20) problems.push(`第 ${i + 1} 行列数 ${r.length} != 20`);
  if (Number(r[0]) !== i + 1) problems.push(`第 ${i + 1} 行序号=${r[0]}，序号被重排`);
  r.forEach((c, j) => {
    if (/^(N\/A|未知|-|0)$/.test(c.trim())) problems.push(`#${r[0]} 列「${EXPECT[j]}」用了占位符 "${c}"`);
  });
  const s = r[15];
  if ([...s].length > 60) problems.push(`#${r[0]} 简介摘要 ${[...s].length} 字 > 60`);
  if (/[\uE000-\uF8FF]/.test(r.join(""))) problems.push(`#${r[0]} 仍含 PUA 字符`);
});

const withId = body.filter((r) => r[4]).length;
const st = {};
for (const r of body) { const k = r[19].split("-")[0]; st[k] = (st[k] || 0) + 1; }

console.log(`文件: ${P}`);
console.log(`BOM: ${buf[0] === 0xef ? "有" : "无"} | 行数: ${body.length} | 列数: ${head.length}`);
console.log(`有书籍ID: ${withId} | 无ID留空: ${body.length - withId}`);
console.log(`核验状态分布:`, JSON.stringify(st, null, 0));
console.log(`封面URL 有值: ${body.filter((r) => r[16]).length}`);
console.log(`首发时间 有值: ${body.filter((r) => r[11]).length}`);
console.log(problems.length ? `\n问题 ${problems.length} 项:\n  ` + problems.join("\n  ") : "\n校验通过，无问题");
