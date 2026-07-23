/**
 * 中彩网全量历史数据导入（增强版）
 * - 写入 lottery_draw 新表
 * - 保留完整字段：号码、奖金、销售额、奖池、星期
 * - 分页循环拉取全部历史
 * 用法: node server/scripts/import-zhcw-all.js
 */
const { getPool, closePool } = require('../db/client');

const API_URL = 'https://jc.zhcw.com/port/client_json.php';
const PAGE_SIZE = 2000;
const DELAY_MS = 800;

const LOTTERIES = [
  // 国内玩法
  { id: 'ssq',  name: '双色', lotteryId: 1,  kind: 'ssq' },
  { id: 'fc3d', name: '福彩3D', lotteryId: 2,  kind: 'digits' },
  { id: 'qlc',  name: '七乐', lotteryId: 3,  kind: 'numbers-special' },
  { id: 'kl8',  name: '快8',  lotteryId: 6,  kind: 'numbers20' },
  { id: 'dlt',  name: '乐透', lotteryId: 281, kind: 'front-back' },
  { id: 'qxc',  name: '七星-新版', lotteryId: 287, kind: 'qxc-new' },
  { id: 'qxc',  name: '七星-旧版', lotteryId: 282, kind: 'qxc-old' },
  { id: 'pl3',  name: '3列', lotteryId: 283, kind: 'digits' },
  { id: 'pl5',  name: '5列', lotteryId: 284, kind: 'digits' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildNumbers(cfg, item) {
  const front = (item.frontWinningNum || '').split(/\s+/).filter(Boolean).map(n => String(Number(n)).padStart(2, '0'));
  const back = (item.backWinningNum || '').split(/\s+/).filter(Boolean).map(n => String(Number(n)).padStart(2, '0'));

  let numbers;

  if (cfg.kind === 'ssq') {
    numbers = { red: front, blue: back };
  } else if (cfg.kind === 'front-back') {
    numbers = { front, back };
  } else if (cfg.kind === 'numbers-special') {
    numbers = { numbers: front, special: back };
  } else if (cfg.kind === 'numbers20') {
    numbers = { numbers: front };
  } else if (cfg.kind === 'digits') {
    numbers = { numbers: front };
  } else if (cfg.kind === 'qxc-new') {
    numbers = { front, back, qxcVersion: 'new' };
  } else {
    numbers = { numbers: front.concat(back), qxcVersion: 'old' };
  }

  // 补充奖金信息（API 自带的字段）
  if (item.saleMoney) numbers.saleMoney = item.saleMoney;
  if (item.prizePoolMoney) numbers.prizePoolMoney = item.prizePoolMoney;
  if (item.week) numbers.week = item.week;
  if (item.winnerDetails && item.winnerDetails.length) numbers.winnerDetails = item.winnerDetails;
  if (item.lotteryId) numbers.lotteryId = item.lotteryId;

  return numbers;
}

async function fetchPage(cfg, pageNum) {
  const url = new URL(API_URL);
  url.searchParams.set('transactionType', '10001001');
  url.searchParams.set('lotteryId', String(cfg.lotteryId));
  url.searchParams.set('issueCount', '100000');
  url.searchParams.set('type', '0');
  url.searchParams.set('pageNum', String(pageNum));
  url.searchParams.set('pageSize', String(PAGE_SIZE));
  url.searchParams.set('tt', String(Math.random()));

  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Referer': 'https://www.zhcw.com/',
          'User-Agent': 'Mozilla/5.0 random-number-helper full-import',
          'Accept': '*/*',
        },
      });
      const text = await res.text();
      // 支持两种回调格式: test(...) 和 callback(...)
      const json = JSON.parse(text.replace(/^(test|callback)\(/, '').replace(/\);?$/, ''));
      if (json.resCode && json.resCode !== '000000') throw new Error(`API error: ${json.resCode}`);
      if (!Array.isArray(json.data)) throw new Error('No data array');
      return json.data;
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(DELAY_MS * attempt);
    }
  }
  return [];
}

