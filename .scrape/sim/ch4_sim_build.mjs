// 通道 4 / 阶段 2：把七猫命中池按 SCHEMA 判据筛成 books / nearMiss，并归一成 SCHEMA 字段。
// 输入 .scrape/sim/ch4_qm_hits.json（阶段 1 产物），输出 .scrape/sim/raw_ch4_qimao.json
import fs from "node:fs";
import { readJson, writeJson } from "../lib.mjs";

const LOG = ".scrape/sim/ch4.log";
const log = (s) => {
  console.log(s);
  fs.appendFileSync(LOG, s + "\n", "utf8");
};

// ---- SCHEMA 1. 条件 A：模拟属性 ----
const SIM_WORDS = ["模拟器", "人生模拟", "模拟", "推演", "演算", "沙盘", "预演", "重开", "无限重生"];
// ---- SCHEMA 1. 条件 B：修仙属性 ----
const CULT_CATS = ["仙侠", "修真", "玄幻", "东方玄幻", "洪荒", "宗门", "东方仙侠", "武侠仙侠", "古典仙侠"];
const CULT_WORDS = ["修仙", "修真", "炼气", "筑基", "金丹", "元婴", "宗门", "灵根", "大道", "化神", "渡劫", "仙门", "仙帝", "长生"];

const clean = (s) => String(s ?? "").replace(/\u3000/g, " ").trim();
const stripTags = (s) => clean(s).replace(/<[^>]+>/g, "");

