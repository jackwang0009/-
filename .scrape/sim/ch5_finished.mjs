// 通道 5：飞卢「已经完本」全表。书页不给状态字段，只有翻完整个完本列表，
// 「不在集合里」才等于「未完本」；只翻前几页的话，缺席什么也证明不了，status 只能写 unknown。
import path from "node:path";
import { sleep, writeJson, readJson } from "../lib.mjs";
import { getHtml, strip, log } from "./ch5_lib.mjs";

const OUT = path.join(import.meta.dirname, "raw", "ch5_stage_finished.json");
const GAP = 1100;
const ids = (html) =>
  html
    .split('<div class="TwoBox02_02">')
    .slice(1)
    .map((c) => /b\.faloo\.com\/(\d{4,})\.html/.exec(c)?.[1])
    .filter(Boolean);

const state = readJson(OUT, { set: [], pages: {}, complete: false });
const set = new Set(state.set);

for (const [cat, name] of [[1, "玄幻奇幻"], [6, "武侠仙侠"]]) {
  let total = state.pages[name] ?? 1;
  for (let p = 1; p <= total; p++) {
    const url = `https://b.faloo.com/y_${cat}_0_0_0_2_0_${p}.html`;
    try {
      const r = await getHtml(url, 3);
      if (p === 1) {
        total = Number(/共\s*(\d+)\s*页/.exec(strip(r.html))?.[1] ?? 1);
        state.pages[name] = total;
        log(`[完本] ${name} 共 ${total} 页`);
      }
      const got = ids(r.html);
      got.forEach((i) => set.add(i));
      if (p % 25 === 0 || p === total) {
        state.set = [...set];
        writeJson(OUT, state);
        log(`[完本] ${name} p${p}/${total} 累计 ${set.size}`);
      }
    } catch (e) {
      log(`[完本] ${name} p${p} 失败 ${e.status ?? ""} ${e.message}`);
    }
    await sleep(GAP);
  }
}

state.set = [...set];
state.complete = true;
writeJson(OUT, state);
log(`[完本] 全表完成，共 ${set.size} 本`);
