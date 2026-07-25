const fs = require('fs');
const p = '/app/scheduler/scheduler.js';
let c = fs.readFileSync(p, 'utf8');
if (c.includes('catchUpMissed')) { console.log('already updated'); process.exit(0); }
c = c.replace('function startScheduler()',
  'async function catchUpMissed() {\n  const now = getChinaHHMM();\n  const today = getDayOfWeek();\n  console.log("[scheduler] \u8865\u67e5\u4eca\u65e5\u5df2\u8fc7\u7a97\u53e3\u7684\u5f69\u79cd...");\n  for (const cfg of LOTTERY_SCHEDULE) {\n    if (!cfg.days.includes(today)) continue;\n    const drawTotal = parseTime(cfg.time);\n    const windowEnd = drawTotal + cfg.delayMinutes + 120;\n    if (now.total > windowEnd) {\n      console.log("[scheduler] \u8865\u62c9\u4eca\u65e5\u5df2\u8fc7\u7a97\u53e3 " + cfg.name + " (" + cfg.code + ")");\n      try { await syncOne(cfg, "\u8865\u62c9"); } catch (err) { console.error("[scheduler] " + cfg.code + " \u8865\u62c9\u5931\u8d25: " + err.message); }\n    }\n  }\n}\n\nfunction startScheduler()');
c = c.replace('  fastTimer();', '  catchUpMissed().finally(() => { fastTimer(); });');
fs.writeFileSync(p, c);
console.log('ok');