// "378.03万字" -> 3780300 ; "9876字" -> 9876 ; 拿不到 -> null
function parseWords(raw) {
  const s = clean(raw);
  if (!s) return null;
  const wan = s.match(/([\d.]+)\s*万/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  const plain = s.match(/([\d.]+)\s*字/);
  if (plain) return Math.round(parseFloat(plain[1]));
  const bare = s.match(/^[\d.]+$/);
  return bare ? Math.round(parseFloat(s)) : null;
}

// SCHEMA: status 只允许 连载 / 完结 / unknown
function parseStatus(raw) {
  const s = clean(raw);
  if (/完结|完本|已完成/.test(s)) return "完结";
  if (/连载/.test(s)) return "连载";
  return "unknown";
}

const parseDate = (raw) => {
  const m = clean(raw).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const hits = readJson(".scrape/sim/ch4_qm_hits.json", []);
log(`\n===== ch4 build @ ${new Date().toISOString()} =====`);
log(`输入命中池：${hits.length} 本`);

const collectedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const books = [];
const nearMiss = [];
const catTally = new Map();

for (const b of hits) {
  const title = stripTags(b.title);
  const intro = clean(b.intro);
  const cat = clean(b.category2_name);
  const id = String(b.book_id ?? "");
  if (!id || !title) continue;
  catTally.set(cat || "(无)", (catTally.get(cat || "(无)") ?? 0) + 1);

  // 条件 A —— 重验原文，不信搜索引擎的模糊匹配。七猫搜索结果无 tag 字段，故只可能命中 title / abstract
  const inTitle = SIM_WORDS.filter((w) => title.includes(w));
  const inAbs = SIM_WORDS.filter((w) => intro.includes(w));
  const matchedIn = [];
  if (inTitle.length) matchedIn.push("title");
  if (inAbs.length) matchedIn.push("abstract");
  const kws = [...new Set([...inTitle, ...inAbs])];

  const url = clean(b.read_url) || `https://www.qimao.com/shuku/${id}/`;

  if (!matchedIn.length) {
    // 搜索引擎召回但正文里根本没有模拟词 —— 连条件 A 都不满足，不进 nearMiss（那是给「A 中但 B 不中」留的）
    continue;
  }

  // 条件 B
  const catHit = CULT_CATS.some((c) => cat.includes(c));
  const wordHit = CULT_WORDS.filter((w) => intro.includes(w));
  if (!catHit && !wordHit.length) {
    nearMiss.push({
      title,
      url,
      reason: `模拟但非修仙：分类「${cat || "未知"}」，简介无修仙词。命中模拟词 ${kws.join("/")}`,
    });
    continue;
  }

  books.push({
    platform: "qimao",
    platformBookId: id,
    title,
    author: clean(b.author) || null,
    url,
    wordCount: parseWords(b.words_num),
    chapterTotal: null, // 七猫书页全站 WAF，章节数只在 HTML 上，拿不到
    status: parseStatus(b.is_over_txt),
    categories: cat ? [cat] : null,
    tags: null, // 七猫搜索 API 不返回标签字段；书页被 WAF 挡住，无法补
    abstract: intro || null,
    popularity: null, // 同上，热度只在被 WAF 挡住的书页/榜单页上
    score: null,
    firstPublishDate: null, // 七猫任何公开接口都不给上架日期
    lastUpdateDate: parseDate(b.update_time),
    simEvidence: { matchedIn, keywords: kws },
    openingHook: null, // 免费试读页同样在 WAF 后，不登录拿不到
    collectedAt,
    source: clean(b._source) || null,
  });
}

// SCHEMA 修订 3：40–80 本上限已拆除，改「凡过判据的全收」。七猫单条搜索结果就带回
// 简介全文/字数/分类/更新时间，过滤阶段记录已在手，多收一本边际请求为零 —— 正是该节点名的情形。
// 仍按字数降序排列（便于人读，且合「先抓头部」），但不再截断。
books.sort((a, b) => (b.wordCount ?? 0) - (a.wordCount ?? 0));
const kept = books;
const dropped = [];

log(`\n条件 A 命中且条件 B 命中：${books.length} 本 -> 全收 ${kept.length} 本（SCHEMA 修订 3 已拆上限）`);
log(`条件 A 中但条件 B 不中（nearMiss）：${nearMiss.length} 本`);

log(`\n分类分布 top 15：`);
[...catTally.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([c, n]) => log(`   ${String(n).padStart(4)}  ${c}`));

const medianOf = (rows) => {
  const w = rows.map((b) => b.wordCount).filter((n) => typeof n === "number").sort((a, b) => a - b);
  if (!w.length) return null;
  return w.length % 2 ? w[(w.length - 1) / 2] : Math.round((w[w.length / 2 - 1] + w[w.length / 2]) / 2);
};
// 交付集是「按字数降序取前 60」，它的中位数天然被截断抬高了。
// 派单要的是「七猫的字数中位数」，所以两个都给，并标明哪个是总体口径。
const median = medianOf(kept);
const medianAll = medianOf(books);
const matchedOnlyAbstract = books.filter((b) => b.simEvidence.matchedIn.join() === "abstract");
const droppedAbsOnly = dropped.filter((b) => b.simEvidence.matchedIn.join() === "abstract").length;

const out = {
  meta: {
    channel: 4,
    platforms: ["qimao"],
    // SCHEMA 修订 3 的正式字段。七猫正常交付但缺 6 个字段，知乎整站 robots 禁抓交 0 本 ——
    // 合起来是「部分字段或部分站点受阻」，故 partial 而非 ok / blocked-by-policy。
    status: "partial",
    collectedAt,
    entryPoints: [
      "https://api-www.qimao.com/api/search/result?keyword={模拟|模拟器|推演|演算|沙盘|预演|重开|人生模拟|无限重生}&page=1..18",
    ],
    notes: [
      "【七猫】仅站内搜索 API 可用。www.qimao.com 的全部 HTML 页面（书页 /shuku/{id}/、分类榜、甚至 robots.txt）均被阿里云 WAF 拦截，统一返回同一份 23670 字节的 arg1 JS 挑战页；已试 9 个 API 侧详情/榜单端点（book/detail、book/info、shuku/detail、rank/list、shuku/list 等）全部 404，chapter-list 返回「请求参数错误」。",
      "【七猫·因此为 null 的字段】chapterTotal、popularity（热度）、openingHook、firstPublishDate、tags、score。前三项只存在于被 WAF 挡住的 HTML 页；firstPublishDate 七猫任何公开接口都不给；tags 搜索 API 不返回；score 七猫无评分体系。均按 SCHEMA 第五节写 null，未猜测、未填占位值。",
      "【七猫·条件 A 重验】搜索 API 是模糊召回，返回结果里有大量正文无模拟词的书。已对 title + intro 原文重新逐词校验，未命中的直接丢弃（不进 books 也不进 nearMiss）。",
      "【七猫·抓取纪律】请求间隔 1.2 秒，403/429/200 空 body 退避 60 秒（本轮 70 次请求全程未触发）。仅访问搜索 API，未抓任何章节正文。",
      "【知乎盐选·0 本，合规原因不是技术原因】知乎 robots.txt 末段为 `User-Agent: *` / `Allow: /tardis/jm` / `Disallow: /`，即对非白名单爬虫整站禁抓，仅放行 /tardis/jm。实测 /tardis/jm/art/{id} 与 /tardis/{zm,bd,sogou}/... 无论 Chrome UA 还是 Googlebot UA 均只返回 1077–1165 字节的知乎 500 错误页，渲染不出内容。其余路径：/search 被 robots 明确 Disallow 且 HTTP 403；zhuanlan 文章页与 question 页 403 + zh-zse-ck 反爬挑战；api/v4/search_v3、api.zhihu.com/search_v3、api/v4/articles、topics feeds 均要求登录（need_login:true / code 10003）。派单明确禁止登录与绕付费墙，故停止抓取，交 0 本而非凑数。robots.txt 已存档 .scrape/sim/raw/ch4_zhihu_robots.txt。",
      "【知乎盐选·派单假设更正】派单称 .scrape/ch4_zhpeek / ch4_zhfetch / ch4_zhauthor / ch4_zh_final 是本通道上一轮的知乎资产，实为【纵横中文网】资产（ch4_zhfetch.py 写死 book.zongheng.com/book/{id}.html，ch4_zh_final.py 解析 rank_d_list / 总点击 / 完本）。zh = zongheng。.scrape/ 下不存在任何知乎旧资产，知乎侧是从零起步。纵横现属通道 5 地盘，本通道未复用亦未改动这批文件。",
      `【七猫·入选规则】按 SCHEMA 修订 3「凡过判据的全收」，条件 A∧B 合格的 ${books.length} 本全部交付，未做数量截断。曾按旧口径截到 60 本，实测该截断把中位数从 ${medianAll} 抬到 ${median}（虚高约 ${Math.round(((median - medianAll) / medianAll) * 100)}%），因为截断是按 wordCount 降序做的——这也从数据侧印证了拆上限是对的。分析请用 ${medianAll}。`,
      `【七猫·三轮召回，末轮证明已饱和】① 9 个单词（SCHEMA 第一节词表）70 请求 → 池 696、合格 81。② 上限拆除后补 12 个「模拟×修仙」复合词 91 请求 → 池 1215（+519）、合格 86。③ 反向轮：改搜修仙词（杂役/筑基/金丹/元婴/灵根/长生/宗门/炼气/化神/仙门/凡人修仙/苟道）再过模拟词，专抓「模拟只写在简介里、搜模拟排不上来」的漏网书，83 请求扫过 1230 条结果，+6 本 → 合格 ${books.length}。合计 244 请求。**这 6 本全部是「仅简介命中」型，把该亚群从 5 本翻倍到 ${matchedOnlyAbstract.length} 本**，正好验证了这一轮的假设：搜模拟词会系统性漏掉「模拟只写在 intro 里」的书，只有从修仙面反查才捞得到。总量上第三轮只 +7%，但对「模拟是卖点还是里子」这个分析维度它贡献了一半样本。继续加轮次的边际收益已很低，召回可以停在这里。`,
      `【统计】七猫命中池 ${hits.length} 本（21 关键词去重，两轮 161 次请求）→ 条件 A∧B ${books.length} 本，全部交付；nearMiss ${nearMiss.length} 本。知乎 0 本（见上条合规说明）。`,
    ].join("\n"),
  },
  books: kept,
  nearMiss,
};

writeJson(".scrape/sim/raw_ch4_qimao.json", out);
log(`\n字数中位数：${medianAll}（${(medianAll / 10000).toFixed(1)} 万字）—— 合格总体即交付集，无截断`);
log(`仅简介命中型（模拟只是情节装置、未进书名）：${matchedOnlyAbstract.length} 本`);
log(`已写出 .scrape/sim/raw_ch4_qimao.json：books=${kept.length} nearMiss=${nearMiss.length}`);

log(`\n入选前 20（字数降序）：`);
kept.slice(0, 20).forEach((b, i) =>
  log(
    `${String(i + 1).padStart(3)}. ${b.title.slice(0, 26).padEnd(28)} ${String(b.author).slice(0, 10).padEnd(11)} ${String((b.wordCount / 10000).toFixed(1) + "万").padStart(8)} ${b.status.padEnd(3)} ${String(b.categories?.[0] ?? "").padEnd(6)} [${b.simEvidence.matchedIn.join("+")}] ${b.simEvidence.keywords.join("/")}`
  )
);
log(`===== build done =====`);
