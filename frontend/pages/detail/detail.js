const { LOTTERY_MAP, LOTTERY_RULES, BALL_COLORS, LOTTERY_DEFS, generateBatch, scoreColor, parseDisplay } = require('../../utils/lottery');
const { getLatestResult, getTemplates, getLatestPeriod } = require('../../services/lottery-api');
const { safeNavigateTo } = require('../../utils/safe-navigate');

Page({
  data: {
    selectedType: '6+1模式',
    selectedId: 'lhc',
    selectedDef: null,
    curMethod: 'weighted',
    curMethodName: '智能加权',
    curMethodDesc: '历史频次加权 + 多维约束',
    mainRange: [],
    extraRange: [],
    methods: [],
    config: {},
    ballStates: { main: {}, extra: {} },
    dedupEnabled: true,
    count: 1,

    // 结果
    latestResult: null,
    lastBalls: [],
    results: [],
    allHistory: [],
    cumTotal: 0,
    cumDup: 0,
    batchTotal: 0,
    batchDup: 0,

    // 本期已随机号码（去重用）
    currentPeriod: '',
    periodExcludedGroups: [],
    periodTotal: 0,
    periodRemain: 0,
    hasGenerated: false,

    // 规则
    rule: {},
    rulesExpanded: false,

    // 玩法信息
    historyCount: 0,
    weeklyDraws: 0,
    ruleCount: 0,

    // 奇偶比选项
    oddEvenOptions: [],
    oddEvenIndex: 0,
    oddEven3DIndex: 0,
    bigSmall3DIndex: 0,

    // 3D直选高亮
    straightHighlights: [[],[],[]],

    // 七星复式高亮（7位×10数字）
    qxcHighlights: [[],[],[],[],[],[],[]],

    // 导出
    adShow: false,
    adCountdown: 0,
    pendingExport: '', // 'doc' | 'analysis'
    adWatched: false,
    adTimer: null,
  },

  onLoad(options) {
    const type = options.type ? decodeURIComponent(options.type) : '6+1模式';
    const id = LOTTERY_MAP[type]?.id || 'lhc';
    const rule = LOTTERY_RULES[id] || LOTTERY_RULES.lhc;
    const def = LOTTERY_DEFS[id];
    const typeConfig = LOTTERY_MAP[type];

    if (!def) {
      wx.showToast({ title: '未找到玩法配置', icon: 'none' });
      return;
    }

    this._initialId = id;

    // 预计算号码范围（含格式化标签，WXML 不支持函数调用）
    const [mainLo, mainHi] = def.main;
    const mainRange = [];
    const pad = mainLo === 0 ? '' : '0';
    for (let i = mainLo; i <= mainHi; i++) {
      mainRange.push({ value: i, label: pad ? String(i).padStart(2, '0') : String(i) });
    }
    let extraRange = [];
    if (def.extra) {
      const [eLo, eHi] = def.extra;
      for (let i = eLo; i <= eHi; i++) {
        extraRange.push({ value: i, label: String(i).padStart(2, '0') });
      }
    }

    this.setData({
      selectedType: type,
      selectedId: id,
      selectedDef: def,
      curMethod: def.methods[0].id,
      curMethodName: def.methods[0].name,
      curMethodDesc: def.methods[0].desc,
      mainRange,
      extraRange,
      methods: def.methods,
      rule,
      historyCount: 0, // 通过 API /api/v1/templates 动态获取
      weeklyDraws: typeConfig?.weeklyDraws || 3,
      ruleCount: rule?.items?.length || 0,
      config: this._applyMethodDefaults(this.getDefaultConfig(def), def.methods[0].id, def),
      oddEvenOptions: this._getOddEvenOptions(def),
      oddEvenIndex: 0,
      oddEven3DIndex: 0,
      bigSmall3DIndex: 0,
      zoneSelected: [],
    selectedZoneTags: [],
    straightHighlights: this._emptyStraightHighlights(id),
    qxcHighlights: [[],[],[],[],[],[],[]],
      results: [],
      hasGenerated: false,
      currentPeriod: '',
      periodExcludedGroups: [],
    });

    this.loadLatestResult(id);
    this.loadTemplateCounts(id);
    this.loadPeriodExcluded(id);
  },

  // 获取本期已随机号码（用于去重）
  loadPeriodExcluded(id) {
    getLatestPeriod(id).then(period => {
      if (!period) return;
      this.setData({ currentPeriod: period });
      // 从本地存储读取本期已随机过的整组号码
      try {
        const records = wx.getStorageSync('local_records') || [];
        const periodRecords = records.filter(r => r.period === period && r.lottery_code === id);
        if (periodRecords.length) {
          // 把每组号码转成字符串集合，用于快速查重
          const excludedGroups = periodRecords.map(g => {
            const main = (g.main_numbers || []).map(n => String(n)).sort().join(',');
            const extra = g.extra_numbers && g.extra_numbers.length ? g.extra_numbers.map(n => String(n)).sort().join(',') : '';
            return main + (extra ? '|' + extra : '');
          });
          this.setData({ periodExcludedGroups: excludedGroups, periodTotal: periodRecords.length });
          // 计算未随机注数（玩法总组合数 - 已随机数）
          this.calcPeriodRemain(id, periodRecords.length);
        } else {
          this.setData({ periodTotal: 0, periodRemain: 0 });
        }
      } catch (e) {
        this.setData({ periodTotal: 0, periodRemain: 0 });
      }
    }).catch(() => {});
  },

  // 计算剩余组合数
  calcPeriodRemain(id, total) {
    const defs = require('../../utils/lottery').LOTTERY_DEFS;
    const def = defs[id];
    if (!def) { this.setData({ periodRemain: 0 }); return; }
    const mainCombos = comb(def.main[1] - def.main[0] + 1, def.main[2]);
    let extraCombos = 1;
    if (def.extra) {
      // 特码从主码之外的号码中选，所以实际可选范围 = 总号码数 - 主码已选数
      // 但固定用组合数计算近似值，精确值用 (总号码数 - 主码选数) 选 extra 个数
      const totalNums = def.main[1] - def.main[0] + 1;
      const mainCount = def.main[2];
      const extraRange = totalNums - mainCount;
      if (extraRange >= def.extra[2]) {
        extraCombos = comb(extraRange, def.extra[2]);
      } else {
        extraCombos = comb(def.extra[1] - def.extra[0] + 1, def.extra[2]);
      }
    }
    const totalCombos = mainCombos * extraCombos;
    const remain = Math.max(0, totalCombos - total);
    const displayRemain = totalCombos > 10000 ? Math.round(remain / 10000) + '万' : String(remain);
    this.setData({ periodRemain: displayRemain });
  },

  loadTemplateCounts(id) {
    getTemplates().then(list => {
      if (!list || !list.length) return;
      const t = list.find(item => item.id === id);
      if (t && t.historyCount) {
        this.setData({ historyCount: t.historyCount });
      }
    }).catch(() => {});
  },

  getDefaultConfig(def) {
    return {
      ballStates: { main: {}, extra: {} },
      hotcoldPref: 'balanced',
      consecPref: 'normal',
      sumTarget: def.sumMean || 0,
      oddEvenTarget: '',
      zoneSelections: [],
      fushiMain: def.main[2] + 2,
      fushiExtra: def.extra ? def.extra[2] + 1 : 0,
      playN: 10,
      positionPrefs: [],
      digitFilters: {},
      oddEven3D: '',
      bigSmall3D: '',
    };
  },

  // 根据玩法修正默认值
  _applyMethodDefaults(config, methodId, def) {
    if (methodId === 'sum3d') config.sumTarget = 13;
    else if (methodId === 'span3d') config.sumTarget = 5;
    else if (methodId === 'sum' && def) config.sumTarget = def.sumMean || 0;
    return config;
  },

  loadLatestResult(id) {
    getLatestResult(id)
      .then(result => {
        if (!result) return;
        if (!result.parsed) {
          result.parsed = parseDisplay(result.display);
        }
        const decorated = this.decorateParsed(result.parsed, id);
        this.setData({
          latestResult: { ...result, parsed: decorated.groups },
          lastBalls: decorated.flatBalls,
        });
      })
      .catch(() => {});
  },

  decorateParsed(parsed, id) {
    const colors = BALL_COLORS[id] || {};
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
    // 展平为一维数组
    const flatBalls = [];
    (parsed || []).forEach((section, si) => {
      const isSpecial = section.label.includes('特别') || section.label.includes('扩展');
      const isSub = section.label.includes('副') || section.label.includes('后') || section.label.includes('后区') || section.label.includes('蓝') || section.label.includes('特别') || section.label.includes('扩展');
      let cls = colors.main || 'ball-red';
      if (isSpecial && colors.special) cls = colors.special;
      else if (isSub && colors.sub) cls = colors.sub;
      const bg = ballStyleMap[cls] || 'linear-gradient(135deg, #ef4444, #b91c1c)';
      section.numbers.forEach((num, ni) => {
        flatBalls.push({ num, bg, sep: '' });
      });
      if (si < parsed.length - 1) {
        flatBalls.push({ num: '+', bg: 'transparent', sep: 'true' });
      }
    });
    // 七星、七乐：最后一个号码强制改为蓝色
    if (id === 'qxc' || id === 'qlc') {
      for (let i = flatBalls.length - 1; i >= 0; i--) {
        if (!flatBalls[i].sep) {
          flatBalls[i].bg = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
          break;
        }
      }
    }
    return { groups: parsed, flatBalls };
  },

  // 辅助函数
  getMethodDesc() {
    const def = this.data.selectedDef;
    if (!def) return '';
    const method = def.methods.find(m => m.id === this.data.curMethod);
    return method ? method.desc : '';
  },

  rangeList(lo, hi) {
    const arr = [];
    for (let i = lo; i <= hi; i++) arr.push(i);
    return arr;
  },

  // ===== 方法切换 =====
  _getOddEvenOptions(def) {
    const n = def.main[2];
    const half = Math.floor(n / 2);
    const opts = ['不限'];
    opts.push(half + ':' + (n - half));
    opts.push((n - half) + ':' + half);
    if (half > 0) {
      opts.push((half - 1) + ':' + (n - half + 1));
      opts.push((n - half + 1) + ':' + (half - 1));
    }
    return opts;
  },

  switchMethod(e) {
    const methodId = e.currentTarget.dataset.method;
    const def = this.data.selectedDef;
    const method = def.methods.find(m => m.id === methodId);

    // 重新计算号码范围（切换玩法可能需要更新）
    const [mainLo, mainHi] = def.main;
    const mainRange = [];
    for (let i = mainLo; i <= mainHi; i++) {
      mainRange.push({ value: i, label: mainLo === 0 ? String(i) : String(i).padStart(2, '0') });
    }
    let extraRange = [];
    if (def.extra) {
      const [eLo, eHi] = def.extra;
      for (let i = eLo; i <= eHi; i++) {
        extraRange.push({ value: i, label: String(i).padStart(2, '0') });
      }
    }

    const config = this._applyMethodDefaults(this.getDefaultConfig(def), methodId, def);
    console.log('[switchMethod] to ' + methodId + ' zoneSelections=' + JSON.stringify(config.zoneSelections));

    this.setData({
      curMethod: methodId,
      curMethodName: method ? method.name : '',
      curMethodDesc: method ? method.desc : '',
      mainRange,
      extraRange,
      ballStates: { main: {}, extra: {} },
      config,
      oddEvenOptions: this._getOddEvenOptions(def),
      oddEvenIndex: 0,
      oddEven3DIndex: 0,
      bigSmall3DIndex: 0,
      straightHighlights: this._emptyStraightHighlights(),
      qxcHighlights: [[],[],[],[],[],[],[]],
      zoneSelected: [],
      selectedZoneTags: [],
    });
  },

  // ===== 配置更新 =====
  onConfigChange(e) {
    const { key } = e.currentTarget.dataset;
    const value = e.detail.value;
    const config = { ...this.data.config };
    config[key] = value;
    this.setData({ config });
  },

  onConfigNumber(e) {
    const { key } = e.currentTarget.dataset;
    const value = parseInt(e.detail.value) || 0;
    const config = { ...this.data.config };
    config[key] = value;
    this.setData({ config });
  },

  // picker 专用处理
  onPlayNPicker(e) {
    const idx = parseInt(e.detail.value) || 0;
    const config = { ...this.data.config };
    config.playN = idx + 1;
    this.setData({ config });
  },

  onOE3DTag(e) {
    const val = e.currentTarget.dataset.val || '';
    const config = { ...this.data.config };
    config.oddEven3D = val;
    this.setData({ config });
  },

  onBS3DTag(e) {
    const val = e.currentTarget.dataset.val || '';
    const config = { ...this.data.config };
    config.bigSmall3D = val;
    this.setData({ config });
  },

  toggleHotcold(e) {
    const val = e.currentTarget.dataset.val;
    const config = { ...this.data.config };
    config.hotcoldPref = val;
    this.setData({ config });
  },

  onHotcoldPicker(e) {
    const idx = parseInt(e.detail.value) || 0;
    const vals = ['balanced', 'hot', 'cold'];
    const config = { ...this.data.config };
    config.hotcoldPref = vals[idx];
    this.setData({ config });
  },

  onConsecPicker(e) {
    const idx = parseInt(e.detail.value) || 0;
    const vals = ['normal', 'more', 'fewer'];
    const config = { ...this.data.config };
    config.consecPref = vals[idx];
    this.setData({ config });
  },

  onOddEvenPicker(e) {
    const idx = parseInt(e.detail.value) || 0;
    const opts = this.data.oddEvenOptions;
    const config = { ...this.data.config };
    config.oddEvenTarget = idx === 0 ? '' : opts[idx];
    this.setData({ config, oddEvenIndex: idx });
  },

  toggleZone(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    let zs = [...(this.data.zoneSelected || [])];
    console.log('[toggleZone] idx=' + idx + ' before=' + JSON.stringify(zs));
    const i = zs.indexOf(idx);
    if (i >= 0) {
      zs.splice(i, 1);
    } else {
      zs.push(idx);
      zs.sort((a, b) => a - b);
    }
    console.log('[toggleZone] after=' + JSON.stringify(zs));
    this.setData({ zoneSelected: zs, 'config.zoneSelections': zs });
  },

  toggleZone3(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const tags = [...(this.data.selectedZoneTags || [])];
    tags[idx] = !tags[idx];
    let zs = [...(this.data.zoneSelected || [])];
    const i = zs.indexOf(idx);
    if (tags[idx] && i < 0) {
      zs.push(idx);
      zs.sort((a, b) => a - b);
    } else if (!tags[idx] && i >= 0) {
      zs.splice(i, 1);
    }
    this.setData({ selectedZoneTags: tags, zoneSelected: zs, 'config.zoneSelections': zs });
  },

  toggleBall(e) {
    const { prefix, num } = e.currentTarget.dataset;
    const n = String(parseInt(num));
    const bs = { ...this.data.ballStates };
    const section = prefix === 'extra' ? 'extra' : 'main';
    bs[section] = { ...bs[section] };
    const cur = bs[section][n] || 0;
    bs[section][n] = (cur + 1) % 3;
    this.setData({ ballStates: bs });
    console.log('[toggleBall]', section, n, '→', bs[section][n]);
  },

  toggleDedup() {
    this.setData({ dedupEnabled: !this.data.dedupEnabled });
  },

  changeCount(e) {
    const d = parseInt(e.currentTarget.dataset.delta);
    this.setData({ count: Math.max(1, Math.min(50, this.data.count + d)) });
  },

  // ===== 3D 快捷过滤 =====
  toggleDigitFilter(e) {
    const { wkey, filter } = e.currentTarget.dataset;
    const config = { ...this.data.config };
    const filters = { ...(config.digitFilters || {}) };
    if (!filters[wkey]) filters[wkey] = [];
    const arr = [...filters[wkey]];

    if (filter === 'all') {
      const idx = arr.indexOf('all');
      idx >= 0 ? arr.splice(idx, 1) : arr.push('all');
    } else if (filter === 'clr') {
      filters[wkey] = [];
    } else {
      const idx = arr.indexOf(filter);
      if (idx >= 0) {
        arr.splice(idx, 1);
      } else {
        if (filter === 'd' || filter === 'x') {
          const other = filter === 'd' ? 'x' : 'd';
          const oi = arr.indexOf(other);
          if (oi >= 0) arr.splice(oi, 1);
        }
        if (filter === 'j' || filter === 'o') {
          const other = filter === 'j' ? 'o' : 'j';
          const oi = arr.indexOf(other);
          if (oi >= 0) arr.splice(oi, 1);
        }
        arr.push(filter);
      }
    }
    filters[wkey] = arr;
    config.digitFilters = filters;
    this.setData({ config, straightHighlights: this._calcStraightHighlights(filters, this._getStraightDigits()) });
  },

  toggleDigit(e) {
    const { wkey, num } = e.currentTarget.dataset;
    const n = parseInt(num);
    const config = { ...this.data.config };
    const filters = { ...(config.digitFilters || {}) };
    if (!filters[wkey]) filters[wkey] = [];
    const arr = [...filters[wkey]];
    const idx = arr.indexOf(n);
    idx >= 0 ? arr.splice(idx, 1) : arr.push(n);
    filters[wkey] = arr;
    config.digitFilters = filters;
    const straightDigits = this._getStraightDigits();
    const isQxc = this.data.selectedId === 'qxc';
    this.setData({ 
      config, 
      straightHighlights: this._calcStraightHighlights(filters, straightDigits),
      qxcHighlights: isQxc ? this._calcStraightHighlights(filters, 7) : [[],[],[],[],[],[],[]],
    });
  },

  _calcStraightHighlights(filters, digits) {
    digits = digits || 3;
    const highlights = [];
    for (let d = 0; d < digits; d++) {
      highlights[d] = [];
      const wKey = 'w' + (d + 1);
      const f = filters[wKey] || [];
      // 七星/排列五没有快捷过滤，f 中直接存数字
      for (let i = 0; i <= 9; i++) {
        highlights[d][i] = f.includes(i);
      }
    }
    return highlights;
  },

  /** 获取指定玩法或当前玩法的直选位数 */
  _getStraightDigits(id) {
    id = id || this.data.selectedId;
    if (id === 'pl5') return 5;
    if (id === 'qxc') return 7;
    return 3; // fc3d, pl3
  },

  /** 初始化空的高亮数组 */
  _emptyStraightHighlights(id) {
    const digits = this._getStraightDigits(id);
    return Array.from({ length: digits }, () => []);
  },

  // ===== 排列五定位 =====
  onPositionPicker(e) {
    const { idx } = e.currentTarget.dataset;
    const val = parseInt(e.detail.value) - 1; // picker value 0-9, 对应 0-9
    const config = { ...this.data.config };
    const prefs = [...(config.positionPrefs || [])];
    prefs[idx] = val >= 0 ? val : -1;
    config.positionPrefs = prefs;
    this.setData({ config });
  },

  // ===== 导出 =====
  showExportDoc() {
    this._openAd('doc');
  },
  showExportAnalysis() {
    this._openAd('analysis');
  },

  // 导出已随机号码
  exportPeriod() {
    const id = this.data.selectedId;
    const period = this.data.currentPeriod;
    if (!period) { wx.showToast({ title: '暂无组号', icon: 'none' }); return; }
    
    try {
      const allRecords = wx.getStorageSync('local_records') || [];
      const records = allRecords.filter(r => r.period === period && r.lottery_code === id);
      
      if (!records.length) {
        wx.showToast({ title: '本组暂无已随机号码', icon: 'none' });
        return;
      }
      
      const now = new Date();
      const dateStr = now.toLocaleDateString('zh-CN');
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

      let txt = '═══════════════════════════════════════\n';
      txt += '  智能随机助手 - 本组已随机号码\n';
      txt += '  玩法：' + this.data.selectedType + '\n';
      txt += '  组号：' + period + '\n';
      txt += '  导出时间：' + dateStr + ' ' + timeStr + '\n';
      txt += '  共 ' + records.length + ' 注\n';
      txt += '═══════════════════════════════════════\n\n';

      records.forEach((r, i) => {
        const main = (r.main_numbers || []).map(n => String(n).padStart(2, '0')).join(' ');
        const extra = r.extra_numbers ? ' + ' + r.extra_numbers.map(n => String(n).padStart(2, '0')).join(' ') : '';
        txt += '第 ' + (i + 1) + ' 注：' + main + extra + '\n';
      });

      txt += '\n═══════════════════════════════════════\n';
      txt += '  仅供参考 · 理性娱乐 · 量力而行\n';
      txt += '═══════════════════════════════════════';

      const safeName = (this.data.selectedType + '_已随机_' + period).replace(/[/\\?%*:|"<>]/g, '_');
      this._exportTxt(txt, safeName);
    } catch (e) {
      wx.showToast({ title: '获取数据失败', icon: 'none' });
    }
  },

  // 导出推荐号码（排除已随机）
  exportRecommend() {
    const id = this.data.selectedId;
    const period = this.data.currentPeriod;
    if (!period) { wx.showToast({ title: '暂无组号', icon: 'none' }); return; }

    // 重新生成排除已随机后的推荐号码
    const def = this.data.selectedDef;
    if (!def) { wx.showToast({ title: '未找到玩法配置', icon: 'none' }); return; }

    try {
      const allRecords = wx.getStorageSync('local_records') || [];
      const periodRecords = allRecords.filter(r => r.period === period && r.lottery_code === id);
      const now = new Date();
      const dateStr = now.toLocaleDateString('zh-CN');
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

      let txt = '═══════════════════════════════════════\n';
      txt += '  智能随机助手 - 推荐号码\n';
      txt += '  玩法：' + this.data.selectedType + '\n';
      txt += '  组号：' + period + '\n';
      txt += '  导出时间：' + dateStr + ' ' + timeStr + '\n';

      const excludedGroups = periodRecords.length ? periodRecords.map(g => {
        const main = (g.main_numbers || []).map(n => String(n)).sort().join(',');
        const extra = g.extra_numbers ? g.extra_numbers.map(n => String(n)).sort().join(',') : '';
        return main + (extra ? '|' + extra : '');
      }) : [];

      const config = { ...this.data.config, excludedGroups };
      const result = generateBatch(id, this.data.curMethod, Math.min(this.data.count || 5, 20), config, true);

      if (result && result.items.length) {
        txt += '  共推荐 ' + result.items.length + ' 注（已排除本组已随机号码）\n';
        txt += '═══════════════════════════════════════\n\n';
        result.items.forEach((item, i) => {
          const main = item.result.main.map(n => String(n).padStart(2, '0')).join(' ');
          const extra = item.result.extra && item.result.extra.length ? ' + ' + item.result.extra.map(n => String(n).padStart(2, '0')).join(' ') : '';
          txt += '第 ' + (i + 1) + ' 注：' + main + extra + '\n';
        });
      } else {
        txt += '  本组所有组合已被覆盖，以下为随机推荐\n';
        txt += '═══════════════════════════════════════\n\n';
        // 降级：普通随机
        for (let i = 0; i < 5; i++) {
          const raw = require('../../utils/lottery').generateOne(id);
          const main = (raw.main || []).map(n => String(n).padStart(2, '0')).join(' ');
          const extra = raw.extra && raw.extra.length ? ' + ' + raw.extra.map(n => String(n).padStart(2, '0')).join(' ') : '';
          txt += '第 ' + (i + 1) + ' 注：' + main + extra + '\n';
        }
      }

      txt += '\n═══════════════════════════════════════\n';
      txt += '  仅供参考 · 理性娱乐 · 量力而行\n';
      txt += '═══════════════════════════════════════';

      const safeName = (this.data.selectedType + '_推荐_' + period).replace(/[/\\?%*:|"<>]/g, '_');
      this._exportTxt(txt, safeName);
    } catch (e) {
      wx.showToast({ title: '获取数据失败', icon: 'none' });
    }
  },

  // 通用导出函数
  _exportTxt(txt, filename) {
    const fs = wx.getFileSystemManager();
    const filePath = wx.env.USER_DATA_PATH + '/' + filename + '.txt';
    try {
      fs.writeFileSync(filePath, txt, 'utf-8');
      wx.openDocument({
        filePath: filePath,
        fileType: 'txt',
        showMenu: true,
        success: () => {
          wx.showToast({ title: '导出成功', icon: 'success' });
        },
        fail: (err) => {
          console.warn('openDocument fail:', err);
          wx.showModal({
            title: '导出提示',
            content: '文件已生成，请在文件管理器中查看或复制内容',
            showCancel: true,
            cancelText: '关闭',
            confirmText: '复制内容',
            success: (res) => {
              if (res.confirm) {
                wx.setClipboardData({
                  data: txt,
                  success: () => wx.showToast({ title: '已复制', icon: 'success' }),
                });
              }
            },
          });
        },
      });
    } catch (e) {
      console.warn('writeFile fail:', e);
      wx.showModal({
        title: '导出提示',
        content: '文件生成失败，请复制内容',
        showCancel: true,
        cancelText: '关闭',
        confirmText: '复制内容',
        success: (res) => {
          if (res.confirm) {
            wx.setClipboardData({
              data: txt,
              success: () => wx.showToast({ title: '已复制', icon: 'success' }),
            });
          }
        },
      });
    }
  },

  exportSummary() {
    const id = this.data.selectedId;
    try {
      const allRecords = wx.getStorageSync('local_records') || [];
      const records = allRecords.filter(r => r.lottery_code === id);
      
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const filename = this.data.selectedType + '_汇总_' + (records.length ? records[0].period || '无' : '无') + '_' + dateStr + '.txt';

      let txt = '═══════════════════════════════════════\n';
      txt += '  本组汇总 - ' + this.data.selectedType + '\n';
      txt += '  最新一组：' + (records.length ? records[0].period || '无' : '无') + '\n';
      txt += '  示例日期：' + (records.length ? new Date(records[0].created_at).toLocaleDateString('zh-CN') : '无') + '\n';
      txt += '  导出时间：' + now.toLocaleString('zh-CN') + '\n';
      txt += '  用户号码：' + records.length + ' 注\n';
      txt += '═══════════════════════════════════════\n\n';

      if (records.length) {
        records.forEach((r, i) => {
          const ms = (r.main_numbers || []).map(n => String(n).padStart(2, '0')).join(' ');
          const es = r.extra_numbers && r.extra_numbers.length
            ? ' + ' + r.extra_numbers.map(n => String(n).padStart(2, '0')).join(' ') : '';
          txt += '第 ' + (i + 1) + ' 注：' + ms + es + '\n';
          txt += '  玩法：' + (r.method_name || '智能加权') + ' | 得分：' + (r.score || 0) + '/100\n\n';
        });
      }

      txt += '═══════════════════════════════════════\n';
      txt += '  仅供参考 · 理性娱乐 · 量力而行\n';
      txt += '═══════════════════════════════════════';

      // 写入临时文件并打开，用户可通过右上角菜单保存
      const fs = wx.getFileSystemManager();
      const filePath = wx.env.USER_DATA_PATH + '/' + filename;
      fs.writeFileSync(filePath, txt, 'utf-8');
      wx.openDocument({
        filePath: filePath,
        fileType: 'txt',
        showMenu: true,
        success: () => {
          wx.showToast({ title: '导出成功', icon: 'success' });
        },
        fail: (err) => {
          wx.showModal({
            title: '导出提示',
            content: '文件已生成，请复制内容手动保存',
            success: (res) => {
              if (res.confirm) {
                wx.setClipboardData({
                  data: txt,
                  success: () => wx.showToast({ title: '已复制', icon: 'success' }),
                });
              }
            },
          });
        },
      });
    } catch (e) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  _openAd(type) {
    this.setData({
      adShow: true,
      adCountdown: 5,
      pendingExport: type,
      adWatched: false,
    });
    const timer = setInterval(() => {
      const sec = this.data.adCountdown - 1;
      if (sec <= 0) {
        clearInterval(timer);
        this.setData({ adCountdown: 0, adWatched: true });
      } else {
        this.setData({ adCountdown: sec });
      }
    }, 1000);
    this.data.adTimer = timer;
  },

  closeAdOutside(e) {
    // 点击遮罩关闭：如果广告已看完则关闭，否则提示
    if (this.data.adWatched) {
      if (this.data.adTimer) clearInterval(this.data.adTimer);
      this.setData({ adShow: false });
      if (this.data.pendingExport === 'doc') {
        this._exportDoc();
      } else {
        this._exportAnalysis();
      }
    } else {
      wx.showToast({ title: '请等待广告完成', icon: 'none' });
    }
  },

  closeAd() {
    if (!this.data.adWatched) {
      wx.showToast({ title: '请完整观看广告', icon: 'none' });
      return;
    }
    if (this.data.adTimer) clearInterval(this.data.adTimer);
    this.setData({ adShow: false });
    if (this.data.pendingExport === 'doc') {
      this._exportDoc();
    } else {
      this._exportAnalysis();
    }
  },

  _exportDoc() {
    const allHistory = this.data.allHistory;
    if (!allHistory.length) {
      wx.showToast({ title: '暂无号码可导出', icon: 'none' });
      return;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString('zh-CN');
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    let txt = '═══════════════════════════════════════\n';
    txt += ' 智能随机 - 全部号码导出\n';
    txt += ' 导出时间：' + dateStr + ' ' + timeStr + '\n';
    txt += ' 累计生成 ' + this.data.cumTotal + ' 注，重复 ' + this.data.cumDup + ' 注\n';
    txt += ' 有效号码 ' + allHistory.length + ' 注\n';
    txt += '═══════════════════════════════════════\n\n';

    allHistory.forEach((item, i) => {
      const ms = item.result.main.map(n => String(n).padStart(2, '0')).join(' ');
      const es = item.result.extra && item.result.extra.length
        ? ' + ' + item.result.extra.map(n => String(n).padStart(2, '0')).join(' ') : '';
      txt += '第 ' + (i + 1) + ' 注：' + ms + es + '\n';
      txt += '  得分：' + item.score.overall + '/100\n';
      const dimStr = Object.entries(item.score.dims || {}).map(([k, v]) => k + ':' + v).join(' ');
      txt += '  ' + dimStr + '\n\n';
    });

    txt += '═══════════════════════════════════════\n';
    txt += ' 仅供参考 · 理性娱乐 · 量力而行\n';
    txt += '═══════════════════════════════════════';

    wx.setClipboardData({
      data: txt,
      success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'success' }),
    });
  },

  _exportAnalysis() {
    const allHistory = this.data.allHistory;
    if (!allHistory.length) {
      wx.showToast({ title: '暂无号码可导出', icon: 'none' });
      return;
    }
    // 简化版：复制统计摘要到剪贴板
    const def = this.data.selectedDef;
    const now = new Date();
    let txt = '═══════════════════════════════════════\n';
    txt += ' 随机号码统计报告\n';
    txt += ' 玩法：' + this.data.selectedType + '\n';
    txt += ' 导出时间：' + now.toLocaleDateString('zh-CN') + ' ' + now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) + '\n';
    txt += ' 累计生成 ' + allHistory.length + ' 注\n';
    txt += '═══════════════════════════════════════\n\n';

    // 号码覆盖统计
    const [lo, hi] = def.main;
    const coverage = {};
    for (let i = lo; i <= hi; i++) coverage[i] = 0;
    allHistory.forEach(item => {
      item.result.main.forEach(n => { if (coverage[n] !== undefined) coverage[n]++; });
      if (item.result.extra) {
        item.result.extra.forEach(n => { if (coverage[n] !== undefined) coverage[n]++; });
      }
    });

    txt += '── 号码覆盖统计 ──\n';
    const sorted = Object.entries(coverage).sort((a, b) => b[1] - a[1]);
    const maxVal = Math.max(...Object.values(coverage), 1);
    sorted.forEach(([num, count]) => {
      const bar = '█'.repeat(Math.min(Math.ceil(count / maxVal * 20), 20));
      txt += '  ' + String(num).padStart(2, '0') + ' ' + bar + ' ' + count + '次\n';
    });

    txt += '\n── 遗漏号码 ──\n';
    const missing = Object.entries(coverage).filter(([_, c]) => c === 0).map(([n]) => n);
    txt += missing.length ? missing.map(n => String(n).padStart(2, '0')).join(', ') : '无遗漏号码\n';

    txt += '\n═══════════════════════════════════════\n';
    txt += ' 仅供参考 · 理性娱乐 · 量力而行\n';
    txt += '═══════════════════════════════════════';

    wx.setClipboardData({
      data: txt,
      success: () => wx.showToast({ title: '统计报告已复制', icon: 'success' }),
    });
  },

  // ===== 生成 =====
  generate() {
    try {
      const def = this.data.selectedDef;
      if (!def) {
        wx.showToast({ title: '配置错误：未找到玩法定义', icon: 'none' });
        return;
      }
      const zoneSel = this.data.zoneSelected || [];
      console.log('[generate] method=' + this.data.curMethod + ' zoneSelected=' + JSON.stringify(zoneSel));
      const config = {
        ...this.data.config,
        ballStates: this.data.ballStates,
        zoneSelections: zoneSel,
        excludedGroups: this.data.periodExcludedGroups || [], // 传入本期已随机整组号码用于排除
      };
      const result = generateBatch(this.data.selectedId, this.data.curMethod, this.data.count, config, this.data.dedupEnabled);
      if (!result || !result.items.length) {
        wx.showToast({ title: '生成失败，请重试', icon: 'none' });
        return;
      }

    // 预计算评分颜色（WXML 无法直接调用模块函数，且 wx:for 不支持对象）
    const items = result.items.map(item => {
      const color = scoreColor(item.score.overall);
      const dimList = Object.entries(item.score.dims).map(([name, value]) => ({
        name,
        value,
        color: scoreColor(value),
      }));
      return {
        ...item,
        result: {
          main: item.result.main.map(n => String(n).padStart(2, '0')),
          extra: item.result.extra ? item.result.extra.map(n => String(n).padStart(2, '0')) : null,
        },
        score: {
          ...item.score,
          color,
          dimList,
        },
      };
    });

    const newHistory = items.map(item => ({
      type: this.data.selectedType,
      method: this.data.curMethodName,
      result: item.result,
      score: item.score,
    }));

    const allHistory = [...newHistory, ...this.data.allHistory].slice(0, 500);

    this.setData({
      results: items,
      hasGenerated: true,
      batchTotal: result.totalAttempts,
      batchDup: result.duplicateCount,
      cumTotal: this.data.cumTotal + result.totalAttempts,
      cumDup: this.data.cumDup + result.duplicateCount,
      allHistory,
    });

    console.log('[generate] success: items=' + items.length + ' hasGenerated=' + true);

    // 自动将本期生成的每组号码保存到本地存储
    const period = this.data.currentPeriod;
    if (period) {
      const records = items.map(item => ({
        id: Date.now() + Math.random(),
        lottery_code: this.data.selectedId,
        type: this.data.selectedType,
        method_id: this.data.curMethod,
        method_name: this.data.curMethodName,
        main_numbers: item.result.main.map(n => parseInt(n)),
        extra_numbers: item.result.extra ? item.result.extra.map(n => parseInt(n)) : null,
        display_text: item.result.main.join(' ') + (item.result.extra && item.result.extra.length ? ' + ' + item.result.extra.join(' ') : ''),
        score: item.score.overall,
        score_dims: item.score.dims,
        source: 'manual',
        period,
        created_at: new Date().toISOString(),
        favorite: false,
      }));
      
      // 保存到本地存储
      try {
        const existingRecords = wx.getStorageSync('local_records') || [];
        const newRecords = [...records, ...existingRecords];
        wx.setStorageSync('local_records', newRecords.slice(0, 1000)); // 只保留1000条记录
        this.loadPeriodExcluded(this.data.selectedId);
      } catch (e) {
        console.error('保存失败', e);
      }
    }

    wx.showToast({ title: `已生成 ${result.items.length} 注`, icon: 'success' });
    } catch (err) {
      console.error('[generate] error:', err);
      wx.showToast({ title: '生成出错: ' + (err.message || '未知错误'), icon: 'none', duration: 3000 });
    }
  },

  // ===== 复制 =====
  copyResult(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    const item = this.data.results[idx];
    if (!item) return;
    const mainStr = item.result.main.join(' ');
    const extraStr = item.result.extra && item.result.extra.length ? ' + ' + item.result.extra.join(' ') : '';
    wx.setClipboardData({
      data: mainStr + extraStr,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  // ===== 收藏/保存 =====
  toggleStar(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    const results = [...this.data.results];
    if (!results[idx]) return;
    results[idx] = { ...results[idx], starred: !results[idx].starred };
    this.setData({ results });
    wx.showToast({ title: results[idx].starred ? '已收藏' : '已取消', icon: 'none' });
  },

  saveAll() {
    const results = this.data.results.filter(r => r);
    if (!results.length) { wx.showToast({ title: '请先生成号码', icon: 'none' }); return; }

    const period = this.data.currentPeriod || '';
    const records = results.map(item => ({
      id: Date.now() + Math.random(),
      lottery_code: this.data.selectedId,
      type: this.data.selectedType,
      method_id: this.data.curMethod,
      method_name: this.data.curMethodName,
      main_numbers: item.result.main.map(n => parseInt(n)),
      extra_numbers: item.result.extra ? item.result.extra.map(n => parseInt(n)) : null,
      display_text: item.result.main.join(' ') + (item.result.extra && item.result.extra.length ? ' + ' + item.result.extra.join(' ') : ''),
      score: item.score.overall,
      score_dims: item.score.dims,
      source: 'manual',
      period,
      created_at: new Date().toISOString(),
      favorite: false,
    }));

    try {
      const existingRecords = wx.getStorageSync('local_records') || [];
      const newRecords = [...records, ...existingRecords];
      wx.setStorageSync('local_records', newRecords.slice(0, 1000));
      wx.showToast({ title: `已保存 ${records.length} 注`, icon: 'success' });
      // 标记为已保存
      const newResults = this.data.results.map(r => ({ ...r, saved: true }));
      this.setData({ results: newResults });
      // 保存成功后，刷新本期已随机号码
      this.loadPeriodExcluded(this.data.selectedId);
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // ===== 规则 =====
  toggleRules() {
    this.setData({ rulesExpanded: !this.data.rulesExpanded });
  },

  // ===== 导航 =====
  goResult() {
    safeNavigateTo(`/pages/result/result?type=${encodeURIComponent(this.data.selectedType)}`);
  },
  goAnalysis() {
    safeNavigateTo(`/pages/analysis/analysis?type=${encodeURIComponent(this.data.selectedType)}`);
  },
});

// 组合数计算 C(n, k)
function comb(n, k) {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = result * (n - k + i) / i;
  }
  return result;
}