async function importLottery(pool, cfg) {
  console.log(`\n=== ${cfg.name} (${cfg.id}) lotteryId=${cfg.lotteryId} ===`);
  let page = 1;
  let total = 0;
  let emptyPages = 0;
  const seenIssues = new Set();

  while (page <= 500) {
    const rows = await fetchPage(cfg, page);
    console.log(`  第${page}页: ${rows.length}条`);
    if (!rows.length) {
      emptyPages++;
      if (emptyPages >= 3) break;
      page++;
      await sleep(DELAY_MS);
      continue;
    }
    emptyPages = 0;

    let pageInserted = 0;
    for (const item of rows) {
      if (!item.issue || !item.openTime || !item.frontWinningNum) continue;
      const key = `${cfg.lotteryId}:${item.issue}`;
      if (seenIssues.has(key)) continue;
      seenIssues.add(key);

      const numbers = buildNumbers(cfg, item);
      try {
        await pool.query(
          `INSERT INTO lottery_draw(lottery_code, issue, draw_date, numbers, data_source)
           VALUES($1, $2, $3::date, $4::jsonb, 'zhcw.com')
           ON CONFLICT(lottery_code, issue) DO NOTHING`,
          [cfg.id, `${item.issue}`, item.openTime, JSON.stringify(numbers)]
        );
        pageInserted++;
      } catch (e) {
        if (e.code !== '23505') console.error(`  Error: ${item.issue}`, e.message);
      }
    }
    total += pageInserted;

    if (rows.length < PAGE_SIZE) break;
    page++;
    await sleep(DELAY_MS);
  }

  const r = await pool.query(
    'SELECT count(*)::int AS total, min(draw_date)::text AS earliest, max(draw_date)::text AS latest FROM lottery_draw WHERE lottery_code=$1',
    [cfg.id]
  );
  console.log(`  ${cfg.name} 完成: 共${r.rows[0].total}条, ${r.rows[0].earliest} ~ ${r.rows[0].latest}`);
  return r.rows[0];
}

async function main() {
  const pool = getPool();
  if (!pool) throw new Error('Database config missing');

  // 清空国内玩法数据重新导入
  await pool.query("DELETE FROM lottery_draw WHERE lottery_code IN ('ssq','dlt','qlc','qxc','fc3d','pl3','pl5','kl8')");

  // 导入所有玩法（七星只导新版287，旧版282单独补充）
  for (const cfg of LOTTERIES) {
    if (cfg.id === 'qxc' && cfg.lotteryId === 282) continue;
    await importLottery(pool, cfg);
    await sleep(DELAY_MS);
  }

  // 七星补充旧版282数据
  console.log(`\n=== 七星-旧版补充 (lotteryId=282) ===`);
  const qxcOld = LOTTERIES.find(c => c.id === 'qxc' && c.lotteryId === 282);
  if (qxcOld) {
    let page = 1;
    let total = 0;
    const seen = new Set();
    while (page <= 500) {
      const rows = await fetchPage(qxcOld, page);
      if (!rows.length) break;
      let ins = 0;
      for (const item of rows) {
        if (!item.issue || !item.openTime || !item.frontWinningNum) continue;
        const key = `282:${item.issue}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const numbers = { numbers: (item.frontWinningNum || '').split(/\s+/).filter(Boolean).map(n => String(Number(n)).padStart(2,'0')), qxcVersion: 'old' };
        if (item.week) numbers.week = item.week;
        try {
          await pool.query(
            `INSERT INTO lottery_draw(lottery_code, issue, draw_date, numbers, data_source)
             VALUES($1, $2, $3::date, $4::jsonb, 'zhcw.com')
             ON CONFLICT(lottery_code, issue) DO NOTHING`,
            ['qxc', `${item.issue}`, item.openTime, JSON.stringify(numbers)]
          );
          ins++;
        } catch (e) { if (e.code !== '23505') console.error(e.message); }
      }
      total += ins;
      if (rows.length < 2000) break;
      page++;
      await sleep(DELAY_MS);
    }
    console.log(`  七星旧版补充: ${total}条`);
  }

  // 最终统计
  const summary = await pool.query(
    `SELECT lottery_code, count(*)::int AS total, min(draw_date)::text AS earliest, max(draw_date)::text AS latest
     FROM lottery_draw WHERE lottery_code IN ('ssq','dlt','qlc','qxc','fc3d','pl3','pl5','kl8')
     GROUP BY lottery_code ORDER BY lottery_code`
  );
  console.log('\n=== 最终统计 ===');
  summary.rows.forEach(r => console.log(`  ${r.lottery_code}: ${r.total}条 (${r.earliest} ~ ${r.latest})`));

  // 验证一条数据的完整字段
  const sample = await pool.query(
    `SELECT lottery_code, issue, jsonb_object_keys(numbers) AS keys FROM lottery_draw WHERE lottery_code='ssq' LIMIT 1`
  );
  console.log('\n=== 字段示例 ===');
  sample.rows.forEach(r => console.log(`  ${r.lottery_code} ${r.issue}: ${r.keys}`));

  await closePool();
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => {});