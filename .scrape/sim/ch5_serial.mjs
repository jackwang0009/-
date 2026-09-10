// 通道 5：飞卢「还在写作中」列表（状态位=1），用来把完本表没覆盖到的书判成 连载。
// 完本表深页会重复同一批 30 条（p226 与 p348 逐条相同），所以这里也做重复检测，
// 一旦连续几页都没有新书就停——继续翻只是在重复请求同一页。
import path from "node:path";
import { sleep, writeJson, readJson } from "../lib.mjs";
import { getHtml, log } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const OUT = path.join(RAW, "ch5_stage_serial.json");
const want = new Set((readJson(path.join(RAW, "ch5_stage_faloo.json"), { picked: [] }).picked ?? []).map(String));
const done = new Set(readJson(path.join(RAW, "ch5_stage_finished.json"), { set: [] }).set.map(String));
for (const id of done) want.delete(id);
log(`[连载] 待判定 ${want.size} 本`);

const ids = (html) =>
  html
    .split('<div class="TwoBox02_02">')
    .slice(1)
    .map((c) => /b\.faloo\.com\/(\d{4,})\.html/.exec(c)?.[1])
    .filter(Boolean);

const state = readJson(OUT, { set: [], exhausted: {} });
const set = new Set(state.set);

outer: for (const [cat, name] of [[1, "玄幻奇幻"], [6, "武侠仙侠"]]) {
  let dry = 0;
  for (let p = 1; p <= 120; p++) {
    try {
      const r = await getHtml(`https://b.faloo.com/y_${cat}_0_0_0_1_0_${p}.html`, 3);
      const got = ids(r.html);
      const before = set.size;
      got.forEach((i) => set.add(i));
      dry = set.size > before ? 0 : dry + 1;
      if (p % 20 === 0 || dry >= 4) {
        state.set = [...set];
        writeJson(OUT, state);
        const left = [...want].filter((i) => !set.has(i)).length;
        log(`[连载] ${name} p${p} 累计 ${set.size} 仍未判定 ${left}`);
      }
      if (dry >= 4) {
        state.exhausted[name] = p;
        log(`[连载] ${name} 连续 ${dry} 页无新书，判定分页到顶，停在 p${p}`);
        break;
      }
      if ([...want].every((i) => set.has(i) || done.has(i))) {
        log(`[连载] 待判定的书已全部命中，提前收工于 ${name} p${p}`);
        state.set = [...set];
        writeJson(OUT, state);
        break outer;
      }
    } catch (e) {
      log(`[连载] ${name} p${p} 失败 ${e.message}`);
    }
    await sleep(1100);
  }
}

state.set = [...set];
writeJson(OUT, state);
const left = [...want].filter((i) => !set.has(i));
log(`[连载] 完成，集合 ${set.size} 本；仍未判定 ${left.length} 本`);
