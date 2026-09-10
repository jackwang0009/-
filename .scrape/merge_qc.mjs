// 分表严格校验 + 合并总表 + 质检报告。
// 原则：只诊断不代填。缺失值一律如实报缺，绝不猜测补全。

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE_CSV = path.join(ROOT, 'docs', '玄幻选题库-100本-20260826.csv');

const dirArg = process.argv.indexOf('--dir');
const LIB_DIR = dirArg >= 0 ? path.resolve(ROOT, process.argv[dirArg + 1]) : path.join(ROOT, 'docs', '书库');
const MASTER = path.join(LIB_DIR, '玄幻书库-100本.csv');
const REPORT = path.join(LIB_DIR, '_质检报告.md');

const COLUMNS = [
  '序号', '书名', '作者', '平台', '书籍ID', '官方书页URL', '字数(万)', '连载状态',
  '平台分类', '内容标签', '总章节数', '首发时间', '最近更新', '榜位快照20260826',
  '核心设定', '简介摘要', '封面URL', '是否核心玄幻盘', '数据来源', '核验状态',
];

const REQUIRED = new Set([
  '序号', '书名', '作者', '平台', '书籍ID', '官方书页URL', '字数(万)', '连载状态',
  '平台分类', '榜位快照20260826', '核心设定', '简介摘要', '是否核心玄幻盘', '数据来源', '核验状态',
]);

const PLATFORMS = ['起点', '番茄', '七猫', '纵横', 'QQ阅读'];
const PLACEHOLDERS = new Set(['N/A', 'n/a', 'NA', '未知', '-', '—', '无', 'null', 'NULL', 'None', '暂无', '待补']);

const PARTS = [
  { file: '番茄-档案.csv', channel: 3, ranges: [[1, 30]], platforms: ['番茄'] },
  { file: '起点QQ阅读-档案.csv', channel: 2, ranges: [[31, 55], [76, 90]], platforms: ['起点', 'QQ阅读'] },
  { file: '七猫纵横-档案.csv', channel: 4, ranges: [[56, 75], [91, 100]], platforms: ['七猫', '纵横'] },
];

const PLATFORM_HOSTS = {
  起点: ['qidian.com'],
  QQ阅读: ['qq.com', 'qidian.com'],
  番茄: ['fanqienovel.com', 'changdunovel.com'],
  七猫: ['qimao.com', 'wtzw.com'],
  纵横: ['zongheng.com'],
};

function parseCsv(text) {
  const hadBom = text.charCodeAt(0) === 0xfeff;
  if (hadBom) text = text.slice(1);
  const rows = [];
  let row = [], field = '', quoted = false, dirty = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
      continue;
    }
    if (c === '"') { quoted = true; dirty = true; }
    else if (c === ',') { row.push(field); field = ''; dirty = true; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; dirty = false; }
    else if (c !== '\r') { field += c; dirty = true; }
  }
  if (dirty || field.length) { row.push(field); rows.push(row); }
  return { rows: rows.filter((r) => r.some((v) => v.trim() !== '')), hadBom };
}

function toCsv(records) {
  const q = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [COLUMNS.map(q).join(',')];
  for (const r of records) lines.push(COLUMNS.map((c) => q(r[c] ?? '')).join(','));
  return '\ufeff' + lines.join('\r\n') + '\r\n';
}

function expandRanges(ranges) {
  const out = [];
  for (const [a, b] of ranges) for (let i = a; i <= b; i++) out.push(i);
  return out;
}

function loadBase() {
  if (!fsSync.existsSync(BASE_CSV)) return new Map();
  const { rows } = parseCsv(fsSync.readFileSync(BASE_CSV, 'utf8'));
  const header = rows[0].map((h) => h.trim());
  const iSeq = header.indexOf('序号');
  const iTitle = header.indexOf('书名');
  const map = new Map();
  for (const r of rows.slice(1)) {
    const seq = Number((r[iSeq] || '').trim());
    if (Number.isFinite(seq)) map.set(seq, (r[iTitle] || '').trim());
  }
  return map;
}

