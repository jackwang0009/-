// 通道 4 · 收口第二件：把「杂役/杂役峰/外门/药童/打杂 + 模拟/推演/演算 + 长生」这一簇
// 在已交付的各通道数据里全部找出来，出同题对标表 ch4_benchmark.md。
//
// 只读，零请求。不改任何 raw_* 交付文件。
// 用法：node .scrape/sim/ch4_bench_table.mjs

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url)); // 中文路径下不要取 .pathname
const ROOT = DIR + "../";

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);

// ── 词表 ────────────────────────────────────────────────────────────
// 低位起点词分两档：杂役档是真的从最底层起步；外门档已经是记名弟子，起点高一级，单列。
const RE_MENIAL_STRICT = /杂役|药童|打杂|做苦力|扫地|柴房/;
const RE_MENIAL_WIDE = /外门/;
const RE_SIM = /模拟|推演|演算/;
const RE_LONGEVITY = /长生/;

const termsIn = (re, s) => [...new Set((s.match(new RegExp(re.source, "g")) || []))];

// ── 载入各通道交付 ──────────────────────────────────────────────────
const sources = [];
const coverage = [];

for (const [file, label] of [
  ["raw_ch2_fanqie.json", "通道2 番茄"],
  ["raw_ch3_alt.json", "通道3 书旗/塔读"],
  ["raw_ch4_qimao.json", "通道4 七猫"],
  ["raw_ch5_feilu.json", "通道5 飞卢/纵横"],
]) {
  const d = readJson(DIR + file);
  if (!d) {
    coverage.push({ file, label, landed: false, books: 0, note: "本轮未落盘，未计入" });
    continue;
  }
  coverage.push({
    file,
    label,
    landed: true,
    books: d.books.length,
    status: d.meta?.status ?? "(该文件未写 meta.status)",
    note: `nearMiss ${(d.nearMiss || []).length} 本`,
  });
  for (const b of d.books) sources.push({ ...b, _file: file });
}

// 番茄 360 本自采榜单：只有 bookName / metaKw / categories，没有简介正文，
// 所以它在本表里只能做「标题层」召回，结构上看不见「模拟只写在简介里」的那一类。
const fq = readJson(ROOT + "fq_books.json");
const fqRows = Object.values(fq || {}).map((b) => ({
  platform: "fanqie",
  platformBookId: b.bookId,
  title: b.bookName,
  author: b.author,
  url: b.url,
  wordCount: b.wordNumber ?? null,
  chapterTotal: b.chapterTotal ?? null,
  status: b.creationStatus === "0" ? "完结" : b.creationStatus === "1" ? "连载" : "unknown",
  categories: (b.categories || []).map((c) => c.name),
  tags: [],
  abstract: "", // 该数据集不含简介正文
  popularity: b.readCount ? { metric: "在读", raw: b.readCount } : null,
  firstPublishDate: b.firstPassTime ? new Date(b.firstPassTime * 1000).toISOString().slice(0, 10) : null,
  _file: "fq_books.json",
  _titleOnly: true,
}));
coverage.push({
  file: "fq_books.json",
  label: "本项目自采 番茄榜单",
  landed: true,
  books: fqRows.length,
  status: "既有资产",
  note: "无简介正文，仅书名+metaKw 可判，只做标题层召回",
});

// ── 归一 + 跨源去重 ────────────────────────────────────────────────
// 去重键**不含平台**：一本书上了几个站仍是一本书，一行。上一版把平台写进了键，
// 结果《凡人修仙：从杂役峰开始推演长生》《武道推演：从宗门杂役开始只手遮天》这两本
// （七猫×纵横都有，正是本仓最贴的两本）在 A1 表里各占两行，13 本里有 2 本是重影，
// 分平台计数与字数中位数跟着一起偏。通道 1 的合并报告统计到 15 本跨站重复，全集中在七猫×纵横。
// 书名里的全角/半角括号、书名号、空白在各站写法不一，一并归一，否则同书判成两本。
const norm = (s) =>
  (s || "")
    .replace(/[\s\u3000]/g, "")
    .replace(/[()（）【】《》〈〉「」『』·・.,，。！!？?~～\-—_+：:]/g, "")
    .toLowerCase();

