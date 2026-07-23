/**
 * 中彩网数据同步脚本
 * 从 https://jc.zhcw.com/port/client_json.php 抓取国内玩法示例数据
 * 支持：双色(ssq)、乐透(dlt)、七乐(qlc)、七星(qxc)、福彩3D(fc3d)、3列(pl3)、5列(pl5)、快8(kl8)
 *
 * 用法: node server/scripts/sync-zhcw.js [玩法id] [期数]
 * 示例: node server/scripts/sync-zhcw.js ssq 100
 *       node server/scripts/sync-zhcw.js all 50
 */

const { query, closePool } = require('../db/client');

// 中彩网玩法ID映射
const ZHCW_LOTTERY_IDS = {
  ssq: '1',    // 双色
  fc3d: '2',   // 福彩3D
  qlc: '3',    // 七乐
  kl8: '6',    // 快8
  dlt: '281',  // 乐透
  qxc: '282',  // 七星
  pl3: '283',  // 3列
  pl5: '284',  // 5列
};

// 号码解析规则
const LOTTERY_RULES = {
  ssq: { frontCount: 6, backCount: 1, frontRange: 33, backRange: 16, name: '双色' },
  fc3d: { frontCount: 3, backCount: 0, frontRange: 9, backRange: 0, name: '福彩3D' },
  qlc: { frontCount: 7, backCount: 0, frontRange: 30, backRange: 0, name: '七乐' },
  kl8: { frontCount: 10, backCount: 0, frontRange: 80, backRange: 0, name: '快8' },
  dlt: { frontCount: 5, backCount: 2, frontRange: 35, backRange: 12, name: '乐透' },
  qxc: { frontCount: 7, backCount: 0, frontRange: 9, backRange: 0, name: '七星' },
  pl3: { frontCount: 3, backCount: 0, frontRange: 9, backRange: 0, name: '3列' },
  pl5: { frontCount: 5, backCount: 0, frontRange: 9, backRange: 0, name: '5列' },
};

const API_URL = 'https://jc.zhcw.com/port/client_json.php';

/**
 * 从API获取示例数据
 */
