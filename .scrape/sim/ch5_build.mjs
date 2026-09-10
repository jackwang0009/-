// 通道 5 成稿：把飞卢 / 纵横两站的暂存合成 raw_ch5_feilu.json，字段口径照 SCHEMA.md。
// 17K 无收录，原因写进 meta.notes，不留占位。
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "../lib.mjs";
import { strip, simHit, log } from "./ch5_lib.mjs";

const RAW = path.join(import.meta.dirname, "raw");
const OUT = path.join(import.meta.dirname, "raw_ch5_feilu.json");
const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

const faloo = readJson(path.join(RAW, "ch5_stage_faloo.json"));
const zh = readJson(path.join(RAW, "ch5_stage_zongheng.json"));
const zhToc = readJson(path.join(RAW, "ch5_stage_zh_chapters.json"), {});
const hooks = readJson(path.join(RAW, "ch5_stage_hooks.json"), {});
const fin = readJson(path.join(RAW, "ch5_stage_finished.json"), { set: [], complete: false });
const finishedSet = new Set(fin.set.map(String));
const serialSet = new Set((readJson(path.join(RAW, "ch5_stage_serial.json"), { set: [] }).set ?? []).map(String));

// 飞卢书页没有状态字段，三条证据依次判定，都不命中就写 unknown：
// ① 在「已经完本」筛选列表里 ② 站方给的最新章节名自带结局字样 ③ 在「还在写作中」列表里。
// ② 在已知样本上是 12 本完本中 4 本命中、11 本连载中 0 本命中，只做正向判据，不做反向推断。
const ENDING = /大结局|完结|全书完|[（(]\s*完\s*[）)]/;
function falooStatus(id, latestChapter) {
  if (finishedSet.has(String(id))) return "完结";
  if (ENDING.test(String(latestChapter ?? ""))) return "完结";
  if (serialSet.has(String(id))) return "连载";
  return "unknown";
}

const dateOnly = (s) => (/(\d{4}-\d{2}-\d{2})/.exec(String(s ?? ""))?.[1] ?? null);
const matchedIn = (ev) => ["title", "tag", "abstract"].filter((k) => (ev[k] ?? []).length);
const keywords = (ev) => [...new Set(Object.values(ev).flat())];

const books = [];

// —— 飞卢 ——
for (const meta of faloo.pickedMeta ?? []) {
  const d = faloo.details[meta.id];
  if (!d) continue;
  const html = fs.existsSync(path.join(RAW, `ch5_faloo_${meta.id}.html`)) ? fs.readFileSync(path.join(RAW, `ch5_faloo_${meta.id}.html`), "utf8") : "";
  const flat = strip(html).replace(/\s+/g, "");
  const score = Number(/好评指数[：:]([\d.]+)分/.exec(flat)?.[1]) || null;
  const abstract = d.abstract ?? meta.listIntro ?? null;

  // 判据留痕按最终 abstract 重算，别拿列表页的截断简介当证据
  const ev = { title: simHit(meta.title), abstract: simHit(abstract ?? ""), tag: simHit((d.tags ?? []).join(" ")) };
  const cats = [d.ogCategory, d.subCategory, meta.listCategory].filter(Boolean);

  books.push({
    platform: "faloo",
    platformBookId: String(meta.id),
    title: meta.title,
    author: d.ogAuthor ?? meta.author ?? null,
    url: `https://b.faloo.com/${meta.id}.html`,
    wordCount: d.wordCount ?? meta.listWordCount ?? null,
    chapterTotal: d.chapterTotal ?? null,
    status: falooStatus(meta.id, d.latestChapter),
    categories: [...new Set(cats)],
    tags: d.tags ?? [],
    abstract,
    popularity: { metric: "点击", raw: d.click ?? meta.listClick ?? null },
    score,
    firstPublishDate: d.firstPublishDate ?? null,
    lastUpdateDate: dateOnly(d.ogUpdate),
    simEvidence: { matchedIn: matchedIn(ev), keywords: keywords(ev) },
    openingHook: hooks[`faloo:${meta.id}`] ?? null,
    collectedAt: now,
    source: meta.source,
  });
}

