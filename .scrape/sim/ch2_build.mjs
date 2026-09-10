// 步骤 C：把命中集组装成 SCHEMA.md 规定的交付结构。
// book/info 没有 chapterTotal 和首发时间，这两项只有书页 __INITIAL_STATE__ 有，
// 所以只对命中的书各回一次书页（不对全池回，省掉一千多次请求）。
import fs from "node:fs";
import { get, extractState, sleep, readJson, writeJson, asArray, ts } from "../lib.mjs";

const CAT_TAXONOMY = readJson(".scrape/sim/raw/ch2_probe_categories.json", { data: [] }).data;
const MAIN_CATS = new Set(CAT_TAXONOMY.filter((c) => c.label === "主分类").map((c) => c.name));

const STATUS = { "0": "完结", "1": "连载" };
const iso = (sec) => (sec ? new Date(sec * 1000).toISOString().slice(0, 10) : null);

// 两个候选池：主池是仙侠/玄幻八分类，补池是非修仙分类的反向召回。
// 主池的 condB 恒为真（八个入口分类名本身就满足条件B），所以 A∧¬B 只可能出自补池，
// nearMiss 这一格必须靠补池才拿得到。详见 meta.notes 里 nearMiss 那两条。
const info = readJson(".scrape/sim/ch2_info.json", {});
const infoNon = readJson(".scrape/sim/ch2_info_noncult.json", {});

const merged = { ...infoNon, ...info };
for (const [id, r] of Object.entries(merged)) {
  const a = infoNon[id]?.foundIn ?? [];
  const b = info[id]?.foundIn ?? [];
  if (a.length && b.length) r.foundIn = [...new Set([...b, ...a])];
}

// 通道 1 裁定，已立为 SCHEMA 修订 6 判例：条件B 那句「或简介中出现修仙…」是用来捞回
// 「分类标错、但主线确实是修仙」的书，不是用来收「某一期节目的题材碰巧是修仙」的书。
// 按 bookId 逐本登记，不去动 judge() 的判据本身——把这条裁定一般化成「仅靠简介词成立
// 就降级」会误伤将来真正分类标错的修仙书，那正是这句判据存在的理由。
// 第二批：SCHEMA 修订 6「『重开』是词形陷阱，命中它必须回原句看词义」。
// 番茄侧命中「重开」11 本，且 11 本**全部**以「重开」为唯一条件A 证据（无一本另有
// 模拟/模拟器/推演兜底），所以判假一本就降一本，没有缓冲。
// 判据沿用通道 5 在飞卢/纵横那批上用过的同一把尺子：「重开」直接带宾语（天地／大道／
// 天路／轮回／魔渊／药铺）＝「重新开启某物」，属开天辟地义，不是「同一段时间反复重来」；
// 作不及物或带次数时才是重来义。逐本原句附在下面，痕迹可推翻。
// 裁定人：通道 2（2026-09-09 接任总指挥后裁；原总指挥通道 1 已离线）。
const CK = (原句, 理由) =>
  `SCHEMA 修订6「重开」词义复核：条件A 不成立。原句「${原句}」——${理由}。` +
  `本书「重开」是唯一条件A 证据，词义不成立即不满足条件A，故不收。`;

