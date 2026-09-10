// 通道 1 成稿组装用：从 all_sim.json 与五份 raw_*.json 重算全部权威数字。
// 零新增请求，纯本地统计。三份章节稿的数字若与本脚本输出不符，以本脚本为准。
// 跑法：node .scrape/sim/ch1_final_stats.mjs
import fs from 'node:fs';
import path from 'node:path';

// 中文路径下 import.meta.url 会被 percent-encode，不取 .pathname，直接用 cwd 拼。
const DIR = path.resolve(process.cwd(), '.scrape/sim');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));

const all = read('all_sim.json');
const books = all.books;
const RAWS = [
  ['raw_ch2_fanqie.json', 2, '番茄'],
  ['raw_ch3_qidian.json', 3, '起点/QQ阅读'],
  ['raw_ch3_alt.json', 3, '塔读'],
  ['raw_ch4_qimao.json', 4, '七猫'],
  ['raw_ch5_feilu.json', 5, '飞卢+纵横'],
];

const med = (a) => {
  const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const pct = (n, d) => (d ? `${n}/${d}=${((n / d) * 100).toFixed(1)}%` : '—');
const wan = (n) => (n == null ? '—' : (n / 10000).toFixed(1) + '万');
const line = (t) => console.log('\n===== ' + t + ' =====');

// —— 各通道交付与 nearMiss ——
line('一、各通道交付（直接读 raw_*.json，不信任何转述）');
let sumBooks = 0, sumNear = 0;
for (const [f, ch, name] of RAWS) {
  const r = read(f);
  const nb = (r.books || []).length, nn = (r.nearMiss || []).length;
  sumBooks += nb; sumNear += nn;
  console.log(`通道${ch} ${name.padEnd(12)} ${f.padEnd(22)} status=${(r.meta?.status ?? '缺').padEnd(18)} books=${String(nb).padStart(3)} nearMiss=${String(nn).padStart(3)}`);
}
console.log(`相加 books=${sumBooks}  nearMiss=${sumNear}`);
console.log(`all_sim.json: rawRecords=${all.meta.rawRecords} uniqueBooks=${all.meta.uniqueBooks} nearMissTotal=${all.meta.nearMissTotal}`);
console.log(`去重口径：书名+作者，跨站同书占一行；rawRecords-uniqueBooks=${all.meta.rawRecords - all.meta.uniqueBooks} 本跨站重复`);

// —— 分平台 ——
line('二、分平台（站次；一本书上两个站两边各记一次）');
const byPlat = {};
for (const b of books) for (const s of b.sources) byPlat[s.platform] = (byPlat[s.platform] || 0) + 1;
console.log(JSON.stringify(byPlat));
console.log('meta.byPlatform =', JSON.stringify(all.meta.byPlatform));
const multi = books.filter((b) => b.sources.length > 1);
console.log(`跨站同书 ${multi.length} 本`);

// —— 亚型 ——
line('三、沙盘流亚型与字数中位');
const sand = books.filter((b) => b.subtype === '沙盘流');
const nonSand = books.filter((b) => b.subtype !== '沙盘流');
console.log(`subtype 分布: ${JSON.stringify(books.reduce((a, b) => ((a[b.subtype ?? 'null'] = (a[b.subtype ?? 'null'] || 0) + 1), a), {}))}`);
const wcOf = (b) => med(b.sources.map((s) => s.wordCount).filter(Number.isFinite));
const wcAll = books.map(wcOf).filter(Number.isFinite);
const wcNon = nonSand.map(wcOf).filter(Number.isFinite);
console.log(`全部 ${books.length} 本 字数中位=${med(wcAll)}（${wan(med(wcAll))}），可算 ${wcAll.length} 本`);
console.log(`排除沙盘 ${nonSand.length} 本 字数中位=${med(wcNon)}（${wan(med(wcNon))}），可算 ${wcNon.length} 本  ← 同题对标用这个`);
console.log(`meta 记的是 ${all.meta.wordCountMedian} / ${all.meta.wordCountMedianExcludingSandbox}`);

// —— 分平台字数 ——
line('四、分平台字数中位与完结状态（按站次算，口径不折算）');
for (const p of Object.keys(byPlat)) {
  const rows = [];
  for (const b of books) for (const s of b.sources) if (s.platform === p) rows.push(s);
  const w = rows.map((s) => s.wordCount).filter(Number.isFinite);
  const st = rows.reduce((a, s) => ((a[s.status ?? 'null'] = (a[s.status ?? 'null'] || 0) + 1), a), {});
  const ch = rows.filter((s) => Number.isFinite(s.chapterTotal) && Number.isFinite(s.wordCount) && s.chapterTotal > 0);
  console.log(`${p.padEnd(9)} n=${String(rows.length).padStart(3)} 字数中位=${String(med(w) ?? '—').padStart(8)}（${wan(med(w))}） 可算章均 ${String(ch.length).padStart(3)} 本 章均中位=${med(ch.map((s) => Math.round(s.wordCount / s.chapterTotal)))} 状态=${JSON.stringify(st)}`);
}

// —— 章均 ——
line('五、章均字数（全语料，对着本仓 2200 字/章）');
const chAll = [];
for (const b of books) {
  for (const s of b.sources) {
    if (Number.isFinite(s.chapterTotal) && Number.isFinite(s.wordCount) && s.chapterTotal > 0) { chAll.push(Math.round(s.wordCount / s.chapterTotal)); break; }
  }
}
console.log(`可算章均 ${chAll.length}/${books.length} 本，中位=${med(chAll)}，最短=${Math.min(...chAll)}，最长=${Math.max(...chAll)}`);
console.log(`落在 1800–2600 字：${pct(chAll.filter((x) => x >= 1800 && x <= 2600).length, chAll.length)}`);

// —— 命中方式 ——
line('六、模拟词入书名 / 仅简介命中（分平台，量的是入口不是市场）');
for (const p of Object.keys(byPlat)) {
  const bs = books.filter((b) => b.sources.some((s) => s.platform === p));
  const inTitle = bs.filter((b) => b.simEvidence.matchedIn.includes('title')).length;
  const onlyAbs = bs.filter((b) => b.simEvidence.matchedIn.length === 1 && b.simEvidence.matchedIn[0] === 'abstract').length;
  console.log(`${p.padEnd(9)} 本数=${String(bs.length).padStart(3)} 书名命中=${pct(inTitle, bs.length).padEnd(14)} 仅简介命中=${pct(onlyAbs, bs.length)}`);
}

// —— 年份 ——
line('七、首发年份分布（仅有 firstPublishDate 的书）');
const yr = {};
for (const b of books) {
  const d = b.firstPublishDate; if (!d) continue;
  const p = b.sources[0].platform, y = d.slice(0, 4);
  ((yr[p] ??= {})[y] = (yr[p][y] || 0) + 1);
}
for (const p of Object.keys(yr)) {
  const ys = Object.keys(yr[p]).sort();
  console.log(`${p.padEnd(9)} ${ys.map((y) => y + ':' + yr[p][y]).join('  ')}  合计=${ys.reduce((a, y) => a + yr[p][y], 0)}`);
}
console.log(`无首发日期的书：${books.filter((b) => !b.firstPublishDate).length} 本`);

// —— 分层（沿用 ch4_benchmark 的判据，剔除表见该稿第 9 节）——
line('八、分层重算：A1 杂役档 / A2 外门档 / B 近邻');
const EXCLUDED = new Set(['我定海神珠，拐走人族后六圣懵了', '我的模拟器不太对劲', '推演功法到满级，我横推武道', '前世模拟：我神话人仙身份曝光了', '玄幻：我有人生重置模拟器！']);
const txt = (b) => [b.title, b.abstract || '', (b.tags || []).join(' '), (b.categories || []).join(' ')].join(' ');
const A1W = /杂役|药童|打杂|做苦力|扫地|柴房/, A2W = /外门/, SIMW = /模拟|推演|演算/, LIFE = /长生/;
const layer = (b) => {
  if (EXCLUDED.has(b.title)) return null;
  const t = txt(b); if (!SIMW.test(t)) return null;
  if (A1W.test(t)) return 'A1';
  if (A2W.test(t)) return 'A2';
  if (LIFE.test(t)) return 'B';
  return null;
};
const L = { A1: [], A2: [], B: [] };
for (const b of books) { const l = layer(b); if (l) L[l].push(b); }
for (const k of ['A1', 'A2', 'B']) {
  const w = L[k].map(wcOf).filter(Number.isFinite);
  console.log(`${k} ${String(L[k].length).padStart(3)} 本  字数中位=${wan(med(w))}  区间 ${wan(Math.min(...w))}–${wan(Math.max(...w))}`);
}
const core = [...L.A1, ...L.A2];
const coreW = core.map(wcOf).filter(Number.isFinite);
console.log(`核心层 A1+A2 = ${core.length} 本，字数中位=${wan(med(coreW))}`);
console.log('A1 名单：'); for (const b of L.A1) console.log(`   ${wan(wcOf(b)).padStart(8)}  ${b.title} / ${b.author} [${b.sources.map((s) => s.platform).join('+')}]`);
console.log('A2 名单：'); for (const b of L.A2) console.log(`   ${wan(wcOf(b)).padStart(8)}  ${b.title} / ${b.author} [${b.sources.map((s) => s.platform).join('+')}]`);

// —— 体量 ——
line('九、≥242 万字的书（本仓规划体量）');
const big = books.filter((b) => (wcOf(b) ?? 0) >= 2420000).sort((a, b) => wcOf(b) - wcOf(a));
console.log(`全语料 ${big.length} 本 ≥242 万字；其中核心层 ${big.filter((b) => core.includes(b)).length} 本，B 近邻 ${big.filter((b) => L.B.includes(b)).length} 本`);
for (const b of big) {
  const s = b.sources.find((x) => Number.isFinite(x.wordCount));
  console.log(`   ${wan(wcOf(b)).padStart(9)}  ${String(s.chapterTotal ?? '—').padStart(5)} 章  ${String(s.status ?? '—').padEnd(4)}  ${b.title} [${b.sources.map((x) => x.platform).join('+')}]`);
}
const coreDone = core.filter((b) => b.sources.some((s) => s.status === '完结'));
console.log(`核心层完结 ${coreDone.length} 本，字数中位=${wan(med(coreDone.map(wcOf).filter(Number.isFinite)))}`);

// —— 标题句式 ——
line('十、标题句式（全语料 / 核心层 / B 近邻）');
const feats = {
  '带冒号两段式': (t) => /[:：]/.test(t),
  '「从…开始」': (t) => /从.{0,8}开始/.test(t),
  '「开局」起手': (t) => /开局/.test(t),
  '第一人称我': (t) => /我/.test(t),
  '模拟词入书名': (t) => SIMW.test(t),
  '低位起点词入书名': (t) => A1W.test(t) || A2W.test(t),
  '带问号叹号': (t) => /[?？!！]/.test(t),
};
const rowOf = (set) => Object.entries(feats).map(([k, f]) => `${k} ${pct(set.filter((b) => f(b.title)).length, set.length)}`).join(' | ');
console.log('全语料: ' + rowOf(books));
console.log('核心层: ' + rowOf(core));
console.log('B 近邻: ' + rowOf(L.B));
const avgLen = (set) => (set.reduce((a, b) => a + b.title.length, 0) / set.length).toFixed(1);
console.log(`书名平均字数：全语料 ${avgLen(books)} / 核心层 ${avgLen(core)} / B 近邻 ${avgLen(L.B)}`);

// —— 推演 vs 模拟 ——
line('十一、「推演」与「模拟」在书名里的分工');
console.log(`书名含推演/演算：${books.filter((b) => /推演|演算/.test(b.title)).length} 本`);
console.log(`书名含模拟：${books.filter((b) => /模拟/.test(b.title)).length} 本`);
console.log(`书名含模拟器/模拟系统：${books.filter((b) => /模拟器|模拟系统/.test(b.title)).length} 本`);

line('十二、跨站同书清单');
for (const b of multi) console.log(`   ${b.title} / ${b.author} → ${b.sources.map((s) => s.platform).join('+')}`);