// —— 纵横 ——
const ZH_STATUS = { 连载中: "连载", 已完结: "完结", 完结: "完结" };
for (const meta of zh.pickedMeta ?? []) {
  const id = String(meta.bookId);
  const rec = zh.books[id];
  if (!rec) continue;
  const toc = zhToc[id] ?? {};
  const ev = { title: simHit(meta.title), abstract: simHit(meta.desc ?? ""), tag: simHit((meta.tags ?? []).join(" ")) };

  books.push({
    platform: "zongheng",
    platformBookId: id,
    title: meta.title,
    author: meta.authorName ?? rec.page.author ?? null,
    url: `https://book.zongheng.com/book/${id}.html`,
    wordCount: meta.totalWord ?? rec.page.wordCount ?? null,
    chapterTotal: toc.chapterTotal ?? null,
    status: ZH_STATUS[rec.page.status] ?? "unknown",
    categories: [...new Set([meta.catePName, meta.cateFineName].filter(Boolean))],
    tags: meta.tags ?? [],
    abstract: meta.desc || null,
    popularity: { metric: "点击", raw: rec.page.clickTotal ?? null },
    score: null,
    firstPublishDate: rec.first?.date ?? toc.firstDate ?? null,
    lastUpdateDate: dateOnly(meta.updateTime) ?? dateOnly(rec.page.updateTime),
    simEvidence: { matchedIn: matchedIn(ev), keywords: keywords(ev) },
    openingHook: hooks[`zh:${id}`] ?? null,
    collectedAt: now,
    source: meta.source,
  });
}

const nearMiss = [...(faloo.nearMiss ?? []), ...(zh.nearMiss ?? [])];

// 「重开」在 SCHEMA 第 1 节是带限定的词（只取「同一段时间反复重来」义），而 simHit 只做子串匹配。
// 洪荒/玄幻语境里「重开」绝大多数是「重开天地／重开某界」，属开天辟地义。逐本读简介后的判定
// 记在 ch5_chongkai_verdict.json 里，这里按它把误收的挪进 nearMiss——判定是人做的，所以留成可审的数据文件，
// 不写成正则藏在代码里。
const verdict = readJson(path.join(import.meta.dirname, "ch5_chongkai_verdict.json"), { keep: {}, drop: {} });
const dropTitles = new Map(Object.entries(verdict.drop ?? {}));
const droppedByWord = [];
for (let i = books.length - 1; i >= 0; i--) {
  const reason = dropTitles.get(books[i].title);
  if (!reason) continue;
  const b = books.splice(i, 1)[0];
  droppedByWord.push(b.title);
  nearMiss.push({ title: b.title, url: b.url, reason: `「重开」非 SCHEMA 限定的「同一段时间反复重来」义：${reason}` });
}
const unmatched = [...dropTitles.keys()].filter((t) => !droppedByWord.includes(t));
if (unmatched.length) log(`[build] ⚠ 重开判定表里有 ${unmatched.length} 条没匹配上任何书（书名可能变了）：${unmatched.join("、")}`);
log(`[build] 「重开」词义复核：剔除 ${droppedByWord.length} 本移入 nearMiss，保留 ${Object.keys(verdict.keep ?? {}).length} 本`);

// meta.status 由实际状态算出来，不写死：17K 整站受阻 → 声明三站只兑现两站，
// 加上飞卢仍有一批 status=unknown，按 SCHEMA 第 3 节落 partial。
const unknownFaloo = books.filter((b) => b.platform === "faloo" && b.status === "unknown").length;
const falooN = books.filter((b) => b.platform === "faloo").length;
const gotPlatforms = new Set(books.map((b) => b.platform));
const status = gotPlatforms.size === 0 ? "blocked-by-policy" : gotPlatforms.size < 3 || unknownFaloo ? "partial" : "ok";

