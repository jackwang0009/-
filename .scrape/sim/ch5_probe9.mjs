// 通道 5 校验：飞卢完本列表深页到底还给不给新书。这决定「未命中 = 连载」能不能成立。
import { sleep } from "../lib.mjs";
import { getHtml, log } from "./ch5_lib.mjs";

const ids = (html) =>
  html
    .split('<div class="TwoBox02_02">')
    .slice(1)
    .map((c) => /b\.faloo\.com\/(\d{4,})\.html/.exec(c)?.[1])
    .filter(Boolean);

const seen = {};
for (const p of [1, 100, 224, 225, 226, 230, 300, 348]) {
  try {
    const r = await getHtml(`https://b.faloo.com/y_1_0_0_0_2_0_${p}.html`, 3);
    const got = ids(r.html);
    seen[p] = got;
    log(`p${p}: 条目=${got.length} 首条=${got[0] ?? "-"} 末条=${got.at(-1) ?? "-"}`);
  } catch (e) {
    log(`p${p}: 失败 ${e.message}`);
  }
  await sleep(1200);
}
const a = seen[225] ?? [], b = seen[226] ?? [], c = seen[300] ?? [];
log(`p225 与 p226 相同？ ${JSON.stringify(a) === JSON.stringify(b)}`);
log(`p225 与 p300 相同？ ${JSON.stringify(a) === JSON.stringify(c)}`);