function validateFile(part, base) {
  const full = path.join(LIB_DIR, part.file);
  const errors = [];
  const warns = [];
  const gaps = [];

  if (!fsSync.existsSync(full)) {
    return { part, exists: false, errors: [`文件不存在：docs/书库/${part.file}`], warns, gaps, records: [] };
  }

  const raw = fsSync.readFileSync(full, 'utf8');
  const { rows, hadBom } = parseCsv(raw);
  if (!hadBom) warns.push('文件没有 UTF-8 BOM，Excel 直开会乱码（规范第 4 节要求 BOM）');
  if (!rows.length) return { part, exists: true, errors: ['文件是空的'], warns, gaps, records: [] };

  const header = rows[0].map((h) => h.trim());
  if (header.length !== COLUMNS.length || header.some((h, i) => h !== COLUMNS[i])) {
    const missing = COLUMNS.filter((c) => !header.includes(c));
    const extra = header.filter((c) => !COLUMNS.includes(c));
    errors.push(
      `表头与规范 20 列不一致（顺序也必须一致）。` +
      (missing.length ? `缺列：${missing.join('、')}。` : '') +
      (extra.length ? `多出：${extra.join('、')}。` : '') +
      (!missing.length && !extra.length ? '列名对但顺序错。' : '')
    );
  }

  // 字段数对不上说明有多余/缺失的逗号，会让整行右移错位；先报根因再报下游症状
  rows.slice(1).forEach((cells, i) => {
    if (cells.length !== COLUMNS.length) {
      const seq = (cells[0] || '').trim();
      const diff = cells.length - COLUMNS.length;
      errors.push(
        `第 ${i + 2} 行（序号 ${seq || '?'}）字段数 ${cells.length}，应为 ${COLUMNS.length}` +
        `：${diff > 0 ? `多了 ${diff} 个逗号，该行从多出处起整体右移错位` : `少了 ${-diff} 个逗号`}`
      );
    }
  });

  const idx = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)]));
  const records = rows.slice(1).map((cells) => {
    const rec = {};
    for (const c of COLUMNS) rec[c] = idx[c] >= 0 ? (cells[idx[c]] ?? '').trim() : '';
    return rec;
  });

  const expected = expandRanges(part.ranges);
  const seen = new Map();
  for (const rec of records) {
    const seq = Number(rec['序号']);
    if (!Number.isInteger(seq)) { errors.push(`序号不是整数：「${rec['序号']}」（书名 ${rec['书名'] || '?'}）`); continue; }
    if (seen.has(seq)) errors.push(`序号 ${seq} 重复出现`);
    seen.set(seq, rec);
    if (!expected.includes(seq)) {
      errors.push(`序号 ${seq} 不在本通道分工区间 ${part.ranges.map(([a, b]) => `${a}-${b}`).join('、')} 内`);
    }
  }
  const missingSeq = expected.filter((s) => !seen.has(s));
  if (missingSeq.length) errors.push(`缺 ${missingSeq.length} 行，缺号：${missingSeq.join(', ')}`);
  if (records.length !== expected.length) {
    errors.push(`行数 ${records.length}，应为 ${expected.length}`);
  }

  for (const rec of records) {
    const seq = rec['序号'];
    const tag = `#${seq} ${rec['书名'] || '(无书名)'}`;

    for (const col of COLUMNS) {
      const v = rec[col];
      if (v && PLACEHOLDERS.has(v)) {
        errors.push(`${tag} 列「${col}」填了占位符「${v}」，规范要求取不到就留空`);
      }
    }
    for (const col of COLUMNS) {
      if (REQUIRED.has(col) && !rec[col]) gaps.push({ 序号: seq, 书名: rec['书名'], 列: col });
    }

    const plat = rec['平台'];
    if (plat && !PLATFORMS.includes(plat)) {
      errors.push(`${tag} 平台「${plat}」不在允许的五个值内（${PLATFORMS.join('/')}）`);
    } else if (plat && !part.platforms.includes(plat)) {
      errors.push(`${tag} 平台「${plat}」不属于本通道负责的 ${part.platforms.join('/')}`);
    }

    for (const col of ['官方书页URL', '封面URL']) {
      const u = rec[col];
      if (!u) continue;
      let parsed = null;
      try { parsed = new URL(u); } catch { /* 下面统一报错 */ }
      if (!parsed || !/^https?:$/.test(parsed.protocol)) {
        errors.push(`${tag} 列「${col}」不是合法 http(s) URL：${u.slice(0, 80)}`);
        continue;
      }
      if (col === '官方书页URL' && plat && PLATFORM_HOSTS[plat]) {
        const ok = PLATFORM_HOSTS[plat].some((h) => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
        if (!ok) warns.push(`${tag} 官方书页URL 域名 ${parsed.hostname} 与平台「${plat}」不匹配，请确认不是填错平台`);
      }
    }

    const w = rec['字数(万)'];
    if (w) {
      const n = Number(w);
      if (!Number.isFinite(n)) errors.push(`${tag} 字数(万)「${w}」不是数字`);
      else if (n <= 0) errors.push(`${tag} 字数(万) 为 ${n}，非正数`);
      else {
        // 超长确有其书（如 3000 万字量级的老书），已在核验状态交代过的就不再重复提醒
        const noted = rec['核验状态'] && rec['核验状态'] !== '已核实';
        if (n > 2000 && !noted) warns.push(`${tag} 字数(万) ${n} 超过 2000 万字，请二次核对是否误填`);
        const snap = rec['榜位快照20260826'] || '';
        if (snap && new RegExp(`(?<![\\d.])${w.replace('.', '\\.')}(?![\\d.])`).test(snap)) {
          errors.push(`${tag} 字数(万) ${w} 与榜位快照里的数字重合（「${snap.slice(0, 40)}」），高度疑似把在读/热度填进了字数列`);
        }
      }
    }

    const st = rec['连载状态'];
    if (st && !['连载中', '已完结'].includes(st)) {
      errors.push(`${tag} 连载状态「${st}」不在 连载中/已完结 之内`);
    }

    for (const col of ['首发时间', '最近更新']) {
      const d = rec[col];
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) errors.push(`${tag} 列「${col}」格式应为 YYYY-MM-DD，实为「${d}」`);
    }

    const ch = rec['总章节数'];
    if (ch && !/^\d+$/.test(ch)) errors.push(`${tag} 总章节数「${ch}」不是整数`);

    const core = rec['是否核心玄幻盘'];
    if (core && !['是', '否', '待定'].includes(core)) errors.push(`${tag} 是否核心玄幻盘「${core}」应为 是/否/待定`);

    // 规范第 2、3 节要求把口径备注写进核验状态（如 待核实-PUA），故允许后缀说明。
    // 但必须是「前缀 + 半角 - 」或纯前缀：用 startsWith 会把 `已核实（作者）-…`、`已核实：…`
    // 这类写错分隔符的静默放行，凭空多出只有一条的新状态值。
    const vs = rec['核验状态'];
    if (vs && !/^(已核实|待核实|冲突)(-|$)/.test(vs)) {
      const head = vs.slice(0, 8);
      errors.push(`${tag} 核验状态「${vs.slice(0, 40)}」格式不合规：必须是 已核实/待核实/冲突 之一，其后要么结束要么紧跟半角 \`-\`（此处为「${head}…」）`);
    }

    const brief = rec['简介摘要'];
    if (brief && [...brief].length > 60) {
      errors.push(`${tag} 简介摘要 ${[...brief].length} 字，超出 60 字上限`);
    }

    const pua = /[\uE000-\uF8FF]/;
    if (pua.test(rec['书名']) || pua.test(rec['作者'])) {
      if (!vs.startsWith('待核实')) {
        errors.push(`${tag} 书名/作者含 PUA 私有字体字符，核验状态必须标 待核实-PUA，实为「${vs || '(空)'}」`);
      } else {
        warns.push(`${tag} 含 PUA 字符，已按规范标记待核实，需 App 内核对`);
      }
    }

    // 已在核验状态写明订正理由的不再提示，只揪没有交代的改名
    const baseTitle = base.get(Number(seq));
    if (baseTitle && rec['书名'] && baseTitle !== rec['书名'] && (!vs || vs === '已核实')) {
      warns.push(`${tag} 书名与底本「${baseTitle}」不一致却未在核验状态说明理由`);
    }
  }

  return { part, exists: true, errors, warns, gaps, records };
}