const out = {
  meta: {
    channel: 5,
    platforms: ["faloo", "zongheng", "17k"],
    status,
    collectedAt: now,
    entryPoints: [
      ...new Set([
        ...(faloo.harvested?.entryPoints ?? []),
        ...(zh.entryPoints ?? []),
        "https://www.17k.com/",
        "https://www.17k.com/sitemap.xml",
      ]),
    ],
    notes: [
      "17K 收录 0 本：www.17k.com 的 /book/ /all/ /lib/ /top/ 与 search.17k.com 全部返回阿里云 WAF 的 JS 挑战页（17136 字节，写 acw_sc__v2 cookie 后 reload），带完整浏览器头 + Cookie + Referer 仍不放行；all.17k.com、m.17k.com、book.17k.com 域名不可解析；api.17k.com 要 appKey。解开挑战需执行混淆 JS 反算 cookie，属绕反爬，未做。首页与 sitemap.xml 可访问但只有栏目链接，拿不到书籍字段。",
      "飞卢页面编码是 GB2312，lib.mjs 的 get() 用 res.text() 按 UTF-8 解会得到乱码，故在 ch5_lib.mjs 里另做取字节+按声明编码解的一层；退避（403/429/空 body 退 60 秒）与 ≥1 秒间隔沿用 lib.mjs 的口径，未改 lib.mjs。",
      "飞卢每隔若干次请求会插一张 357 字节的过渡页，明文写出 C3VK cookie 后自跳转。已按浏览器的常规做法存下该 cookie 原样重取，未解混淆、未伪造凭据。",
      "飞卢站内搜索入口是 b.faloo.com/l_0_{页}.html?t=1&k={关键词的 GBK 百分号编码}（t=1 书名、t=2 作者）；so.faloo.com/search 与 b.faloo.com/search.html 均 404。b.faloo.com/robots.txt 返 406（WAF 拒非浏览器 Accept），www.faloo.com/robots.txt 为 Allow: /。",
      `飞卢书页不给连载状态（og:novel:status 恒为空串），status 按三条证据依次判定：① 命中「已经完本」筛选列表（共收 ${finishedSet.size} 本）→ 完结；② 站方给的 og:novel:latest_chapter_name 自带「大结局／完结／（完）」→ 完结；③ 命中「还在写作中」列表（共收 ${serialSet.size} 本）→ 连载；都不命中 → unknown，不做反向推断。判据 ② 在已知样本上是完本 12 本中命中 4 本、连载 11 本中命中 0 本，故只当正向证据用。`,
      `飞卢列表分页在 ~223 页后失效：更深的页要么 0 条，要么反复返回同一批 30 条（实测 y_1_..._2_0_226 与 _348 逐条相同），「还在写作中」列表更早在 p18 就到顶。因此完本表与连载表都是截断的，「不在完本表里」证明不了在连载——这正是上面那条 unknown 的来由，不是没查。`,
      "纵横新版 search.zongheng.com 是 JS 渲染的（不同关键词返回的 HTML 字节数完全相同），改用其 search/book JSON 接口取候选；wordCount 用接口的 totalWord（精确到字），书页上的『218.7 万字数』是四舍五入值，未采用。",
      "纵横书页正文简介也由 JS 渲染，abstract 取接口返回的 description（站方自己的简介全文），未截断。",
      "chapterTotal：飞卢取书页章节列表里去重后的章节链接数；纵横取目录页去重后的章节链接数。两者都是「站上实际列出的章节数」，与书名里的章回序号可能不等（飞卢有跳号）。",
      "openingHook 只取第一章免费试读页公开可见的前 200 字，命中 VIP/订阅/登录提示或取不到的写 null，未登录、未绕付费墙。",
      "score：飞卢取书页「好评指数」（10 分制）；纵横书页无评分，写 null。",
      "popularity.metric 一律「点击」，飞卢取 og:novel:click_cnt（总点击），纵横取书页总点击。两站口径不同，未做跨站折算。",
      `meta.status=${status} 而不是 ok 或 blocked-by-policy：飞卢与纵横正常实收，所以整份不是 blocked-by-policy（0 本整站阻断只适用于 17K 那一格）；但也够不上 ok——① 17K 整站受阻，platforms 里声明的三站只兑现了两站；② 飞卢仍有 ${unknownFaloo}/${falooN} 本 status=unknown（成因见上面分页失效那条）。两条都属 SCHEMA 第 3 节说的「部分字段或部分站点受阻」。`,
      "飞卢 abstract 一度整批是列表页的截断版（64–78 字、以 ... 结尾），不合 SCHEMA 第 2 节「简介全文、不截断」。根因是书页解析当时分了两份实现：现抓那条（detail()）补了 T-L-T-C-Box1 的解析，重解存档那条没有，于是 stage.details 里没有 abstract 这一格，本文件第 44 行的 `d.abstract ?? meta.listIntro` 整批回退到了列表页简介——?? 回退不报错，而截断版是合法字符串，两层合法叠起来就没有出口。现已把书页解析抽进 ch5_lib.mjs 的 parseFalooDetail()，两条路共用一份，不会再分叉。少数几本 abstract 仍以 ... 结尾的，是作者自己在简介里打的省略号，已逐本比对存档 Box1 确认；ch5_validate.mjs 的这条断言也相应从「字符串以 ... 结尾」改成「与存档 Box1 比对」（是收紧不是放宽：现在能抓到不以点结尾但就是比存档短的真截断）。",
      "【弯路记录，补齐后保留】本文件曾长期只交 46 本，而实际过 A+B 判据的是 158 本。原因不是抓不到，是 ch5_faloo.mjs 里 `picked.slice(0, 46)` 这个写死的上限没跟上 SCHEMA 第 5 节修订 3——那次修订已拆掉 40–80 本上限、改为「凡过判据的全收」，代码停在旧口径上。被切掉的 112 本是按 listClick 降序排在 46 名之后的，而 listClick 本身混着总点击与周点击（候选池 695 本里 517 本周点击、178 本总点击），所以那个「头部」连口径都不齐，直接污染了字数中位数与标题句式两项结论。现已改为全收，排序只决定抓取先后。这条记录不删：下一个人看到它才会去查自己那份脚本里的 limit。",
      "补抓那 112 本时遇到飞卢限流的第三种样子：HTTP 200 但 body 只有 55–56 字节（前两种是空 body 和 357 字节的 C3VK 过渡页）。它成两段连续区间出现（第 92–101、132–144 本）而非零散分布，隔十几次请求自行恢复，所以是节流不是死链。已把「HTTP 200 且 body 异常短」归入 SCHEMA 第 4 节那条 60 秒退避（此前只吃到 1.5 秒退避，会整段丢），重跑后 158 本全部取回。另：raw/ 里曾有 24 份 ch5_faloo_{id}.html 是 357 字节的过渡页而非书页，靠「存档长度 < 5000 当失败」的断言拦下，未混入交付。",
      `【「重开」是带限定的词，已人工复核】SCHEMA 第 1 节把「重开」限定为「同一段时间反复重来」义，但 simHit 只做子串匹配、判不了词义。扩样后靠这个词进来的共 29 本，逐本读简介后剔除 ${droppedByWord.length} 本移入 nearMiss、保留 ${Object.keys(verdict.keep ?? {}).length} 本。判据是：「重开」直接带宾语（天地／大道／地府／天门／灵界／魂界／金榜／纪元）时是「重新开启某物」义，属开天辟地一类；作不及物或带次数（重开一万次／无限重开／重开万世）时才是重来义。逐本判定与理由记在 ch5_chongkai_verdict.json，是人做的判断，故留成可审的数据文件而不是藏在代码里的正则。这一步影响不小：剔除的里面有 5 本是纵横的，它们此前被算进「纵横仅简介命中」那个数。`,
      "【判据不对称，尚未消除】books 里的飞卢记录按书页简介全文（中位约 300 字）判定，而 nearMiss 仍是按列表页 78 字截断版判的。条件 B（修仙）最依赖简介正文，所以理论上有一批 nearMiss 本该进 books 而没进。零请求能重判的部分已查：raw/ 里非 books 的存档全是过渡页，一本都盖不到 nearMiss。补判其余部分需对 nearMiss 逐本抓详情页，未做。",
    ].join("\n"),
    counts: {
      faloo: books.filter((b) => b.platform === "faloo").length,
      zongheng: books.filter((b) => b.platform === "zongheng").length,
      "17k": 0,
      nearMiss: nearMiss.length,
    },
  },
  books,
  nearMiss,
};

