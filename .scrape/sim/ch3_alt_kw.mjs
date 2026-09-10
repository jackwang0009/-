// 判据关键词单独成模块：ch3_alt_list.mjs 顶层是爬取逻辑，import 它会连带重跑整轮扫描
// （第一版就这么误跑过一次，白烧 85 次请求）。常量放这里，谁都能安全引用。

// SCHEMA 条件 A。「重开」「无限重生」限定为「同一段时间反复重来」义，命中后需人工复核。
export const KW_SIM = ["模拟器", "模拟", "推演", "演算", "沙盘", "预演", "人生模拟", "无限重生", "重开"];
export const KW_SIM_LOOSE = new Set(["重开", "无限重生", "推演", "演算"]);

// SCHEMA 条件 B 的简介关键词
export const KW_XIU = ["修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根", "大道"];

// 条件 B 的分类白名单（塔读分类名）
export const CAT_XIU = ["东方玄幻", "武侠仙侠"];

export function simHits(text) {
  const hits = KW_SIM.filter((k) => text.includes(k));
  // 命中「模拟器」时「模拟」必然冗余
  return hits.includes("模拟器") ? hits.filter((k) => k !== "模拟") : hits;
}