const all = [];
const seen = new Map();
for (const b of [...sources, ...fqRows]) {
  const key = norm(b.title) + "|" + norm(b.author);
  const site = {
    platform: b.platform,
    file: b._file,
    url: b.url ?? null,
    wordCount: Number.isFinite(b.wordCount) ? b.wordCount : null,
    chapterTotal: Number.isFinite(b.chapterTotal) ? b.chapterTotal : null,
    status: b.status,
    popularity: b.popularity ?? null,
    firstPublishDate: b.firstPublishDate ?? null,
    titleOnly: Boolean(b._titleOnly),
  };
  const prev = seen.get(key);
  if (!prev) {
    seen.set(key, { ...b, sites: [site] });
    all.push(seen.get(key));
    continue;
  }
  // 同一本书的第二条来源：并进 sites，主记录取信息更全的字段（判据要跑在简介全文上）
  if (!prev.sites.some((s) => s.platform === site.platform && s.file === site.file)) prev.sites.push(site);
  if ((b.abstract || "").length > (prev.abstract || "").length) prev.abstract = b.abstract;
  // 各站的 tags/categories 都可能是 null（如番茄自采那份没有 tags），先兜住再合并
  prev.tags ??= [];
  prev.categories ??= [];
  for (const t of b.tags || []) if (!prev.tags.includes(t)) prev.tags.push(t);
  for (const c of b.categories || []) if (!prev.categories.includes(c)) prev.categories.push(c);
  if (prev.status === "unknown" && b.status !== "unknown") prev.status = b.status;
  if (!prev.firstPublishDate && b.firstPublishDate) prev.firstPublishDate = b.firstPublishDate;
}

// 一本书的对外字段：字数/章节数注明取自哪站、为什么；热度各站都列，不择一。
// 章节数只有服务端渲染的站给（纵横/番茄/飞卢），七猫全站被 WAF 挡住 → null，
// 所以「取自哪站」几乎总是「取自唯一给了这个字段的那站」，这一点要在表里说清而不是默默取值。
const PLAT_CN0 = { fanqie: "番茄", qimao: "七猫", faloo: "飞卢", zongheng: "纵横", shuqi: "书旗", tadu: "塔读" };
for (const b of all) {
  const withCh = b.sites.filter((s) => s.chapterTotal);
  const withWc = b.sites.filter((s) => s.wordCount);
  // 优先取「同时给了字数和章节数」的那站，保证章均字数是同一站的两个数相除，不跨站拼
  const pick = withCh.find((s) => s.wordCount) ?? withWc[0] ?? b.sites[0];
  b.wordCount = pick.wordCount ?? null;
  b.chapterTotal = pick.chapterTotal ?? null;
  b.srcOfNums = pick.platform;
  // 各站字数不一致时两个都列，不偷偷取一个。但「不一致」要按显示精度判：
  // 548,700 与 549,000 都显示成 54.9万，标成「各站不一」是噪音；差 1% 以内视为同一个数。
  const wcVals = [...new Set(withWc.map((s) => s.wordCount))];
  const spread = wcVals.length > 1 ? (Math.max(...wcVals) - Math.min(...wcVals)) / Math.max(...wcVals) : 0;
  b.wcDisagree =
    spread > 0.01
      ? withWc
          .filter((s, i, a) => a.findIndex((x) => x.wordCount === s.wordCount) === i)
          .map((s) => ({ w: s.wordCount, from: s.file === "fq_books.json" ? "自采榜单" : PLAT_CN0[s.platform] || s.platform }))
      : null;
  b.platforms = [...new Set(b.sites.map((s) => s.platform))];
  b.popList = b.sites
    .filter((s) => s.popularity && Number.isFinite(s.popularity.raw))
    .map(
      (s) =>
        `${s.file === "fq_books.json" ? "番茄自采榜单" : PLAT_CN0[s.platform] || s.platform} ${s.popularity.metric} ${s.popularity.raw.toLocaleString("en-US")}`,
    );
  if (!b.firstPublishDate) b.firstPublishDate = b.sites.map((s) => s.firstPublishDate).find(Boolean) ?? null;
}

// ── 分类 ────────────────────────────────────────────────────────────
const classify = (b) => {
  const title = b.title || "";
  const body = [b.abstract || "", ...(b.tags || []), ...(b.categories || [])].join(" ");
  const whole = title + " " + body;

  const menialStrict = termsIn(RE_MENIAL_STRICT, whole);
  const menialWide = termsIn(RE_MENIAL_WIDE, whole);
  const sim = termsIn(RE_SIM, whole);
  const longevity = termsIn(RE_LONGEVITY, whole);

  const simInTitle = RE_SIM.test(title);
  const menialInTitle = RE_MENIAL_STRICT.test(title) || RE_MENIAL_WIDE.test(title);

  let tier = null;
  if (menialStrict.length && sim.length) tier = "A1"; // 杂役档 + 模拟：最贴本仓
  else if (menialWide.length && sim.length) tier = "A2"; // 外门档 + 模拟：起点高一级
  else if (sim.length && longevity.length) tier = "B"; // 模拟 + 长生，起点不低：近邻

  return {
    tier,
    menial: [...menialStrict, ...menialWide],
    sim,
    longevity,
    simInTitle,
    menialInTitle,
    perAvg: b.chapterTotal && b.wordCount ? Math.round(b.wordCount / b.chapterTotal) : null,
  };
};

