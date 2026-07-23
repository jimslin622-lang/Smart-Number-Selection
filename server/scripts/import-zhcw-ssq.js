const { getPool, closePool } = require('../db/client');

const SOURCE = 'zhcw.com';
const TYPE_ID = 'ssq';
const COUNT = Math.min(Math.max(Number(process.argv[2] || 3000), 1), 5000);
const API_URL = 'https://jc.zhcw.com/port/client_json.php';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeNums(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).map(n => String(Number(n)).padStart(2, '0'));
}

function buildRecord(item) {
  const red = normalizeNums(item.frontWinningNum).sort((a, b) => Number(a) - Number(b));
  const blue = normalizeNums(item.backWinningNum);
  const raw = {
    red,
    blue,
    sourceIssue: item.issue,
    saleMoney: item.saleMoney || null,
    prizePoolMoney: item.prizePoolMoney || null,
    winnerDetails: item.winnerDetails || [],
  };
  return {
    templateId: TYPE_ID,
    period: `SSQ-${item.issue}`,
    sampleDate: item.openTime,
    raw,
    display: `主区：${red.join(' ')}\n副区：${blue.join(' ')}`,
    formatted: `主区:${red.join(',')} 副区:${blue.join(',')}`,
  };
}

async function fetchZhcwPage(pageNum, pageSize, retries = 3) {
  const url = new URL(API_URL);
  url.searchParams.set('transactionType', '10001001');
  url.searchParams.set('lotteryId', '1');
  url.searchParams.set('issueCount', String(COUNT));
  url.searchParams.set('startIssue', '');
  url.searchParams.set('endIssue', '');
  url.searchParams.set('startDate', '');
  url.searchParams.set('endDate', '');
  url.searchParams.set('type', '0');
  url.searchParams.set('pageNum', String(pageNum));
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('tt', String(Math.random()));

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
      await sleep(1000 * attempt);
    }
  }
}

async function fetchZhcw() {
  const pageSize = Math.min(100, COUNT);
  const pages = Math.ceil(COUNT / pageSize);
  const all = [];
  for (let page = 1; page <= pages; page++) {
    const rows = await fetchZhcwPage(page, pageSize);
    all.push(...rows);
    console.log(`Fetched page ${page}/${pages}: ${rows.length} rows`);
    if (rows.length < pageSize) break;
    await sleep(1000);
  }
  return all.slice(0, COUNT);
}

async function main() {
  const pool = getPool();
  if (!pool) throw new Error('Database config missing. Run inside docker compose api or set DB_* env vars.');

  console.log(`Fetching ${COUNT} SSQ records from zhcw.com ...`);
  await sleep(500);
  const rows = await fetchZhcw();
  console.log(`Fetched ${rows.length} records.`);

  let imported = 0;
  let skipped = 0;
  for (const item of rows) {
    if (!item.issue || !item.openTime || !item.frontWinningNum || !item.backWinningNum) {
      skipped++;
      continue;
    }
    const rec = buildRecord(item);
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

  const summary = await pool.query(`
    SELECT source, count(*)::int AS count, min(sample_date) AS min_date, max(sample_date) AS max_date
    FROM history_numbers
    WHERE template_id = $1
    GROUP BY source
    ORDER BY source
  `, [TYPE_ID]);

  console.log(JSON.stringify({ imported, skipped, summary: summary.rows }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(closePool);
