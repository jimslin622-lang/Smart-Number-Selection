const { LOTTERY_SCHEDULE } = require('../config/lottery-schedule');

const INTERVAL_5M = 5 * 60 * 1000;
const INTERVAL_1H = 60 * 60 * 1000;
const INTERVAL_10M = 10 * 60 * 1000;

function nowInChina() {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
}

function getChinaHHMM() {
  const d = nowInChina();
  return { hh: d.getHours(), mm: d.getMinutes(), total: d.getHours() * 60 + d.getMinutes() };
}

function getDayOfWeek() {
  const d = nowInChina().getDay();
  return d === 0 ? 7 : d;
}

async function runScheduler(mode) {
  const now = getChinaHHMM();
  const today = getDayOfWeek();
  const modeLabel = mode === 'immediate' ? '即时拉取' : '延迟拉取';

  for (const cfg of LOTTERY_SCHEDULE) {
    if (!cfg.days.includes(today)) continue;
    const drawTotal = parseTime(cfg.time);
    let windowStart, windowEnd;
    if (mode === 'immediate') {
      windowStart = drawTotal;
      windowEnd = drawTotal + 30;
    } else {
      windowStart = drawTotal + cfg.delayMinutes;
      windowEnd = windowStart + 120;
    }
    if (now.total >= windowStart && now.total <= windowEnd) {
      console.log(`[scheduler] ${modeLabel} ${cfg.name} (${cfg.code})`);
      try {
        await syncOne(cfg, modeLabel);
      } catch (err) {
        console.error(`[scheduler] ${cfg.code} sync error:`, err.message);
      }
    }
  }
}

function parseTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

async function syncOne(cfg, label) {
  const { code, name, provider, syncCount } = cfg;
  console.log(`[scheduler] 同步 ${name} (${code}) ${label}...`);
  if (provider === 'zhcw') {
    const syncZhcw = require('../scripts/sync-zhcw');
    await syncZhcw.sync(code, syncCount || 3);
  } else if (provider === 'hkjc') {
    const syncHkjc = require('../scripts/sync-hkjc-marksix');
    await syncHkjc.sync(syncCount || 5);
  }
}

async function runCheckAndFill() {
  console.log('[scheduler] 补漏检查...');
  try {
    const { checkMissingDraws, syncLottery } = require('../scripts/check-and-fill');
    for (const cfg of LOTTERY_SCHEDULE) {
      const result = await checkMissingDraws(cfg.code);
      if (result.shouldSync) {
        console.log(`[scheduler] 补漏 ${cfg.name} (${cfg.code})`);
        await syncLottery(cfg, 10);
      }
    }
  } catch (err) {
    console.error('[scheduler] check-and-fill error:', err.message);
  }
}

async function runUpdateStats() {
  console.log('[scheduler] 更新统计分析...');
  try {
    await require('../scripts/update-stats')();
  } catch (err) {
    console.error('[scheduler] update-stats error:', err.message);
  }
}

async function catchUpMissed() {
  const now = getChinaHHMM();
  console.log('[scheduler] 检查今日已过窗口的彩种...');

  for (const cfg of LOTTERY_SCHEDULE) {
    const drawTotal = parseTime(cfg.time);
    const windowEnd = drawTotal + cfg.delayMinutes + 120;
    const isAfterMidnight = now.hh >= 0 && now.hh < 6;
    const missed = now.total > windowEnd || (isAfterMidnight && now.total < drawTotal);
    if (missed) {
      console.log(`[scheduler] 补拉 ${cfg.name} (${cfg.code})`);
      try {
        await syncOne(cfg, '补拉');
      } catch (err) {
        console.error(`[scheduler] ${cfg.code} 补拉失败:`, err.message);
      }
    }
  }
}

let started = false;

function startScheduler() {
  if (started) return;
  started = true;
  console.log('[scheduler] 启动定时任务 (in-app)');

  const fastTimer = () => {
    runScheduler('immediate').catch(() => {});
    runScheduler('delayed').catch(() => {});
  };

  catchUpMissed().finally(() => {
    fastTimer();
  });
  setInterval(fastTimer, INTERVAL_5M);

  const hourTimer = () => {
    runCheckAndFill().catch(() => {});
  };
  setInterval(hourTimer, INTERVAL_1H);

  const statsTimer = () => {
    const now = nowInChina();
    if (now.getHours() === 2 && now.getMinutes() < 10) {
      runUpdateStats().catch(() => {});
    }
  };
  setInterval(statsTimer, INTERVAL_10M);
}

module.exports = { startScheduler };