// ── 低位起点词的人工复核（ch4_bench_spotcheck.mjs 逐本看原文的结论） ──────────
// 「扫地」「外门」和通道 3 报的「重开」是同一类词形陷阱：词在，指的不是主角的起点。
// A1 里三本「扫地」命中全部不成立，其中《前世模拟：我神话人仙身份曝光了》603 万字，
// 若不剔除会直接把「核心层有没有人写到 242 万字」这个结论翻过来——这一条必须逐本看原文。
// key = 归一书名|归一作者，剔的是「起点词」这一项，模拟词与其它字段不动；
// 剔除后该书按剩余判据重新分层（多半落进 B 或退出分层），不是从语料里删掉。
const MENIAL_REJECT = {
  "前世模拟我神话人仙身份曝光了|亦文阿":
    "「三千年前，他在金山寺，于藏经阁扫地八十年，镇青白二蛇」——主角是隐世神话人仙，扫地是其漫长履历中的一段，不是低起点",
  "我的模拟器不太对劲|爱吃玉米的兔子": "「藏经阁扫地的老头是隐藏boss」——扫地的是别人，不是主角",
  "推演功法到满级我横推武道|妙蛙树人": "「嫂子天天嚷着要把他扫地出门」——成语，与宗门杂役无关",
  "我定海神珠拐走人族后六圣懵了|邪渊":
    "「选择拜师通天加入截教，成为外门第五弟子」——出现在模拟选项里，且截教通天门下并非低起点",
  "玄幻我有人生重置模拟器|x萌新": "「你刚刚经历了佛宗外门弟子的一生」——模拟出来的某一世，不是主角的起点",
};
const menialRejected = [];
for (const b of all) {
  Object.assign(b, classify(b));
  const key = norm(b.title) + "|" + norm(b.author);
  if (b.menial.length && MENIAL_REJECT[key]) {
    menialRejected.push({ ...b, rejectReason: MENIAL_REJECT[key], wasTier: b.tier });
    b.menialRejected = MENIAL_REJECT[key];
    b.menial = [];
    // 起点词作废后按剩余判据重判：有长生的落 B，没有的退出分层但仍留在全模拟语料里
    const sim = b.sim, longevity = b.longevity;
    b.tier = sim.length && longevity.length ? "B" : null;
  }
}

const A1 = all.filter((b) => b.tier === "A1");
const A2 = all.filter((b) => b.tier === "A2");
const B = all.filter((b) => b.tier === "B");

// ── 统计工具 ────────────────────────────────────────────────────────
const median = (xs) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2);
};
const wan = (n) => (n == null ? "—" : (n / 10000).toFixed(1) + "万");
// 行是「书」，但一本书可能上了多个站。分平台这一行记的是**站次**，
// 所以站次之和会大于本数；跨站书数单列，免得两个数对不上被当成 bug。
const byPlat = (xs) => {
  const d = {};
  for (const b of xs) for (const p of b.platforms) d[p] = (d[p] || 0) + 1;
  return d;
};
const multiSite = (xs) => xs.filter((b) => b.platforms.length > 1);
const PLAT_CN = PLAT_CN0;
// 热度按各站原口径原值给，不折算，也不在多站之间择一——「点击」和「在读」不是一回事，
// 挑一个当代表就等于偷偷折算了。多站都有就都列出来。七猫被 WAF 挡住的留 —
const POP = (b) => (b.popList.length ? b.popList.join(" ／ ") : "—");

// 本仓规划
const OUR = { words: 2420000, chapters: 1100, perAvg: 2200 };

// ── 生成表格 ────────────────────────────────────────────────────────
const platsOf = (b) => b.platforms.map((p) => PLAT_CN[p] || p).join("+");
// 字数/章节数标明取自哪站：多站同书时这两个数只有部分站给得出，不注明就无法复核
const numSrc = (b) => (b.platforms.length > 1 && b.srcOfNums ? `（${PLAT_CN[b.srcOfNums]}）` : "");
const wcCell = (b) =>
  b.wcDisagree
    ? b.wcDisagree.map((d) => `${wan(d.w)}（${d.from}）`).join(" / ") + " ⚠两处不一致"
    : wan(b.wordCount) + numSrc(b);

const rowOf = (b) =>
  `| ${b.title} | ${b.author || "—"} | ${platsOf(b)} | ${wcCell(b)} | ${
    b.chapterTotal != null ? b.chapterTotal + numSrc(b) : "—"
  } | ${b.perAvg ?? "—"} | ${b.status} | ${b.firstPublishDate || "—"} | ${POP(b)} | ${b.menial.join("/") || "—"} | ${b.sim.join(
    "/"
  )}${b.longevity.length ? "+长生" : ""} |`;

const HEAD =
  "| 书名 | 作者 | 平台 | 字数 | 章节数 | 章均字数 | 状态 | 上架时间 | 热度原值（各站口径，不折算） | 低位起点词 | 模拟词 |\n" +
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";

