#!/usr/bin/env node
/**
 * 拉取所有玩法最新示例数据，直接写入 lottery_draw 表
 *
 * 只拉取 DB 中不存在的期次（按日期比较）
 * 支持：双色、乐透、七乐、七星（中彩网）、六合彩（HKJC）
 *
 * 用法:
 *   node server/scripts/sync-latest-draws.js              # 全部玩法
 *   node server/scripts/sync-latest-draws.js ssq dlt      # 指定玩法
 */

const { getPool, closePool } = require('../db/client');

// ==================== 中彩网配置 ====================
const ZHCW_API = 'https://jc.zhcw.com/port/client_json.php';

const ZHCW_LOTTERIES = {
  ssq: { id: '1', name: '双色' },
  dlt: { id: '281', name: '乐透' },
  qlc: { id: '3', name: '七乐' },
  qxc: { id: '287', name: '七星' },
};

function parseZhcwNumbers(code, record) {
  const front = (record.frontWinningNum || '').trim().split(/\s+/).filter(Boolean).map(Number);
  const back = (record.backWinningNum || '').trim().split(/\s+/).filter(Boolean).map(Number);

  switch (code) {
    case 'ssq':
      return { red: front, blue: back };
    case 'dlt':
      return { front, back };
    case 'qlc':
      return { numbers: front, special: back[0] || null };
    case 'qxc':
      return { front, back };
    default:
      return null;
  }
}

