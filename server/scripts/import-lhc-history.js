/**
 * 从本地缓存文件导入六合彩全部历史数据到 lottery_draw 表
 * 来源: utils/lottery/marksix-history.js (4352期)
 * 用法: node server/scripts/import-lhc-history.js
 */
const { getPool, closePool } = require('../db/client');

async function main() {
  const pool = getPool();
  if (!pool) throw new Error('Database config missing');

  const history = require('../utils/lottery/marksix-history');
  console.log(`总缓存: ${history.length} 期`);

  let inserted = 0, skipped = 0;
  for (const row of history) {
    // marksix-history 格式: [period, date, mainCsv, special, source]
    const [period, dateStr, mainCsv, special, source] = row;
    const main = String(mainCsv || '').split(',').filter(Boolean);
    const numbers = { normal: main, special: String(special || '') };

    // 日期格式: "2025-01-15" 或 "15/1/2025"
    let drawDate;
    if (dateStr.includes('-')) {
      drawDate = dateStr;
    } else {
      const parts = dateStr.split('/');
      drawDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    try {
      await pool.query(`
        INSERT INTO lottery_draw(lottery_code, issue, draw_date, numbers, data_source)
        VALUES($1,$2,$3,$4::jsonb,$5)
        ON CONFLICT(lottery_code, issue) DO NOTHING
      `, ['lhc', period, drawDate, JSON.stringify(numbers), 'hkjc-history']);
      inserted++;
    } catch (e) {
      if (e.code === '23505') { skipped++; }
      else { console.error('Error:', period, e.message); }
    }
  }

  const summary = await pool.query(`
    SELECT count(*)::int AS total, max(draw_date)::text AS latest, min(draw_date)::text AS earliest
    FROM lottery_draw WHERE lottery_code = 'lhc'
  `);
  console.log(JSON.stringify({ inserted, skipped, db: summary.rows[0] }, null, 2));
}

main().catch(err => { console.error(err); process.exitCode = 1; }).finally(closePool);