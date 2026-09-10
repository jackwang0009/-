// merge_qc.mjs 的端到端演练：在沙箱目录里造三份合成分表，验证「全绿→合并→归档」整条链路。
// 造的是纯占位元数据，不含任何作品正文。跑完即删。

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SANDBOX = path.join(ROOT, '.scrape', '_mergetest');
const ARCHIVE_OUT = path.join(SANDBOX, '归档');

const COLUMNS = [
  '序号', '书名', '作者', '平台', '书籍ID', '官方书页URL', '字数(万)', '连载状态',
  '平台分类', '内容标签', '总章节数', '首发时间', '最近更新', '榜位快照20260826',
  '核心设定', '简介摘要', '封面URL', '是否核心玄幻盘', '数据来源', '核验状态',
];

const HOSTS = {
  番茄: 'fanqienovel.com', 起点: 'qidian.com', QQ阅读: 'book.qq.com',
  七猫: 'qimao.com', 纵横: 'zongheng.com',
};

function row(seq, plat, opts = {}) {
  const host = HOSTS[plat];
  const r = {
    序号: String(seq), 书名: `测试书${seq}`, 作者: `作者${seq}`, 平台: plat,
    书籍ID: `id${seq}`, 官方书页URL: `https://${host}/book/${seq}`,
    '字数(万)': String(50 + seq), 连载状态: seq % 3 === 0 ? '已完结' : '连载中',
    平台分类: '传统玄幻', 内容标签: '标签甲/标签乙', 总章节数: String(500 + seq),
    首发时间: '2025-03-04', 最近更新: '2026-08-25',
    榜位快照20260826: `某榜 #${seq}`, 核心设定: `设定${seq}`, 简介摘要: `占位摘要${seq}`,
    封面URL: `https://${host}/cover/${seq}.jpg`, 是否核心玄幻盘: '是',
    数据来源: `${plat}官方书页 2026-08-26`, 核验状态: '已核实',
    ...opts,
  };
  return COLUMNS.map((c) => {
    const v = r[c] ?? '';
    return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',');
}

function writeCsv(file, rows) {
  fsSync.writeFileSync(file, '\ufeff' + [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n', 'utf8');
}

function run(script, args) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [path.join(ROOT, '.scrape', script), ...args], { cwd: ROOT });
    let buf = '';
    c.stdout.on('data', (d) => { buf += d; });
    c.stderr.on('data', (d) => { buf += d; });
    c.on('close', (code) => resolve({ out: buf, code }));
  });
}

