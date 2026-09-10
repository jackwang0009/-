// 通道 3 · 组装 .scrape/sim/raw_ch3_alt.json（SCHEMA 第 2/3 节字段契约）。
// 输入：ch3_alt_candidates.json（列表页池，含分类/作者/状态/列表页字数）
//       ch3_alt_pages.json（书页全量字段：简介全文、标签、字数、周人气、章数、更新日）
//       ch3_shuqi_books.json（书旗侧产出，存在才并入；不存在则该站记 0 本并在 notes 说明）
// 口径：SCHEMA 修订 3 已拆掉 40–80 本上限 → 凡过 A∧B 的全收，不截断。
//       popularity 不跨站折算：塔读记 metric="周人气"，书旗记它自己的口径。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "../lib.mjs";
import { KW_SIM, KW_XIU, simHits } from "./ch3_alt_kw.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const COLLECTED_AT = new Date().toISOString();

// SCHEMA 条件 B 的分类白名单（仙侠/修真/玄幻/东方玄幻/洪荒/宗门 一类）
const CAT_B = /仙侠|修真|玄幻|洪荒|宗门|仙侠|奇幻/;
const REL_CATS = ["东方玄幻", "武侠仙侠", "脑洞创意"];

const cand = readJson(path.join(DIR, "ch3_alt_candidates.json"));
const pages = readJson(path.join(DIR, "ch3_alt_pages.json"));

// SCHEMA 条件 A 把「重开」「无限重生」限定为「同一段时间反复重来」义，命中后需人工复核。
// 本池 4 本「重开」逐条看过原文（取证见 ch3_alt_review.mjs 输出），词义全部不符：修仙文里
// 「重开」压倒性地是「天地重开／乱世重开／重开山门」这类开天辟地义，不是重来一遍。
// 判定写死在这里而不是靠正则，是因为这是人看了原文下的结论，得可追、可推翻。
const LOOSE_VERDICT = {
  851568: ["reject", "「天地重开，万族尽殁」——开天辟地义，非同一段时间反复重来"],
  860570: ["reject", "「天劫又至，乱世重开」——世道重启义，非反复重来"],
  849671: ["reject", "「通天欲重开世界，唯其独尊」——重造世界义，非反复重来"],
  1002264: ["reject", "「重开登仙之门，续世间已断五千年之仙路」——重启仙路义，非反复重来"],
};

const notes = [];
const books = [];
const nearMiss = [];

// ---------- 塔读 ----------
// 判据在「书名 + 标签 + 简介全文」三处上跑，与 SCHEMA 条件 A 的三处一致。
// 列表页那版判据只看书名+截断摘要，会漏「模拟只写在简介后半段」的书，故一律以书页全文为准。
let tadNoPage = 0;
let looseRejected = 0;
for (const c of cand.books) {
  const p = pages[c.id];
  const inRel = REL_CATS.includes(c.cat);
  const abstract = p && !p.error ? p.abstract || null : null;
  const tags = p && !p.error ? p.tags ?? [] : [];

  const hitTitle = simHits(c.title);
  const hitTags = simHits(tags.join(" "));
  const hitAbs = simHits(abstract ?? "");
  const matchedIn = [];
  if (hitTitle.length) matchedIn.push("title");
  if (hitTags.length) matchedIn.push("tag");
  if (hitAbs.length) matchedIn.push("abstract");
  const keywords = [...new Set([...hitTitle, ...hitTags, ...hitAbs])];
  const condA = keywords.length > 0;
  if (!condA) continue;

  const url0 = `https://www.tadu.com/book/${c.id}/`;
  const verdict = LOOSE_VERDICT[c.id];
  if (verdict?.[0] === "reject") {
    nearMiss.push({
      title: c.title,
      url: url0,
      reason: `词形命中「${keywords.join("/")}」但词义不符：${verdict[1]}。按 SCHEMA 条件 A 的限定义排除`,
    });
    looseRejected++;
    continue;
  }

  const catB = CAT_B.test(c.cat) || tags.some((t) => CAT_B.test(t));
  const absB = KW_XIU.some((k) => (abstract ?? "").includes(k) || c.intro.includes(k));
  const condB = catB || absB;

  const url = url0;
  if (!condB) {
    nearMiss.push({
      title: c.title,
      url,
      reason: `模拟但非修仙：分类「${c.cat}」，简介无修仙词（命中模拟词 ${keywords.join("/")}）`,
    });
    continue;
  }
  if (!inRel || !p || p.error) {
    // 现代都市分类没有取书页（本就只用于 nearMiss）；若它同时过了 A∧B，缺字段不能硬交
    tadNoPage++;
    nearMiss.push({
      title: c.title,
      url,
      reason: `模拟+修仙词命中但未取书页（分类「${c.cat}」不在本轮取页范围），字段不全，不计入 books`,
    });
    continue;
  }

  books.push({
    platform: "tadu",
    platformBookId: c.id,
    title: c.title,
    author: c.author || null,
    url,
    wordCount: p.wordCount ?? c.wordCount ?? null,
    chapterTotal: p.chapterTotal ?? null,
    status: ["连载", "完结"].includes(c.status) ? c.status : "unknown",
    categories: [c.cat],
    tags,
    abstract,
    popularity: { metric: "周人气", raw: p.popularityRaw ?? null },
    score: null,
    firstPublishDate: null,
    lastUpdateDate: p.lastUpdateDate ?? null,
    simEvidence: { matchedIn, keywords },
    openingHook: null,
    collectedAt: COLLECTED_AT,
    source: "https://www.tadu.com/store/{99|109|135}-a-0-15-a-20-p-{页}-909",
  });
}

