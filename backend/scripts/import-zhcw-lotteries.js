const { getPool, closePool } = require('../db/client');

const SOURCE = 'zhcw.com';
const API_URL = 'https://jc.zhcw.com/port/client_json.php';
const COUNT = Math.min(Math.max(Number(process.argv[2] || 5000), 1), 5000);

const LOTTERIES_ALL = [
  { id: 'fc3d', name: '福彩3D', lotteryId: 2, periodPrefix: 'FC3D', kind: 'digits' },
  { id: 'qlc', name: '七乐', lotteryId: 3, periodPrefix: 'QLC', kind: 'numbers-special' },
  { id: 'kl8', name: '快8', lotteryId: 6, periodPrefix: 'KL8', kind: 'numbers20' },
  { id: 'dlt', name: '乐透', lotteryId: 281, periodPrefix: 'DLT', kind: 'front-back' },
  { id: 'qxc', name: '七星', lotteryId: 287, periodPrefix: 'QXC', kind: 'qxc-new' },
  { id: 'pl3', name: '3列', lotteryId: 283, periodPrefix: 'PL3', kind: 'digits' },
  { id: 'pl5', name: '5列', lotteryId: 284, periodPrefix: 'PL5', kind: 'digits' },
];

const ONLY = (process.argv[3] || '').split(',').map(s => s.trim()).filter(Boolean);
const LOTTERIES = ONLY.length ? LOTTERIES_ALL.filter(item => ONLY.includes(item.id)) : LOTTERIES_ALL;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function nums(s, pad = 2) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter(n => n !== '-1')
    .map(n => pad === 2 ? String(Number(n)).padStart(2, '0') : String(Number(n)));
}

function buildRecord(cfg, item) {
  const front2 = nums(item.frontWinningNum, 2);
  const back2 = nums(item.backWinningNum, 2);
  const frontDigit = nums(item.frontWinningNum, 1);
  const backDigit = nums(item.backWinningNum, 1);
  let raw;
  let display;
  let formatted;

  if (cfg.kind === 'front-back') {
    raw = { front: front2, back: back2 };
    display = `前区：${front2.join(' ')}\n后区：${back2.join(' ')}`;
    formatted = `前区:${front2.join(',')} 后区:${back2.join(',')}`;
  } else if (cfg.kind === 'numbers-special') {
    raw = { numbers: front2, special: back2 };
    display = back2.length ? `基本号：${front2.join(' ')}\n特别号：${back2.join(' ')}` : `号码：${front2.join(' ')}`;
    formatted = back2.length ? `基本号:${front2.join(',')} 特别号:${back2.join(',')}` : `号码:${front2.join(',')}`;
  } else if (cfg.kind === 'numbers20') {
    raw = { numbers: front2 };
    display = `号码：${front2.join(' ')}`;
    formatted = `号码:${front2.join(',')}`;
  } else if (cfg.kind === 'qxc-new') {
    const digits = frontDigit.concat(backDigit);
    raw = { digits, front: frontDigit, back: backDigit };
    display = backDigit.length ? `前区：${frontDigit.join(' ')}\n后区：${backDigit.join(' ')}` : `号码：${digits.join(' ')}`;
    formatted = backDigit.length ? `前区:${frontDigit.join(',')} 后区:${backDigit.join(',')}` : `号码:${digits.join(',')}`;
  } else {
    raw = { digits: frontDigit };
    display = `号码：${frontDigit.join(' ')}`;
    formatted = `号码:${frontDigit.join(',')}`;
  }

  raw.sourceIssue = item.issue;
  raw.saleMoney = item.saleMoney || null;
  raw.prizePoolMoney = item.prizePoolMoney || null;
  raw.winnerDetails = item.winnerDetails || [];
  raw.week = item.week || null;

  return {
    templateId: cfg.id,
    period: `${cfg.periodPrefix}-${item.issue}`,
    sampleDate: item.openTime,
    raw,
    display,
    formatted,
  };
}

async function fetchPage(cfg, pageNum, pageSize, retries = 3) {
  const url = new URL(API_URL);
  Object.entries({
    transactionType: '10001001',
    lotteryId: cfg.lotteryId,
    issueCount: COUNT,
    startIssue: '',
    endIssue: '',
    startDate: '',
    endDate: '',
    type: 0,
    pageNum,
    pageSize,
    tt: Math.random(),
  }).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          referer: 'https://www.zhcw.com/kjxx/ssq/',
          'user-agent': 'Mozilla/5.0 random-number-helper local import',
          accept: 'application/json,text/plain,*/*',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text.replace(/^callback\(/, '').replace(/\);?$/, ''));
      if (json.resCode && json.resCode !== '000000') throw new Error(`ZHCW API error: ${json.resCode}`);
      if (!Array.isArray(json.data)) throw new Error('ZHCW response missing data[]');
      return json.data;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`${cfg.name} page ${pageNum} attempt ${attempt} failed: ${err.message}`);
      await sleep(1000 * attempt);
    }
  }
}

async function importOne(pool, cfg) {
  const pageSize = Math.min(100, COUNT);
  const pages = Math.ceil(COUNT / pageSize);
  let imported = 0;
  let skipped = 0;

  console.log(`\n== ${cfg.name} (${cfg.id}) lotteryId=${cfg.lotteryId} ==`);
  for (let page = 1; page <= pages; page++) {
    let rows;
    try {
      rows = await fetchPage(cfg, page, pageSize);
    } catch (err) {
      console.warn(`${cfg.name} page ${page}/${pages} skipped after retries: ${err.message}`);
      continue;
    }
    console.log(`${cfg.name} page ${page}/${pages}: ${rows.length} rows`);
    for (const item of rows) {
      if (!item.issue || !item.openTime || !item.frontWinningNum) {
        skipped++;
        continue;
      }
      const rec = buildRecord(cfg, item);
      await pool.query(`
        INSERT INTO history_numbers(template_id, period, sample_date, raw_numbers, display_text, formatted_text, source)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)
        ON CONFLICT(template_id, period) DO UPDATE SET
          sample_date = EXCLUDED.sample_date,
          raw_numbers = EXCLUDED.raw_numbers,
          display_text = EXCLUDED.display_text,
          formatted_text = EXCLUDED.formatted_text,
          source = EXCLUDED.source
      `, [rec.templateId, rec.period, rec.sampleDate, JSON.stringify(rec.raw), rec.display, rec.formatted, SOURCE]);
      imported++;
    }
    if (rows.length < pageSize) break;
    await sleep(1000);
  }

  await pool.query('DELETE FROM history_numbers WHERE template_id = $1 AND source = $2', [cfg.id, 'local-seed']);
  return { id: cfg.id, name: cfg.name, imported, skipped };
}

async function main() {
  const pool = getPool();
  if (!pool) throw new Error('Database config missing. Run inside docker compose api or set DB_* env vars.');

  const results = [];
  for (const cfg of LOTTERIES) {
    results.push(await importOne(pool, cfg));
    await sleep(1500);
  }

  const summary = await pool.query(`
    SELECT template_id, source, count(*)::int AS count, min(sample_date) AS min_date, max(sample_date) AS max_date
    FROM history_numbers
    GROUP BY template_id, source
    ORDER BY template_id, source
  `);

  console.log(JSON.stringify({ results, summary: summary.rows }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(closePool);
