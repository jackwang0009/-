// 通道 3 · 分页上限逃逸性检查。塔读每个分类的列表只放得出 30 页（p31 起 0 条），
// 若分类实际存量大于 600 本，换一种排序就会露出另一批书；若各排序返回的是同一批，
// 说明这个分类本来就只有这么多，池子已经到顶，个位数产量是站方存量决定的，不是漏抓。
// 只取每种排序的 p1 与 p30 各一页，够判重叠率，不多打站。
import { get, sleep, readJson } from "../lib.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const pool = new Set(cand.books.map((b) => b.id));

// 第 4 段是排序位：15=默认 12=周人气 13=周银票 0=最近更新 14=最新发布
const SORTS = [
  ["最新发布", 14],
  ["周人气", 12],
];
for (const [name, s] of SORTS) {
  for (const p of [1, 30]) {
    const url = `https://www.tadu.com/store/99-a-0-${s}-a-20-p-${p}-909`;
    let html = "";
    try {
      html = await get(url, 1);
    } catch (e) {
      console.log(`[${name} p${p}] ERR ${e.status ?? e.message}`);
      await sleep(1200);
      continue;
    }
    const ids = [...new Set([...html.matchAll(/href="\/book\/(\d+)\/"/g)].map((m) => m[1]))];
    const fresh = ids.filter((i) => !pool.has(i));
    console.log(`[${name} p${p}] ${ids.length} 本，池外新书 ${fresh.length} 本${fresh.length ? "：" + fresh.slice(0, 8).join(",") : ""}`);
    await sleep(1200);
  }
}
console.log("\n池外新书为 0 ⇒ 各排序返回同一批，分类存量已扫尽；>0 ⇒ 30 页上限确实挡住了书，需按排序多轮扫");