// ---------- 书旗 ----------
const sq = readJson(path.join(DIR, "ch3_shuqi_books.json"));
if (sq) {
  for (const b of sq.books ?? []) books.push(b);
  for (const n of sq.nearMiss ?? []) nearMiss.push(n);
  if (sq.notes) notes.push(sq.notes);
}
// 书旗这一格交 0 本，且理由不是「没开工」而是撞墙——和 raw_ch3_qidian.json 是同一种东西。
// 机器可读地摆在 meta 里，合并脚本与人都不必去 notes 里读长句才能分辨。
const shuqiRecheck = readJson(path.join(DIR, "ch3_shuqi_recheck.json"));

// ---------- 统计与落盘 ----------
const byPlatform = {};
for (const b of books) byPlatform[b.platform] = (byPlatform[b.platform] ?? 0) + 1;
const wc = books.map((b) => b.wordCount).filter(Number.isInteger).sort((a, b) => a - b);
const median = wc.length ? (wc.length % 2 ? wc[(wc.length - 1) / 2] : Math.round((wc[wc.length / 2 - 1] + wc[wc.length / 2]) / 2)) : null;

const emptyAbs = Object.values(pages).filter((v) => !v.error && !v.abstract).length;
const years = {};
for (const v of Object.values(pages)) {
  if (v.error || !v.lastUpdateDate) continue;
  const y = v.lastUpdateDate.slice(0, 4);
  years[y] = (years[y] ?? 0) + 1;
}

notes.push(
  `【入口】塔读站内搜索被 robots 明禁（/search、/search?query=*），改走 /store 分类页。扫三个与条件 B 相关的分类` +
    `（99 东方玄幻 / 109 武侠仙侠 / 135 脑洞创意）共 ${Object.keys(pages).length} 本，逐本取书页拿简介全文与标签；` +
    `103 现代都市 ${cand.books.filter((b) => b.cat === "现代都市").length} 本只扫列表页，仅用于 nearMiss（其条件 A 命中 0 本）。`,
);
notes.push(
  `【那 396 本空字段的结论：不是站方不给，也不是选择器漂了，是取回的响应本身不是书页】` +
    `ch3_fetch.log 记的「简介为空 396 本，字数为空 396 本」经查是同一批书（交集 396，无一只空一项），` +
    `且简介/标签/字数/周人气/总银票/章数/更新日七项同时为空——整条解析链一起断，而不是某一个选择器失配。` +
    `取证三步：① 这 396 本在列表页全部拿得到字数，数据在站上确实存在；` +
    `② 重抓其中 9 本落盘对比（raw/ch3_alt_probe_*.html），老正则原样跑过去七项全部正常解出，选择器没问题；` +
    `③ 这 396 本在原抓取顺序里只构成 2 个连续段（位置 0–561），是时间窗而非按书散布。` +
    `即 22:20 那轮在一段时间内被站方返了非书页响应，HTTP 200、不空 body、不抛异常，解析器安静地返回一堆 null——` +
    `SCHEMA 第 4 节点名的「不报错的那一类失败」。ch3_alt_fetch.mjs 缺的正是那条「异常短就当失败」的断言。` +
    `处置：ch3_alt_refetch.mjs 补上断言（<20000 字节或无 datum 块即判失败退避重试）后全量重取，396/396 修复，全库剩余空简介 0。`,
);
notes.push(
  `【「重开」是假阳性重灾区】条件 A 词表里的「重开」在修仙文里压倒性地是「天地重开／乱世重开／重开山门」这类开天辟地义。` +
    `本池 4 本「重开」命中逐条看原文后全部排除（已列入 nearMiss 并附原句），无一是「同一段时间反复重来」。` +
    `词形命中率 4/5 而词义命中率 0/4——这个词单独用不可靠，建议通道 1 考虑要么给它加「模拟／重来／循环」的共现约束，要么在合并时对它单独复核。`,
);
notes.push(
  `【分页上限造成的已知缺口，已量化】塔读每个分类的列表页最多 30 页（实测 p31 起 0 条），` +
    `即每类至多露出约 600 个位次；换排序（最新发布 / 周人气）抽查 p1 与 p30 各一页，池外新书分别为 2/3 与 1/2 本，` +
    `约一成。要吃掉这个缺口需 4 种排序 × 三类 60 页 ≈ 240 次列表请求外加新候选的书页请求，` +
    `而本池 1061 本的实收率是 1/1061，预期增量 0–1 本，故本轮不扫，缺口留在这里由通道 1 定夺。`,
);
notes.push(
  `【书旗 shuqi 交 0 本：新墙，不在 SCHEMA 第 6 节里】robots.txt 今天仍可 200 读到（23325 字节，内容与 ch3_robots_verdict.json 一致，` +
    `对 * 未整站禁止），但除 robots.txt 外每一个路径都返回 1120 字节的「403 - 访问被拒绝」页（Tengine）：` +
    `首页、书页 /book/{id}.html、搜索、以及它自己 robots 里公示的 sitemap 全部 403；m.shuqi.com 域名不解析。` +
    `即站方 robots 层面允许、边缘层面拦截本代理。绕它需要换身份或喂 Cookie，属规避反爬，不做。` +
    `取证：raw/ch3_shuqi_*.html、raw/ch3_shuqi_recheck_*.txt、ch3_shuqi_recheck.json。`,
);
notes.push(
  `【字段缺失口径】openingHook 一律 null：塔读试读正文属章节内容，SCHEMA 第 4 节禁抓，未取。` +
    `firstPublishDate 一律 null：塔读书页与列表页都不公开首发日期，只给最新章节时间，无处可取。` +
    `popularity.metric="周人气" 取自书页 datum 块原始标签，未跨站折算；该值大面积为 0 是站方原样显示，不是没取到。`,
);
notes.push(
  `【存量年份分布，供解读产量用】塔读三类 ${Object.keys(pages).length} 本的最新章节年份：${JSON.stringify(years)}。`,
);
if (emptyAbs) notes.push(`⚠ 重取后仍空简介 ${emptyAbs} 本。`);

