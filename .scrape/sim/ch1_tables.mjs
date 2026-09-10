// 通道 1 成稿组装用：把 docs/调研-模拟流全网盘点.md 需要的 markdown 表格直接从 all_sim.json 生成，
// 避免从三份章节稿里手抄。零新增请求。
// 跑法：node .scrape/sim/ch1_tables.mjs > .scrape/sim/_tables.md
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.resolve(process.cwd(), '.scrape/sim');
const all = JSON.parse(fs.readFileSync(path.join(DIR, 'all_sim.json'), 'utf8'));
const books = all.books;

const PLAT = { fanqie: '番茄', qimao: '七猫', zongheng: '纵横', faloo: '飞卢', tadu: '塔读' };
const wan = (n) => (Number.isFinite(n) ? (n / 10000).toFixed(1) + '万' : '—');
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const pick = (b) => b.sources.find((s) => Number.isFinite(s.wordCount)) ?? b.sources[0];
const wc = (b) => med(b.sources.map((s) => s.wordCount).filter(Number.isFinite));
const plats = (b) => [...new Set(b.sources.map((s) => PLAT[s.platform] ?? s.platform))].join('+');
const chap = (b) => { const s = b.sources.find((x) => Number.isFinite(x.chapterTotal)); return s ? s.chapterTotal : null; };
const perChap = (b) => { const s = b.sources.find((x) => Number.isFinite(x.chapterTotal) && Number.isFinite(x.wordCount) && x.chapterTotal > 0); return s ? Math.round(s.wordCount / s.chapterTotal) : null; };
const stat = (b) => { const s = b.sources.find((x) => x.status && x.status !== 'unknown'); return s ? s.status : (b.sources[0].status ?? '—'); };
const hot = (b) => b.sources.filter((s) => s.popularity?.raw != null).map((s) => `${PLAT[s.platform]} ${s.popularity.metric} ${s.popularity.raw.toLocaleString('en-US')}`).join('／') || '—';

const EXCLUDED = new Set(['我定海神珠，拐走人族后六圣懵了', '我的模拟器不太对劲', '推演功法到满级，我横推武道', '前世模拟：我神话人仙身份曝光了', '玄幻：我有人生重置模拟器！']);
const txt = (b) => [b.title, b.abstract || '', (b.tags || []).join(' '), (b.categories || []).join(' ')].join(' ');
const A1W = /杂役|药童|打杂|做苦力|扫地|柴房/, A2W = /外门/, SIMW = /模拟|推演|演算/, LIFE = /长生/;
const layer = (b) => { if (EXCLUDED.has(b.title)) return null; const t = txt(b); if (!SIMW.test(t)) return null; if (A1W.test(t)) return 'A1'; if (A2W.test(t)) return 'A2'; if (LIFE.test(t)) return 'B'; return null; };
const L = { A1: [], A2: [], B: [] };
for (const b of books) { const l = layer(b); if (l) L[l].push(b); }

const hits = (b) => (b.simEvidence?.keywords ?? []).join('/');
const startW = (b) => { const t = txt(b); const m = t.match(A1W) ?? t.match(A2W); return m ? m[0] : '—'; };

const rows = (set) => set.sort((a, b) => (wc(b) ?? 0) - (wc(a) ?? 0)).map((b) =>
  `| ${b.title} | ${b.author} | ${plats(b)} | ${wan(wc(b))} | ${chap(b) ?? '—'} | ${perChap(b) ?? '—'} | ${stat(b)} | ${b.firstPublishDate ?? '—'} | ${hot(b)} | ${startW(b)} | ${hits(b)} |`).join('\n');
const HEAD = '| 书名 | 作者 | 平台 | 字数 | 章节数 | 章均 | 状态 | 首发 | 热度原值（各站口径，不折算） | 起点词 | 判据命中 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';

console.log('## A1 杂役档\n' + HEAD + '\n' + rows(L.A1));
console.log('\n## A2 外门档\n' + HEAD + '\n' + rows(L.A2));
console.log('\n## B 近邻层\n' + HEAD + '\n' + rows(L.B));

console.log('\n## ≥242 万字');
console.log('| 书名 | 平台 | 字数 | 章节数 | 章均 | 状态 | 层 |\n| --- | --- | --- | --- | --- | --- | --- |');
const core = [...L.A1, ...L.A2];
for (const b of books.filter((x) => (wc(x) ?? 0) >= 2420000).sort((a, b) => wc(b) - wc(a))) {
  const lay = core.includes(b) ? '核心' : L.B.includes(b) ? 'B 近邻' : '语料内未分层';
  console.log(`| ${b.title} | ${plats(b)} | ${wan(wc(b))} | ${chap(b) ?? '—'} | ${perChap(b) ?? '—'} | ${stat(b)} | ${lay} |`);
}

console.log('\n## 最早五本（有首发日期的）');
console.log('| 首发 | 平台 | 书名 / 作者 | 字数 | 状态 | 判据命中 |\n| --- | --- | --- | --- | --- | --- |');
for (const b of books.filter((x) => x.firstPublishDate).sort((a, b) => a.firstPublishDate.localeCompare(b.firstPublishDate)).slice(0, 5)) {
  console.log(`| ${b.firstPublishDate} | ${plats(b)} | 《${b.title}》/ ${b.author} | ${wan(wc(b))} | ${stat(b)} | ${hits(b)} |`);
}