const sortDesc = (xs) => xs.slice().sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));

// ── 结论用的数字 ────────────────────────────────────────────────────
const core = [...A1, ...A2];
const statOf = (xs) => ({
  n: xs.length,
  plat: byPlat(xs),
  medWords: median(xs.map((b) => b.wordCount)),
  maxWords: Math.max(0, ...xs.map((b) => b.wordCount || 0)),
  minWords: Math.min(Infinity, ...xs.map((b) => b.wordCount || Infinity)),
  withCh: xs.filter((b) => b.perAvg),
  medPerAvg: median(xs.map((b) => b.perAvg)),
  medCh: median(xs.map((b) => b.chapterTotal)),
  fin: xs.filter((b) => b.status === "完结"),
  ser: xs.filter((b) => b.status === "连载"),
  unk: xs.filter((b) => b.status === "unknown"),
  overOur: xs.filter((b) => (b.wordCount || 0) >= OUR.words),
  finOverOur: xs.filter((b) => b.status === "完结" && (b.wordCount || 0) >= OUR.words),
});

const sA1 = statOf(A1), sA2 = statOf(A2), sB = statOf(B), sCore = statOf(core);
const simAll = all.filter((b) => b.sim.length);
const sSim = statOf(simAll);

const platLine = (d) =>
  Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${PLAT_CN[k] || k} ${v}`)
    .join(" / ") || "—";

// ── 写文件 ──────────────────────────────────────────────────────────
const L = [];
L.push("# 「杂役 + 模拟」同题对标表");
L.push("");
L.push(
  "本表给《杂役模拟三千世，一出手就无敌》（番茄向玄幻脑洞，规划八卷 1100 章 × 2200 字，约 242 万字）做同题对标。" +
    "由通道 4 从各通道已交付的 `raw_*.json` 与本项目自采的 `fq_books.json` 里筛出，**零新增请求，纯本地比对**。"
);
L.push("");
L.push("> 这是外部作品调研。表里所有数字都是别人的书，**不构成对本仓 `01-设定/` `02-大纲/` 任何设定的依据**。");
L.push("");
L.push("## 1. 数据底盘与覆盖缺口");
L.push("");
L.push("| 来源 | 本数 | meta.status | 备注 |");
L.push("| --- | --- | --- | --- |");
for (const c of coverage) {
  L.push(`| \`${c.file}\`（${c.label}） | ${c.landed ? c.books : "—"} | ${c.landed ? c.status : "未落盘"} | ${c.note} |`);
}
L.push("");
L.push(
  `去重后进入本表的候选总量：**${all.length} 本**（按 **书名+作者** 去重，**不含平台**——一本书上了几个站仍是一本书，占一行）。` +
    `通道 1 的合并报告统计到 15 本跨站重复、全集中在七猫×纵横，本表要对标的两本正在其中` +
    `（\`凡人修仙：从杂役峰开始推演长生\`、\`武道推演：从宗门杂役开始只手遮天\`），` +
    `**上一版把平台写进了去重键，这两本在 A1 表里各占两行**，分平台计数与字数中位数跟着一起偏，已修。`,
);
L.push("");
L.push("**两个必须说清的覆盖缺口，否则下面的本数会被读高或读低：**");
L.push("");
const qmDeliv = readJson(DIR + "raw_ch4_qimao.json");
const qmNoCh = (qmDeliv?.books || []).filter((b) => b.chapterTotal == null).length;
L.push(
  `1. **七猫 ${qmNoCh}/${qmDeliv?.books?.length ?? 0} 本没有 \`chapterTotal\` 和热度**——七猫的 HTML 页被阿里云 WAF 挡死，章节数与热度只存在于被挡的页面上，按 SCHEMA 第 5 节写 \`null\` 而不是猜。所以「章均字数」这一列在七猫侧**结构性缺失**，不是漏填。`
);
L.push(
  "2. **`fq_books.json` 那 360 本只有书名和 `metaKw`，没有简介正文**，只能做标题层召回。「模拟只写在简介里、书名不提」的那一类书，在这个数据集里**结构上就看不见**。这个亚群不是小数目：七猫 92 本里 `matchedIn` 只有 `abstract` 的有 11 本，其中 6 本是第三轮反向召回才捞上来的（`node .scrape/sim/ch4_bench_reconcile.mjs` 可复现）。因此不要把 `fq_books.json` 的命中数当成番茄的真实存量。"
);
L.push("");
L.push("**七猫那三个来回对不上的数，这里一次定死（`ch4_bench_reconcile.mjs` 的输出）：**");
L.push("");
L.push("| 争议 | 定案 | 依据 |");
L.push("| --- | --- | --- |");
L.push("| 86 本 还是 92 本 | **两个都对，但口径不同：交付就是 92 本**，86 是第三轮反向召回之前的口径 | 92 本逐条回查命中池 `ch4_qm_hits.json` 的 `_hitBy`，其中 6 本只被 `rev:` 前缀的第三轮关键词命中；92−6=86 |\n| 模拟词入书名 94% 还是 88% | **88%**（81/92） | `matchedIn` 分布 `abstract+title` 72 + `title` 9 = 81 带书名命中；94% 是 81/86 的旧分母，反向召回新增的 6 本全是「仅简介命中」，只进分母不进分子 |\n| 字数中位数 65.9万 还是 65.7万 | **656,900 字（65.69 万）** | 直接取自 `raw_ch4_qimao.json` 的 92 本 `wordCount` 中位数；65.9 万是四舍五入到一位小数时把 65.69 读成了 65.9 |");
L.push("");
L.push("## 2. 分层口径");
L.push("");
L.push("派单给的词簇是「杂役 / 杂役峰 / 外门 / 药童 / 打杂 **+** 模拟 / 推演 / 演算 **+** 长生」。");
L.push(
  "三组词做严格 AND 会把《武道推演：从宗门杂役开始只手遮天》这种**没有「长生」二字但显然同题**的书排除掉，所以本表按「起点有多低」分三层，长生只作为附加标记："
);
L.push("");
L.push("| 层 | 判据 | 含义 |");
L.push("| --- | --- | --- |");
L.push("| **A1 杂役档** | (杂役\\|药童\\|打杂\\|做苦力\\|扫地\\|柴房) ∧ (模拟\\|推演\\|演算) | 主角从宗门最底层起步 + 模拟机制。**这是与本仓真正同题的一层** |");
L.push("| **A2 外门档** | 外门 ∧ (模拟\\|推演\\|演算)，且不含 A1 词 | 起点高一级（已是记名/外门弟子），机制相同 |");
L.push("| **B 近邻** | (模拟\\|推演\\|演算) ∧ 长生，且无低位起点词 | 「模拟推长生」这套公式，但起点不低 |");
L.push("");
L.push("命中范围为 **书名 + 简介全文 + 标签 + 分类**；`fq_books.json` 只有书名。每本书末两列标出实际命中的词，方便自己复核判据松紧。");
L.push("");
L.push(
  `**词形命中 ≠ 词义命中，本表已剔除 ${menialRejected.length} 本。** 「扫地」「外门」和通道 3 在塔读那批报的「重开」是同一类陷阱：` +
    `词确实在，但指的不是主角的起点。逐本看原文后剔除的名单在第 9 节，**剔的是「起点词」这一项，书仍留在语料里按剩余判据重新分层**，不是删数据。` +
    `这件事不是锦上添花：其中《前世模拟：我神话人仙身份曝光了》603.1 万字，若不剔除会直接把第 8 节「核心层有没有人写到 242 万字」的结论翻过来。`,
);
L.push("");
L.push(`## 3. A1 杂役档（${A1.length} 本）—— 与本仓同题的核心层`);
L.push("");
L.push(HEAD);
for (const b of sortDesc(A1)) L.push(rowOf(b));
L.push("");
L.push(
  `分平台（**站次**，一本书上了两个站在两边各记一次，故合计大于本数）：${platLine(sA1.plat)}；其中跨站同书 ${multiSite(A1).length} 本` +
    `${multiSite(A1).length ? "（" + multiSite(A1).map((b) => b.title).join("、") + "）" : ""}。`,
);
L.push(`字数中位数 **${wan(sA1.medWords)}字**，区间 ${wan(sA1.minWords)}–${wan(sA1.maxWords)}字。状态：完结 ${sA1.fin.length} / 连载 ${sA1.ser.length} / 未定 ${sA1.unk.length}。`);
L.push("");
L.push(`## 4. A2 外门档（${A2.length} 本）`);
L.push("");
L.push(HEAD);
for (const b of sortDesc(A2)) L.push(rowOf(b));
L.push("");
L.push(`分平台（站次）：${platLine(sA2.plat)}；跨站同书 ${multiSite(A2).length} 本。字数中位数 **${wan(sA2.medWords)}字**。状态：完结 ${sA2.fin.length} / 连载 ${sA2.ser.length} / 未定 ${sA2.unk.length}。`);
L.push("");
L.push(`## 5. B 近邻层（${B.length} 本）—— 「模拟 + 长生」但起点不低`);
L.push("");
L.push(HEAD);
for (const b of sortDesc(B)) L.push(rowOf(b));
L.push("");
L.push(`分平台（站次）：${platLine(sB.plat)}；跨站同书 ${multiSite(B).length} 本。字数中位数 **${wan(sB.medWords)}字**。状态：完结 ${sB.fin.length} / 连载 ${sB.ser.length} / 未定 ${sB.unk.length}。`);
L.push("");

