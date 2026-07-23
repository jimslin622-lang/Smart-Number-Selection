#!/usr/bin/env node
/**
 * 智能调度脚本 - 双保险策略
 * 
 * 功能：
 * 1. 开奖时间立即拉取一次
 * 2. 开奖后延迟30分钟再拉取一次（补漏）
 * 3. 数据库防重入，保证同期不重复写入
 * 
 * 用法：
 *   node scheduler.js                    # 自动判断，拉取应该拉取的
 *   node scheduler.js --immediate        # 拉取开奖时间到达的彩种（立即拉取）
 *   node scheduler.js --delayed          # 拉取开奖后延迟30分钟的彩种（补漏）
 *   node scheduler.js --code lhc,ssq    # 拉取指定彩种
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
  return day === 0 ? 7 : day;
}

function getCurrentTime() {
  const now = nowInTimezone();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function shouldSyncImmediate(config, nowHHMM) {
  // 立即拉取模式：开奖时间到达后30分钟内
  const today = getDayOfWeek();
  if (!config.days.includes(today)) return false;

  const [hh, mm] = config.time.split(':').map(Number);
  const [nowHH, nowMM] = nowHHMM.split(':').map(Number);
  
  const configTotal = hh * 60 + mm;
  const nowTotal = nowHH * 60 + nowMM;
  
  const windowStart = configTotal;
  const windowEnd = configTotal + 30; // 开奖后30分钟内
  
  return nowTotal >= windowStart && nowTotal <= windowEnd;
}

function shouldSyncDelayed(config, nowHHMM) {
  // 延迟拉取模式：开奖后30分钟到2小时
  const today = getDayOfWeek();
  if (!config.days.includes(today)) return false;

  const [hh, mm] = config.time.split(':').map(Number);
  const [nowHH, nowMM] = nowHHMM.split(':').map(Number);
  
  const configTotal = hh * 60 + mm;
  const nowTotal = nowHH * 60 + nowMM;
  const delayTotal = config.delayMinutes;
  
  const windowStart = configTotal + delayTotal;
  const windowEnd = windowStart + 120;
  
  return nowTotal >= windowStart && nowTotal <= windowEnd;
}

function shouldSyncDefault(config, nowHHMM) {
  // 默认模式：两者都拉取
  return shouldSyncImmediate(config, nowHHMM) || shouldSyncDelayed(config, nowHHMM);
}

function getLotteriesToSync(mode, nowHHMM) {
  if (mode === 'immediate') {
    return LOTTERY_SCHEDULE.filter(config => shouldSyncImmediate(config, nowHHMM));
  } else if (mode === 'delayed') {
    return LOTTERY_SCHEDULE.filter(config => shouldSyncDelayed(config, nowHHMM));
  } else {
    return LOTTERY_SCHEDULE.filter(config => shouldSyncDefault(config, nowHHMM));
  }
}

async function syncLottery(config, modeLabel = '') {
  const { code, name, provider, syncCount } = config;
  
  const label = modeLabel ? `(${modeLabel}) ` : '';
  
  console.log(`\n=== 同步 ${name} (${code}) ${label}===`);
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
  const isImmediate = args.includes('--immediate');
  const isDelayed = args.includes('--delayed');
  const codeArg = args.find(arg => arg.startsWith('--code='));
  
  const nowHHMM = getCurrentTime();
  console.log('智能调度工具');
  console.log('================');
  console.log(`当前时间: ${nowHHMM}`);
  console.log(`星期: ${getDayOfWeek()}\n`);
  
  let lotteriesToSync;
  let modeLabel = '';
  
  if (codeArg) {
    const codes = codeArg.replace('--code=', '').split(',');
    lotteriesToSync = LOTTERY_SCHEDULE.filter(c => codes.includes(c.code));
    modeLabel = '指定';
  } else if (isImmediate) {
    lotteriesToSync = getLotteriesToSync('immediate', nowHHMM);
    modeLabel = '立即拉取';
  } else if (isDelayed) {
    lotteriesToSync = getLotteriesToSync('delayed', nowHHMM);
    modeLabel = '延迟拉取';
  } else {
    lotteriesToSync = getLotteriesToSync('default', nowHHMM);
    modeLabel = '自动';
  }
  
  if (lotteriesToSync.length === 0) {
    console.log(`当前时间没有需要同步的彩种 (${modeLabel})`);
    return;
  }
  
  console.log(`准备同步 ${lotteriesToSync.length} 个彩种 (${modeLabel})`);
  
  for (const config of lotteriesToSync) {
    await syncLottery(config, modeLabel);
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
