// 通道 5 接管（由通道 3 执行）· SCHEMA 修订 6 弱词词义复核的落地。
// 取证见 ch5_weak_review.mjs / ch5_weak_full.mjs 的输出，逐本判定写在下面的 VERDICT 里，
// 同时落成 ch5_weak_verdict.json——人做的判断留成可审数据，不藏进正则（沿用 ch5_chongkai_verdict.json 的做法）。
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "../lib.mjs";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const FILE = path.join(DIR, "raw_ch5_feilu.json");
const data = readJson(FILE);

const WEAK = ["重开", "沙盘", "演算", "预演"];
const STRONG = ["模拟器", "人生模拟", "模拟", "推演"];
const kwOf = (b) => b.simEvidence?.keywords ?? [];
const weakOnly = data.books.filter((b) => kwOf(b).some((k) => WEAK.includes(k)) && !kwOf(b).some((k) => STRONG.includes(k)));

// ── 判定 ────────────────────────────────────────────────────────────
// 只有一本判假。理由不是「沙盘是误命中」——恰恰相反，28 本沙盘书里一本军事沙盘都没有，
// 总指挥预判要拦的那一类在这批里不存在。真正的问题是另一件事，写在 SANDBOX_NOTE 里。
// DROP 是**全部历次判假的账**，不是「本次要删谁」。写成前者是因为：书一旦移出 books，
// 下一次跑 weakOnly 就扫不到它，若 verdict 只由本次 weakOnly 生成，上一轮的判定会静默消失。
// 判定记录必须比数据活得久。
const DROP = {
  "全球演算：我的战魂是条绸缎":
    "「战斗演算启动：目标弱点分析完毕，建议攻击下盘」——AI 对单场战斗做一次性弱点解算，主角不重来、不回滚、不试错，" +
    "功能上与占卜推算同类。这正是 SCHEMA 修订 6 点名要拦的「演算」义。",
  仙尊重开记:
    "SCHEMA 修订7 单次重生不算反复：「仙尊沈修仁因上一世捡了一块被误以为是宝物的破石头被杀害，机缘巧合之下他又重开了，" +
    "这一世无论如何他都要想尽一切办法活下去」——只重开一次，是重生文；SCHEMA「同一段时间反复重来」里的「反复」是定义性的，不是修饰。" +
    "本条由通道 3 在上一轮标为存疑、提请总指挥（通道 2）终裁，2026-09-09 裁定剔除。",
};

// 保留的逐本理由（沙盘按亚型归类，便于总指挥按亚型一次性处置）
const KEEP_REASON = {
  重生之人有重开日花无再少年: "「我已重开万世……第一万次重开，我从皇城开局」——明确的同一段人生反复重来",
  "漏洞都是漏洞，重开": "「任何选择都可以重来，只需要付出一点点代价」——重来义，且明写代价机制",
  "我满级后系统让我重开！": "「狗系统直接让他重开了」「宿主重新来过」——重来义",
  仙尊重开记: "「因上一世被杀害……又重开了」——是重来义，但**只重开一次**，不是「反复」；沿用上一轮判定保留，存疑见报告",
  无限重开: "「剧情无限重开，美女好感度不高就重开」——反复重来，最典型的一本",
  道祖重开: "「修成道祖后觉得不是想要的，还是重开吧。穿越，启动！」——主角主动重来一遍",
};

const SANDBOX_NOTE =
  "沙盘流：主角拥有/创造一个外部世界，看它演化并介入，收割成果。词义上是货真价实的「模拟」，不是误命中，故保留；" +
  "但它与本仓要对标的「模拟流」不是同一个机制，详见 meta.notes 与交付报告。";

// ── 应用 ────────────────────────────────────────────────────────────
const verdict = { _说明: "", keep: {}, drop: { ...DROP }, 沙盘亚型: {}, 有强词兜底未参与降级: {} };
const dropped = [];
for (const b of weakOnly) {
  const weakHit = kwOf(b).filter((k) => WEAK.includes(k));
  if (DROP[b.title]) dropped.push(b);
  else verdict.keep[b.title] = KEEP_REASON[b.title] ?? `弱词「${weakHit.join("/")}」：${SANDBOX_NOTE}`;
}

