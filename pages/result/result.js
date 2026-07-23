const { LOTTERY_TYPES, LOTTERY_MAP, LOTTERY_RULES, BALL_COLORS } = require('../../utils/lottery');
const { getHistoryResults, getTemplates } = require('../../services/lottery-api');

const BALL_STYLE_MAP = {
  'ball-red': 'linear-gradient(135deg, #ef4444, #b91c1c)',
  'ball-blue': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'ball-special': 'linear-gradient(135deg, #f59e0b, #d97706)',
  'ball-green': 'linear-gradient(135deg, #10b981, #047857)',
  'ball-orange': 'linear-gradient(135deg, #f97316, #ea580c)',
  'ball-pinkpurple': 'linear-gradient(135deg, #ec4899, #be185d)',
  'ball-indigopink': 'linear-gradient(135deg, #818cf8, #7c3aed)',
  'ball-violet': 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'ball-emerald': 'linear-gradient(135deg, #34d399, #059669)',
  'ball-cyanindigo': 'linear-gradient(135deg, #22d3ee, #2563eb)',
  'ball-amberred': 'linear-gradient(135deg, #fbbf24, #ef4444)',
  'red': 'linear-gradient(135deg, #ef4444, #b91c1c)',
  'blue': 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
};

function decorateParsed(parsed, typeId) {
  if (!parsed || !parsed.length) return parsed;
  const colors = BALL_COLORS[typeId] || {};
  const result = parsed.map(item => ({ ...item }));
  result.forEach(item => {
    item.isSpecial = item.label.includes('特别') || item.label.includes('扩展');
    item.isSub = item.label.includes('副') || item.label.includes('后') || item.label.includes('后区') || item.label.includes('蓝') || item.label.includes('特别') || item.label.includes('扩展');
    if (item.isSpecial && colors.special) {
      item.ballClass = colors.special;
    } else if (item.isSub && colors.sub) {
      item.ballClass = colors.sub;
    } else {
      item.ballClass = colors.main || 'ball-red';
    }
    item.ballStyle = BALL_STYLE_MAP[item.ballClass] || 'linear-gradient(135deg, #ef4444, #b91c1c)';
  });
  // 七星、七乐等单分组玩法：把最后一个号码拆为特码分组（蓝色）
  if ((typeId === 'qxc' || typeId === 'qlc') && result.length === 1) {
    const group = result[0];
    if (group.numbers.length > 1) {
      const mainNums = group.numbers.slice(0, -1);
      const specialNum = group.numbers[group.numbers.length - 1];
      result[0] = { ...group, numbers: mainNums, ballStyle: 'linear-gradient(135deg, #ef4444, #b91c1c)' };
      result.push({
        label: '特码',
        numbers: [specialNum],
        ballStyle: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      });
    }
  }
  return result;
}

/**
 * 将 parsed 分组合并为一行显示，保留每个号码的颜色
 */
function flattenParsed(parsed) {
  if (!parsed || !parsed.length) return [];
  const all = [];
  parsed.forEach(section => {
    section.numbers.forEach(num => {
      all.push({ num, ballStyle: section.ballStyle });
    });
  });
  return all;
}

Page({
  data: {
    type: '6+1模式',
    selectedId: 'lhc',
    lotteryTypes: LOTTERY_TYPES,
    results: [],
    allResults: [],
    periodCount: 20,
    totalCount: 0,
    countText: '',
    rule: null,
    rulesExpanded: false,
    loading: false
  },

  onLoad(options) {
    const type = options.type ? decodeURIComponent(options.type) : '6+1模式';
    this.loadTemplateCounts();
    this.refreshResults(type, 20);
  },

  loadTemplateCounts() {
    getTemplates().then(list => {
      if (!list || !list.length) return;
      const countMap = {};
      list.forEach(t => { countMap[t.id] = t.historyCount; });
      this._templateCounts = countMap;
    }).catch(() => {});
  },

  _getHistoryCount(id) {
    return (this._templateCounts && this._templateCounts[id]) || 0;
  },

  refreshResults(type, count = this.data.periodCount) {
    const id = LOTTERY_MAP[type]?.id || 'lhc';
    const requestId = Date.now();
    this._lastRequestId = requestId;
    this.setData({
      type,
      selectedId: id,
      periodCount: count,
      totalCount: this._getHistoryCount(id),
      rule: null,
      rulesExpanded: false,
      loading: true
    });
    wx.setNavigationBarTitle({ title: `${type} 历史示例` });

    getHistoryResults(type, count)
      .then(results => {
        if (this._lastRequestId !== requestId) return;
        // 给每条结果加上带颜色的 parsed 分组，并合并为一行
        const decorated = (results || []).map(item => {
          if (!item.parsed) return item;
          const colored = decorateParsed(item.parsed, id);
          const flatBalls = flattenParsed(colored);
          const ballCount = flatBalls.length;
          let ballSize = 64, fontSize = 26;
          if (ballCount >= 10) { ballSize = 44; fontSize = 20; }
          else if (ballCount >= 8) { ballSize = 48; fontSize = 22; }
          else if (ballCount >= 7) { ballSize = 54; fontSize = 24; }
          return { ...item, parsed: colored, flatBalls, ballSize, ballFontSize: fontSize };
        });
        const visibleResults = decorated.slice(0, count);
        const totalCount = this._getHistoryCount(id) || decorated.length || 0;
        this.setData({
          allResults: decorated,
          results: visibleResults,
          totalCount,
          countText: `已显示 ${visibleResults.length} 组示例${totalCount ? ` / 共 ${totalCount} 组` : ''}`,
          loading: false
        });
      })
      .catch(() => {
        if (this._lastRequestId !== requestId) return;
        this.setData({ loading: false });
        wx.showToast({ title: '历史数据加载失败', icon: 'none' });
      });
  },

  onSelectType(e) {
    const type = e.currentTarget.dataset.name;
    this.refreshResults(type, this.data.periodCount);
  },

  setPeriods(e) {
    const rawCount = parseInt(e.currentTarget.dataset.count);
    const count = rawCount === -1 ? Math.min(this._getHistoryCount(this.data.selectedId) || 300, 300) : rawCount;
    this.refreshResults(this.data.type, count);
  },

  toggleRules() {
    this.setData({ rulesExpanded: !this.data.rulesExpanded });
  },

  goBack() {
    wx.navigateBack();
  }
});