console.log('\n## 年份分布（站次，仅有首发日期的书）');
const years = [...new Set(books.filter((b) => b.firstPublishDate).map((b) => b.firstPublishDate.slice(0, 4)))].sort();
console.log('| 平台 | ' + years.join(' | ') + ' | 合计 |\n|' + ' --- |'.repeat(years.length + 2));
for (const p of ['faloo', 'zongheng', 'fanqie', 'qimao']) {
  const bs = books.filter((b) => b.firstPublishDate && b.sources.some((s) => s.platform === p));
  const c = years.map((y) => bs.filter((b) => b.firstPublishDate.startsWith(y)).length);
  console.log(`| ${PLAT[p]} | ` + c.map((n) => (n ? n : '—')).join(' | ') + ` | ${c.reduce((a, b) => a + b, 0)} |`);
}

console.log('\n## 平台形态对照');
console.log('| | ' + ['faloo', 'zongheng', 'qimao', 'fanqie'].map((p) => PLAT[p]).join(' | ') + ' |\n|' + ' --- |'.repeat(5));
const cell = (fn) => ['faloo', 'zongheng', 'qimao', 'fanqie'].map(fn).join(' | ');
const srcOf = (p) => books.flatMap((b) => b.sources.filter((s) => s.platform === p));
console.log('| 本数 | ' + cell((p) => srcOf(p).length) + ' |');
console.log('| 字数中位 | ' + cell((p) => wan(med(srcOf(p).map((s) => s.wordCount)))) + ' |');
console.log('| 字数最小／最大 | ' + cell((p) => { const w = srcOf(p).map((s) => s.wordCount).filter(Number.isFinite); return `${wan(Math.min(...w))} / ${wan(Math.max(...w))}`; }) + ' |');
console.log('| 完结 | ' + cell((p) => { const r = srcOf(p); const d = r.filter((s) => s.status === '完结').length; const u = r.filter((s) => s.status === 'unknown').length; return `${d}（${Math.round((d / r.length) * 100)}%）${u ? `，另 ${u} 本 unknown` : ''}`; }) + ' |');
console.log('| 章均字数中位 | ' + cell((p) => { const r = srcOf(p).filter((s) => Number.isFinite(s.chapterTotal) && Number.isFinite(s.wordCount) && s.chapterTotal > 0); return r.length ? med(r.map((s) => Math.round(s.wordCount / s.chapterTotal))) + ' 字' : '不可得'; }) + ' |');
console.log('| 书名带模拟词 | ' + cell((p) => { const bs = books.filter((b) => b.sources.some((s) => s.platform === p)); const n = bs.filter((b) => b.simEvidence.matchedIn.includes('title')).length; return `${n}（${Math.round((n / bs.length) * 100)}%）`; }) + ' |');
console.log('| 仅简介命中 | ' + cell((p) => { const bs = books.filter((b) => b.sources.some((s) => s.platform === p)); const n = bs.filter((b) => b.simEvidence.matchedIn.length === 1 && b.simEvidence.matchedIn[0] === 'abstract').length; return `${n}（${Math.round((n / bs.length) * 100)}%）`; }) + ' |');

console.log('\n## 飞卢低于 40 万字（纵横最小值）的书');
const fl = books.filter((b) => b.sources.some((s) => s.platform === 'faloo'));
const small = fl.filter((b) => (wc(b) ?? 0) < 400000);
console.log(`飞卢 ${fl.length} 本中 ${small.length} 本（${Math.round((small.length / fl.length) * 100)}%）低于 40 万字`);
for (const b of small.sort((a, b) => wc(a) - wc(b)).slice(0, 5)) {
  const s = pick(b);
  console.log(`- 《${b.title}》${s.wordCount} 字、${s.chapterTotal ?? '—'} 章${b.firstPublishDate && b.firstPublishDate === s.lastUpdateDate ? '、首发当天即末更' : ''}`);
}

console.log('\n## 曝光体');
for (const b of books.filter((b) => /曝光/.test(b.title))) console.log(`- 《${b.title}》[${plats(b)}]`);

console.log('\n## 沙盘流亚型');
const sand = books.filter((b) => b.subtype === '沙盘流');
console.log(`${sand.length} 本，字数中位 ${wan(med(sand.map(wc)))}，不足 5 万字 ${sand.filter((b) => (wc(b) ?? 0) < 50000).length} 本`);
console.log(`书名含「沙盘」的：${books.filter((b) => /沙盘/.test(b.title)).length} 本，分平台 ${JSON.stringify(books.filter((b) => /沙盘/.test(b.title)).reduce((a, b) => ((a[plats(b)] = (a[plats(b)] || 0) + 1), a), {}))}`);

console.log('\n## 推演 vs 模拟（书名层）');
const ty = books.filter((b) => /推演|演算/.test(b.title)), ms = books.filter((b) => /模拟器|模拟系统|人生模拟|前世模拟/.test(b.title));
console.log(`书名含推演／演算 ${ty.length} 本；含模拟器／模拟系统／人生模拟／前世模拟 ${ms.length} 本`);
console.log('推演例：' + ty.slice(0, 6).map((b) => '《' + b.title + '》').join('、'));
console.log('模拟例：' + ms.slice(0, 6).map((b) => '《' + b.title + '》').join('、'));

console.log('\n## 存活天数（首发→末更，仅两端都有的书）');
for (const p of ['faloo', 'zongheng', 'fanqie']) {
  const d = [];
  for (const b of books) { if (!b.firstPublishDate) continue; const s = b.sources.find((x) => x.platform === p && x.lastUpdateDate); if (s) d.push((new Date(s.lastUpdateDate) - new Date(b.firstPublishDate)) / 86400000); }
  console.log(`${PLAT[p]}：n=${d.length}，中位 ${med(d.map(Math.round))} 天`);
}