const checks = [];
const check = (name, pass, detail = '') => {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

await fs.rm(SANDBOX, { recursive: true, force: true });
await fs.mkdir(SANDBOX, { recursive: true });

const seqs = {
  番茄: Array.from({ length: 30 }, (_, i) => i + 1),
  起点QQ: [...Array.from({ length: 25 }, (_, i) => i + 31), ...Array.from({ length: 15 }, (_, i) => i + 76)],
  七猫纵横: [...Array.from({ length: 20 }, (_, i) => i + 56), ...Array.from({ length: 10 }, (_, i) => i + 91)],
};

writeCsv(path.join(SANDBOX, '番茄-档案.csv'), seqs.番茄.map((s) => row(s, '番茄')));
writeCsv(path.join(SANDBOX, '起点QQ阅读-档案.csv'), seqs.起点QQ.map((s) => row(s, s <= 55 ? '起点' : 'QQ阅读')));
writeCsv(path.join(SANDBOX, '七猫纵横-档案.csv'), seqs.七猫纵横.map((s) => row(s, s <= 75 ? '七猫' : '纵横')));

console.log('=== 全绿场景：三份分表齐全且合规 ===');
const r1 = await run('merge_qc.mjs', ['--dir', SANDBOX]);
check('退出码 0（无阻断性错误）', r1.code === 0, `code=${r1.code}`);
check('报告声明合并 100 行', /合并行数：100/.test(r1.out));
check('序号 1–100 无缺号', /连续性：无缺号/.test(r1.out));
check('跨表无重号', /跨表重号：无/.test(r1.out));
check('总表已写出', fsSync.existsSync(path.join(SANDBOX, '玄幻书库-100本.csv')));

const master = fsSync.readFileSync(path.join(SANDBOX, '玄幻书库-100本.csv'), 'utf8');
check('总表带 UTF-8 BOM', master.charCodeAt(0) === 0xfeff);
check('总表 CRLF 换行', master.includes('\r\n'));
const mLines = master.replace(/^\ufeff/, '').trim().split('\r\n');
check('总表 1 表头 + 100 数据行', mLines.length === 101, `实得 ${mLines.length}`);
check('总表表头即规范 20 列', mLines[0] === COLUMNS.join(','));
check('总表按序号升序', mLines[1].startsWith('1,') && mLines[100].startsWith('100,'));

console.log('\n=== 错误场景：注入 6 类违规 ===');
const bad = [
  row(1, '番茄', { 平台: '飞卢' }),
  row(2, '番茄', { '字数(万)': '132.6', 榜位快照20260826: '传统玄幻榜 #1 · 132.6 万在读' }),
  row(3, '番茄', { 官方书页URL: 'not-a-url' }),
  row(4, '番茄', { 作者: 'N/A' }),
  row(5, '番茄', { 连载状态: '断更中' }),
  row(6, '番茄', { 首发时间: '2025/03/04' }),
  row(7, '番茄', { 简介摘要: '啊'.repeat(61) }),
  row(8, '番茄', { 书名: '含\uE123私有字形', 核验状态: '已核实' }),
  row(9, '番茄', { 序号: '9', 总章节数: '五百章' }),
  row(10, '番茄', { 是否核心玄幻盘: 'Y' }),
  row(11, '番茄'), row(11, '番茄'),
  // 分隔符写错：用 startsWith 判前缀会静默放行，凭空多出只有一条的新状态值
  row(12, '番茄', { 核验状态: '已核实（作者）-底本署名有误' }),
  row(13, '番茄', { 核验状态: '已核实：与序号94为同书跨站双记录' }),
  row(45, '起点'),
  ...seqs.番茄.slice(13).filter((s) => s !== 20).map((s) => row(s, '番茄')),
];
writeCsv(path.join(SANDBOX, '番茄-档案.csv'), bad);

const r2 = await run('merge_qc.mjs', ['--dir', SANDBOX]);
const o = r2.out;
check('退出码 1（存在阻断性错误）', r2.code === 1, `code=${r2.code}`);
check('④ 平台越界被抓', /平台「飞卢」不在允许的五个值内/.test(o));
check('⑤ 热度误填进字数列被抓', /与榜位快照里的数字重合/.test(o));
check('③ 非法 URL 被抓', /不是合法 http\(s\) URL/.test(o));
check('占位符 N\\/A 被抓', /填了占位符「N\/A」/.test(o));
check('连载状态越界被抓', /连载状态「断更中」/.test(o));
check('日期格式被抓', /格式应为 YYYY-MM-DD/.test(o));
check('简介摘要超 60 字被抓', /简介摘要 61 字/.test(o));
check('PUA 未标待核实被抓', /含 PUA 私有字体字符/.test(o));
check('总章节数非整数被抓', /总章节数「五百章」/.test(o));
check('是否核心玄幻盘越界被抓', /是否核心玄幻盘「Y」/.test(o));
check('核验状态全角括号分隔符被抓', /#12 .*核验状态.*格式不合规/.test(o));
check('核验状态全角冒号分隔符被抓', /#13 .*核验状态.*格式不合规/.test(o));
check('① 序号重号被抓', /序号 11 重复出现/.test(o));
check('① 序号越区间被抓', /不在本通道分工区间/.test(o));
check('① 缺号被抓', /缺号：20/.test(o));
check('有错时拒绝写总表', /总表未写出/.test(o));

console.log('\n=== 归档器吃合并总表 ===');
writeCsv(path.join(SANDBOX, '番茄-档案.csv'), seqs.番茄.map((s) => row(s, '番茄')));
await run('merge_qc.mjs', ['--dir', SANDBOX]);
const r3 = await run('archive.mjs', [
  '--in', path.join(SANDBOX, '玄幻书库-100本.csv'), '--out', ARCHIVE_OUT, '--no-covers',
]);
check('归档器读到 100 条', /读到 100 条/.test(r3.out));
check('20 列总表不触发别名映射', !/列名兼容映射/.test(r3.out));
check('books/ 出 100 份 JSON', fsSync.readdirSync(path.join(ARCHIVE_OUT, 'books')).length === 100);
const man = JSON.parse(fsSync.readFileSync(path.join(ARCHIVE_OUT, 'manifest.json'), 'utf8'));
check('manifest 认出这不是底本', man.输入表是底本 === false);
check('manifest 认定表头合规', man.表头合规 === true);
check('manifest 全 20 列 100% 覆盖', COLUMNS.every((c) => man.字段覆盖率[c].覆盖率 === '100.0%'));
check('manifest 平台分布五平台齐全', Object.keys(man.平台分布).length === 5, JSON.stringify(man.平台分布));

await fs.rm(SANDBOX, { recursive: true, force: true });
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} 通过`);
if (failed.length) { console.log('未通过：' + failed.map((c) => c.name).join('；')); process.exitCode = 1; }
