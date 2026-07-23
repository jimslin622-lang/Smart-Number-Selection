const { getPool, closePool } = require('../db/client');

const BASE_URL = 'https://lottery.hk/en/mark-six/results';

function pad2(value) {
  return String(Number(value)).padStart(2, '0');
}

function toIsoDate(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(iso) {
  const [, mm, dd] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  return `${Number(mm)}月${Number(dd)}日`;
}

function parseYearResults(html) {
  const rows = [];
  const re = /(?:^|[>\s])(\d{2}\/\d{3})\s*<\/td>[\s\S]*?(\d{2}\/\d{2}\/\d{4})[\s\S]*?<ul class="balls">([\s\S]*?)<\/ul>/g;
  let match;
  while ((match = re.exec(html))) {
    const period = match[1];
    const iso = toIsoDate(match[2]);
    const nums = Array.from(match[3].matchAll(/<li[^>]*>\s*(\d{1,2})\s*<\/li>/g)).map(m => pad2(m[1]));
    if (nums.length !== 7) continue;
    const main = nums.slice(0, 6);
    const special = [nums[6]];
    rows.push({
      period,
      sampleDate: iso,
      raw: { main, special, sourceUrl: `${BASE_URL}/${iso}` },
      display: `主码：${main.join(' ')}\n特别号：${special.join(' ')}`,
      formatted: `主码:${main.join(',')} 特别号:${special.join(',')}`,
      date: formatDate(iso),
    });
  }
  return rows;
}

async function fetchYear(year) {
  const url = `${BASE_URL}/${year}`;
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144 Safari/537.36',
      'accept': 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  const html = await response.text();
  return parseYearResults(html);
}

async function sync() {
  const fromYear = Number(process.argv[2] || 1993);
  const toYear = Number(process.argv[3] || new Date().getFullYear());
  const pool = getPool();
  if (!pool) throw new Error('Database config missing. Set DB_HOST/DB_NAME/DB_USER first.');

  await pool.query(`
    INSERT INTO templates(id, name, description, weekly_draws, draw_days, icon_text)
    VALUES('lhc','六合','6+1数字',3,jsonb_build_array('二','四','六/日'),'六')
    ON CONFLICT(id) DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      weekly_draws = EXCLUDED.weekly_draws,
      draw_days = EXCLUDED.draw_days,
      icon_text = EXCLUDED.icon_text,
      updated_at = now()
  `);

  let fetched = 0;
  let inserted = 0;
  let updated = 0;
  const perYear = [];

  for (let year = toYear; year >= fromYear; year--) {
    const rows = await fetchYear(year);
    perYear.push({ year, count: rows.length });
    fetched += rows.length;
    for (const row of rows) {
      const result = await pool.query(`
        INSERT INTO history_numbers(template_id, period, sample_date, raw_numbers, display_text, formatted_text, source)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)
        ON CONFLICT(template_id, period) DO UPDATE SET
          sample_date = EXCLUDED.sample_date,
          raw_numbers = CASE WHEN history_numbers.source = 'hkjc.com' THEN history_numbers.raw_numbers ELSE EXCLUDED.raw_numbers END,
          display_text = CASE WHEN history_numbers.source = 'hkjc.com' THEN history_numbers.display_text ELSE EXCLUDED.display_text END,
          formatted_text = CASE WHEN history_numbers.source = 'hkjc.com' THEN history_numbers.formatted_text ELSE EXCLUDED.formatted_text END,
          source = CASE WHEN history_numbers.source = 'hkjc.com' THEN history_numbers.source ELSE EXCLUDED.source END
        RETURNING (xmax = 0) AS inserted
      `, [
        'lhc',
        row.period,
        row.sampleDate,
        JSON.stringify(row.raw),
        row.display,
        row.formatted,
        'lottery.hk',
      ]);
      if (result.rows[0]?.inserted) inserted++; else updated++;
    }
  }

  const summary = await pool.query(`
    SELECT source, count(*)::int AS count, min(sample_date) AS earliest, max(sample_date) AS latest
    FROM history_numbers
    WHERE template_id = 'lhc'
    GROUP BY source
    ORDER BY source
  `);

  console.log(JSON.stringify({ ok: true, fromYear, toYear, fetched, inserted, updated, perYear, db: summary.rows }, null, 2));
}

sync().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(closePool);