function coverageOf(records) {
  const out = {};
  for (const c of COLUMNS) {
    const n = records.filter((r) => (r[c] ?? '').trim() !== '').length;
    out[c] = { 非空: n, 总数: records.length, 率: records.length ? (n / records.length) * 100 : 0 };
  }
  return out;
}

function fmtPct(x) { return `${x.toFixed(1)}%`; }

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes('--force');
  const noMerge = argv.includes('--no-merge');

  const base = loadBase();
  const results = PARTS.map((p) => validateFile(p, base));

  const lines = [];
  const say = (s = '') => { lines.push(s); console.log(s); };

  say(`# 玄幻书库 · 质检报告`);
  say();
  say(`- 生成时间：${new Date().toISOString()}`);
  say(`- 校验依据：docs/书库/_字段规范.md（20 列 v1）`);
  say();
  say(`## 一、分表交付状态`);
  say();
  say(`| 通道 | 文件 | 状态 | 行数/应交 | 阻断性错误 | 提示 |`);
  say(`| --- | --- | --- | --- | --- | --- |`);
  for (const r of results) {
    const need = expandRanges(r.part.ranges).length;
    const status = !r.exists ? '未交付' : r.errors.length ? '不合规·退回' : '通过';
    say(`| ${r.part.channel} | ${r.part.file} | ${status} | ${r.exists ? r.records.length : 0}/${need} | ${r.errors.length} | ${r.warns.length} |`);
  }
  say();

  let anyError = false;
  for (const r of results) {
    if (!r.errors.length && !r.warns.length && !r.gaps.length) continue;
    anyError = anyError || r.errors.length > 0;
    say(`### 通道 ${r.part.channel} — ${r.part.file}`);
    say();
    if (r.errors.length) {
      say(`**阻断性错误 ${r.errors.length} 项（须由通道 ${r.part.channel} 自行修正后重交）：**`);
      say();
      for (const e of r.errors) say(`- ${e}`);
      say();
    }
    if (r.warns.length) {
      say(`**提示 ${r.warns.length} 项：**`);
      say();
      for (const w of r.warns) say(`- ${w}`);
      say();
    }
    if (r.exists) {
      const cov = coverageOf(r.records);
      const thin = COLUMNS.filter((c) => cov[c].非空 < r.records.length);
      say(`**未满列覆盖率（缺口由通道 ${r.part.channel} 自行补，本通道不代填）：**`);
      say();
      if (!thin.length) say('全部 20 列 100% 非空。');
      else {
        for (const c of thin) {
          const who = r.records.filter((x) => !x[c]).map((x) => x['序号']);
          const mark = REQUIRED.has(c) ? '必填 ' : '选填 ';
          say(`- ${mark}\`${c}\` ${fmtPct(cov[c].率)}，缺 ${who.length} 条：${who.join(', ')}`);
        }
      }
      say();
    }
  }

  const missingFiles = results.filter((r) => !r.exists);
  if (missingFiles.length) {
    say(`## 二、合并未执行`);
    say();
    say(`还差 ${missingFiles.length} 份分表：${missingFiles.map((r) => `${r.part.file}（通道 ${r.part.channel}）`).join('、')}`);
    await fs.mkdir(LIB_DIR, { recursive: true });
    await fs.writeFile(REPORT, lines.join('\n') + '\n', 'utf8');
    console.log(`\n报告已写入 ${path.relative(ROOT, REPORT)}`);
    return;
  }

  const all = results.flatMap((r) => r.records);
  const bySeq = new Map();
  const dupes = [];
  for (const rec of all) {
    const s = Number(rec['序号']);
    if (bySeq.has(s)) dupes.push(s); else bySeq.set(s, rec);
  }
  const merged = [...bySeq.values()].sort((a, b) => Number(a['序号']) - Number(b['序号']));
  const missingSeq = [];
  for (let i = 1; i <= 100; i++) if (!bySeq.has(i)) missingSeq.push(i);

  say(`## 二、合并结果`);
  say();
  say(`- 合并行数：${merged.length}`);
  say(`- 序号 1–100 连续性：${missingSeq.length ? `缺 ${missingSeq.length} 个 → ${missingSeq.join(', ')}` : '无缺号'}`);
  say(`- 跨表重号：${dupes.length ? [...new Set(dupes)].join(', ') : '无'}`);
  say();

  const cov = coverageOf(merged);
  say(`## 三、字段覆盖率`);
  say();
  say(`| 列 | 必填 | 非空 | 覆盖率 |`);
  say(`| --- | --- | --- | --- |`);
  for (const c of COLUMNS) {
    say(`| ${c} | ${REQUIRED.has(c) ? '是' : '否'} | ${cov[c].非空}/${cov[c].总数} | ${fmtPct(cov[c].率)} |`);
  }
  say();

  const shortfall = COLUMNS.filter((c) => REQUIRED.has(c) && cov[c].非空 < merged.length);
  if (shortfall.length) {
    say(`**必填列未满 100% 的有 ${shortfall.length} 列**（缺口归属各平台通道，本通道不代填）：`);
    say();
    for (const c of shortfall) {
      const who = merged.filter((r) => !r[c]).map((r) => r['序号']);
      say(`- \`${c}\`：缺 ${who.length} 条 → ${who.join(', ')}`);
    }
    say();
  }

  const platTally = {};
  for (const r of merged) platTally[r['平台'] || '(空)'] = (platTally[r['平台'] || '(空)'] || 0) + 1;
  say(`## 四、平台分布`);
  say();
  say(Object.entries(platTally).map(([k, v]) => `${k} ${v}`).join(' · '));
  const badPlat = merged.filter((r) => r['平台'] && !PLATFORMS.includes(r['平台']));
  say();
  say(`平台字段越界项：${badPlat.length ? badPlat.map((r) => `#${r['序号']}「${r['平台']}」`).join('、') : '无'}`);
  say();

  const badUrl = [];
  for (const r of merged) {
    for (const c of ['官方书页URL', '封面URL']) {
      if (!r[c]) continue;
      try { const u = new URL(r[c]); if (!/^https?:$/.test(u.protocol)) throw new Error(); }
      catch { badUrl.push(`#${r['序号']} ${c}：${r[c].slice(0, 60)}`); }
    }
  }
  say(`## 五、URL 合法性`);
  say();
  say(`- 官方书页URL 非空 ${cov['官方书页URL'].非空}/${merged.length}，封面URL 非空 ${cov['封面URL'].非空}/${merged.length}`);
  say(`- 无法解析为合法 http(s) 的：${badUrl.length ? '\n' + badUrl.map((s) => `  - ${s}`).join('\n') : '无'}`);
  say();

  const wordIssues = [];
  for (const r of merged) {
    const w = r['字数(万)'];
    if (!w) continue;
    const n = Number(w);
    if (!Number.isFinite(n)) { wordIssues.push(`#${r['序号']} ${r['书名']}：「${w}」非数字`); continue; }
    const noted = r['核验状态'] && r['核验状态'] !== '已核实';
    if (n <= 0) wordIssues.push(`#${r['序号']} ${r['书名']}：${n}，非正数`);
    else if (n > 2000 && !noted) wordIssues.push(`#${r['序号']} ${r['书名']}：${n} 万字，超常规上限，需核对`);
    const snap = r['榜位快照20260826'] || '';
    if (snap && new RegExp(`(?<![\\d.])${String(w).replace('.', '\\.')}(?![\\d.])`).test(snap)) {
      wordIssues.push(`#${r['序号']} ${r['书名']}：字数 ${w} 与榜位快照数字重合，疑似误填在读/热度`);
    }
  }
  say(`## 六、字数异常`);
  say();
  say(wordIssues.length ? wordIssues.map((s) => `- ${s}`).join('\n') : '无异常。');
  say();

  const needVerify = merged.filter((r) => r['核验状态'] && r['核验状态'] !== '已核实');
  say(`## 七、待核实 / 冲突条目（${needVerify.length} 条）`);
  say();
  if (needVerify.length) {
    say(`| 序号 | 书名 | 平台 | 核验状态 | 数据来源 |`);
    say(`| --- | --- | --- | --- | --- |`);
    for (const r of needVerify) {
      say(`| ${r['序号']} | ${r['书名']} | ${r['平台']} | ${r['核验状态']} | ${r['数据来源'] || ''} |`);
    }
  } else say('无。');
  say();

  const noVerifyField = merged.filter((r) => !r['核验状态']);
  if (noVerifyField.length) {
    say(`核验状态整列留空的 ${noVerifyField.length} 条（该列为必填）：${noVerifyField.map((r) => r['序号']).join(', ')}`);
    say();
  }

  // 序号是主键，不增不删：底本给一个序号就一行，给两个序号就两行。两类都不去重、不拆合。
  // 分类依据取核验状态里显式互指的序号，不取书名：讹写书名的订正通常晚于互指标注，
  // 在那个中间态里同一组的两行书名各自唯一，按书名配对会把一组甲类误拆成两条乙类。
  const seqSet = new Set(merged.map((r) => Number(r['序号'])));
  const parent = new Map(merged.map((r) => [Number(r['序号']), Number(r['序号'])]));
  const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  for (const r of merged) {
    const self = Number(r['序号']);
    for (const m of (r['核验状态'] || '').matchAll(/序号\s*(\d+)/g)) {
      const other = Number(m[1]);
      if (other !== self && seqSet.has(other)) {
        const a = find(self), b = find(other);
        if (a !== b) parent.set(a, b);
      }
    }
  }
  const grouped = {};
  for (const r of merged) (grouped[find(Number(r['序号']))] ||= []).push(r);
  const multiSeq = Object.values(grouped).filter((g) => g.length > 1)
    .map((g) => [g.map((r) => r['书名']).find(Boolean), g]);

  const inMulti = new Set(multiSeq.flatMap(([, g]) => g.map((r) => r['序号'])));
  const singleSeq = merged.filter((r) => /跨站|同书/.test(r['核验状态'] || '') && !inMulti.has(r['序号']));

  // 书名降为辅助校验：同名却互不指向的，可能是还没写互指的同书双行
  const byTitle = {};
  for (const r of merged) (byTitle[r['书名']] ||= []).push(r);
  const unlinked = Object.entries(byTitle).filter(([, v]) =>
    v.length > 1 && new Set(v.map((r) => find(Number(r['序号'])))).size > 1);

  say(`## 八、跨站同书（${multiSeq.length + singleSeq.length} 组，均不去重、不拆合）`);
  say();
  say(`序号是主键，不增不删：底本给一个序号就占一行，给两个序号就占两行。下面两类的差异来自底本分配，不是处理标准不一致。`);
  say();
  say(`**甲类 · 底本占两个序号 → 保留两行并互指（${multiSeq.length} 组）**`);
  say();
  if (multiSeq.length) {
    say(`| 书名 | 各站条目 | 字数 | 书名一致性 |`);
    say(`| --- | --- | --- | --- |`);
    for (const [title, v] of multiSeq) {
      const items = v.map((r) => `#${r['序号']} ${r['平台']}`).join(' + ');
      const ws = v.map((r) => r['字数(万)']).filter(Boolean);
      const diff = new Set(ws).size > 1 ? `${ws.join(' / ')} 万（连载进度不同，正常）` : (ws[0] ? `${ws[0]} 万，一致` : '未填');
      const titles = [...new Set(v.map((r) => r['书名']))];
      const ok = titles.length === 1 ? '一致' : `**不一致：${titles.join(' / ')}，待订正**`;
      say(`| ${title} | ${items} | ${diff} | ${ok} |`);
    }
    say();
    say(`分组依据是核验状态里显式互指的序号（句式「与序号 XX 为同书跨站双记录」），不依赖书名是否已订正。`);
  } else say('无。');
  say();
  say(`**乙类 · 底本只占一个序号 → 保留一行，另一站 ID 记于核验状态（${singleSeq.length} 组）**`);
  say();
  if (singleSeq.length) {
    say(`| 书名 | 本表条目 | 另一站信息（见核验状态） |`);
    say(`| --- | --- | --- |`);
    for (const r of singleSeq) {
      const vs = (r['核验状态'] || '').replace(/\|/g, '/');
      const clause = vs.split(/[；;]/).find((s) => /跨站|同书/.test(s))?.trim() || vs;
      say(`| ${r['书名']} | #${r['序号']} ${r['平台']} | ${clause.slice(0, 70)} |`);
    }
  } else say('无。');
  say();
  say(`> 下游注意：甲类不要合并成一行，乙类不要拆成两行，两个方向都会破坏 1–100 主键完整性。`);
  say();
  if (unlinked.length) {
    say(`**待确认 · 同名但核验状态未互指（${unlinked.length} 组）**`);
    say();
    for (const [title, v] of unlinked) {
      say(`- 《${title}》：${v.map((r) => `#${r['序号']} ${r['平台']}`).join('、')} —— 若确为同书，请在两行核验状态写明「与序号 XX 为同书跨站双记录」；若是同名异书，也请注明以免下游误并`);
    }
    say();
  }

  if (anyError && !force) {
    say(`## 九、总表未写出`);
    say();
    say(`存在阻断性错误，按把关规则退回相关通道修正，不做静默修复。确需强行合并请加 \`--force\`。`);
    await fs.writeFile(REPORT, lines.join('\n') + '\n', 'utf8');
    console.log(`\n报告已写入 ${path.relative(ROOT, REPORT)}`);
    process.exitCode = 1;
    return;
  }

  if (!noMerge) {
    await fs.writeFile(MASTER, toCsv(merged), 'utf8');
    say(`## 九、总表`);
    say();
    say(`已写出 \`docs/书库/玄幻书库-100本.csv\`（UTF-8 BOM，CRLF，${merged.length} 行）${force && anyError ? '，注意：带 --force 强行合并，上述阻断性错误仍未修' : ''}`);
    say();
  }

  await fs.writeFile(REPORT, lines.join('\n') + '\n', 'utf8');
  console.log(`\n报告已写入 ${path.relative(ROOT, REPORT)}`);
}

main().catch((e) => { console.error('质检失败：', e); process.exitCode = 1; });