const DEMOTED = {
  "7663036049270000702": CK("斩邪神、诛仇敌，重开轮回", "带宾语「轮回」，重新开启轮回，开天辟地义"),
  "7669021476468558873": CK("他撕裂混沌，重开天地", "带宾语「天地」，标准开天辟地义"),
  "7656806334385376280": CK("只为等待仙路重开", "「仙路」重新开启，重启仙路义"),
  "6903349659985513479": CK("自天地重开，灵气重现", "带宾语「天地」，开天辟地义"),
  "7533671107010776126": CK("看石来如何重开天路，再续仙缘", "带宾语「天路」，开辟义"),
  "7622126325096008766": CK("既然旧路已断，那便以身为界，重开新天", "带宾语「新天」，开辟义"),
  "7679100063531944985": CK("集齐九钱的人，能重开天路", "带宾语「天路」，开辟义"),
  "7683144122986662937": CK("那便由我，重开一条拾尘逆道", "带宾语「逆道」，开辟义"),
  "7683155600150154264": CK("有人欲碎神界重开魔渊", "带宾语「魔渊」，开启义"),
  "7682327502844349502": CK("药铺重开，灵田复种，镖局走线", "**店铺重新开张**，与修仙机制全无关系，本批最干净的假阳性"),
  // 保留不降：7647885772179115033《死回仙尊》——「他死一次就能原地复活，修为还能回潮重开」，
  // 「重开」不带宾语、主语是修为，配合「死一次就原地复活」与书名「死回」，整本是死亡重试循环，
  // 属「同一段时间反复重来」义，条件A 成立。
  "7646237483482483774":
    "通道1 裁定（SCHEMA 修订 6 判例）：条件A 成立（简介含「模拟」），条件B 不成立。" +
    "分类为都市脑洞/都市/系统/穿越/搞笑轻松/群像，全书主线是综艺节目脑洞；" +
    "触发条件B 的是简介里独立成行的一句节目单原文「【第六期·修仙模拟之战】」——" +
    "修仙只是其中一期节目的题材，不是主线。属 SCHEMA 第1节「只满足 A 不收」。",
};

const recs = Object.values(merged).filter((r) => !r._err);
const hitsRaw = recs.filter((r) => r._hit);
const hits = hitsRaw.filter((r) => !DEMOTED[r.bookId]);
const demoted = hitsRaw.filter((r) => DEMOTED[r.bookId]);
const nears = recs.filter((r) => r._near);

const nMain = Object.keys(info).length;
const nNon = Object.keys(infoNon).length;

// 两池的召回方式不同（主池按仙侠/玄幻分类枚举，补池按非修仙分类反向召回），合成一个数之后
// 必须还能分得开，否则下一个拿这份数据的人会把它当成一次均匀抽样。
// SCHEMA 第 2 节禁止自造字段名，所以不新增字段，把池名标进既有的 source 里。
const poolOf = (id) =>
  info[id] && infoNon[id] ? "主池+补池" : info[id] ? "主池" : "补池";

// 「仅 title / 仅 abstract / 两者都」要分开给，合成一个数会把结论稀掉。
// tag 不列：番茄没有模拟类标签，结构上不可能命中，恒为 0。
function matchedInSplit(list) {
  let t = 0, a = 0, both = 0;
  for (const b of list) {
    const hasT = b.simEvidence.matchedIn.includes("title");
    const hasA = b.simEvidence.matchedIn.includes("abstract");
    if (hasT && hasA) both++;
    else if (hasT) t++;
    else if (hasA) a++;
  }
  return `${list.length} 本：仅title ${t} / 仅abstract ${a} / 两者都 ${both}`;
}

// nearMiss 那条 note 要引的实算值，别写死数字（重跑一次就过期）
const fromNon = new Set(Object.keys(infoNon).filter((id) => !info[id]));
const mainRecs = Object.values(info).filter((r) => !r._err);
const mainJudged = mainRecs.filter((r) => "_near" in r && r._judge).length;
const mainCondB = mainRecs.filter((r) => r._judge?.condB).length;
const mainCondBByCat = mainRecs.filter((r) => r._judge?.catCult).length;
console.log(`已解析 ${recs.length} 本（主池 ${nMain} + 补池 ${nNon}，去重后 ${Object.keys(merged).length}）；命中 ${hitsRaw.length} 本，其中 ${demoted.length} 本经裁定降级并入 nearMiss → books ${hits.length}，nearMiss ${nears.length + demoted.length}`);