// ── 6. 章均字数 ─────────────────────────────────────────────────────
// 本仓规划 2200 字/章，这一节直接对着这个数比。
// 只有拿得到 chapterTotal 的书才算得出章均——七猫全站没有，样本会小一截，先把分母说清。
const withAvg = (xs) => xs.filter((b) => b.perAvg);
const cAvg = withAvg(core), bAvg = withAvg(B), simAvg = withAvg(simAll);
const band = (xs, lo, hi) => xs.filter((b) => b.perAvg >= lo && b.perAvg < hi).length;
L.push("## 6. 章均字数（直接对着本仓 2200 字/章）");
L.push("");
L.push(
  `能算章均的只有拿得到 \`chapterTotal\` 的书：核心层 ${cAvg.length}/${core.length} 本、近邻层 ${bAvg.length}/${B.length} 本、` +
    `全模拟语料 ${simAvg.length}/${simAll.length} 本。**缺的那部分几乎全是七猫**——它的章节数只存在于被 WAF 挡死的 HTML 页上，` +
    `是结构性缺失，不是漏填，所以这一节的样本天然偏向番茄/纵横/飞卢。`,
);
L.push("");
L.push("| 分层 | 可算章均的本数 | 章均中位数 | 最短 | 最长 | 落在 1800–2600 字（本仓 2200 的邻域） |");
L.push("| --- | --- | --- | --- | --- | --- |");
for (const [name, xs] of [["核心 A1+A2", cAvg], ["B 近邻", bAvg], ["全模拟语料", simAvg]]) {
  const a = xs.map((b) => b.perAvg);
  L.push(
    `| ${name} | ${xs.length} | ${median(a) ?? "—"} | ${a.length ? Math.min(...a) : "—"} | ${a.length ? Math.max(...a) : "—"} | ${band(xs, 1800, 2600)} 本（${a.length ? Math.round((band(xs, 1800, 2600) / a.length) * 100) : 0}%） |`,
  );
}
L.push("");
L.push(
  `本仓 2200 字/章落在全模拟语料章均中位数 ${median(simAvg.map((b) => b.perAvg))} 字的旁边，属于这一簇的常规值，不是异类。` +
    `真正拉开差距的是两端：飞卢那批把章切到 1200 字上下（\`模拟神话：你这修炼速度太逆天\` 5757 章 × 1180 字），` +
    `而 3000 字以上的多是章节数还很少的新书（章均被前几章拉高，样本不稳）。`,
);
L.push("");

