const { LOTTERY_MAP, LOTTERY_RULES } = require('../../utils/lottery');
const { getHistoryResults, getTemplates, getNumberStats } = require('../../services/lottery-api');

// ============ 六合彩常量 ============
const LHC_COLOR_MAP = {
  red: ['01','02','07','08','12','13','18','19','23','24','29','30','34','35','40','45','46'],
  blue: ['03','04','09','10','14','15','20','25','26','31','36','37','41','42','47','48'],
  green: ['05','06','11','16','17','21','22','27','28','32','33','38','39','43','44','49']
};
const LHC_COLOR_BY_NUM = {};
Object.keys(LHC_COLOR_MAP).forEach(color => {
  LHC_COLOR_MAP[color].forEach(num => { LHC_COLOR_BY_NUM[num] = color; });
});
const LHC_HEADERS = Array.from({ length: 49 }, (_, i) => String(i + 1).padStart(2, '0'));

const SSQ_RED_HEADERS = Array.from({ length: 33 }, (_, i) => String(i + 1).padStart(2, '0'));
const SSQ_BLUE_HEADERS = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0'));
const DLT_FRONT_HEADERS = Array.from({ length: 35 }, (_, i) => String(i + 1).padStart(2, '0'));
const DLT_BACK_HEADERS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

// ============ 七乐常量 ============
const QLC_HEADERS = Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, '0'));

// ============ 七星常量 ============
const QXC_FRONT_HEADERS = Array.from({ length: 10 }, (_, i) => String(i).padStart(1, '0'));
const QXC_BACK_HEADERS = Array.from({ length: 10 }, (_, i) => String(i).padStart(1, '0'));

