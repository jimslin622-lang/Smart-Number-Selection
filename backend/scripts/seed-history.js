const { getPool, closePool } = require('../db/client');
const { templates } = require('../data');
const { generateById, formatDisplay, formatText } = require('../random');

function dateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  const pool = getPool();
  if (!pool) throw new Error('Database config missing. Set DB_HOST/DB_NAME/DB_USER first.');

  for (const tpl of templates) {
    await pool.query(`
      INSERT INTO templates(id, name, description, weekly_draws, draw_days, icon_text)
      VALUES($1,$2,$3,$4,$5::jsonb,$6)
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        weekly_draws = EXCLUDED.weekly_draws,
        draw_days = EXCLUDED.draw_days,
        icon_text = EXCLUDED.icon_text,
        updated_at = now()
    `, [tpl.id, tpl.name, tpl.desc, tpl.weeklyDraws, JSON.stringify(tpl.drawDays), tpl.iconText]);
  }

  const historyCounts = {
    lhc: 130, ssq: 145, dlt: 138, qlc: 74, qxc: 96,
    fc3d: 210, pl3: 198, pl5: 198, kl8: 156,
  };

  for (const tpl of templates) {
    const count = historyCounts[tpl.id] || 100;
    for (let i = 0; i < count; i++) {
      const raw = generateById(tpl.id);
      const display = formatDisplay(tpl.id, raw);
      const formatted = formatText(tpl.id, raw);
      const period = `${tpl.id.toUpperCase()}-${String(count - i).padStart(4, '0')}`;
      const sampleDate = dateDaysAgo(i);
      await pool.query(`
        INSERT INTO history_numbers(template_id, period, sample_date, raw_numbers, display_text, formatted_text, source)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)
        ON CONFLICT(template_id, period) DO NOTHING
      `, [tpl.id, period, sampleDate, JSON.stringify(raw), display, formatted, 'local-seed']);
    }
  }

  const summary = await pool.query(`
    SELECT template_id, count(*)::int AS count
    FROM history_numbers
    GROUP BY template_id
    ORDER BY template_id
  `);
  console.log(JSON.stringify({ seeded: true, summary: summary.rows }, null, 2));
}

seed().catch(err => {
  console.error(err);
  process.exitCode = 1;
}).finally(closePool);