// ── 7. 标题句式 ─────────────────────────────────────────────────────
// 这一簇的书名高度套路化，量出来比感觉可靠。
const titleStats = (xs) => {
  const n = xs.length || 1;
  const has = (re) => xs.filter((b) => re.test(b.title)).length;
  return {
    n: xs.length,
    colon: has(/[:：]/),
    from: has(/从.{0,8}开始/),
    first: has(/^我|我的|我能|我在/),
    simWord: has(RE_SIM),
    menialWord: has(/杂役|药童|打杂|外门/),
    q: has(/[?？]/),
    bang: has(/[!！]/),
    len: Math.round(xs.reduce((s, b) => s + b.title.length, 0) / n),
  };
};
const tCore = titleStats(core), tB = titleStats(B), tSim = titleStats(simAll);
L.push("## 7. 标题句式");
L.push("");
L.push("| 句式特征 | 核心 A1+A2 | B 近邻 | 全模拟语料 |");
L.push("| --- | --- | --- | --- |");
const pc = (v, t) => `${v}/${t.n}（${t.n ? Math.round((v / t.n) * 100) : 0}%）`;
L.push(`| 带冒号的两段式 | ${pc(tCore.colon, tCore)} | ${pc(tB.colon, tB)} | ${pc(tSim.colon, tSim)} |`);
L.push(`| 「从…开始」 | ${pc(tCore.from, tCore)} | ${pc(tB.from, tB)} | ${pc(tSim.from, tSim)} |`);
L.push(`| 第一人称开头（我/我的/我能/我在） | ${pc(tCore.first, tCore)} | ${pc(tB.first, tB)} | ${pc(tSim.first, tSim)} |`);
L.push(`| 模拟词入书名 | ${pc(tCore.simWord, tCore)} | ${pc(tB.simWord, tB)} | ${pc(tSim.simWord, tSim)} |`);
L.push(`| 低位起点词入书名 | ${pc(tCore.menialWord, tCore)} | ${pc(tB.menialWord, tB)} | ${pc(tSim.menialWord, tSim)} |`);
L.push(`| 带问号/叹号 | ${pc(tCore.q + tCore.bang, tCore)} | ${pc(tB.q + tB.bang, tB)} | ${pc(tSim.q + tSim.bang, tSim)} |`);
L.push(`| 书名平均字数 | ${tCore.len} | ${tB.len} | ${tSim.len} |`);
L.push("");
L.push(
  "主流句式是 **「设定前缀：从<低起点>开始<结果>」**——`凡人修仙：从杂役峰开始推演长生`、`武道推演：从宗门杂役开始只手遮天`、" +
    "`修仙：从杂役开始模拟长生路`，冒号前立世界观、冒号后一句话把起点和终点同时给出。" +
    "本仓现名《杂役模拟三千世，一出手就无敌》用的是逗号并列而不是冒号两段式，前半「杂役模拟」把起点与机制压进四个字，" +
    "后半给结果——**同一套信息，另一种断句**，不在这一簇的多数派里，但把该给的三件事（起点低 / 有模拟 / 结果强）都给了。",
);
L.push("");

