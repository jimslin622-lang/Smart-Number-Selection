#!/usr/bin/env node
/**
 * 智能调度脚本
 * 
 * 功能：
 * 1. 根据配置的开奖时间，只拉取当天开奖的彩种
 * 2. 只拉取最新的数据，不是全部
 * 3. 支持单彩种拉取，也支持所有应该拉取的彩种
 * 
 * 用法：
 *   node scheduler.js                          # 拉取现在应该开奖的彩种
 *   node scheduler.js --all                    # 拉取所有应该开奖的彩种
 *   node scheduler.js --code lhc,ssq          # 拉取指定彩种
 *   node scheduler.js --help                   # 帮助
 */

const { LOTTERY_SCHEDULE } = require('../config/lottery-schedule');

function nowInTimezone() {
  // 返回当前时间（中国时区）
  const now = new Date();
  const chinaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  return chinaTime;
}

function getDayOfWeek() {
  const day = nowInTimezone().getDay();
  // 周日是0，转换为7
  return day === 0 ? 7 : day;
}

function getCurrentTime() {
  const now = nowInTimezone();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function shouldSync(config, nowHHMM) {
  const today = getDayOfWeek();
  if (!config.days.includes(today)) return false;

  const [hh, mm] = config.time.split(':').map(Number);
  const [nowHH, nowMM] = nowHHMM.split(':').map(Number);
  
  const configTotal = hh * 60 + mm;
  const nowTotal = nowHH * 60 + nowMM;
  const delayTotal = config.delayMinutes;
  
  const windowStart = configTotal + delayTotal;
  const windowEnd = windowStart + 120; // 开奖后2小时内拉取
  
  return nowTotal >= windowStart && nowTotal <= windowEnd;
}

function getLotteriesToSync(nowHHMM) {
  return LOTTERY_SCHEDULE.filter(config => shouldSync(config, nowHHMM));
}

async function syncLottery(config) {
  const { code, name, provider, syncCount } = config;
  
  console.log(`\n=== 同步 ${name} (${code}) ===`);
  console.log(`数据源: ${provider === 'zhcw' ? '中彩网' : '香港马会'}`);
  console.log(`拉取期数: ${syncCount}`);
  
  try {
    if (provider === 'zhcw') {
      // 中彩网
      const syncZhcw = require('./sync-zhcw');
      await syncZhcw(code, syncCount);
    } else if (provider === 'hkjc') {
      // 香港马会
      const syncHkjc = require('./sync-hkjc-marksix');
      await syncHkjc(syncCount);
    }
    console.log(`✅ ${name} 同步完成`);
  } catch (err) {
    console.error(`❌ ${name} 同步失败:`, err.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isAll = args.includes('--all');
  const codeArg = args.find(arg => arg.startsWith('--code='));
  
  const nowHHMM = getCurrentTime();
  console.log('智能调度工具');
  console.log('================');
  console.log(`当前时间: ${nowHHMM}`);
  console.log(`星期: ${getDayOfWeek()}\n`);
  
  let lotteriesToSync;
  
  if (codeArg) {
    const codes = codeArg.replace('--code=', '').split(',');
    lotteriesToSync = LOTTERY_SCHEDULE.filter(c => codes.includes(c.code));
  } else if (isAll) {
    lotteriesToSync = LOTTERY_SCHEDULE;
  } else {
    lotteriesToSync = getLotteriesToSync(nowHHMM);
  }
  
  if (lotteriesToSync.length === 0) {
    console.log('当前时间没有需要同步的彩种');
    return;
  }
  
  console.log(`准备同步 ${lotteriesToSync.length} 个彩种`);
  
  for (const config of lotteriesToSync) {
    await syncLottery(config);
  }
  
  console.log('\n================');
  console.log('✅ 调度完成');
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ 调度失败:', err);
    process.exit(1);
  });
}

module.exports = { syncLottery, getLotteriesToSync, getDayOfWeek, getCurrentTime };
