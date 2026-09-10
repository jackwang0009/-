// 步骤 B：把 ID 池逐本解析成干净文本。
// /api/book/info?bookId=xxx（注意是驼峰 bookId，下划线 book_id 会 404 到首页）
// 返回 4KB JSON，文本不被私有字体混淆——列表接口那份 29–48% PUA 的 abstract 不能用。
// 这里只判定命中，不组装交付记录（交付记录在步骤 C，要补 chapterTotal / 首发日期）。
import fs from "node:fs";
import { UA, sleep, readJson, writeJson, asArray } from "../lib.mjs";

const SIM_KW = ["模拟器", "模拟", "推演", "演算", "沙盘", "预演", "重开", "人生模拟", "无限重生"];
const CULT_KW = ["修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根", "大道"];
const CULT_CAT = /仙侠|修真|修仙|玄幻|洪荒|宗门|仙侠|东方玄幻/;
const PUA = /[\uE000-\uF8FF]/;

export async function bookInfo(id, tries = 3) {
  const url = `https://fanqienovel.com/api/book/info?bookId=${id}`;
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9", Accept: "application/json, text/plain, */*", Referer: "https://fanqienovel.com/" },
      });
      if (!res.ok) { const e = new Error("HTTP " + res.status); e.status = res.status; throw e; }
      const body = await res.text();
      if (!body.length) { const e = new Error("empty body"); e.softLimit = true; throw e; }
      if (!body.trimStart().startsWith("{")) { const e = new Error("non-json (redirected)"); e.softLimit = true; throw e; }
      return JSON.parse(body);
    } catch (e) {
      lastErr = e;
      const throttled = e.status === 403 || e.status === 429 || e.softLimit;
      if (throttled) console.warn(`  [throttled ${e.status ?? "empty-200"}] backing off 60s`);
      await sleep(throttled ? 60000 : 1500 * (i + 1));
    }
  }
  throw lastErr;
}

export function judge(rec) {
  const cats = rec.cats.map((c) => c.name);
  const hit = (text) => SIM_KW.filter((k) => String(text ?? "").includes(k));
  // 「模拟器」命中时「模拟」必然也命中，去重后保留两者供后续看写法分布
  const tHit = hit(rec.bookName);
  const gHit = [...new Set(cats.flatMap(hit))];
  const aHit = hit(rec.abstract);
  const matchedIn = [tHit.length && "title", gHit.length && "tag", aHit.length && "abstract"].filter(Boolean);
  const keywords = [...new Set([...tHit, ...gHit, ...aHit])];

  const condA = matchedIn.length > 0;
  const catCult = cats.some((c) => CULT_CAT.test(c));
  const absCult = CULT_KW.filter((k) => String(rec.abstract ?? "").includes(k));
  const condB = catCult || absCult.length > 0;
  return { condA, condB, matchedIn, keywords, catCult, absCult, cats };
}

// 默认跑主池（仙侠/玄幻八分类）。补跑非修仙分类的反向召回时用 IDS/INFO 换一对文件，
// 判据仍走上面这一个 judge()，两个池不会各长出一套口径。
const IDS = process.env.IDS || ".scrape/sim/ch2_ids.json";
const INFO = process.env.INFO || ".scrape/sim/ch2_info.json";

const pool = readJson(IDS, {});
const info = readJson(INFO, {});
const ids = Object.keys(pool);
const LIMIT = Number(process.env.LIMIT || ids.length);

let n = 0, done = 0, hits = 0, near = 0, errs = 0;
const t0 = Date.now();

for (const id of ids) {
  if (done >= LIMIT) break;
  n++;
  if (info[id]) { if (info[id]._hit) hits++; if (info[id]._near) near++; continue; }
  done++;
  try {
    const j = await bookInfo(id);
    const d = j?.data;
    if (!d || !d.bookName) throw new Error(`no data (code=${j?.code})`);
    const rec = {
      bookId: String(d.bookId ?? id),
      bookName: d.bookName,
      author: d.author || d.authorName || null,
      abstract: d.abstract || "",
      cats: asArray(d.categoryV2).map((c) => ({ id: c.ObjectId, name: c.Name, dim: c.Dim })),
      wordNumber: Number(d.wordNumber || 0),
      readCount: Number(d.readCount || 0),
      creationStatus: String(d.creationStatus ?? ""),
      lastPublishTime: Number(d.lastPublishTime || 0),
      genre: d.genre,
      pua: PUA.test(d.bookName) || PUA.test(d.abstract || ""),
      foundIn: pool[id].foundIn,
    };
    const v = judge(rec);
    rec._hit = v.condA && v.condB;
    rec._near = v.condA && !v.condB;
    rec._judge = v;
    info[id] = rec;
    if (rec._hit) { hits++; console.log(`  ★HIT ${rec.bookName} | ${v.matchedIn} ${v.keywords} | ${v.cats.join("/")}`); }
    else if (rec._near) { near++; console.log(`  ~near ${rec.bookName} | ${v.keywords} | ${v.cats.join("/")}`); }
  } catch (e) {
    info[id] = { bookId: id, _err: e.message, foundIn: pool[id].foundIn };
    errs++;
  }
  if (n % 20 === 0) {
    writeJson(INFO, info);
    const el = (Date.now() - t0) / 1000;
    const line = `${n}/${ids.length} resolved=${done} hits=${hits} near=${near} err=${errs} ${el.toFixed(0)}s eta=${(((ids.length - n) * el) / Math.max(done, 1) / 60).toFixed(1)}min`;
    console.log(line);
    fs.appendFileSync(".scrape/sim/ch2.log", line + "\n", "utf8");
  }
  await sleep(1050);
}

writeJson(INFO, info);
const sum = `\n步骤B完成（${IDS}）：解析 ${done} 本，命中(A∧B) ${hits}，nearMiss(A∧¬B) ${near}，错误 ${errs}`;
console.log(sum);
fs.appendFileSync(".scrape/sim/ch2.log", sum + "\n", "utf8");