// ── 8. 本仓在这一簇里的位置 ──────────────────────────────────────────
// 这一节是派单点名要的结论，必须给反例，不替本仓说好话。
const coreOver = core.filter((b) => (b.wordCount || 0) >= OUR.words);
const coreFinOver = coreOver.filter((b) => b.status === "完结");
const simOver = simAll.filter((b) => (b.wordCount || 0) >= OUR.words);
const simFinOver = simOver.filter((b) => b.status === "完结");
const coreMax = core.slice().sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0))[0];
L.push(`## 8. 本仓 242 万字 / 1100 章放在这一簇里是什么位置`);
L.push("");
// 这句话必须由数据算出来，不能写死：草稿里写死的「核心层没人写到 242 万」在飞卢数据接进来后
// 一度变成假话（多出一本 603 万字的），剔除假阳性后才重新成立。写死的结论会随数据静默烂掉。
L.push(
  coreOver.length === 0
    ? `**核心层（A1+A2，${core.length} 本）里没有一本写到 242 万字。** 最长的是 \`${coreMax?.title}\`（${wan(coreMax?.wordCount)}字` +
        `${coreMax?.chapterTotal ? " / " + coreMax.chapterTotal + " 章" : ""}，${platsOf(coreMax)}），核心层字数中位数 ${wan(sCore.medWords)}字` +
        `——本仓规划体量是这一层中位数的 ${sCore.medWords ? (OUR.words / sCore.medWords).toFixed(1) : "—"} 倍。` +
        `也就是说，**「从杂役起步 + 模拟」这一层，目前没有人在这个体量上写过。**`
    : `**核心层（A1+A2，${core.length} 本）里有 ${coreOver.length} 本 ≥242 万字，其中完结 ${coreFinOver.length} 本**：` +
        coreOver.map((b) => `\`${b.title}\`（${wan(b.wordCount)}字 / 章均 ${b.perAvg ?? "—"} / ${b.status} / ${platsOf(b)}）`).join("、") +
        `。核心层字数中位数 ${wan(sCore.medWords)}字。`,
);
L.push("");
L.push(
  `放宽到全模拟语料（${simAll.length} 本）才有 ${simOver.length} 本 ≥242 万字，其中**完结的 ${simFinOver.length} 本**：`,
);
L.push("");
if (simOver.length) {
  L.push("| 书名 | 平台 | 字数 | 章节数 | 章均 | 状态 | 层 |");
  L.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const b of simOver.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0))) {
    L.push(`| ${b.title} | ${platsOf(b)} | ${wan(b.wordCount)} | ${b.chapterTotal ?? "—"} | ${b.perAvg ?? "—"} | ${b.status} | ${b.tier ?? "语料内未分层"} |`);
  }
  L.push("");
}
L.push(
  `**所以回答是「这么写过的都没写完」，而不是「没人这么写过」——但这两句话分别对应不同的层，不能混着说：**` +
    `在与本仓真正同题的核心层，是**没人这么写过**（${core.length} 本全部低于 242 万字，最长 ${wan(coreMax?.wordCount)}）；` +
    `在放宽后的模拟语料里，写到这个体量的确实存在，但**要么靠超短章堆量、要么仍在连载**。`,
);
L.push("");
L.push(
  `**反例得摆出来，别只挑对本仓有利的：**` +
    `\`模拟神话：你这修炼速度太逆天\`（飞卢，679.2万字 / 5757 章）体量是本仓规划的 2.8 倍且已经写到了——` +
    `但它章均 1180 字，是本仓 2200 字的一半多点，靠的是把章切碎，不是同一种写法；` +
    `\`修仙：第二灵根助我长生\`（番茄，285.9万字 / 1254 章 / 章均 2280）在**章均、总章数、总字数三项上都与本仓规划几乎重合**，` +
    `它证明这个体量在番茄是能跑到的——不过它属 B 近邻层（模拟+长生，起点不低），起点低这一条它并不占。`,
);
L.push("");
L.push(
  `**一句话：体量本身不是问题，番茄有人跑到过；风险在「起点低 + 模拟」这一层至今没有长篇成功样本——` +
    `核心层 ${sCore.fin.length} 本完结书的字数中位数只有 ${wan(median(sCore.fin.map((b) => b.wordCount)))}字，` +
    `这一层的书普遍在 50–150 万字之间就收尾或断更。**这是本表能给出的最有用的一个信号，也是唯一一个对本仓不利的信号。`,
);
L.push("");
// ── 9. 剔除名单 ─────────────────────────────────────────────────────
L.push("## 9. 词形命中但已剔除起点词的书（可复核、可推翻）");
L.push("");
L.push(
  "下面每一本的「低位起点词」都确实出现在书名或简介里，但看原文后不成立。列在这里而不是悄悄删掉，是为了让人能一条条推翻我的判断。",
);
L.push("");
L.push("| 书名 | 平台 | 字数 | 原分层 | 剔除后 | 剔除理由（原句） |");
L.push("| --- | --- | --- | --- | --- | --- |");
for (const r of menialRejected) {
  const now = all.find((b) => norm(b.title) + "|" + norm(b.author) === norm(r.title) + "|" + norm(r.author));
  L.push(`| ${r.title} | ${platsOf(r)} | ${wan(r.wordCount)} | ${r.wasTier ?? "—"} | ${now?.tier ?? "退出分层，仍在语料内"} | ${r.rejectReason} |`);
}
L.push("");
L.push(
  `按词看：「扫地」在本语料 A1 命中 ${menialRejected.filter((r) => /扫地/.test(r.rejectReason)).length} 次、成立 0 次；` +
    `「外门」误命中集中在一种写法上——**模拟词条正文里那句「你成为了某宗外门弟子」**，那是被模拟出来的某一世，不是主角的现实起点。` +
    `建议通道 6 的弱词普查把「扫地」「外门」一并纳入，判据加一条：命中处若落在【】模拟播报文本内，不计作主角起点。`,
);
L.push("");
L.push("---");
L.push("");
L.push(`> 生成：\`node .scrape/sim/ch4_bench_table.mjs\`，零新增请求。数据快照见同目录 \`_bench_stats.json\`。`);
L.push(
  `> **两处会变的数**：① 通道 5 正在把飞卢从 46 本扩到 158 本（\`ch5_faloo.mjs\` 一句写死的 \`slice(0,46)\` 没跟上 SCHEMA 修订 3 的「全收」），` +
    `它广播后重跑本脚本即可；② 通道 6 正在做弱词（重开/沙盘/演算/预演）假阳性普查，被降级的书要从本表删行——` +
    `每本书末列保留了实际命中词，按词删即可。`,
);

