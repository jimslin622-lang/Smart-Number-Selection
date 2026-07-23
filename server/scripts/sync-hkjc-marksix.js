const { getPool, closePool } = require('../db/client');
const { fetchMarkSixResults, HKJC_RESULTS_URL } = require('../hkjc-marksix');

async function sync() {
  const count = Math.min(Math.max(Number(process.argv[2] || process.env.HKJC_MARKSIX_COUNT || 50), 1), 5000);
  const pool = getPool();
  if (!pool) throw new Error('Database config missing');

  const rows = await fetchMarkSixResults({ count, maxCount: 5000 });
  let inserted = 0;

  for (const row of rows) {
    const numbers = { normal: row.raw.main.map(String), special: String(row.raw.special) };
    try {
      await pool.query(`
        INSERT INTO lottery_draw(lottery_code, issue, draw_date, numbers, data_source)
        VALUES($1,$2,$3,$4::jsonb,$5)
        ON CONFLICT(lottery_code, issue) DO NOTHING
      `, ['lhc', row.period, row.sampleDate, JSON.stringify(numbers), 'hkjc.com']);
      inserted++;
    } catch (e) {
      // 跳过重复
    }
  }

  const summary = await pool.query(`
    SELECT count(*)::int AS total, max(draw_date)::text AS latest, min(draw_date)::text AS earliest
    FROM lottery_draw
    WHERE lottery_code = 'lhc' AND data_source = 'hkjc.com'
  `);

  console.log(JSON.stringify({
    ok: true,
    fetched: rows.length,
    inserted,
    db: summary.rows[0],
  }, null, 2));
}

sync().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(closePool);