Page({
  data: {
    selectedType: '6+1模式',
    selectedId: 'lhc',
    rule: null,
    historyCount: 0,
    weeklyDraws: 0,
    ruleCount: 0,
    loading: false,

    // 统计（从数据库读取）
    statMode: 'miss',
    statPeriodCount: 1,
    statBalls: [],
    blueStats: [],
    backStats: [],
    statRangeText: '',
    statPeriodText: '',
    statCards: [],
    hotNumbers: [],
    coldNumbers: [],
    specialHotNumbers: [],
    colorStats: [],

    // 走势图（前端实时计算）
    trendHeaders: LHC_HEADERS,
    SSQ_BLUE_HEADERS: SSQ_BLUE_HEADERS,
    DLT_BACK_HEADERS: DLT_BACK_HEADERS,
    QLC_HEADERS: QLC_HEADERS,
    QXC_FRONT_HEADERS: QXC_FRONT_HEADERS,
    trendRows: [],
    trendRangeText: '',
    trendPeriodCount: 30,
    showSpecial: true,
    showMiss: true,
    landscapeMode: false,

    fallbackText: ''
  },

  onLoad(options) {
    const type = options.type ? decodeURIComponent(options.type) : '6+1模式';
    const id = LOTTERY_MAP[type]?.id || 'lhc';
    const rule = LOTTERY_RULES[id] || LOTTERY_RULES.lhc;
    const typeConfig = LOTTERY_MAP[type] || LOTTERY_MAP.lhc;

    this.setData({
      selectedType: type, selectedId: id, rule,
      historyCount: 0, weeklyDraws: typeConfig?.weeklyDraws || 3,
      drawDaysText: typeConfig?.drawDaysText || '',
      ruleCount: rule?.items?.length || 0, loading: true
    });

    wx.setNavigationBarTitle({ title: `${type} 数字洞察` });
    this.loadTemplateCounts(id);
    this.generateAnalysis(id);
  },

  loadTemplateCounts(id) {
    getTemplates().then(list => {
      if (!list || !list.length) return;
      const t = list.find(item => item.id === id);
      if (t && t.historyCount) this.setData({ historyCount: t.historyCount });
    }).catch(() => {});
  },

  // ============ 通用号码提取 ============
  getNums(item, id) {
    const raw = item.raw || {};
    if (id === 'lhc') {
      const main = (raw.normal || raw.main || []).map(n => String(n).padStart(2, '0'));
      const special = raw.special != null ? [String(raw.special).padStart(2, '0')] : [];
      return { main, special, all: main.concat(special) };
    }
    if (id === 'ssq') {
      const red = (raw.red || []).map(n => String(n).padStart(2, '0'));
      const blue = (raw.blue || []).map(n => String(n).padStart(2, '0'));
      return { main: red, special: blue, all: red.concat(blue) };
    }
    if (id === 'dlt') {
      const front = (raw.front || []).map(n => String(n).padStart(2, '0'));
      const back = (raw.back || []).map(n => String(n).padStart(2, '0'));
      return { main: front, special: back, all: front.concat(back) };
    }
    if (id === 'qlc') {
      const nums = (raw.numbers || []).map(n => String(n).padStart(2, '0'));
      const special = raw.special != null ? [String(raw.special).padStart(2, '0')] : [];
      return { main: nums, special, all: nums.concat(special) };
    }
    if (id === 'qxc') {
      const front = (raw.front || []).map(n => String(n).padStart(1, '0'));
      const back = (raw.back || []).map(n => String(n).padStart(1, '0'));
      return { main: front, special: back, all: front.concat(back) };
    }
    return { main: [], special: [], all: [] };
  },

  // ============ 从数据库读取全量统计数据 ============
  buildStatsFromDb(dbStats, id) {
    if (!dbStats || !dbStats.length) return null;

    let mainHeaders, specialHeaders, specialOffset;
    let mainColor, specialColor;
    if (id === 'lhc') {
      mainHeaders = LHC_HEADERS; specialHeaders = null;
      mainColor = (num) => LHC_COLOR_BY_NUM[num] || 'blue';
    } else if (id === 'ssq') {
      mainHeaders = SSQ_RED_HEADERS; specialHeaders = SSQ_BLUE_HEADERS; specialOffset = 100;
      mainColor = () => 'red'; specialColor = () => 'blue';
    } else if (id === 'dlt') {
      mainHeaders = DLT_FRONT_HEADERS; specialHeaders = DLT_BACK_HEADERS; specialOffset = 100;
      mainColor = () => 'orange'; specialColor = () => 'blue';
    } else if (id === 'qlc') {
      mainHeaders = QLC_HEADERS; specialHeaders = QLC_HEADERS; specialOffset = 200;
      mainColor = () => 'red'; specialColor = () => 'blue';
    } else if (id === 'qxc') {
      mainHeaders = QXC_FRONT_HEADERS; specialHeaders = QXC_BACK_HEADERS; specialOffset = 100;
      mainColor = () => 'red'; specialColor = () => 'blue';
    } else return null;

    const statMap = {};
    dbStats.forEach(s => { statMap[s.number_value] = s; });

    const statBalls = mainHeaders.map(num => {
      const s = statMap[Number(num)];
      return {
        num, color: mainColor(num),
        value: this.data.statMode === 'freq' ? (s ? s.appear_count : 0) : (s ? s.current_miss : '-'),
        miss: s ? s.current_miss : '-',
        freq: s ? s.appear_count : 0
      };
    });

    const sorted = [...statBalls].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num));
    const hotNumbers = sorted.slice(0, 10);
    const coldNumbers = sorted.slice(-10).reverse();

    let blueStats = [], backStats = [], specialHotNumbers = [];
    if (specialHeaders && specialOffset) {
      const specialList = specialHeaders.map(num => {
        const s = statMap[Number(num) + specialOffset];
        return {
          num, color: specialColor ? specialColor() : 'blue',
          value: this.data.statMode === 'freq' ? (s ? s.appear_count : 0) : (s ? s.current_miss : '-'),
          miss: s ? s.current_miss : '-',
          freq: s ? s.appear_count : 0
        };
      });
      const specialSorted = [...specialList].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num));
      specialHotNumbers = specialSorted.slice(0, 8);
      if (id === 'ssq') blueStats = specialList;
      if (id === 'dlt') backStats = specialList;
    }

    return { statBalls, blueStats, backStats, hotNumbers, coldNumbers, specialHotNumbers };
  },

  // ============ 生成分析 ============
  generateAnalysis(id, statCount) {
    if (id !== 'lhc' && id !== 'ssq' && id !== 'dlt' && id !== 'qlc' && id !== 'qxc') {
      this.setData({ loading: false, fallbackText: '该玩法暂不支持数字洞察' });
      return;
    }

    const typeName = id === 'lhc' ? '6+1模式' : id === 'ssq' ? '红蓝模式' : id === 'dlt' ? '双区模式' : id === 'qlc' ? '七位模式' : '七星模式';
    const fetchCount = statCount || this.data.statPeriodCount || 500;
    const trendCount = this.data.trendPeriodCount || 30;

    Promise.all([
      getHistoryResults(typeName, fetchCount),
      getHistoryResults(typeName, trendCount),
      getNumberStats(id)
    ])
      .then(([statResults, trendResults, dbStats]) => {
        const history = (statResults || []).filter(Boolean);
        const trendHistory = (trendResults || []).filter(Boolean);

        // 走势图：前端实时计算（保持原有逻辑）
        let trendData;
        if (id === 'lhc') trendData = this.buildLhcTrend(trendHistory);
        else if (id === 'ssq') trendData = this.buildSsqTrend(trendHistory);
        else if (id === 'dlt') trendData = this.buildDltTrend(trendHistory);
        else if (id === 'qlc') trendData = this.buildQlcTrend(trendHistory);
        else trendData = this.buildQxcTrend(trendHistory);

        // 统计面板：从数据库读取全量统计数据（由定时脚本 update-stats.js 更新）
        let statData = this.buildStatsFromDb(dbStats, id);
        if (!statData) {
          if (id === 'lhc') statData = this.buildLhcStatsFallback(history);
          else if (id === 'ssq') statData = this.buildSsqStatsFallback(history);
          else if (id === 'dlt') statData = this.buildDltStatsFallback(history);
          else if (id === 'qlc') statData = this.buildQlcStatsFallback(history);
          else statData = this.buildQxcStatsFallback(history);
        }

        // 统计卡片（奇偶、大小等）仍然前端计算
        const cards = this.buildStatCards(history, id);

        // 六合彩波色统计
        let colorStats = [];
        if (id === 'lhc') colorStats = this.buildLhcColorStats(history);

        const latest = history[0]; const oldest = history[history.length - 1];

        this.setData({
          ...statData,
          ...trendData,
          statCards: cards,
          colorStats,
          statRangeText: `统计范围：${oldest?.date || '-'} 至 ${latest?.date || '-'}`,
          statPeriodText: `近 ${history.length} 组（${oldest?.period || '-'} ~ ${latest?.period || '-'}）`,
          loading: false
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '走势数据加载失败', icon: 'none' });
      });
  },

  // ============ 统计卡片（前端计算） ============
  buildStatCards(history, id) {
    let odd = 0, even = 0, big = 0, small = 0;
    let bigThreshold = 25;
    if (id === 'ssq') bigThreshold = 17;
    if (id === 'dlt') bigThreshold = 18;
    if (id === 'qlc') bigThreshold = 16;
    if (id === 'qxc') bigThreshold = 5;

    history.forEach(item => {
      const nums = this.getNums(item, id);
      nums.all.forEach(n => {
        const v = Number(n);
        if (v % 2 === 0) even++; else odd++;
        if (v >= bigThreshold) big++; else small++;
      });
    });

    const total = odd + even || 1;
    return [
      { label: '历史总组数', value: String(this.data.historyCount || 0), tip: '数据库已补全' },
      { label: '当前统计', value: `${history.length}组`, tip: '用于热冷/遗漏' },
      { label: '奇偶比例', value: `${odd}:${even}`, tip: `奇数${Math.round(odd / total * 100)}%` },
      { label: '大小比例', value: `${big}:${small}`, tip: id === 'lhc' ? '25-49为大' : id === 'ssq' ? '红球17-33为大' : '前区18-35为大' }
    ];
  },

  // ============ 六合彩波色统计 ============
  buildLhcColorStats(history) {
    const colorHits = { red: 0, blue: 0, green: 0 };
    const colorNames = { red: '红波', blue: '蓝波', green: '绿波' };
    history.forEach(item => {
      const nums = this.getNums(item, 'lhc');
      nums.all.forEach(num => { colorHits[LHC_COLOR_BY_NUM[num]] += 1; });
    });
    const total = colorHits.red + colorHits.blue + colorHits.green || 1;
    return ['red', 'blue', 'green'].map(color => ({
      color, name: colorNames[color],
      count: colorHits[color],
      percent: Math.round(colorHits[color] / total * 100)
    }));
  },

  // ============ 前端计算 fallback ============
  buildLhcStatsFallback(history) {
    const mainFreq = {}; const specialFreq = {}; const lastSeen = {};
    LHC_HEADERS.forEach(num => { mainFreq[num] = 0; specialFreq[num] = 0; lastSeen[num] = null; });
    history.forEach((item, index) => {
      const nums = this.getNums(item, 'lhc');
      nums.main.forEach(num => { mainFreq[num] += 1; if (lastSeen[num] === null) lastSeen[num] = index; });
      nums.special.forEach(num => { specialFreq[num] += 1; if (lastSeen[num] === null) lastSeen[num] = index; });
    });
    const statBalls = LHC_HEADERS.map(num => ({
      num, color: LHC_COLOR_BY_NUM[num] || 'blue',
      value: this.data.statMode === 'freq' ? (mainFreq[num] + specialFreq[num]) : (lastSeen[num] === null ? '-' : lastSeen[num]),
      miss: lastSeen[num] === null ? '-' : lastSeen[num],
      freq: mainFreq[num] + specialFreq[num]
    }));
    const sorted = [...statBalls].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num));
    const specialHot = LHC_HEADERS.map(num => ({
      num, color: LHC_COLOR_BY_NUM[num] || 'blue', count: specialFreq[num]
    })).sort((a, b) => b.count - a.count || Number(a.num) - Number(b.num)).slice(0, 8);
    return { statBalls, trendHeaders: LHC_HEADERS, hotNumbers: sorted.slice(0, 10), coldNumbers: sorted.slice(-10).reverse(), specialHotNumbers: specialHot };
  },

  buildSsqStatsFallback(history) {
    const redFreq = {}; const blueFreq = {}; const redLast = {}; const blueLast = {};
    SSQ_RED_HEADERS.forEach(num => { redFreq[num] = 0; redLast[num] = null; });
    SSQ_BLUE_HEADERS.forEach(num => { blueFreq[num] = 0; blueLast[num] = null; });
    history.forEach((item, index) => {
      const nums = this.getNums(item, 'ssq');
      nums.main.forEach(num => { redFreq[num] += 1; if (redLast[num] === null) redLast[num] = index; });
      nums.special.forEach(num => { blueFreq[num] += 1; if (blueLast[num] === null) blueLast[num] = index; });
    });
    const statBalls = SSQ_RED_HEADERS.map(num => ({
      num, color: 'red',
      value: this.data.statMode === 'freq' ? redFreq[num] : (redLast[num] === null ? '-' : redLast[num]),
      miss: redLast[num] === null ? '-' : redLast[num], freq: redFreq[num]
    }));
    const sorted = [...statBalls].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num));
    const blueStats = SSQ_BLUE_HEADERS.map(num => ({
      num, color: 'blue',
      value: this.data.statMode === 'freq' ? blueFreq[num] : (blueLast[num] === null ? '-' : blueLast[num]),
      miss: blueLast[num] === null ? '-' : blueLast[num], freq: blueFreq[num]
    }));
    const blueHot = [...blueStats].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num)).slice(0, 8);
    return { statBalls, blueStats, trendHeaders: SSQ_RED_HEADERS, hotNumbers: sorted.slice(0, 10), coldNumbers: sorted.slice(-10).reverse(), specialHotNumbers: blueHot };
  },

  buildDltStatsFallback(history) {
    const frontFreq = {}; const backFreq = {}; const frontLast = {}; const backLast = {};
    DLT_FRONT_HEADERS.forEach(num => { frontFreq[num] = 0; frontLast[num] = null; });
    DLT_BACK_HEADERS.forEach(num => { backFreq[num] = 0; backLast[num] = null; });
    history.forEach((item, index) => {
      const nums = this.getNums(item, 'dlt');
      nums.main.forEach(num => { frontFreq[num] += 1; if (frontLast[num] === null) frontLast[num] = index; });
      nums.special.forEach(num => { backFreq[num] += 1; if (backLast[num] === null) backLast[num] = index; });
    });
    const statBalls = DLT_FRONT_HEADERS.map(num => ({
      num, color: 'orange',
      value: this.data.statMode === 'freq' ? frontFreq[num] : (frontLast[num] === null ? '-' : frontLast[num]),
      miss: frontLast[num] === null ? '-' : frontLast[num], freq: frontFreq[num]
    }));
    const sorted = [...statBalls].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num));
    const backStats = DLT_BACK_HEADERS.map(num => ({
      num, color: 'blue',
      value: this.data.statMode === 'freq' ? backFreq[num] : (backLast[num] === null ? '-' : backLast[num]),
      miss: backLast[num] === null ? '-' : backLast[num], freq: backFreq[num]
    }));
    const backHot = [...backStats].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num)).slice(0, 8);
    return { statBalls, backStats, trendHeaders: DLT_FRONT_HEADERS, hotNumbers: sorted.slice(0, 10), coldNumbers: sorted.slice(-10).reverse(), specialHotNumbers: backHot };
  },

  // ============ 走势图（保持前端实时计算） ============
  buildLhcTrend(history) {
    const missMap = {};
    LHC_HEADERS.forEach(num => { missMap[num] = 0; });
    const asc = history.slice().reverse();
    const builtAsc = asc.map(item => {
      const nums = this.getNums(item, 'lhc');
      const hitSet = {};
      nums.main.forEach(num => { hitSet[num] = 'main'; });
      nums.special.forEach(num => { hitSet[num] = 'special'; });
      const cells = LHC_HEADERS.map(num => {
        const hitType = hitSet[num] || '';
        const cell = { num, color: LHC_COLOR_BY_NUM[num] || 'blue', hit: !!hitType, isSpecial: hitType === 'special', miss: missMap[num] };
        missMap[num] = hitType ? 0 : missMap[num] + 1;
        return cell;
      });
      return { period: item.period, date: item.date, mainText: nums.main.join(' '), specialText: nums.special.join(' '), cells };
    });
    const trendRows = builtAsc.reverse();
    const latest = history[0]; const oldest = history[history.length - 1];
    return { trendRows, trendRangeText: `近 ${history.length} 组：${oldest?.period || '-'} ~ ${latest?.period || '-'}` };
  },

  buildSsqTrend(history) {
    const redMiss = {}; const blueMiss = {};
    SSQ_RED_HEADERS.forEach(num => { redMiss[num] = 0; });
    SSQ_BLUE_HEADERS.forEach(num => { blueMiss[num] = 0; });
    const asc = history.slice().reverse();
    const builtAsc = asc.map(item => {
      const nums = this.getNums(item, 'ssq');
      const redHit = {}; const blueHit = {};
      nums.main.forEach(num => { redHit[num] = true; });
      nums.special.forEach(num => { blueHit[num] = true; });
      const redCells = SSQ_RED_HEADERS.map(num => {
        const hit = !!redHit[num];
        const cell = { num, color: 'red', hit, isSpecial: false, miss: redMiss[num] };
        redMiss[num] = hit ? 0 : redMiss[num] + 1;
        return cell;
      });
      const blueCells = SSQ_BLUE_HEADERS.map(num => {
        const hit = !!blueHit[num];
        const cell = { num, color: 'blue', hit, isSpecial: false, miss: blueMiss[num] };
        blueMiss[num] = hit ? 0 : blueMiss[num] + 1;
        return cell;
      });
      return { period: item.period, date: item.date, mainText: nums.main.join(' '), specialText: nums.special.join(' '), redCells, blueCells };
    });
    const trendRows = builtAsc.reverse();
    const latest = history[0]; const oldest = history[history.length - 1];
    return { trendRows, trendHeaders: SSQ_RED_HEADERS, trendRangeText: `近 ${history.length} 组：${oldest?.period || '-'} ~ ${latest?.period || '-'}` };
  },

  buildDltTrend(history) {
    const frontMiss = {}; const backMiss = {};
    DLT_FRONT_HEADERS.forEach(num => { frontMiss[num] = 0; });
    DLT_BACK_HEADERS.forEach(num => { backMiss[num] = 0; });
    const asc = history.slice().reverse();
    const builtAsc = asc.map(item => {
      const nums = this.getNums(item, 'dlt');
      const frontHit = {}; const backHit = {};
      nums.main.forEach(num => { frontHit[num] = true; });
      nums.special.forEach(num => { backHit[num] = true; });
      const frontCells = DLT_FRONT_HEADERS.map(num => {
        const hit = !!frontHit[num];
        const cell = { num, color: 'orange', hit, isSpecial: false, miss: frontMiss[num] };
        frontMiss[num] = hit ? 0 : frontMiss[num] + 1;
        return cell;
      });
      const backCells = DLT_BACK_HEADERS.map(num => {
        const hit = !!backHit[num];
        const cell = { num, color: 'blue', hit, isSpecial: false, miss: backMiss[num] };
        backMiss[num] = hit ? 0 : backMiss[num] + 1;
        return cell;
      });
      return { period: item.period, date: item.date, mainText: nums.main.join(' '), specialText: nums.special.join(' '), frontCells, backCells };
    });
    const trendRows = builtAsc.reverse();
    const latest = history[0]; const oldest = history[history.length - 1];
    return { trendRows, trendHeaders: DLT_FRONT_HEADERS, trendRangeText: `近 ${history.length} 组：${oldest?.period || '-'} ~ ${latest?.period || '-'}` };
  },

  // ============ 交互 ============
  switchStatMode(e) {
    const mode = e.currentTarget.dataset.mode;
    const balls = (this.data.statBalls || []).map(item => ({
      ...item, value: mode === 'freq' ? item.freq : item.miss
    }));
    this.setData({ statMode: mode, statBalls: balls });
  },

  // ============ 七乐走势图 ============
  buildQlcTrend(history) {
    const missMap = {};
    QLC_HEADERS.forEach(num => { missMap[num] = 0; });
    const asc = history.slice().reverse();
    const builtAsc = asc.map(item => {
      const nums = this.getNums(item, 'qlc');
      const hitSet = {};
      nums.main.forEach(num => { hitSet[num] = 'main'; });
      nums.special.forEach(num => { hitSet[num] = 'special'; });
      const cells = QLC_HEADERS.map(num => {
        const hitType = hitSet[num] || '';
        const cell = { num, color: 'red', hit: !!hitType, isSpecial: hitType === 'special', miss: missMap[num] };
        missMap[num] = hitType ? 0 : missMap[num] + 1;
        return cell;
      });
      return { period: item.period, date: item.date, mainText: nums.main.join(' '), specialText: nums.special.join(' '), cells };
    });
    const trendRows = builtAsc.reverse();
    const latest = history[0]; const oldest = history[history.length - 1];
    return { trendRows, trendRangeText: `近 ${history.length} 组：${oldest?.period || '-'} ~ ${latest?.period || '-'}` };
  },

  // ============ 七星走势图 ============
  buildQxcTrend(history) {
    const frontMiss = {}; const backMiss = {};
    QXC_FRONT_HEADERS.forEach(num => { frontMiss[num] = 0; });
    QXC_BACK_HEADERS.forEach(num => { backMiss[num] = 0; });
    const asc = history.slice().reverse();
    const builtAsc = asc.map(item => {
      const nums = this.getNums(item, 'qxc');
      const frontHit = {}; const backHit = {};
      nums.main.forEach(num => { frontHit[num] = true; });
      nums.special.forEach(num => { backHit[num] = true; });
      const frontCells = QXC_FRONT_HEADERS.map(num => {
        const hit = !!frontHit[num];
        const cell = { num, color: 'red', hit, isSpecial: false, miss: frontMiss[num] };
        frontMiss[num] = hit ? 0 : frontMiss[num] + 1;
        return cell;
      });
      const backCells = QXC_BACK_HEADERS.map(num => {
        const hit = !!backHit[num];
        const cell = { num, color: 'blue', hit, isSpecial: false, miss: backMiss[num] };
        backMiss[num] = hit ? 0 : backMiss[num] + 1;
        return cell;
      });
      return { period: item.period, date: item.date, mainText: nums.main.join(' '), specialText: nums.special.join(' '), frontCells, backCells };
    });
    const trendRows = builtAsc.reverse();
    const latest = history[0]; const oldest = history[history.length - 1];
    return { trendRows, trendRangeText: `近 ${history.length} 组：${oldest?.period || '-'} ~ ${latest?.period || '-'}` };
  },

  // ============ 七乐 fallback ============
  buildQlcStatsFallback(history) {
    const freq = {}; const lastSeen = {};
    QLC_HEADERS.forEach(num => { freq[num] = 0; lastSeen[num] = null; });
    history.forEach((item, index) => {
      const nums = this.getNums(item, 'qlc');
      nums.main.forEach(num => { freq[num]++; if (lastSeen[num] === null) lastSeen[num] = index; });
      nums.special.forEach(num => { if (lastSeen[num] === null) lastSeen[num] = index; });
    });
    const statBalls = QLC_HEADERS.map(num => ({
      num, color: 'red',
      value: this.data.statMode === 'freq' ? freq[num] : (lastSeen[num] === null ? '-' : lastSeen[num]),
      miss: lastSeen[num] === null ? '-' : lastSeen[num], freq: freq[num]
    }));
    const sorted = [...statBalls].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num));
    return { statBalls, trendHeaders: QLC_HEADERS, hotNumbers: sorted.slice(0, 10), coldNumbers: sorted.slice(-10).reverse(), specialHotNumbers: [], blueStats: [], backStats: [] };
  },

  // ============ 七星 fallback ============
  buildQxcStatsFallback(history) {
    const frontFreq = {}; const backFreq = {}; const frontLast = {}; const backLast = {};
    QXC_FRONT_HEADERS.forEach(num => { frontFreq[num] = 0; frontLast[num] = null; });
    QXC_BACK_HEADERS.forEach(num => { backFreq[num] = 0; backLast[num] = null; });
    history.forEach((item, index) => {
      const nums = this.getNums(item, 'qxc');
      nums.main.forEach(num => { frontFreq[num]++; if (frontLast[num] === null) frontLast[num] = index; });
      nums.special.forEach(num => { backFreq[num]++; if (backLast[num] === null) backLast[num] = index; });
    });
    const statBalls = QXC_FRONT_HEADERS.map(num => ({
      num, color: 'red',
      value: this.data.statMode === 'freq' ? frontFreq[num] : (frontLast[num] === null ? '-' : frontLast[num]),
      miss: frontLast[num] === null ? '-' : frontLast[num], freq: frontFreq[num]
    }));
    const sorted = [...statBalls].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num));
    const backStats = QXC_BACK_HEADERS.map(num => ({
      num, color: 'blue',
      value: this.data.statMode === 'freq' ? backFreq[num] : (backLast[num] === null ? '-' : backLast[num]),
      miss: backLast[num] === null ? '-' : backLast[num], freq: backFreq[num]
    }));
    const backHot = [...backStats].sort((a, b) => b.freq - a.freq || Number(a.num) - Number(b.num)).slice(0, 8);
    return { statBalls, trendHeaders: QXC_FRONT_HEADERS, hotNumbers: sorted.slice(0, 10), coldNumbers: sorted.slice(-10).reverse(), specialHotNumbers: backHot, blueStats: [], backStats };
  },

  setStatPeriod(e) {
    const count = Number(e.currentTarget.dataset.count) || 500;
    this.setData({ statPeriodCount: count, loading: true });
    this.generateAnalysis(this.data.selectedId, count);
  },

  setTrendCount(e) {
    const count = Number(e.currentTarget.dataset.count) || 30;
    this.setData({ trendPeriodCount: count, loading: true });
    const typeName = this.data.selectedId === 'lhc' ? '6+1模式' : this.data.selectedId === 'ssq' ? '红蓝模式' : this.data.selectedId === 'dlt' ? '双区模式' : this.data.selectedId === 'qlc' ? '七位模式' : '七星模式';
    getHistoryResults(typeName, count)
      .then(results => {
        const id = this.data.selectedId;
        let trendData;
        if (id === 'lhc') trendData = this.buildLhcTrend((results || []).filter(Boolean));
        else if (id === 'ssq') trendData = this.buildSsqTrend((results || []).filter(Boolean));
        else if (id === 'dlt') trendData = this.buildDltTrend((results || []).filter(Boolean));
        else if (id === 'qlc') trendData = this.buildQlcTrend((results || []).filter(Boolean));
        else trendData = this.buildQxcTrend((results || []).filter(Boolean));
        this.setData({ ...trendData, loading: false });
      })
      .catch(() => this.setData({ loading: false }));
  },

  toggleSpecial() { this.setData({ showSpecial: !this.data.showSpecial }); },
  toggleMiss() { this.setData({ showMiss: !this.data.showMiss }); },

  openLandscape() {
    this.setData({ landscapeMode: true });
    if (wx.setPageOrientation) wx.setPageOrientation({ orientation: 'landscape', fail: () => {} });
  },
  closeLandscape() {
    this.setData({ landscapeMode: false });
    if (wx.setPageOrientation) wx.setPageOrientation({ orientation: 'portrait', fail: () => {} });
  },
  onUnload() {
    if (wx.setPageOrientation) wx.setPageOrientation({ orientation: 'portrait', fail: () => {} });
  }
});