const pages = readJson(".scrape/sim/ch2_pages.json", {});
let n = 0;
for (const r of hits) {
  n++;
  if (pages[r.bookId]) continue;
  try {
    const html = await get(`https://fanqienovel.com/page/${r.bookId}`);
    const p = extractState(html)?.page;
    if (!p) throw new Error("no state");
    const chapters = asArray(p.chapterListWithVolume).flatMap(asArray);
    const first = chapters.length
      ? chapters.reduce((a, b) => (Number(a.realChapterOrder) <= Number(b.realChapterOrder) ? a : b))
      : null;
    pages[r.bookId] = {
      chapterTotal: Number(p.chapterTotal || chapters.length || 0) || null,
      firstPassTime: Number(first?.firstPassTime || 0) || null,
    };
    console.log(`  ${n}/${hits.length} ${r.bookName} ch=${pages[r.bookId].chapterTotal} first=${iso(pages[r.bookId].firstPassTime)}`);
  } catch (e) {
    pages[r.bookId] = { chapterTotal: null, firstPassTime: null, _err: e.message };
    console.log(`  ${n}/${hits.length} ERR ${r.bookName} ${e.message}`);
  }
  if (n % 10 === 0) writeJson(".scrape/sim/ch2_pages.json", pages);
  await sleep(1150);
}
writeJson(".scrape/sim/ch2_pages.json", pages);

const collectedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");

const books = hits
  .sort((a, b) => b.readCount - a.readCount)
  .map((r) => {
    const pg = pages[r.bookId] || {};
    const catNames = r.cats.map((c) => c.name);
    return {
      platform: "fanqie",
      platformBookId: r.bookId,
      title: r.bookName,
      author: r.author,
      url: `https://fanqienovel.com/page/${r.bookId}`,
      wordCount: r.wordNumber || null,
      chapterTotal: pg.chapterTotal ?? null,
      status: STATUS[r.creationStatus] ?? "unknown",
      categories: catNames.filter((c) => MAIN_CATS.has(c)),
      tags: catNames.filter((c) => !MAIN_CATS.has(c)),
      abstract: r.abstract || null,
      popularity: { metric: "在读", raw: r.readCount || null },
      score: null,
      firstPublishDate: iso(pg.firstPassTime),
      lastUpdateDate: iso(r.lastPublishTime),
      simEvidence: { matchedIn: r._judge.matchedIn, keywords: r._judge.keywords },
      openingHook: null,
      collectedAt,
      source: `[${poolOf(r.bookId)}] https://fanqienovel.com/api/library/book_list (${r.foundIn.join("; ")})`,
    };
  });

const nearMiss = [...nears, ...demoted]
  .sort((a, b) => b.readCount - a.readCount)
  .map((r) => ({
    title: r.bookName,
    url: `https://fanqienovel.com/page/${r.bookId}`,
    reason: DEMOTED[r.bookId]
      ? `[${poolOf(r.bookId)}][裁定降级] ${DEMOTED[r.bookId]}`
      : `[${poolOf(r.bookId)}] 命中模拟词 ${r._judge.keywords.join("/")}（${r._judge.matchedIn.join("+")}），但不满足修仙条件：分类为 ${r.cats.map((c) => c.name).join("/") || "(无)"}，简介无修仙/炼气/筑基一类词`,
  }));

