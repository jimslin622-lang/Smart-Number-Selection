#!/usr/bin/env node
/**
 * 更新统计数据分析脚本
 *
 * 功能：
 * 1. 更新 number_statistics 表（出现次数、遗漏、冷热分）
 * 2. 更新 trend_statistics 表（走势数据）
 * 3. 清除 fc3d/pl3/pl5/kl8 四个玩法的统计数据（不做走势分析）
 *
 * 用法：
 *   node server/scripts/update-stats.js              # 全量更新
 *   node server/scripts/update-stats.js lhc ssq      # 只更新指定玩法
 *   node server/scripts/update-stats.js --clean      # 只清理 fc3d/pl3/pl5/kl8
 *
 * 建议通过 cron 每日执行：0 3 * * * cd /path && node server/scripts/update-stats.js
 */

const crypto = require('crypto');
const { getPool, closePool } = require('../db/client');

// 不做走势分析的玩法
const EXCLUDED_CODES = ['fc3d', 'pl3', 'pl5', 'kl8'];

// 需要分析的玩法
const ANALYZE_CODES = ['lhc', 'ssq', 'dlt', 'qlc', 'qxc'];

// 各玩法的号码范围配置
const LOTTERY_CONFIG = {
  lhc: { mainRange: [1, 49], specialRange: [1, 49], mainCount: 6, specialCount: 1, bigThreshold: 25 },
  ssq: { mainRange: [1, 33], specialRange: [1, 16], mainCount: 6, specialCount: 1, bigThreshold: 17 },
  dlt: { mainRange: [1, 35], specialRange: [1, 12], mainCount: 5, specialCount: 2, bigThreshold: 18 },
  qlc: { mainRange: [1, 30], specialRange: [1, 30], mainCount: 7, specialCount: 1, bigThreshold: 16 },
  qxc: { mainRange: [0, 9], specialRange: [0, 9], mainCount: 6, specialCount: 1, bigThreshold: 5 },
};

function toNum(v) { return v != null ? Number(v) : null; }
function extractNumbers(raw, cfg) {
  const n = raw || {};
  let main = [], special = [];
  if (n.normal) { main = n.normal.map(toNum); special = n.special != null ? [toNum(n.special)] : []; }
  else if (n.red) { main = n.red.map(toNum); special = (n.blue || []).map(toNum); }
  else if (n.front) { main = n.front.map(toNum); special = (n.back || []).map(toNum); }
  else if (n.numbers) { main = n.numbers.map(toNum); special = (n.special || []).map(toNum); }
  return { main: main.filter(v => v != null), special: special.filter(v => v != null) };
}

async function updateNumberStats(pool, code) {
  const cfg = LOTTERY_CONFIG[code];
  if (!cfg) return;

  console.log(`  [${code}] 更新 number_statistics...`);

  // 获取所有示例记录（从旧到新）
  const draws = await pool.query(`
    SELECT d.id, d.issue, d.numbers
    FROM lottery_draw d
    WHERE d.lottery_code = $1
    ORDER BY d.draw_date ASC, d.id ASC
  `, [code]);

  if (draws.rows.length === 0) return;

  // 分别统计主号码和副号码（避免号码范围重叠导致统计混淆）
  const mainFreq = {}; const mainLast = {};
  const specialFreq = {}; const specialLast = {};
  const allIssues = [];

  for (let i = 0; i < draws.rows.length; i++) {
    const row = draws.rows[i];
    const { main, special } = extractNumbers(row.numbers, cfg);
    allIssues.push(row.issue);

    main.forEach(n => {
      mainFreq[n] = (mainFreq[n] || 0) + 1;
      mainLast[n] = i;
    });
    special.forEach(n => {
      specialFreq[n] = (specialFreq[n] || 0) + 1;
      specialLast[n] = i;
    });
  }

  const totalDraws = draws.rows.length;

  // 清理旧数据
  await pool.query('DELETE FROM number_statistics WHERE lottery_code = $1', [code]);

  let inserted = 0;

  // 主号码
  for (let num = cfg.mainRange[0]; num <= cfg.mainRange[1]; num++) {
    const appearCount = mainFreq[num] || 0;
    const currentMiss = mainLast[num] !== undefined ? (totalDraws - 1 - mainLast[num]) : totalDraws;
    const probability = totalDraws > 0 ? appearCount / totalDraws : 0;
    const avgMiss = appearCount > 0 ? (totalDraws - appearCount) / appearCount : totalDraws;
    const hotScore = totalDraws > 0 ? Math.round((appearCount / totalDraws) * 1000) / 10 : 0;
    const coldScore = totalDraws > 0 ? Math.round(((totalDraws - appearCount) / totalDraws) * 1000) / 10 : 0;

    await pool.query(`
      INSERT INTO number_statistics
        (id, lottery_code, number_value, appear_count, current_miss, max_miss, avg_miss,
         consecutive_count, hot_score, cold_score, probability, last_issue)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      crypto.randomBytes(6).toString('hex'),
      code, num, appearCount, currentMiss, currentMiss, Math.round(avgMiss * 100) / 100,
      0, hotScore, coldScore, Math.round(probability * 1000000) / 1000000,
      allIssues[totalDraws - 1] || '',
    ]);
    inserted++;
  }

  // 副号码（蓝球/后区/特别号）用偏移量 100 避免主号码范围重叠
  // 副号码：如果范围不同（如双色蓝球）或范围相同但玩法有特别号（如七乐），都写入
  // 七乐特别号用偏移量 200，其他用 100
  const needSpecial = cfg.specialRange && (
    cfg.specialRange[0] !== cfg.mainRange[0] ||
    cfg.specialRange[1] !== cfg.mainRange[1] ||
    code === 'qlc' || code === 'lhc'
  );
  if (needSpecial) {
    for (let num = cfg.specialRange[0]; num <= cfg.specialRange[1]; num++) {
      const appearCount = specialFreq[num] || 0;
      const currentMiss = specialLast[num] !== undefined ? (totalDraws - 1 - specialLast[num]) : totalDraws;
      const probability = totalDraws > 0 ? appearCount / totalDraws : 0;
      const avgMiss = appearCount > 0 ? (totalDraws - appearCount) / appearCount : totalDraws;
      const hotScore = totalDraws > 0 ? Math.round((appearCount / totalDraws) * 1000) / 10 : 0;
      const coldScore = totalDraws > 0 ? Math.round(((totalDraws - appearCount) / totalDraws) * 1000) / 10 : 0;

      const offset = (code === 'qlc' || code === 'lhc') ? 200 : 100;
      const storedValue = num + offset;

      await pool.query(`
        INSERT INTO number_statistics
          (id, lottery_code, number_value, appear_count, current_miss, max_miss, avg_miss,
           consecutive_count, hot_score, cold_score, probability, last_issue)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        crypto.randomBytes(6).toString('hex'),
        code, storedValue, appearCount, currentMiss, currentMiss, Math.round(avgMiss * 100) / 100,
        0, hotScore, coldScore, Math.round(probability * 1000000) / 1000000,
        allIssues[totalDraws - 1] || '',
      ]);
      inserted++;
    }
  }

  console.log(`  [${code}]  更新 ${inserted} 个号码统计`);
}