async function fetchFromZhcw(lotteryId, pageSize = 50) {
  const params = new URLSearchParams({
    transactionType: '10001001',
    lotteryId,
    type: '0',
    pageNum: '1',
    pageSize: String(pageSize),
    issueCount: String(pageSize),
    tt: String(Math.random()),
  });

  const url = `${API_URL}?${params}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      'Referer': 'https://www.zhcw.com/',
      'Accept': '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const text = await response.text();

  // 去掉 JSONP 回调包裹
  const jsonStr = text.replace(/^test\(/, '').replace(/\)$/, '');
  const data = JSON.parse(jsonStr);

  if (data.resCode !== '000000') {
    throw new Error(`API error: ${data.resCode} - ${data.message || 'unknown'}`);
  }

  return data.data || [];
}

/**
 * 解析号码
 */
function parseNumbers(typeId, record) {
  const rule = LOTTERY_RULES[typeId];
  if (!rule) return null;

  const frontWinningNum = record.frontWinningNum || '';
  const backWinningNum = record.backWinningNum || '';

  let frontNumbers, backNumbers;

  if (typeId === 'kl8') {
    // 快8 所有号码都在 frontWinningNum
    frontNumbers = frontWinningNum.split(' ').filter(Boolean).map(n => n.padStart(2, '0'));
    backNumbers = [];
  } else if (typeId === 'fc3d' || typeId === 'pl3' || typeId === 'pl5' || typeId === 'qxc') {
    // 这些玩法所有号码在 frontWinningNum
    frontNumbers = frontWinningNum.split(' ').filter(Boolean).map(n => n.padStart(2, '0'));
    backNumbers = [];
  } else {
    frontNumbers = frontWinningNum.split(' ').filter(Boolean).map(n => n.padStart(2, '0'));
    backNumbers = backWinningNum.split(' ').filter(Boolean).map(n => n.padStart(2, '0'));
  }

  return { frontNumbers, backNumbers };
}

/**
 * 格式化显示
 */
function formatDisplay(typeId, frontNumbers, backNumbers) {
  const rule = LOTTERY_RULES[typeId];
  if (!rule) return '';

  if (rule.backCount > 0) {
    return `前区：${frontNumbers.join(' ')}\n后区：${backNumbers.join(' ')}`;
  }
  return frontNumbers.join(' ');
}

function formatText(typeId, frontNumbers, backNumbers) {
  const rule = LOTTERY_RULES[typeId];
  if (!rule) return frontNumbers.join(',');

  if (rule.backCount > 0) {
    return `前区:${frontNumbers.join(',')} 后区:${backNumbers.join(',')}`;
  }
  return frontNumbers.join(',');
}

/**
 * 保存到数据库
 */
async function saveToDb(typeId, records) {
  const rule = LOTTERY_RULES[typeId];
  let inserted = 0, skipped = 0;

  for (const record of records) {
    const parsed = parseNumbers(typeId, record);
    if (!parsed) continue;

    const { frontNumbers, backNumbers } = parsed;
    const period = record.issue;
    const sampleDate = record.openTime;

    let numbers = { front: frontNumbers, back: backNumbers };
    if (typeId === 'ssq') {
      numbers = { red: frontNumbers, blue: backNumbers };
    } else if (typeId === 'dlt') {
      numbers = { front: frontNumbers, back: backNumbers };
    } else if (typeId === 'qlc' || typeId === 'qxc' || typeId === 'fc3d' || typeId === 'pl3' || typeId === 'pl5') {
      numbers = { numbers: frontNumbers };
    } else if (typeId === 'kl8') {
      numbers = { numbers: frontNumbers };
    }

    try {
      await query(
        `INSERT INTO lottery_draw(lottery_code, issue, draw_date, numbers, data_source)
         VALUES ($1, $2, $3, $4::jsonb, 'zhcw.com')
         ON CONFLICT (lottery_code, issue) DO NOTHING`,
        [typeId, period, sampleDate, JSON.stringify(numbers)]
      );
      inserted++;
    } catch (err) {
      if (err.code === '23505') {
        skipped++;
      } else {
        console.error(`  Error saving ${typeId} ${period}:`, err.message);
      }
    }
  }

  return { inserted, skipped };
}

/**
 * 同步单个玩法
 */
async function syncType(typeId, count = 50) {
  const zhcwId = ZHCW_LOTTERY_IDS[typeId];
  if (!zhcwId) {
    console.error(`Unknown lottery type: ${typeId}`);
    return;
  }

  const rule = LOTTERY_RULES[typeId];
  console.log(`\n=== 同步 ${rule.name} (${typeId}) ===`);

  try {
    const records = await fetchFromZhcw(zhcwId, count);
    console.log(`  从API获取到 ${records.length} 条记录`);

    if (records.length === 0) {
      console.log('  无新数据');
      return;
    }

    // 显示最新一条
    const latest = records[0];
    const parsed = parseNumbers(typeId, latest);
    console.log(`  最新一期: ${latest.issue} (${latest.openTime})`);
    if (parsed) {
      console.log(`  号码: ${formatDisplay(typeId, parsed.frontNumbers, parsed.backNumbers)}`);
    }

    const result = await saveToDb(typeId, records);
    console.log(`  入库: ${result.inserted} 条, 跳过: ${result.skipped} 条`);
  } catch (err) {
    console.error(`  同步失败:`, err.message);
  }
}

/**
 * 同步所有玩法
 */
async function syncAll(count = 30) {
  const types = Object.keys(ZHCW_LOTTERY_IDS);
  for (const typeId of types) {
    await syncType(typeId, count);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const typeArg = args[0] || 'all';
  const count = parseInt(args[1] || '30', 10);

  console.log(`中彩网数据同步工具`);
  console.log(`=================`);
  console.log(`时间: ${new Date().toISOString()}`);

  try {
    if (typeArg === 'all') {
      await syncAll(count);
    } else {
      await syncType(typeArg, count);
    }
  } catch (err) {
    console.error('同步失败:', err.message);
    process.exit(1);
  } finally {
    await closePool().catch(() => {});
  }

  console.log('\n✅ 同步完成');
}

async function syncFromModule(typeId, count = 50) {
  const zhcwId = ZHCW_LOTTERY_IDS[typeId];
  if (!zhcwId) {
    console.error(`Unknown lottery type: ${typeId}`);
    return;
  }

  const rule = LOTTERY_RULES[typeId];
  console.log(`同步 ${rule.name} (${typeId})`);

  try {
    const records = await fetchFromZhcw(zhcwId, count);
    console.log(`  从API获取到 ${records.length} 条记录`);

    if (records.length === 0) {
      console.log('  无新数据');
      return;
    }

    const result = await saveToDb(typeId, records);
    console.log(`  入库: ${result.inserted} 条, 跳过: ${result.skipped} 条`);
  } catch (err) {
    console.error(`  同步失败:`, err.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { sync: syncFromModule, syncType, syncAll };

