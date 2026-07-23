// ==================== 彩票类型配置 ====================
const LOTTERY_TYPES = [
  { id: 'lhc', name: '6+1模式', desc: '6+1数字', color: '#10b981', bg: 'linear-gradient(135deg, #10b981, #059669)', weeklyDraws: 3, drawDays: [2, 4, 6], icon: '六', iconClass: 'lottery-icon-lhc', iconText: '6' },
  { id: 'ssq', name: '红蓝模式', desc: '6红+1蓝', color: '#ef4444', bg: 'linear-gradient(135deg, #ef4444, #3b82f6)', weeklyDraws: 3, drawDays: [2, 4, 7], icon: '双', iconClass: 'lottery-icon-ssq', iconText: '红' },
  { id: 'dlt', name: '双区模式', desc: '5前+2后', color: '#f59e0b', bg: 'linear-gradient(135deg, #f59e0b, #ea580c)', weeklyDraws: 3, drawDays: [1, 3, 6], icon: '大', iconClass: 'lottery-icon-dlt', iconText: '双' },
  { id: 'qlc', name: '七位模式', desc: '7个号码', color: '#ec4899', bg: 'linear-gradient(135deg, #ec4899, #06b6d4)', weeklyDraws: 3, drawDays: [1, 3, 5], icon: '七', iconClass: 'lottery-icon-qlc', iconText: '7' },
  { id: 'qxc', name: '七星模式', desc: '7位号码', color: '#6366f1', bg: 'linear-gradient(135deg, #6366f1, #8b5cf6)', weeklyDraws: 3, drawDays: [2, 5, 7], icon: '星', iconClass: 'lottery-icon-qxc', iconText: '7' },
  { id: 'fc3d', name: '三位模式', desc: '三位号码', color: '#8b5cf6', bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', weeklyDraws: 7, drawDays: [1, 2, 3, 4, 5, 6, 7], icon: '3D', iconClass: 'lottery-icon-fc3d', iconText: '3' },
  { id: 'pl3', name: '三星模式', desc: '三位排列', color: '#22c55e', bg: 'linear-gradient(135deg, #22c55e, #14b8a6)', weeklyDraws: 7, drawDays: [1, 2, 3, 4, 5, 6, 7], icon: '3', iconClass: 'lottery-icon-pl3', iconText: '三' },
  { id: 'pl5', name: '五星模式', desc: '五位排列', color: '#14b8a6', bg: 'linear-gradient(135deg, #14b8a6, #06b6d4)', weeklyDraws: 7, drawDays: [1, 2, 3, 4, 5, 6, 7], icon: '5', iconClass: 'lottery-icon-pl5', iconText: '5' },
  { id: 'kl8', name: '八选模式', desc: '10个号码', color: '#f97316', bg: 'linear-gradient(135deg, #f97316, #ea580c)', weeklyDraws: 7, drawDays: [1, 2, 3, 4, 5, 6, 7], icon: '8', iconClass: 'lottery-icon-kl8', iconText: '8' },
];

const BALL_COLORS = {
  lhc: { main: 'ball-green', special: 'ball-orange' },
  ssq: { main: 'red', sub: 'blue' },
  dlt: { main: 'red', sub: 'blue' },
  qlc: { main: 'red', sub: 'blue' },
  qxc: { main: 'red', sub: 'blue' },
  fc3d: { main: 'red' },
  pl3: { main: 'red' },
  pl5: { main: 'red' },
  kl8: { main: 'red' }
};

// ⚠️ 废弃：HISTORY_COUNTS 已移除，历史期数统一通过 API /api/v1/templates 动态获取
// 旧表 history_numbers 已废弃，数据迁移至 lottery_draw 表
// 如需离线 fallback，请在 services/lottery-api.js 的 getTemplates() catch 中处理

const WEEK_NAMES = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六', 7: '日' };

const LOTTERY_MAP = {};
LOTTERY_TYPES.forEach(item => {
  // drawDays 为数字数组 [1-7]，转中文星期显示
  // 如果是 1-7 全部覆盖则显示"每日"
  const days = item.drawDays;
  if (days.length === 7 && days[0] === 1 && days[6] === 7) {
    item.drawDaysText = '每日';
  } else {
    item.drawDaysText = days.map(d => WEEK_NAMES[d]).join('/');
  }
  LOTTERY_MAP[item.name] = item;
  LOTTERY_MAP[item.id] = item;
});

module.exports = { LOTTERY_TYPES, BALL_COLORS, LOTTERY_MAP };