async function updateTrendStats(pool, code) {
  const cfg = LOTTERY_CONFIG[code];
  if (!cfg) return;

  console.log(`  [${code}] 更新 trend_statistics...`);

  // 清理旧走势数据
  await pool.query('DELETE FROM trend_statistics WHERE lottery_code = $1', [code]);

  // 获取所有示例记录（从旧到新）
  const draws = await pool.query(`
    SELECT d.id, d.issue, d.numbers
    FROM lottery_draw d
    WHERE d.lottery_code = $1
    ORDER BY d.draw_date ASC, d.id ASC
  `, [code]);

  if (draws.rows.length === 0) return;

  const missMap = {};
  for (let num = cfg.mainRange[0]; num <= cfg.mainRange[1]; num++) {
    missMap[num] = 0;
  }

  let inserted = 0;
  for (const row of draws.rows) {
    const { main, special } = extractNumbers(row.numbers, cfg);
    const hitSet = new Set(main);

    // 每个号码的遗漏值
    const missValues = {};
    for (let num = cfg.mainRange[0]; num <= cfg.mainRange[1]; num++) {
      missValues[num] = missMap[num];
      missMap[num] = hitSet.has(num) ? 0 : missMap[num] + 1;
    }

    await pool.query(`
      INSERT INTO trend_statistics (id, draw_id, lottery_code, issue, trend_type, trend_value, trend_json)
      VALUES ($1, $2, $3, $4, 'miss', $5, $6::jsonb)
    `, [
      crypto.randomBytes(6).toString('hex'),
      row.id, code, row.issue,
      Object.values(missValues).join(','),
      JSON.stringify(missValues),
    ]);
    inserted++;
  }

  console.log(`  [${code}]  更新 ${inserted} 条走势记录`);
}

async function cleanExcluded(pool) {
  console.log('\n清理排除玩法的分析数据...');
  for (const code of EXCLUDED_CODES) {
    const r2 = await pool.query('DELETE FROM number_statistics WHERE lottery_code = $1', [code]);
    const r3 = await pool.query('DELETE FROM trend_statistics WHERE lottery_code = $1', [code]);
    console.log(`  [${code}] 清理完成: stats=${r2.rowCount}, trend=${r3.rowCount}`);
  }
}

async function main() {
  const pool = getPool();
  const args = process.argv.slice(2);

  if (args.includes('--clean')) {
    await cleanExcluded(pool);
    await closePool();
    return;
  }

  // 确定要更新的玩法
  let codes = args.filter(a => !a.startsWith('--'));
  if (codes.length === 0) {
    codes = ANALYZE_CODES;
  }

  // 先清理排除玩法
  await cleanExcluded(pool);

  // 更新分析数据
  console.log('\n开始更新分析数据...');
  for (const code of codes) {
    console.log(`\n=== ${code} ===`);
    await updateNumberStats(pool, code);
    await updateTrendStats(pool, code);
  }

  console.log('\n✅ 全部更新完成');
  await closePool();
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ 更新失败:', err.message);
    process.exit(1);
  });
}

module.exports = main;
