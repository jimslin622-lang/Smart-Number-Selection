#!/usr/bin/env node
/**
 * 补漏查询脚本
 * 
 * 功能：
 * 1. 查询数据库，检查是否有缺失的数据
 * 2. 如果缺失，自动触发拉取
 * 3. 支持手动指定拉取期数
 * 
 * 用法：
 *   node check-and-fill.js                        # 检查所有彩种
 *   node check-and-fill.js --code lhc            # 检查指定彩种
 *   node check-and-fill.js --code lhc --count 30 # 检查并拉取更多期
 */

const { query, closePool } = require('../db/client');
const { LOTTERY_SCHEDULE } = require('../config/lottery-schedule');

async function checkMissingDraws(code, daysToCheck = 14) {
  console.log(`\n=== 检查 ${code} ===`);
  
  // 获取最新的期数
  const latest = await query(`
    SELECT issue, draw_date
    FROM lottery_draw
    WHERE lottery_code = $1
    ORDER BY draw_date DESC
    LIMIT 1
  `, [code]);
  
  if (latest.rows.length === 0) {
    console.log(`ℹ️ ${code} 没有数据`);
    return { hasMissing: true, shouldSync: true };
  }
  
  const latestRow = latest.rows[0];
  console.log(`最新期数: ${latestRow.issue}, 日期: ${latestRow.draw_date}`);
  
  // 检查最近 daysToCheck 天的数据完整性
  const recent = await query(`
    SELECT issue, draw_date
    FROM lottery_draw
    WHERE lottery_code = $1
    ORDER BY draw_date DESC
    LIMIT $2
  `, [code, daysToCheck]);
  
  console.log(`有 ${recent.rows.length} 条近期记录`);
  
  if (recent.rows.length < 5) {
    console.log(`⚠️ 近期数据过少，可能有缺失`);
    return { hasMissing: true, shouldSync: true };
  }
  
  return { hasMissing: false, shouldSync: false };
}

async function syncLottery(config, count = 10) {
  const { code, name, provider } = config;
  
  console.log(`\n=== 拉取 ${name} ===`);
  
  try {
    if (provider === 'zhcw') {
      // 中彩网
      const syncZhcw = require('./sync-zhcw');
      await syncZhcw(code, count);
    } else if (provider === 'hkjc') {
      // 香港马会
      const syncHkjc = require('./sync-hkjc-marksix');
      await syncHkjc(count);
    }
    console.log(`✅ ${name} 拉取完成`);
  } catch (err) {
    console.error(`❌ ${name} 拉取失败:`, err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const codeArg = args.find(arg => arg.startsWith('--code='));
  const countArg = args.find(arg => arg.startsWith('--count='));
  const syncCount = countArg ? parseInt(countArg.replace('--count=', ''), 10) : 10;
  
  console.log('补漏查询工具');
  console.log('================');
  console.log(`拉取期数: ${syncCount}\n`);
  
  let lotteriesToCheck;
  
  if (codeArg) {
    const codes = codeArg.replace('--code=', '').split(',');
    lotteriesToCheck = LOTTERY_SCHEDULE.filter(c => codes.includes(c.code));
  } else {
    lotteriesToCheck = LOTTERY_SCHEDULE;
  }
  
  const lotteriesToSync = [];
  
  // 检查各个彩种
  for (const config of lotteriesToCheck) {
    const result = await checkMissingDraws(config.code);
    if (result.shouldSync) {
      lotteriesToSync.push(config);
    }
  }
  
  console.log(`\n================`);
  if (lotteriesToSync.length === 0) {
    console.log('✅ 数据完整，无需拉取');
  } else {
    console.log(`⚠️ 准备拉取 ${lotteriesToSync.length} 个彩种`);
    for (const config of lotteriesToSync) {
      await syncLottery(config, syncCount);
    }
    console.log('\n✅ 补漏完成');
  }
  
  await closePool().catch(() => {});
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ 检查失败:', err);
    process.exit(1);
  });
}

module.exports = { checkMissingDraws, syncLottery };
