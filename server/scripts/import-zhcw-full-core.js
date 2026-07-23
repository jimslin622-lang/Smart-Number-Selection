const { getPool, closePool } = require('../db/client');

const SOURCE = 'zhcw.com';
const API_URL = 'https://jc.zhcw.com/port/client_json.php';
const PAGE_SIZE = Math.min(Math.max(Number(process.argv[2] || 100), 20), 100);
const DELAY_MS = Math.max(Number(process.argv[3] || 1200), 500);

const TASKS = [
  { id: 'ssq', name: '双色', lotteryId: 1, periodPrefix: 'SSQ', kind: 'ssq' },
  { id: 'dlt', name: '乐透', lotteryId: 281, periodPrefix: 'DLT', kind: 'front-back' },
  { id: 'qlc', name: '七乐', lotteryId: 3, periodPrefix: 'QLC', kind: 'numbers-special' },
  // 七星票 2020-10 左右有新旧接口，两个都导入到 qxc。
  { id: 'qxc', name: '七星-新版', lotteryId: 287, periodPrefix: 'QXC', kind: 'qxc-new' },
  { id: 'qxc', name: '七星-旧版', lotteryId: 282, periodPrefix: 'QXC', kind: 'qxc-old' },
];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
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
  let raw, display, formatted;

  if (cfg.kind === 'ssq') {
    raw = { red: front2, blue: back2 };
    display = `红球：${front2.join(' ')}\n蓝球：${back2.join(' ')}`;
    formatted = `红球:${front2.join(',')} 蓝球:${back2.join(',')}`;
  } else if (cfg.kind === 'front-back') {
    raw = { front: front2, back: back2 };
    display = `前区：${front2.join(' ')}\n后区：${back2.join(' ')}`;
    formatted = `前区:${front2.join(',')} 后区:${back2.join(',')}`;
  } else if (cfg.kind === 'numbers-special') {
    raw = { numbers: front2, special: back2 };
    display = back2.length ? `基本号：${front2.join(' ')}\n特别号：${back2.join(' ')}` : `号码：${front2.join(' ')}`;
    formatted = back2.length ? `基本号:${front2.join(',')} 特别号:${back2.join(',')}` : `号码:${front2.join(',')}`;
  } else if (cfg.kind === 'qxc-new') {
    const digits = frontDigit.concat(backDigit);
    raw = { digits, front: frontDigit, back: backDigit, qxcVersion: 'new' };
    display = backDigit.length ? `前区：${frontDigit.join(' ')}\n后区：${backDigit.join(' ')}` : `号码：${digits.join(' ')}`;
    formatted = backDigit.length ? `前区:${frontDigit.join(',')} 后区:${backDigit.join(',')}` : `号码:${digits.join(',')}`;
  } else {
    const digits = frontDigit.concat(backDigit);
    raw = { digits, qxcVersion: 'old' };
    display = `号码：${digits.join(' ')}`;
    formatted = `号码:${digits.join(',')}`;
  }

  raw.sourceIssue = item.issue;
  raw.saleMoney = item.saleMoney || null;
  raw.prizePoolMoney = item.prizePoolMoney || null;
  raw.winnerDetails = item.winnerDetails || [];
  raw.week = item.week || null;
  raw.lotteryId = cfg.lotteryId;

  return {
    templateId: cfg.id,
    period: `${cfg.periodPrefix}-${item.issue}`,
    sampleDate: item.openTime,
    raw,
    display,
    formatted,
  };
}

async function fetchPage(cfg, pageNum, retries = 6) {
  const url = new URL(API_URL);
  Object.entries({
    transactionType: '10001001',
    lotteryId: cfg.lotteryId,
    issueCount: 100000,
    startIssue: '',
    endIssue: '',
    startDate: '',
    endDate: '',
    type: 0,
    pageNum,
    pageSize: PAGE_SIZE,
    tt: Math.random(),
  }).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          referer: 'https://www.zhcw.com/kjxx/ssq/',
          'user-agent': 'Mozilla/5.0 random-number-helper local full import',
          accept: 'application/json,text/plain,*/*',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const json = JSON.parse(text.replace(/^callback\(/, '').replace(/\);?$/, ''));
      if (json.resCode && json.resCode !== '000000') throw new Error(`ZHCW API error: ${json.resCode || '(empty code)'}`);
      if (!Array.isArray(json.data)) throw new Error('ZHCW response missing data[]');
      return json.data;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`${cfg.name} page ${pageNum} attempt ${attempt}/${retries} failed: ${err.message}`);
      await sleep(DELAY_MS * attempt);
    }
  }
}

async function upsertRows(pool, cfg, rows) {
  let imported = 0;
  let skipped = 0;
  for (const item of rows) {
    if (!item.issue || !item.openTime || !item.frontWinningNum) { skipped++; continue; }
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
  return { imported, skipped };
}

async function importTask(pool, cfg) {
  console.log(`\n== ${cfg.name} (${cfg.id}) lotteryId=${cfg.lotteryId} pageSize=${PAGE_SIZE} ==`);
  let page = 1;
  let imported = 0;
  let skipped = 0;
  let consecutiveEmpty = 0;
  const seenIssues = new Set();

  while (page <= 500) {
    const rows = await fetchPage(cfg, page);
    console.log(`${cfg.name} page ${page}: ${rows.length} rows`);
    if (!rows.length) {
      consecutiveEmpty++;
      if (consecutiveEmpty >= 2) break;
      page++;
      await sleep(DELAY_MS);
      continue;
    }

    const newRows = rows.filter(item => {
      const key = `${cfg.lotteryId}:${item.issue}`;
      if (seenIssues.has(key)) return false;
      seenIssues.add(key);
      return true;
    });
    const result = await upsertRows(pool, cfg, newRows);
    imported += result.imported;
    skipped += result.skipped;

    if (rows.length < PAGE_SIZE) break;
    page++;
    await sleep(DELAY_MS);
  }

  await pool.query('DELETE FROM history_numbers WHERE template_id = $1 AND source = $2', [cfg.id, 'local-seed']);
  return { id: cfg.id, name: cfg.name, lotteryId: cfg.lotteryId, imported, skipped, pages: page };
}

async function main() {
  const pool = getPool();
  if (!pool) throw new Error('Database config missing. Run inside docker compose api or set DB_* env vars.');
  const results = [];
  for (const cfg of TASKS) {
    results.push(await importTask(pool, cfg));
    await sleep(DELAY_MS * 2);
  }
  const summary = await pool.query(`
    SELECT template_id, source, count(*)::int AS count, min(sample_date) AS min_date, max(sample_date) AS max_date
    FROM history_numbers
    WHERE template_id IN ('ssq','dlt','qlc','qxc')
    GROUP BY template_id, source
    ORDER BY template_id, source
  `);
  console.log(JSON.stringify({ results, summary: summary.rows }, null, 2));
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(closePool);
