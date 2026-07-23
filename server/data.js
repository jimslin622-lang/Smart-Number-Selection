const { generateById, formatDisplay, formatText, parseDisplay } = require('./random');

// ⚠️ 废弃：templates 内存数据仅作为数据库不可用时的 fallback
// 新数据从 lottery_draw 表读取，见 repository.js
const templates = [
  { id: 'lhc', name: '6+1模式', desc: '6+1数字', weeklyDraws: 3, drawDays: ['二', '四', '六/日'], iconText: '6' },
  { id: 'ssq', name: '红蓝模式', desc: '6红+1蓝', weeklyDraws: 3, drawDays: ['二', '四', '日'], iconText: '红' },
  { id: 'dlt', name: '双区模式', desc: '5前+2后', weeklyDraws: 3, drawDays: ['一', '三', '六'], iconText: '双' },
  { id: 'qlc', name: '七位模式', desc: '7个号码', weeklyDraws: 3, drawDays: ['一', '三', '五'], iconText: '7' },
  { id: 'qxc', name: '七星模式', desc: '7位号码', weeklyDraws: 3, drawDays: ['二', '五', '日'], iconText: '7' },
  { id: 'fc3d', name: '三位模式', desc: '三位号码', weeklyDraws: 7, drawDays: ['每日'], iconText: '3' },
  { id: 'pl3', name: '三星模式', desc: '三位排列', weeklyDraws: 7, drawDays: ['每日'], iconText: '三' },
  { id: 'pl5', name: '五星模式', desc: '五位排列', weeklyDraws: 7, drawDays: ['每日'], iconText: '5' },
  { id: 'kl8', name: '八选模式', desc: '10个号码', weeklyDraws: 7, drawDays: ['每日'], iconText: '8' },
];

const templateMap = Object.fromEntries(templates.map(item => [item.id, item]));

function getTemplate(id) {
  return templateMap[id] || templates[0];
}

function buildExample(id) {
  const tpl = getTemplate(id);
  const raw = generateById(tpl.id);
  const display = formatDisplay(tpl.id, raw);
  return {
    typeId: tpl.id,
    type: tpl.name,
    period: `示例-${tpl.id.toUpperCase()}`,
    date: '今日示例',
    raw,
    formatted: formatText(tpl.id, raw),
    display,
    parsed: parseDisplay(display),
  };
}

function buildHistory(id, count = 20) {
  const tpl = getTemplate(id);
  const safeCount = Math.min(Math.max(Number(count) || 20, 1), 50);
  const now = new Date();
  return Array.from({ length: safeCount }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const raw = generateById(tpl.id);
    const display = formatDisplay(tpl.id, raw);
    const formatted = formatText(tpl.id, raw);
    return {
      typeId: tpl.id,
      type: tpl.name,
      period: `第${i + 1}组`,
      date: `${date.getMonth() + 1}月${date.getDate()}日`,
      raw,
      formatted,
      display,
      parsed: parseDisplay(display),
      numberList: parseDisplay(display).flatMap(group => group.numbers),
    };
  });
}

function buildAnalysis(id) {
  const history = buildHistory(id, 20);
  const freq = {};
  history.forEach(item => {
    item.parsed.forEach(group => {
      group.numbers.forEach(num => {
        freq[num] = (freq[num] || 0) + 1;
      });
    });
  });
  const sorted = Object.keys(freq).map(num => ({ num, count: freq[num] })).sort((a, b) => b.count - a.count || Number(a.num) - Number(b.num));
  return {
    typeId: getTemplate(id).id,
    highFrequency: sorted.slice(0, 8),
    lowFrequency: sorted.slice(-8).reverse(),
    sampleSize: history.length,
  };
}

module.exports = { templates, getTemplate, buildExample, buildHistory, buildAnalysis };