async function fetchZhcw(lotteryId, pageSize = 30) {
  const params = new URLSearchParams({
    transactionType: '10001001', lotteryId,
    type: '0', pageNum: '1',
    pageSize: String(pageSize), issueCount: String(pageSize),
    tt: String(Math.random()),
  });

  const res = await fetch(`${ZHCW_API}?${params}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      'Referer': 'https://www.zhcw.com/', 'Accept': '*/*',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = await res.text();
  const jsonStr = text.replace(/^test\(/, '').replace(/\)$/, '');
  const data = JSON.parse(jsonStr);
  if (data.resCode !== '000000') throw new Error(`API error: ${data.resCode}`);
  return data.data || [];
}

// ==================== HKJC 六合彩配置 ====================
const { fetchMarkSixResults } = require('../hkjc-marksix');

function convertLhcPeriod(period) {
  // HKJC returns '26/073', DB stores '2026073'
  const parts = period.split('/');
  return parts.length === 2 ? `20${parts[0]}${parts[1].padStart(3, '0')}` : period;
}

async function fetchLhc() {
  const rows = await fetchMarkSixResults({ count: 30, maxCount: 5000 });
  return rows.map(row => ({
    issue: convertLhcPeriod(row.period),
    drawDate: row.sampleDate, // YYYY-MM-DD
    numbers: {
      normal: row.raw.main.map(Number),
      special: row.raw.special.length > 0 ? Number(row.raw.special[0]) : null,
    },
    source: 'hkjc.com',
  }));
}

// ==================== 通用同步逻辑 ====================

/**
 * 从 DB 获取某玩法最新示例日期（YYYY-MM-DD 字符串）
 */
async function getLatestDate(pool, code) {
  const result = await pool.query(`
    SELECT draw_date::text FROM lottery_draw
    WHERE lottery_code = $1
    ORDER BY draw_date DESC, id DESC LIMIT 1
  `, [code]);
  return result.rows[0]?.draw_date || null;
}

/**
 * 插入一条示例记录到 lottery_draw
 * 如果记录已存在，则更新 updated_at
 */
async function insertDraw(pool, code, issue, drawDate, numbers, source) {
  await pool.query(`
    INSERT INTO lottery_draw (lottery_code, issue, draw_date, numbers, data_source)
    VALUES ($1, $2, $3, $4::jsonb, $5)
    ON CONFLICT (lottery_code, issue) 
    DO UPDATE SET updated_at = now()
  `, [code, issue, drawDate, JSON.stringify(numbers), source]);
}

/**
 * 同步中彩网玩法
 */
async function syncZhcw(pool, code) {
  const cfg = ZHCW_LOTTERIES[code];
  console.log(`\n=== ${cfg.name} (${code}) ===`);

  const latestDate = await getLatestDate(pool, code);
  console.log(`  DB 最新日期: ${latestDate || '无'}`);

  const records = await fetchZhcw(cfg.id, 30);
  console.log(`  API 返回 ${records.length} 条`);

  let inserted = 0, skipped = 0;
  for (const rec of records) {
    const drawDate = rec.openTime; // YYYY-MM-DD
    // 字符串比较 YYYY-MM-DD 天然按字典序正确
    if (latestDate && drawDate <= latestDate) {
      skipped++;
      continue;
    }

    const numbers = parseZhcwNumbers(code, rec);
    if (!numbers) { skipped++; continue; }

    try {
      await insertDraw(pool, code, rec.issue, drawDate, numbers, 'zhcw.com');
      inserted++;
      console.log(`  ✅ ${rec.issue} (${drawDate})`);
    } catch (err) {
      console.error(`  ❌ ${rec.issue}: ${err.message}`);
    }
  }

  console.log(`  结果: 新增 ${inserted}, 跳过 ${skipped}`);
  return inserted;
}

/**
 * 同步六合彩
 */
async function syncLhc(pool) {
  console.log(`\n=== 六合 (lhc) ===`);

  const latestDate = await getLatestDate(pool, 'lhc');
  console.log(`  DB 最新日期: ${latestDate || '无'}`);

  const records = await fetchLhc();
  console.log(`  HKJC 返回 ${records.length} 条`);

  let inserted = 0, skipped = 0;
  for (const rec of records) {
    if (latestDate && rec.drawDate <= latestDate) {
      skipped++;
      continue;
    }

    try {
      await insertDraw(pool, 'lhc', rec.issue, rec.drawDate, rec.numbers, rec.source);
      inserted++;
      console.log(`  ✅ ${rec.issue} (${rec.drawDate})`);
    } catch (err) {
      console.error(`  ❌ ${rec.issue}: ${err.message}`);
    }
  }

  console.log(`  结果: 新增 ${inserted}, 跳过 ${skipped}`);
  return inserted;
}

// ==================== 主流程 ====================

async function main() {
  const args = process.argv.slice(2);
  const ALLOWED = ['ssq', 'dlt', 'qlc', 'qxc', 'lhc'];

  const targets = args.length > 0
    ? args.filter(a => ALLOWED.includes(a))
    : ALLOWED;

  if (targets.length === 0) {
    console.error(`可用玩法: ${ALLOWED.join(', ')}`);
    process.exit(1);
  }

  console.log('=== 拉取最新示例数据 ===');
  console.log(`时间: ${new Date().toISOString()}`);
  console.log(`玩法: ${targets.join(', ')}\n`);

  const pool = getPool();
  if (!pool) { console.error('数据库未配置'); process.exit(1); }

  let totalInserted = 0;

  for (const code of targets) {
    try {
      if (code === 'lhc') {
        totalInserted += await syncLhc(pool);
      } else {
        totalInserted += await syncZhcw(pool, code);
      }
    } catch (err) {
      console.error(`  ${code} 失败:`, err.message);
    }
  }

  // 有新增数据则更新统计
  if (totalInserted > 0) {
    console.log(`\n  新增 ${totalInserted} 条数据，更新统计...`);
    const { execSync } = require('child_process');
    execSync(`node server/scripts/update-stats.js ${targets.join(' ')}`, {
      cwd: __dirname + '/../..', stdio: 'inherit', env: process.env,
    });
  } else {
    console.log('\n  无新增数据，跳过统计更新');
  }

  await closePool().catch(() => {});
  console.log('\n✅ 完成');
}

main().catch(err => { console.error(err); process.exit(1); });