// 修订 7 追加的一步：8 本有强词兜底的书里有没有「单次重生」型的。
// 它们即使是也不影响入选（强词兜底），但按总指挥要求在判定文件里标一笔，免得下次有人重查。
const REPEAT_MARK = /万次|一万次|万世|百万年|无限|反复|每一次|一次又一次|重新来过|再来一次/;
for (const b of data.books.filter((x) => kwOf(x).some((k) => WEAK.includes(k)) && kwOf(x).some((k) => STRONG.includes(k)))) {
  const hay = `${b.title} ${b.abstract ?? ""}`;
  const rep = hay.match(REPEAT_MARK)?.[0] ?? null;
  verdict.有强词兜底未参与降级[b.title] = rep
    ? `强词 ${kwOf(b).filter((k) => STRONG.includes(k)).join("/")} 兜底；反复记号「${rep}」，非单次重生`
    : `强词 ${kwOf(b).filter((k) => STRONG.includes(k)).join("/")} 兜底；简介里未见明确的反复记号，但强词已足以入选，不影响收录`;
}

const dropSet = new Set(dropped.map((b) => b.platformBookId));
data.books = data.books.filter((b) => !dropSet.has(b.platformBookId));
for (const b of dropped) {
  data.nearMiss.push({
    title: b.title,
    url: b.url,
    // 全组统一口径：词义复核剔下来的是 ¬A∧B（真修仙文，只是不满足条件 A），
    // 与原定义的 nearMiss（A∧¬B）不是一回事，reason 里必须带这行字样以便机器分辨。
    reason: `SCHEMA 修订6 词义复核：${DROP[b.title]}`,
  });
}

// 沙盘那 28 本的体量与标签分布——是「沙盘流≠模拟流」这个判断的量化依据
const sandbox = weakOnly.filter((b) => kwOf(b).includes("沙盘") && !DROP[b.title]);
const wc = sandbox.map((b) => b.wordCount).filter(Number.isFinite).sort((a, b) => a - b);
const tagCount = {};
for (const b of sandbox) for (const t of b.tags ?? []) tagCount[t] = (tagCount[t] ?? 0) + 1;
const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
verdict.沙盘亚型 = {
  本数: sandbox.length,
  军事沙盘误命中: 0,
  字数中位数: wc[Math.floor(wc.length / 2)] ?? null,
  低于5万字的: sandbox.filter((b) => (b.wordCount ?? 0) < 50000).length,
  高频标签: Object.fromEntries(topTags),
  结论: SANDBOX_NOTE,
};
verdict._说明 =
  "SCHEMA 修订 6 要求弱词（重开/沙盘/演算/预演）回原句判词义。本文件是飞卢/纵横这一格的逐本判定，" +
  `复核范围为「仅靠弱词入选、无强词兜底」的 ${weakOnly.length} 本（含弱词共 43 本，另 8 本有强词兜底不参与降级）。` +
  "判据：该词在本书里指的是不是「主角能反复推演/重来」这个机制。";

writeJson(path.join(DIR, "ch5_weak_verdict.json"), verdict);

