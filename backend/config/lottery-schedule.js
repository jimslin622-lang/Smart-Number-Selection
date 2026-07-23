/**
 * 彩种开奖时间配置
 * 
 * 说明：
 * - 格式：每个彩种配置拉取时间和策略
 * - days: 1-7, 周一到周日
 * - time: HH:mm 格式
 * - syncCount: 每次拉取期数
 * - provider: 数据源 'zhcw' 或 'hkjc'
 */

const LOTTERY_SCHEDULE = [
  // 6+1模式 (周二、周四、周六/周日)
  {
    code: 'lhc',
    name: '6+1模式',
    provider: 'hkjc',
    days: [2, 4, 6, 7], // 周二、周四、周六、周日
    time: '21:00',     // 21:00 开奖
    syncCount: 5,
    delayMinutes: 30, // 开奖后延迟30分钟拉取
  },

  // 红蓝模式 (周二、周四、周日)
  {
    code: 'ssq',
    name: '红蓝',
    provider: 'zhcw',
    days: [2, 4, 7], // 周二、周四、周日
    time: '21:15',
    syncCount: 3,
    delayMinutes: 15,
  },

  // 双区模式 (周一、周三、周六)
  {
    code: 'dlt',
    name: '双区',
    provider: 'zhcw',
    days: [1, 3, 6], // 周一、周三、周六
    time: '20:30',
    syncCount: 3,
    delayMinutes: 15,
  },

  // 七位模式 (周一、周三、周五)
  {
    code: 'qlc',
    name: '七位',
    provider: 'zhcw',
    days: [1, 3, 5], // 周一、周三、周五
    time: '21:15',
    syncCount: 3,
    delayMinutes: 15,
  },

  // 七星模式 (周二、周五、周日)
  {
    code: 'qxc',
    name: '七星模式',
    provider: 'zhcw',
    days: [2, 5, 7], // 周二、周五、周日
    time: '20:30',
    syncCount: 3,
    delayMinutes: 15,
  },

  // 福彩3D (每天)
  {
    code: 'fc3d',
    name: '三位',
    provider: 'zhcw',
    days: [1, 2, 3, 4, 5, 6, 7], // 每天
    time: '21:15',
    syncCount: 3,
    delayMinutes: 15,
  },

  // 排列3 (每天)
  {
    code: 'pl3',
    name: '三星',
    provider: 'zhcw',
    days: [1, 2, 3, 4, 5, 6, 7], // 每天
    time: '21:15',
    syncCount: 3,
    delayMinutes: 15,
  },

  // 排列5 (每天)
  {
    code: 'pl5',
    name: '五星',
    provider: 'zhcw',
    days: [1, 2, 3, 4, 5, 6, 7], // 每天
    time: '21:15',
    syncCount: 3,
    delayMinutes: 15,
  },

  // 快乐8 (每天)
  {
    code: 'kl8',
    name: '八选',
    provider: 'zhcw',
    days: [1, 2, 3, 4, 5, 6, 7], // 每天
    time: '21:30',
    syncCount: 3,
    delayMinutes: 15,
  },
];

module.exports = { LOTTERY_SCHEDULE };