writeJson(path.join(DIR, "raw_ch3_alt.json"), {
  meta: {
    channel: 3,
    platforms: sq ? ["tadu", "shuqi"] : ["tadu"],
    status: sq && sq.status === "ok" ? "ok" : "partial",
    collectedAt: COLLECTED_AT,
    entryPoints: [
      "https://www.tadu.com/store/99-a-0-15-a-20-p-{页}-909",
      "https://www.tadu.com/store/109-a-0-15-a-20-p-{页}-909",
      "https://www.tadu.com/store/135-a-0-15-a-20-p-{页}-909",
      "https://www.tadu.com/store/103-a-0-15-a-20-p-{页}-909（仅供 nearMiss）",
      ...(sq?.entryPoints ?? []),
    ],
    notes: notes.join("\n"),
    byPlatform,
    wordCountMedian: median,
    poolScanned: cand.books.length,
    bookPagesFetched: Object.keys(pages).length,
    // 分站交付状态：0 本是「撞墙」还是「没开工」，这里机器可判，不必读 notes
    perSite: {
      tadu: { status: "ok", books: books.filter((b) => b.platform === "tadu").length, blocked: null },
      shuqi: {
        status: "blocked-by-anti-bot",
        books: 0,
        blocked:
          "robots.txt 可读且对 * 未整站禁止，但除 robots.txt 外全部路径返回 1120 字节「403 - 访问被拒绝」（Tengine），" +
          "含首页 / 书页 / 搜索 / 它自己公示的 sitemap；m.shuqi.com 不解析。绕过需换身份或喂 Cookie，属规避反爬，未做。",
        evidence: (shuqiRecheck ?? []).map((r) => `${r.url} → ${r.status ?? "ERR " + r.error}${r.bytes != null ? ` (${r.bytes}B)` : ""}`),
        note: "这是 SCHEMA 第 6 节尚未收录的新墙（该节现记书旗为「可抓」），按第 6 节规矩回报通道 1 增补，本通道不改 SCHEMA.md。",
      },
    },
  },
  books,
  nearMiss,
});

console.log(`books ${books.length}（${JSON.stringify(byPlatform)}），nearMiss ${nearMiss.length}`);
console.log(`字数中位数 ${median}；词义复核排除 ${looseRejected} 本；未取书页而落入 nearMiss 的 ${tadNoPage} 本`);
console.log(`塔读存量年份分布 ${JSON.stringify(years)}`);
for (const b of books) console.log(`  ✓ ${b.platform} ${b.title} — ${b.author}｜${b.wordCount}字｜${b.simEvidence.keywords.join("/")} @ ${b.simEvidence.matchedIn.join("+")}`);
for (const n of nearMiss) console.log(`  · nearMiss ${n.title}：${n.reason}`);