// ── 接管记录 ────────────────────────────────────────────────────────
const TAKEOVER =
  `\n【2026-09-09 通道 3 接管执行】本文件原属通道 5，该通道在线但连续四单零响应，经总指挥（通道 2）授权由通道 3 接管，` +
  `补做 SCHEMA 修订 6 的弱词词义复核。上一轮通道 5 只做了「重开」（判据在 ch5_chongkai_verdict.json），` +
  `沙盘/演算/预演三个词从未复核。本轮范围：仅靠弱词入选、无强词兜底的 ${weakOnly.length} 本（含弱词共 43 本，8 本有强词兜底未动）。` +
  `结果：剔除 ${dropped.length} 本（${dropped.map((b) => b.title).join("、")}），books ${data.books.length + dropped.length} → ${data.books.length}，` +
  `nearMiss ${data.nearMiss.length - dropped.length} → ${data.nearMiss.length}。原句写进各条 reason 并带「SCHEMA 修订6 词义复核」字样，痕迹可推翻。其余字段、判据、抓取记录一字未动。` +
  `\n【接管中发现的一件事，比剔除本身重要：沙盘流 ≠ 模拟流】仅靠弱词入选的 ${weakOnly.length} 本里 ${sandbox.length} 本是「沙盘」，` +
  `**其中军事沙盘/地形模型式的误命中 0 本**——预判要拦的那一类在这批里根本不存在，所以按词义它们全部保留。` +
  `但逐本读下来，沙盘流讲的是「主角当造物主，创造一个外部世界、看文明演化、收割成果」，` +
  `主角本人不重来、时间线不回滚；而本仓对标的模拟流是「主角把自己这一生反复推演，拿死过一次换来的信息回到现实做对的选择」。` +
  `两者共享「模拟」的字面，机制相反：一个是向外造世界，一个是向内重活。量化旁证：这 ${sandbox.length} 本字数中位数仅 ` +
  `${Math.round((verdict.沙盘亚型.字数中位数 ?? 0) / 1000) / 10} 万字、${verdict.沙盘亚型.低于5万字的} 本不足 5 万字（多为断更坑），` +
  `高频标签是 ${topTags.slice(0, 5).map(([t, n]) => t + n).join("/")}，与模拟流的系统/重生/升级练功完全不同族。` +
  `**它们留在 books 里是对的（SCHEMA 条件 A 的「沙盘」没有像「重开」那样带限定义），但做同题对标时应作为独立亚型排除，否则会把 ${sandbox.length} 本非同题的小体量书算进分母，字数中位数与标题句式两项结论都会被带偏。** ` +
  `是否给「沙盘」补一条限定义、或在合并层加亚型标记，请总指挥定。逐本判定见 ch5_weak_verdict.json。`;

if (String(data.meta.notes).includes("通道 3 接管执行")) {
  console.log("接管记录已存在，跳过（幂等）");
} else {
  data.meta.notes += TAKEOVER;
}

// 修订 7 是接管之后才立的，单独一段追加，不去改上面那段已经写死的数
const R7 =
  `\n【2026-09-09 SCHEMA 修订 7 落地·通道 3 执行】总指挥裁定「同一段时间反复重来」里的**「反复」是定义性的**，` +
  `单次重生不算。据此把《仙尊重开记》（只重开一次，典型重生文）剔入 nearMiss，books ${data.books.length + 1} → ${data.books.length}。` +
  `本条只会让更多书被剔、不会让已剔的回来，故此前按「重开+宾语」剔掉的 18 本无需重审；需复查的只有已保留的重开书，已逐本看过。` +
  `另按要求核了 8 本有强词兜底的：反复记号齐全，无单次重生型，逐本标注见 ch5_weak_verdict.json 的「有强词兜底未参与降级」段。` +
  `\n【同一轮的另一件·notes 格式】总指挥已把 raw_ch4_qimao.json 与 raw_ch2_fanqie.json 的 meta.notes 由数组归一回字符串，` +
  `五份交付现全部符合 SCHEMA 第 3 节的字符串契约。本文件自始为字符串，未受影响。`;
if (!String(data.meta.notes).includes("SCHEMA 修订 7 落地")) data.meta.notes += R7;
writeJson(FILE, data);

console.log(`复核 ${weakOnly.length} 本：保留 ${weakOnly.length - dropped.length}，剔除 ${dropped.length}`);
console.log(`books → ${data.books.length}，nearMiss → ${data.nearMiss.length}`);
console.log(`沙盘 ${sandbox.length} 本｜军事沙盘误命中 0｜字数中位数 ${verdict.沙盘亚型.字数中位数}｜<5万字 ${verdict.沙盘亚型.低于5万字的} 本`);
console.log(`沙盘高频标签：${topTags.map(([t, n]) => `${t}×${n}`).join("、")}`);