const out = {
  meta: {
    channel: 2,
    platforms: ["fanqie"],
    // partial 而非 ok：站内搜索被验证码挡死，召回只能走分类浏览的头部抽样（理由见 notes 第 2、
    // 倒数第 2 条）；另有 openingHook / score 两个字段整列为 null、1 本 chapterTotal 因书页 404 缺失。
    // 不是撞墙放弃（那是 blocked-by-policy），也不是没开工。
    status: "partial",
    collectedAt,
    entryPoints: [
      "https://fanqienovel.com/api/library/book_list?gender=1&category_id={1140|258|257|124|511|259|66|7}&creation_status=-1&word_count=-1&sort={0|1}&page_index=0..11&page_count=20",
      "https://fanqienovel.com/api/book/info?bookId={id}",
      "https://fanqienovel.com/page/{id}",
      "本地种子 .scrape/fq_books.json（360 本既有番茄榜单采样）",
    ],
    notes: [
      "robots.txt 为 `User-agent: * / Allow:/`，无禁抓路径。",
      "站内搜索未能使用：/api/author/search/search_book/v1 确为官方搜索端点（已从 Search.53ebdaa2.js 确认参数形态 filter/page_count/page_index/query_type/query_word），但搜索页挂载了 secsdk/captcha 安全 SDK，裸请求一律返回 HTTP 200 + 空 body；绕过它属于破反爬保护，未做。/search?q= 与 /searchPage 均 404，/search/{kw} 是 SPA 壳（search.loading=true, searchBookList=null，不 SSR 结果）。因此本通道的扩池改走分类浏览端点 /api/library/book_list。",
      "列表接口 /api/library/book_list 的文本字段被私有字体混淆，实测 20 本样本：abstract 20/20 脏（PUA 占比 29–48%）、book_name 18/20、author 14/20、word_count 与 read_count 20/20；book_id、creation_status、last_chapter_time 干净。故列表层只取 bookId，书名/简介/字数一律以 /api/book/info?bookId=（返回干净文本）为准，未做任何字体反解。",
      "openingHook 全部为 null：SCHEMA 第 4 节要求不抓正文章节内容，本通道据此未请求任何试读/阅读页，不是抓取失败。",
      "score 全部为 null：番茄书页与 book/info 均不提供评分字段，平台不公开评分。",
      "chapterTotal 与 firstPublishDate 来自书页 __INITIAL_STATE__.page（chapterTotal 与首章 firstPassTime）；book/info 不含这两项。个别书页取不到时写 null。",
      "status 映射经实测校验：creationStatus=\"1\" 的书页渲染为「连载中」，故 1→连载、0→完结。",
      "wordCount 取 book/info 的 wordNumber（已是「字」的整数），未做万字折算。",
      "popularity.metric 固定为「在读」，raw 为 book/info 的 readCount 原始值，未折算。",
      "番茄 260 个分类节点（/api/author/book/category_list/v0/）中没有「模拟/模拟器/推演/重开」任何一个标签——平台没有为这一题材设标签（同级别的 系统 19、无限流 70、升级流 830、副本 864 都有）。因此 simEvidence.matchedIn 在番茄这一侧只可能是 title 与 abstract，tag 结构上不可能命中。",
      "categories / tags 的切分依据分类表的 label 字段：label=「主分类」入 categories，「主题」「角色」「情节」入 tags。",
      `抽样口径：主池为八个仙侠/玄幻系分类 × 两种排序 × 12 页，去重得 ${nMain} 个 bookId，再逐本解析判定。这是头部抽样而非全站普查，番茄该题材的绝对存量高于本文件的收录数。`,
      `nearMiss 曾经为 0，原因不是判定代码漏了 A∧¬B 分支，而是候选池在打条件A 之前就已经被条件B 过滤过一遍：主池可用 ${mainRecs.length} 本里 condB 为真的有 ${mainCondB} 本（其中 ${mainCondBByCat} 本靠分类成立），因为步骤A 枚举的八个入口分类——东方仙侠/传统玄幻/玄幻脑洞/都市修真/东方玄幻/奇幻仙侠/洪荒/玄幻——分类名本身就命中条件B。在这个池子上 A∧¬B 是数学上不可能的事件，0 不是数据的形状。核验脚本 ch2_nearcheck.mjs（纯离线）：_near 与 _judge 字段 ${mainJudged}/${mainRecs.length} 条齐全，落盘没有问题。`,
      `因此按 SCHEMA 第 5 节补了一轮反向召回，方向与主池相反：枚举五个非修仙分类（都市脑洞 262 / 游戏体育 746 / 都市种田 263 / 科幻末世 8 / 西方奇幻 1141）× 两种排序 × 3 页，得补池 ${nNon} 本，再用同一个 judge() 判定。SCHEMA 举的三个 nearMiss 例子（都市模拟、足球模拟、种田模拟）正好落在前三个分类里。补池是有界探针，用于量化「模拟但非修仙」这个亚群并给出边界样本，不是这五个分类的普查。`,
      `补召回的结果：nearMiss 从 0 变成 ${nears.length} 条，全部出自补池；books 增加 ${hits.filter((r) => fromNon.has(r.bookId)).length} 本（分类不在仙侠/玄幻系、靠简介里的修仙词满足条件B，是主池按分类枚举系统性够不到的那一类，其 source 字段可见来源分类）。补池另有 3 本命中书与主池重复（西方奇幻类同时挂着奇幻仙侠/玄幻分类），已按 bookId 去重。`,
      `一本边界样本经通道 1 裁定降级，已从 books 移入 nearMiss：「让你拍节目，你让项羽撕秦始皇？」（bookId 7646237483482483774）。它是本文件唯一一本分类不属仙侠系、仅靠简介词满足条件B 的书，触发处是简介里独立成行的节目单「【第六期·修仙模拟之战】」。裁定口径：条件B 那句「或简介中出现修仙…」是用来捞回分类标错、但主线确实是修仙的书，不是用来收某一期节目题材碰巧是修仙的书，故属 SCHEMA 第1节「只满足 A 不收」。原句已留在该条 nearMiss 的 reason 里，痕迹可推翻。此裁定已立为 SCHEMA 修订 6 判例，本文件按 bookId 逐本登记执行，未修改 judge() 的判据本身——把它一般化成「仅靠简介词成立就降级」会误伤将来真正分类标错的修仙书。`,
      `另做过一次假阳性审计（ch2_report.mjs）：条件B 的简介词表里「大道」是宽词，「大道理」「大道上」都含它，主池靠分类满足B 会把这个风险掩盖掉。审计逐条摊开了所有「仅靠简介词入选」的书，实测 0 本是靠「大道」单独成立的，故本文件不含该类假阳性。`,
      "两池溯源：每条 books 与 nearMiss 的 source / reason 开头都带池名标签——[主池] 为仙侠/玄幻八分类枚举，[补池] 为非修仙五分类反向召回，[主池+补池] 为两轮都枚举到、已按 bookId 去重的书。两池召回方式不同，合成一个数之后不要当成一次均匀抽样；按池分开统计的口径见下一条。",
      `按池分列的命中方式分布（本文件唯一未被召回方式污染的比例口径）：全部 ${matchedInSplit(books)}；主池 ${matchedInSplit(books.filter((b) => !b.source.startsWith("[补池]")))}；补池 ${matchedInSplit(books.filter((b) => b.source.startsWith("[补池]")))}。这个比例在番茄侧不存在同义反复：站内搜索被验证码挡死，入池走的是分类浏览端点，与书名里有没有模拟词完全无关——按书名搜再去数书名命中率的那种偏差，这一格没有。`,
      // SCHEMA 第 3 节的文件结构写的是 notes 为字符串，五份交付里只有本文件一直是数组——
      // 一直没出事只是运气：合并脚本用 `?? null` 取值不会抛，但任何对 notes 做字符串操作的
      // 下游都会断（通道 3 今天就在七猫那份上被 .match() 抛过一次）。写盘前 join 成字符串，
      // 数组只在源码里保留，方便一条一条读写。
      "meta.status=partial 的三个理由：① 站内搜索整条路被 secsdk 验证码挡死，召回只能靠分类浏览，是头部抽样不是全站普查；② openingHook 与 score 两个字段整列为 null；③ 1 本书（逆道拾尘）书页返回 404，chapterTotal 与 firstPublishDate 为 null。都不构成整站放弃，故不是 blocked-by-policy。",
    ],
  },
  books,
  nearMiss,
};

out.meta.notes = out.meta.notes.join("\n");
writeJson(".scrape/sim/raw_ch2_fanqie.json", out);
console.log(`\n写出 .scrape/sim/raw_ch2_fanqie.json：books=${books.length} nearMiss=${nearMiss.length}`);