writeJson(OUT, out);

// —— 自检 ——
const problems = [];
const allowStatus = new Set(["连载", "完结", "unknown"]);
for (const b of books) {
  if (!allowStatus.has(b.status)) problems.push(`${b.title} status=${b.status}`);
  if (b.wordCount != null && !Number.isInteger(b.wordCount)) problems.push(`${b.title} wordCount 非整数`);
  if (!b.simEvidence.matchedIn.length) problems.push(`${b.title} simEvidence 为空`);
  if (b.firstPublishDate && !/^\d{4}-\d{2}-\d{2}$/.test(b.firstPublishDate)) problems.push(`${b.title} firstPublishDate 格式`);
  if (/[\uFFFD]/.test(b.title + b.abstract)) problems.push(`${b.title} 疑似乱码`);
}
log(`[build] books=${books.length}（faloo ${out.meta.counts.faloo} / zongheng ${out.meta.counts.zongheng} / 17k 0） nearMiss=${nearMiss.length}`);
log(`[build] 自检问题 ${problems.length} 项` + (problems.length ? "：\n  " + problems.join("\n  ") : ""));

const words = books.map((b) => b.wordCount).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
const median = words.length % 2 ? words[(words.length - 1) / 2] : Math.round((words[words.length / 2 - 1] + words[words.length / 2]) / 2);
log(`[build] 字数中位数 ${median}（样本 ${words.length}）`);
const dated = books.filter((b) => b.firstPublishDate).sort((a, b) => a.firstPublishDate.localeCompare(b.firstPublishDate));
log("[build] 最早 5 本：");
for (const b of dated.slice(0, 5)) log(`  ${b.firstPublishDate}  ${b.platform.padEnd(8)} ${b.title}`);
log(`[build] 缺 firstPublishDate ${books.length - dated.length} 本；缺 openingHook ${books.filter((b) => !b.openingHook).length} 本`);
log(`[build] 写入 ${OUT}`);