fs.writeFileSync(DIR + "_bench_stats.json", JSON.stringify({ sA1, sA2, sB, sCore, sSim, all: all.length, A1, A2, B }, null, 1), "utf8");
fs.writeFileSync(DIR + "_bench_body.md", L.join("\n"), "utf8");
fs.writeFileSync(DIR + "ch4_benchmark.md", L.join("\n"), "utf8");

// ── 控制台诊断 ──────────────────────────────────────────────────────
console.log("候选总量", all.length, "| 含模拟词", simAll.length);
console.log("A1 杂役档", A1.length, platLine(sA1.plat), "中位", wan(sA1.medWords), "章均中位", sA1.medPerAvg, "有章节数", sA1.withCh.length);
console.log("A2 外门档", A2.length, platLine(sA2.plat), "中位", wan(sA2.medWords), "章均中位", sA2.medPerAvg, "有章节数", sA2.withCh.length);
console.log("B  近邻 ", B.length, platLine(sB.plat), "中位", wan(sB.medWords), "章均中位", sB.medPerAvg, "有章节数", sB.withCh.length);
console.log("核心 A1+A2", sCore.n, "中位", wan(sCore.medWords), "章均中位", sCore.medPerAvg);
console.log("全模拟语料 章均中位", sSim.medPerAvg, "字数中位", wan(sSim.medWords), "有章节数", sSim.withCh.length);
console.log("\n>= 本仓 242 万字的：核心", sCore.overOur.length, "其中完结", sCore.finOverOur.length);
for (const b of sCore.overOur) console.log("   ", b.tier, b.title, wan(b.wordCount), b.chapterTotal, b.status, PLAT_CN[b.platform]);
console.log("全模拟语料 >=242万:", sSim.overOur.length, "其中完结", sSim.finOverOur.length);
for (const b of sSim.overOur.slice(0, 30)) console.log("   *", b.title, wan(b.wordCount), "ch" + b.chapterTotal, b.status, PLAT_CN[b.platform]);
console.log("\nA1 全表:");
for (const b of sortDesc(A1)) console.log("   ", PLAT_CN[b.platform], b.title, "|", b.author, "|", wan(b.wordCount), "| ch", b.chapterTotal, "| 章均", b.perAvg, "|", b.status, "| menial:", b.menial.join(","), "| sim:", b.sim.join(","));
