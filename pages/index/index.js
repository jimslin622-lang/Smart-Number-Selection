const { LOTTERY_TYPES, BALL_COLORS, parseDisplay } = require('../../utils/lottery');
const { safeNavigateTo } = require('../../utils/safe-navigate');
const { getLatestResult, getTemplates } = require('../../services/lottery-api');

Page({
  data: {
    lotteryTypes: LOTTERY_TYPES,
    historyCounts: {}, // 通过 API /api/v1/templates 动态获取
    selectedTypeId: 'lhc',
    selectedTypeObj: LOTTERY_TYPES.find(t => t.id === 'lhc') || LOTTERY_TYPES[0],
    selectedTypeName: '6+1模式',
    latestResult: null
  },

  onLoad() {
    this.updateLatestResult('lhc');
    this.loadTemplates();
  },

  loadTemplates() {
    getTemplates().then(list => {
      if (!list || !list.length) return;
      const countMap = {};
      list.forEach(t => { countMap[t.id] = t.historyCount; });
      this.setData({ historyCounts: countMap });
    }).catch(() => {});
  },

  onShow() {
    // 首页重新显示时不强制刷新，避免 tab 切换造成多余 setData 和卡顿
  },

  onSelectType(e) {
    const id = e.currentTarget.dataset.id;
    const typeObj = LOTTERY_TYPES.find(t => t.id === id);
    this.setData({
      selectedTypeId: id,
      selectedTypeObj: typeObj,
      selectedTypeName: typeObj.name,
      latestResult: null
    });
    this.updateLatestResult(id);
  },

  decorateResult(result, typeId) {
    if (!result) return null;
    const colors = BALL_COLORS[typeId] || {};
    // 确保有 parsed 字段（MOCK_LATEST 只有 display 字符串）
    if (!result.parsed) {
      result.parsed = parseDisplay(result.display);
    }
    const ballStyleMap = {
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
    const parsed = (result.parsed || []).map(item => ({ ...item }));
    parsed.forEach(item => {
      item.isSpecial = item.label.includes('特别') || item.label.includes('扩展');
      item.isSub = item.label.includes('副') || item.label.includes('后') || item.label.includes('后区') || item.label.includes('蓝') || item.label.includes('特别') || item.label.includes('扩展');
      if (item.isSpecial && colors.special) {
        item.ballClass = colors.special;
      } else if (item.isSub && colors.sub) {
        item.ballClass = colors.sub;
      } else {
        item.ballClass = colors.main || 'ball-red';
      }
      item.ballStyle = ballStyleMap[item.ballClass] || 'linear-gradient(135deg, #ef4444, #b91c1c)';
    });
    // 七星、七乐等单分组玩法：把最后一个号码拆为特码分组（蓝色）
    if ((typeId === 'qxc' || typeId === 'qlc') && parsed.length === 1) {
      const group = parsed[0];
      if (group.numbers.length > 1) {
        const mainNums = group.numbers.slice(0, -1);
        const specialNum = group.numbers[group.numbers.length - 1];
        parsed[0] = { ...group, numbers: mainNums, ballStyle: 'linear-gradient(135deg, #ef4444, #b91c1c)' };
        parsed.push({
          label: '特码',
          numbers: [specialNum],
          ballStyle: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
        });
      }
    }
    // 拍平为一行，保留每个号码的颜色
    const flatBalls = [];
    parsed.forEach(section => {
      section.numbers.forEach(num => {
        flatBalls.push({ num, ballStyle: section.ballStyle });
      });
    });
    // 号码多时缩小尺寸，尽量一行显示
    const ballCount = flatBalls.length;
    let ballSize = 68;
    let fontSize = 28;
    if (ballCount >= 10) { ballSize = 48; fontSize = 22; }
    else if (ballCount >= 8) { ballSize = 52; fontSize = 24; }
    else if (ballCount >= 7) { ballSize = 58; fontSize = 26; }
    return { ...result, parsed, flatBalls, ballSize, ballFontSize: fontSize };
  },

  updateLatestResult(typeId) {
    getLatestResult(typeId).then(result => {
      if (result) {
        this.setData({ latestResult: this.decorateResult(result, typeId) });
      }
    }).catch(() => {
      // fallback: 静默失败，不显示旧数据
    });
  },

  onChooseType(e) {
    const name = e.currentTarget.dataset.name;
    safeNavigateTo(`/pages/detail/detail?type=${encodeURIComponent(name)}`);
  },

  onRandomSelect() {
    const type = this.data.selectedTypeName;
    safeNavigateTo(`/pages/detail/detail?type=${encodeURIComponent(type)}&mode=random`);
  },

  onRandomFive() {
    const type = this.data.selectedTypeName;
    safeNavigateTo(`/pages/detail/detail?type=${encodeURIComponent(type)}&mode=five`);
  },

  goResult() {
    const type = this.data.selectedTypeName;
    safeNavigateTo(`/pages/result/result?type=${encodeURIComponent(type)}`);
  },

  goAnalysis() {
    const id = this.data.selectedTypeId;
    // fc3d/pl3/pl5/kl8 不支持数字洞察
    if (['fc3d', 'pl3', 'pl5', 'kl8'].includes(id)) {
      wx.showToast({ title: '该玩法暂不支持数字洞察', icon: 'none' });
      return;
    }
    const type = this.data.selectedTypeName;
    safeNavigateTo(`/pages/analysis/analysis?type=${encodeURIComponent(type)}`);
  }
});
