// ===== 智能选号引擎 =====
// 基于 PRD v1.1 和 HTML 预览版核心算法移植

const { LOTTERY_MAP } = require('./config');

// ==================== 玩法定义（含区间/维度/权重） ====================
const LOTTERY_DEFS = {
  lhc: {
    name:'六合', accent:'#B83280',
    main:[1,49,6,'#B83280','正码'], extra:[1,49,1,'#D69E2E','特码'],
    methods:[
      {id:'weighted',name:'智能加权',desc:'历史频次加权 + 多维约束'},
      {id:'dantuo',name:'胆拖选号',desc:'锁定胆码，其余随机'},
      {id:'fushi',name:'复式选号',desc:'扩大选号池，筛选最优'},
      {id:'sum',name:'和值选号',desc:'指定6码和值'},
      {id:'oddeven',name:'奇偶比',desc:'指定奇偶比例'},
      {id:'zone',name:'区间选号',desc:'指定五区出号（可多选）'},
      {id:'hotcold',name:'冷热倾向',desc:'热号/冷号/均衡'},
      {id:'consec',name:'连号倾向',desc:'控制连号数量'},
    ],
    zones:[[1,10],[11,20],[21,30],[31,40],[41,49]],
    zoneNames:['1-10','11-20','21-30','31-40','41-49'],
    dims:['和值','奇偶比','区间','冷热','连号','跨度','特码'],
    dimW:[25,20,20,15,10,5,5], sumMean:150, sumStd:30,
  },
  ssq: {
    name:'双色', accent:'#C53030',
    main:[1,33,6,'#E53E3E','红球'], extra:[1,16,1,'#3182CE','蓝球'],
    methods:[
      {id:'weighted',name:'智能加权',desc:'基于历史频次加权随机 + 多维约束过滤'},
      {id:'dantuo',name:'胆拖选号',desc:'锁定胆码（必出号码），其余随机补全'},
      {id:'fushi',name:'复式选号',desc:'扩大选号池，筛选最优'},
      {id:'sum',name:'和值选号',desc:'指定红球和值范围'},
      {id:'oddeven',name:'奇偶比',desc:'指定红球奇偶比例'},
      {id:'zone',name:'区间选号',desc:'指定出号区间（三区可多选）'},
      {id:'hotcold',name:'冷热倾向',desc:'偏好热号/冷号/均衡'},
      {id:'consec',name:'连号倾向',desc:'控制连号数量'},
    ],
    zones:[[1,11],[12,22],[23,33]], zoneNames:['一区1-11','二区12-22','三区23-33'],
    dims:['和值','奇偶比','区间','冷热','连号','跨度','蓝球'],
    dimW:[25,20,20,15,10,5,5], sumMean:102, sumStd:25,
  },
  dlt: {
    name:'乐透', accent:'#C53030',
    main:[1,35,5,'#E53E3E','前区'], extra:[1,12,2,'#3182CE','后区'],
    methods:[
      {id:'weighted',name:'智能加权',desc:'基于历史频次加权随机 + 多维约束过滤'},
      {id:'dantuo',name:'胆拖选号',desc:'锁定胆码，其余随机补全'},
      {id:'fushi',name:'复式选号',desc:'扩大选号池，筛选最优'},
      {id:'sum',name:'和值选号',desc:'指定前区和值范围'},
      {id:'oddeven',name:'奇偶比',desc:'指定前区奇偶比例'},
      {id:'zone',name:'区间选号',desc:'指定出号区间（五区可多选）'},
      {id:'hotcold',name:'冷热倾向',desc:'热号/冷号/均衡'},
      {id:'consec',name:'连号倾向',desc:'控制连号数量'},
    ],
    zones:[[1,7],[8,14],[15,21],[22,28],[29,35]],
    zoneNames:['一区1-7','二区8-14','三区15-21','四区22-28','五区29-35'],
    dims:['和值','奇偶比','区间','冷热','连号','跨度','后区'],
    dimW:[25,20,20,15,10,5,5], sumMean:86, sumStd:22,
  },
  fc3d: {
    name:'3D数字', accent:'#9C4221',
    main:[0,9,3,'#E53E3E','号码'], extra:null,
    methods:[
      {id:'straight',name:'直选',desc:'每位0-9独立选取'},
      {id:'group3',name:'组三',desc:'一对+单号形态'},
      {id:'group6',name:'组六',desc:'三个完全不同数字'},
      {id:'sum3d',name:'和值',desc:'指定三位和值（0-27）'},
      {id:'span3d',name:'跨度',desc:'指定跨度（0-9）'},
      {id:'oddeven3d',name:'奇偶形态',desc:'8种奇偶形态'},
      {id:'bigsmall',name:'大小形态',desc:'大=5-9,小=0-4'},
    ],
    dims:['和值','跨度','形态','冷热'], dimW:[30,25,25,20],
    sumMean:13.5, sumStd:5,
  },
  pl3: {
    name:'排列三', accent:'#9C4221',
    main:[0,9,3,'#E53E3E','号码'], extra:null,
    methods:[
      {id:'straight',name:'直选',desc:'每位0-9独立选取'},
      {id:'group3',name:'组三',desc:'一对+单号形态'},
      {id:'group6',name:'组六',desc:'三个完全不同数字'},
      {id:'sum3d',name:'和值',desc:'指定三位和值'},
      {id:'span3d',name:'跨度',desc:'指定跨度（0-9）'},
      {id:'oddeven3d',name:'奇偶形态',desc:'8种奇偶形态'},
      {id:'bigsmall',name:'大小形态',desc:'大=5-9,小=0-4'},
    ],
    dims:['和值','跨度','形态','冷热'], dimW:[30,25,25,20],
    sumMean:13.5, sumStd:5,
  },
  pl5: {
    name:'排列五', accent:'#9C4221',
    main:[0,9,5,'#E53E3E','号码'], extra:null,
    methods:[
      {id:'weighted',name:'智能加权',desc:'逐位独立加权随机'},
      {id:'position',name:'定位选号',desc:'逐位锁定，未锁随机'},
      {id:'sum',name:'和值选号',desc:'指定五位和值范围'},
    ],
    dims:['每位','和值','重复控制'], dimW:[60,20,20],
    sumMean:22.5, sumStd:7,
  },
  qlc: {
    name:'七乐', accent:'#276749',
    main:[1,30,7,'#E53E3E','号码'], extra:[1,30,1,'#3182CE','特码'],
    methods:[
      {id:'weighted',name:'智能加权',desc:'历史频次加权随机'},
      {id:'dantuo',name:'胆拖选号',desc:'锁定胆码，其余随机'},
      {id:'fushi',name:'复式选号',desc:'扩大选号池'},
      {id:'sum',name:'和值选号',desc:'指定7球和值'},
      {id:'oddeven',name:'奇偶比',desc:'指定奇偶比例'},
      {id:'zone',name:'区间选号',desc:'指定出号区间'},
      {id:'hotcold',name:'冷热倾向',desc:'热号/冷号/均衡'},
    ],
    zones:[[1,10],[11,20],[21,30]], zoneNames:['一区1-10','二区11-20','三区21-30'],
    dims:['和值','奇偶比','区间','冷热','连号','跨度'], dimW:[30,20,20,15,10,5],
    sumMean:108, sumStd:20,
  },
  kl8: {
    name:'快8', accent:'#553C9A',
    main:[1,80,10,'#E53E3E','选号'], extra:null,
    methods:[
      {id:'playN',name:'玩法选择',desc:'选一至选十'},
      {id:'weighted',name:'智能加权',desc:'80个号冷热加权'},
      {id:'zone',name:'区间覆盖',desc:'均匀覆盖八区'},
      {id:'hotcold',name:'冷热倾向',desc:'热号/冷号/均衡'},
    ],
    zones:[[1,10],[11,20],[21,30],[31,40],[41,50],[51,60],[61,70],[71,80]],
    zoneNames:['01-10','11-20','21-30','31-40','41-50','51-60','61-70','71-80'],
    dims:['区间覆盖','冷热','和值','奇偶比','连号'], dimW:[35,25,20,15,5],
    sumMean:405, sumStd:45,
  },
  qxc: {
    name:'七星', accent:'#6366f1',
    main:[0,9,6,'#E53E3E','前区'], extra:[0,9,1,'#3182CE','后区'],
    methods:[
      {id:'weighted',name:'智能加权',desc:'逐位独立加权随机'},
      {id:'qxc_front',name:'前六位复式',desc:'前六位可多选，最后一位单选'},
      {id:'qxc_last',name:'最后一位复式',desc:'前六位单选，最后一位可多选'},
      {id:'qxc_full',name:'全复式',desc:'七位均可多选'},
    ],
    dims:['每位','和值','重复控制'], dimW:[60,20,20],
    sumMean:31.5, sumStd:8,
  },
};

// ==================== 真实频率数据（从后端 API 拉取） ====================
let _freqCache = {};
let _freqPromise = null;

/**
 * 从后端 GET /api/v1/stats 拉取真实冷热统计数据
 * 按 number_statistics 表的 appear_count 排序，取前 30% 为热号，后 30% 为冷号
 */
async function _loadRealFreq() {
  if (_freqPromise) return _freqPromise;
  _freqPromise = (async () => {
    try {
      const { request } = require('../../services/request');
      const types = Object.keys(LOTTERY_DEFS);
      const results = await Promise.allSettled(
        types.map(id =>
          request({ path: '/api/v1/stats', query: { typeId: id } })
            .then(stats => ({ id, stats }))
            .catch(() => ({ id, stats: [] }))
        )
      );
      results.forEach(r => {
        if (r.status !== 'fulfilled') return;
        const { id, stats } = r.value;
        if (!stats || !stats.length) return;
        const def = LOTTERY_DEFS[id];
        if (!def) return;
        const [lo, hi] = def.main;
        const freq = {};
        stats.forEach(s => {
          const n = s.number_value;
          if (n >= lo && n <= hi) {
            freq[n] = s.appear_count || 0;
          }
        });
        // 按 appear_count 降序排序
        const arr = Object.entries(freq).map(([k, v]) => [+k, v]).sort((a, b) => b[1] - a[1]);
        const n = hi - lo + 1;
        const hotCount = Math.max(1, Math.floor(n * 0.3));
        const coldStart = Math.max(1, Math.floor(n * 0.7));
        const hot = arr.slice(0, hotCount).map(e => e[0]);
        const cold = arr.slice(coldStart).map(e => e[0]);
        _freqCache[id] = { freq, hc: { hot, cold } };
      });
    } catch (e) {
      // 网络错误时静默保留空缓存
    }
  })();
  return _freqPromise;
}

/**
 * 获取冷热频率数据
 * 优先从缓存读取，无缓存时尝试拉取 API，仍失败则返回空数据
 */
function getMockFreq(typeId) {
  if (_freqCache[typeId]) return _freqCache[typeId];
  const def = LOTTERY_DEFS[typeId];
  if (!def) return { freq: {}, hc: { hot: [], cold: [] } };
  // 尝试异步拉取（非阻塞，后续调用会拿到数据）
  _loadRealFreq().catch(() => {});
  // 返回空频率，让生成器走随机 fallback
  return { freq: {}, hc: { hot: [], cold: [] } };
}

/**
 * 强制刷新频率缓存
 */
function refreshFreq() {
  _freqPromise = null;
  _freqCache = {};
  _loadRealFreq().catch(() => {});
}

// 在模块加载时自动尝试拉取真实数据
_loadRealFreq().catch(() => {});

// ==================== 工具函数 ====================
function weightedPick(candidates, weights, n) {
  const pool = [...candidates], wt = [...weights], res = [];
  for (let i = 0; i < n; i++) {
    const tot = wt.reduce((a, b) => a + b, 0);
    if (tot <= 0) { res.push(pool[Math.floor(Math.random() * pool.length)]); continue; }
    let r = Math.random() * tot, idx = 0;
    for (; idx < pool.length; idx++) { r -= wt[idx]; if (r <= 0) break; }
    if (idx >= pool.length) idx = pool.length - 1;
    res.push(pool[idx]);
    pool.splice(idx, 1);
    wt.splice(idx, 1);
  }
  return res.sort((a, b) => a - b);
}

function calcWeights(def, hc, extra, config) {
  const [lo, hi] = extra && def.extra ? def.extra : def.main;
  const ballStates = config.ballStates || {};
  const states = extra ? (ballStates.extra || {}) : (ballStates.main || {});
  const hotcoldPref = config.hotcoldPref || 'balanced';
  const w = [];
  for (let i = lo; i <= hi; i++) {
    let v = 1.0;
    if (states[i] === 2) { w.push(0); continue; }
    if (hotcoldPref === 'hot') {
      if (hc.hot.includes(i)) v = 2.2;
      else if (hc.cold.includes(i)) v = 0.3;
    } else if (hotcoldPref === 'cold') {
      if (hc.cold.includes(i)) v = 2.2;
      else if (hc.hot.includes(i)) v = 0.3;
    } else {
      if (hc.hot.includes(i)) v = 1.7;
      else if (hc.cold.includes(i)) v = 1.3;
    }
    v += (Math.random() - 0.5) * 0.3;
    w.push(Math.max(0.05, v));
  }
  return w;
}

function checkMain(def, main) {
  if (!main || main.length !== def.main[2]) return false;
  if ([3, 5, 7].includes(def.main[2]) && def.main[0] === 0) return true;
  const sum = main.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - def.sumMean) > 2 * def.sumStd) return false;
  if (def.zones) {
    const zc = def.zones.map(z => main.filter(x => x >= z[0] && x <= z[1]).length);
    if (zc.filter(c => c > 0).length < Math.max(2, Math.floor(def.zones.length * 0.5))) return false;
  }
  const span = main[main.length - 1] - main[0];
  if (span > (def.main[1] - def.main[0]) * 0.92) return false;
  return true;
}

// ==================== 各玩法生成器 ====================
function genWeighted(def, hc, config) {
  for (let att = 0; att < 100; att++) {
    const [lo, hi] = def.main;
    const cand = []; for (let i = lo; i <= hi; i++) cand.push(i);
    const w = calcWeights(def, hc, false, config);
    const main = weightedPick(cand, w, def.main[2]);
    if (!checkMain(def, main)) continue;
    let extra = null;
    if (def.extra) {
      const [elo, ehi] = def.extra;
      const ec = []; for (let i = elo; i <= ehi; i++) ec.push(i);
      extra = weightedPick(ec, calcWeights(def, hc, true, config), def.extra[2]);
    }
    return { main, extra };
  }
  return fallback(def);
}

function genDantuo(def, hc, config) {
  const bold = Object.entries(config.ballStates.main || {}).filter(([k, v]) => v === 1).map(([k]) => +k);
  if (bold.length === 0 || bold.length >= def.main[2]) return genWeighted(def, hc, config);
  const need = def.main[2] - bold.length;
  const [lo, hi] = def.main;
  const pool = []; for (let i = lo; i <= hi; i++) { if (!bold.includes(i) && (config.ballStates.main || {})[i] !== 2) pool.push(i); }
  if (pool.length < need) return genWeighted(def, hc, config);
  const w = pool.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.7; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
  const main = [...bold, ...weightedPick(pool, w, need)].sort((a, b) => a - b);
  // 胆拖选号不执行 checkMain 的区间检查，因为用户已手动指定胆码
  let extra = null;
  if (def.extra) {
    const eb = Object.entries(config.ballStates.extra || {}).filter(([k, v]) => v === 1).map(([k]) => +k);
    const [elo, ehi] = def.extra;
    const ep = []; for (let i = elo; i <= ehi; i++) { if (!eb.includes(i) && (config.ballStates.extra || {})[i] !== 2) ep.push(i); }
    const eneed = def.extra[2] - eb.length;
    extra = eneed > 0 && ep.length >= eneed ? [...eb, ...weightedPick(ep, ep.map(() => 1 + Math.random() * 0.3), eneed)].sort((a, b) => a - b) : [...eb].sort((a, b) => a - b);
  }
  return { main, extra };
}

function genFushi(def, hc, config) {
  // 复式选号：用户选中号码（v===1）必须出现在结果中
  // 如果选中数量 ≥ 需要数量 → 从选中号码中随机抽
  // 如果选中数量 < 需要数量 → 全部保留，再从全号码池补充
  const [lo, hi] = def.main;
  const need = def.main[2];
  const picked = Object.entries(config.ballStates.main || {})
    .filter(([k, v]) => v === 1)
    .map(([k]) => +k)
    .filter(n => n >= lo && n <= hi);

  console.log('[genFushi] picked:', JSON.stringify(picked), 'need:', need);
  let main;
  if (picked.length >= need) {
    // 选中足够多，从选中号码中随机抽
    const pool = [...picked];
    const result = [];
    for (let i = 0; i < need; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      result.push(pool.splice(idx, 1)[0]);
    }
    main = result.sort((a, b) => a - b);
  } else {
    // 选中不够，全部保留，从全号码池补充
    const cand = [];
    for (let i = lo; i <= hi; i++) {
      if ((config.ballStates.main || {})[i] !== 2 && !picked.includes(i)) {
        cand.push(i);
      }
    }
    const supplement = need - picked.length;
    const extraNums = cand.length > 0
      ? weightedPick(cand, calcWeights(def, hc, false, config), Math.min(supplement, cand.length))
      : [];
    const fullExtra = [...extraNums];
    while (fullExtra.length < supplement) {
      const n = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (!picked.includes(n) && !fullExtra.includes(n) && (config.ballStates.main || {})[n] !== 2) {
        fullExtra.push(n);
      }
    }
    main = [...picked, ...fullExtra].sort((a, b) => a - b);
  }

  let extra = null;
  if (def.extra) {
    const [elo, ehi] = def.extra;
    const eNeed = def.extra[2];
    const ePicked = Object.entries(config.ballStates.extra || {})
      .filter(([k, v]) => v === 1)
      .map(([k]) => +k)
      .filter(n => n >= elo && n <= ehi);

    // 从 ePicked 中取 eNeed 个（如果用户选了多个副区号码，只取需要的数量）
    const eResult = [];
    const ePool = [...ePicked];
    while (ePool.length < eNeed) {
      const n = elo + Math.floor(Math.random() * (ehi - elo + 1));
      if (!ePool.includes(n) && (config.ballStates.extra || {})[n] !== 2) {
        ePool.push(n);
      }
    }
    for (let i = 0; i < eNeed; i++) {
      const idx = Math.floor(Math.random() * ePool.length);
      eResult.push(ePool.splice(idx, 1)[0]);
    }
    extra = eResult.sort((a, b) => a - b);
  }
  return { main, extra };
}

function genSum(def, hc, config) {
  const [lo, hi] = def.main;
  const n = def.main[2];
  const target = config.sumTarget || def.sumMean;
  for (let att = 0; att < 300; att++) {
    const cand = []; for (let i = lo; i <= hi; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
    const main = weightedPick(cand, calcWeights(def, hc, false, config), n);
    if (Math.abs(main.reduce((a, b) => a + b, 0) - target) <= def.sumStd * 0.4 && checkMain(def, main)) {
      let extra = null;
      if (def.extra) {
        const [elo, ehi] = def.extra;
        const ec = []; for (let i = elo; i <= ehi; i++) ec.push(i);
        extra = weightedPick(ec, ec.map(() => 1 + Math.random() * 0.3), def.extra[2]);
      }
      return { main, extra };
    }
  }
  return genWeighted(def, hc, config);
}

function genOddEven(def, hc, config) {
  const [lo, hi] = def.main;
  const n = def.main[2];
  let tO = n % 2 ? Math.ceil(n / 2) : n / 2, tE = n - tO;
  if (config.oddEvenTarget) { const [o, e] = config.oddEvenTarget.split(':').map(Number); tO = o; tE = e; }
  for (let att = 0; att < 200; att++) {
    const odds = [], evens = [];
    for (let i = lo; i <= hi; i++) { if ((config.ballStates.main || {})[i] === 2) continue; if (i % 2) odds.push(i); else evens.push(i); }
    const ow = odds.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
    const ew = evens.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
    const po = weightedPick(odds, ow, Math.min(tO, odds.length));
    const pe = weightedPick(evens, ew, Math.min(tE, evens.length));
    if (po.length >= tO && pe.length >= tE) {
      const main = [...po.slice(0, tO), ...pe.slice(0, tE)].sort((a, b) => a - b);
      if (checkMain(def, main)) {
        let extra = null;
        if (def.extra) {
          const [elo, ehi] = def.extra;
          const ec = []; for (let i = elo; i <= ehi; i++) ec.push(i);
          extra = weightedPick(ec, ec.map(() => 1 + Math.random() * 0.3), def.extra[2]);
        }
        return { main, extra };
      }
    }
  }
  return genWeighted(def, hc, config);
}

function genZone(def, hc, config) {
  const rawZs = (config.zoneSelections && config.zoneSelections.length > 0) ? config.zoneSelections : def.zones.map((_, i) => i);
  // 只取有效的区间索引
  const zs = rawZs.filter(zi => zi >= 0 && zi < def.zones.length);
  if (zs.length === 0) {
    // 没有选中任何区间，从所有区间随机选
    return genWeighted(def, hc, config);
  }
  const [lo, hi] = def.main;
  const n = def.main[2];
  const per = Math.max(1, Math.ceil(n / zs.length));
  for (let att = 0; att < 200; att++) {
    let all = [];
    for (const zi of zs) {
      const [zl, zh] = def.zones[zi];
      const cand = []; for (let i = zl; i <= zh; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
      const w = cand.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
      all.push(...(cand.length >= per ? weightedPick(cand, w, per) : [...cand]));
    }
    // 确保所有号码都在选中的区间内
    const inZones = main => main.every(num => zs.some(zi => {
      const [zl, zh] = def.zones[zi];
      return num >= zl && num <= zh;
    }));
    const idxs = []; while (idxs.length < Math.min(n, all.length)) { const r = Math.floor(Math.random() * all.length); if (!idxs.includes(r)) idxs.push(r); }
    const main = idxs.map(i => all[i]).sort((a, b) => a - b);
    if (main.length === n && inZones(main)) {
      let extra = null;
      if (def.extra) {
        const [elo, ehi] = def.extra;
        const ec = []; for (let i = elo; i <= ehi; i++) ec.push(i);
        extra = weightedPick(ec, ec.map(() => 1 + Math.random() * 0.3), def.extra[2]);
      }
      return { main, extra };
    }
  }
  return genWeighted(def, hc, config);
}

function genConsec(def, hc, config) {
  for (let att = 0; att < 200; att++) {
    const [lo, hi] = def.main;
    const n = def.main[2];
    const cand = []; for (let i = lo; i <= hi; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
    let main = weightedPick(cand, calcWeights(def, hc, false, config), n);
    const consecPref = config.consecPref || 'normal';
    if (consecPref === 'more') {
      let g = 0; for (let i = 1; i < main.length; i++) if (main[i] - main[i - 1] === 1) g++;
      if (g < 2 && main.length >= 4) {
        for (let i = 0; i < main.length - 1; i++) {
          const v = main[i] + 1;
          if (!main.includes(v) && v <= hi) { const far = main.findIndex(x => Math.abs(x - v) > 5); if (far >= 0) { main[far] = v; main.sort((a, b) => a - b); break; } }
        }
      }
    } else if (consecPref === 'fewer') {
      for (let i = 1; i < main.length; i++) {
        if (main[i] - main[i - 1] === 1) { const pool = cand.filter(x => !main.includes(x)); if (pool.length > 0) { main[i] = pool[Math.floor(Math.random() * pool.length)]; main.sort((a, b) => a - b); } }
      }
    }
    if (checkMain(def, main)) {
      let extra = null;
      if (def.extra) {
        const [elo, ehi] = def.extra;
        const ec = []; for (let i = elo; i <= ehi; i++) ec.push(i);
        extra = weightedPick(ec, ec.map(() => 1 + Math.random() * 0.3), def.extra[2]);
      }
      return { main, extra };
    }
  }
  return genWeighted(def, hc, config);
}

function genStraight(def, hc, config) {
  const [lo, hi] = def.main;
  const main = [];
  const digitFilters = config.digitFilters || {};
  for (let d = 0; d < def.main[2]; d++) {
    const wKey = 'w' + (d + 1);
    const filters = digitFilters[wKey] || [];
    let cand = []; for (let i = lo; i <= hi; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
    if (filters.length > 0) {
      let filtered = [];
      for (const i of cand) {
        let ok = true;
        for (const f of filters) {
          if (f === 'd' && i < 5) ok = false;
          if (f === 'x' && i >= 5) ok = false;
          if (f === 'j' && i % 2 === 0) ok = false;
          if (f === 'o' && i % 2 === 1) ok = false;
        }
        if (ok) filtered.push(i);
      }
      if (filtered.length > 0) cand = filtered;
    }
    const w = cand.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
    main.push(weightedPick(cand, w, 1)[0]);
  }
  return { main, extra: null };
}

function genGroup3(def, hc, config) {
  const [lo, hi] = def.main;
  const cand = []; for (let i = lo; i <= hi; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
  const w = cand.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
  const pair = weightedPick(cand, w, 1)[0];
  const rest = cand.filter(x => x !== pair);
  const rw = rest.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
  const single = weightedPick(rest, rw, 1)[0];
  const arr = [pair, pair, single];
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return { main: arr, extra: null };
}

function genGroup6(def, hc, config) {
  const [lo, hi] = def.main;
  const cand = []; for (let i = lo; i <= hi; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
  const w = cand.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
  return { main: weightedPick(cand, w, 3), extra: null };
}

function genSum3D(def, hc, config) {
  const t = config.sumTarget || 13;
  for (let att = 0; att < 500; att++) { const a = Math.floor(Math.random() * 10), b = Math.floor(Math.random() * 10), c = Math.floor(Math.random() * 10); if (a + b + c === t) return { main: [a, b, c], extra: null }; }
  return genStraight(def, hc, config);
}

function genSpan3D(def, hc, config) {
  const t = config.sumTarget || 5;
  for (let att = 0; att < 500; att++) { const a = Math.floor(Math.random() * 10), b = Math.floor(Math.random() * 10), c = Math.floor(Math.random() * 10); const s = [a, b, c].sort((x, y) => x - y); if (s[2] - s[0] === t) return { main: [a, b, c], extra: null }; }
  return genStraight(def, hc, config);
}

function genOE3D(def, hc, config) {
  const map = { '奇奇奇': [3, 0], '奇奇偶': [2, 1], '奇偶奇': [2, 1], '偶奇奇': [2, 1], '奇偶偶': [1, 2], '偶奇偶': [1, 2], '偶偶奇': [1, 2], '偶偶偶': [0, 3] };
  const [oN, eN] = map[config.oddEven3D] || [2, 1];
  for (let att = 0; att < 200; att++) {
    const odds = [], evens = []; for (let i = 0; i <= 9; i++) if ((config.ballStates.main || {})[i] !== 2) (i % 2 ? odds : evens).push(i);
    if (odds.length < oN || evens.length < eN) break;
    const oPick = []; while (oPick.length < oN) { const r = odds[Math.floor(Math.random() * odds.length)]; if (!oPick.includes(r)) oPick.push(r); }
    const ePick = []; while (ePick.length < eN) { const r = evens[Math.floor(Math.random() * evens.length)]; if (!ePick.includes(r)) ePick.push(r); }
    const all = [...oPick, ...ePick]; for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return { main: all, extra: null };
  }
  return genStraight(def, hc, config);
}

function genBigSmall(def, hc, config) {
  const map = { '大大大': [3, 0], '大大小': [2, 1], '大小大': [2, 1], '小大大': [2, 1], '大小小': [1, 2], '小大小': [1, 2], '小小大': [1, 2], '小小小': [0, 3] };
  const [bN, sN] = map[config.bigSmall3D] || [2, 1];
  for (let att = 0; att < 200; att++) {
    const bigs = [], smalls = []; for (let i = 0; i <= 9; i++) if ((config.ballStates.main || {})[i] !== 2) (i >= 5 ? bigs : smalls).push(i);
    if (bigs.length < bN || smalls.length < sN) break;
    const bPick = []; while (bPick.length < bN) { const r = bigs[Math.floor(Math.random() * bigs.length)]; if (!bPick.includes(r)) bPick.push(r); }
    const sPick = []; while (sPick.length < sN) { const r = smalls[Math.floor(Math.random() * smalls.length)]; if (!sPick.includes(r)) sPick.push(r); }
    const all = [...bPick, ...sPick]; for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    return { main: all, extra: null };
  }
  return genStraight(def, hc, config);
}

function genPosition(def, hc, config) {
  const [lo, hi] = def.main;
  const main = [];
  const totalDigits = def.main[2] + (def.extra ? def.extra[2] : 0);
  for (let d = 0; d < totalDigits; d++) {
    const posPrefs = config.positionPrefs || [];
    if (posPrefs[d] !== undefined && posPrefs[d] !== -1) { main.push(posPrefs[d]); continue; }
    const cand = []; for (let i = lo; i <= hi; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
    const w = cand.map(i => { let v = 1; if (hc.hot.includes(i)) v = 1.8; else if (hc.cold.includes(i)) v = 1.3; return v + Math.random() * 0.3; });
    main.push(weightedPick(cand, w, 1)[0]);
  }
  let extra = null;
  if (def.extra) {
    const mainCount = def.main[2];
    extra = main.splice(mainCount);
  }
  return { main, extra };
}

function genPL5Sum(def, hc, config) {
  const t = config.sumTarget || 22;
  for (let att = 0; att < 500; att++) {
    const a = Math.floor(Math.random() * 10), b = Math.floor(Math.random() * 10), c = Math.floor(Math.random() * 10), d = Math.floor(Math.random() * 10), e = Math.floor(Math.random() * 10);
    if (a + b + c + d + e === t) return { main: [a, b, c, d, e], extra: null };
  }
  return genPosition(def, hc, config);
}

function genPlayN(def, hc, config) {
  const n = config.playN || 10;
  const [lo, hi] = def.main;
  const cand = []; for (let i = lo; i <= hi; i++) if ((config.ballStates.main || {})[i] !== 2) cand.push(i);
  return { main: weightedPick(cand, calcWeights(def, hc, false, config), n), extra: null };
}

function genPL5Weighted(def, hc, config) {
  return genPosition(def, hc, config);
}

function genQlcWeighted(def, hc, config) {
  return genWeighted(def, hc, config);
}

function genQxcWeighted(def, hc, config) {
  return genPosition(def, hc, config);
}

// 七星复式基类：每位从选中的数字中随机抽 1 个，未选则全范围随机
function genQxcFushiBase(def, hc, config, mode) {
  // mode: 'front'=前六位复式, 'last'=最后一位复式, 'full'=全复式
  const digitFilters = config.digitFilters || {};
  const main = [];
  for (let d = 0; d < 7; d++) {
    const wKey = 'w' + (d + 1);
    const selected = digitFilters[wKey] || [];
    // 根据模式判断当前位是否可多选
    const isFront = d < 6;  // 前六位
    const isLast = d === 6; // 最后一位
    let canMulti = false;
    if (mode === 'full') canMulti = true;
    else if (mode === 'front' && isFront) canMulti = true;
    else if (mode === 'last' && isLast) canMulti = true;

    let cand;
    if (canMulti && selected.length > 0) {
      // 可多选且用户选了数字 → 从选中数字中随机抽
      cand = [...selected];
    } else {
      // 单选或用户没选 → 0-9 全范围
      cand = [];
      for (let i = 0; i <= 9; i++) cand.push(i);
    }
    const w = cand.map(() => 1 + Math.random() * 0.3);
    main.push(weightedPick(cand, w, 1)[0]);
  }
  return { main, extra: null };
}

function genQxcFront(def, hc, config) {
  return genQxcFushiBase(def, hc, config, 'front');
}

function genQxcLast(def, hc, config) {
  return genQxcFushiBase(def, hc, config, 'last');
}

function genQxcFull(def, hc, config) {
  return genQxcFushiBase(def, hc, config, 'full');
}

function fallback(def) {
  const [lo, hi] = def.main;
  const pool = []; for (let i = lo; i <= hi; i++) pool.push(i);
  const main = []; const cp = [...pool];
  for (let i = 0; i < def.main[2]; i++) { const idx = Math.floor(Math.random() * cp.length); main.push(cp.splice(idx, 1)[0]); }
  main.sort((a, b) => a - b);
  let extra = null;
  if (def.extra) {
    const [elo, ehi] = def.extra;
    const ep = []; for (let i = elo; i <= ehi; i++) ep.push(i);
    extra = [];
    for (let i = 0; i < def.extra[2]; i++) { const idx = Math.floor(Math.random() * ep.length); extra.push(ep.splice(idx, 1)[0]); }
    extra.sort((a, b) => a - b);
  }
  return { main, extra };
}

// ==================== 评分算法 ====================
function scoreIt(def, result, typeId) {
  const { main } = result;
  const dims = {};
  const sum = main.reduce((a, b) => a + b, 0);

  if (def.dims.includes('和值')) dims['和值'] = Math.max(0, Math.round(100 - Math.abs(sum - def.sumMean) / def.sumStd * 50));
  if (def.dims.includes('奇偶比')) { const odd = main.filter(x => x % 2).length; dims['奇偶比'] = Math.max(20, 100 - Math.abs(odd - Math.round(main.length / 2)) * 20); }
  if (def.dims.includes('区间') && def.zones) { const zc = def.zones.map(z => main.filter(x => x >= z[0] && x <= z[1]).length); dims['区间'] = Math.round(zc.filter(c => c > 0).length / def.zones.length * 100); }
  if (def.dims.includes('区间覆盖') && def.zones) { const zc = def.zones.map(z => main.filter(x => x >= z[0] && x <= z[1]).length); dims['区间覆盖'] = Math.round(zc.filter(c => c > 0).length / def.zones.length * 100); }
  if (def.dims.includes('冷热')) { const data = typeId ? getMockFreq(typeId) : getMockFreq(Object.keys(LOTTERY_DEFS).find(k => LOTTERY_DEFS[k] === def)); const hot = main.filter(x => data.hc.hot.includes(x)).length; dims['冷热'] = hot >= 1 && hot <= Math.ceil(main.length * 0.5) ? 90 : Math.max(30, 100 - Math.abs(hot - Math.floor(main.length * 0.35)) * 15); }
  if (def.dims.includes('连号')) { let g = 0; for (let i = 1; i < main.length; i++) if (main[i] - main[i - 1] === 1) g++; dims['连号'] = g === 0 ? 65 : g <= 2 ? 90 : g <= 3 ? 55 : 30; }
  if (def.dims.includes('跨度')) { const sp = main[main.length - 1] - main[0]; const ideal = (def.main[1] - def.main[0]) * 0.6; dims['跨度'] = Math.max(20, Math.round(100 - Math.abs(sp - ideal) / (def.main[1] - def.main[0]) * 80)); }
  if (def.dims.includes('蓝球')) {
    const data = typeId ? getMockFreq(typeId) : null;
    if (data && result.extra && result.extra.length) {
      const blue = result.extra[0];
      const appear = data.freq[blue] || 0;
      const maxAppear = Math.max(...Object.values(data.freq), 1);
      dims['蓝球'] = Math.max(30, Math.round(50 + (appear / maxAppear) * 50));
    } else {
      dims['蓝球'] = 70;
    }
  }
  if (def.dims.includes('后区')) {
    const data = typeId ? getMockFreq(typeId) : null;
    if (data && result.extra && result.extra.length) {
      const avgAppear = result.extra.reduce((s, n) => s + (data.freq[n] || 0), 0) / result.extra.length;
      const maxAppear = Math.max(...Object.values(data.freq), 1);
      dims['后区'] = Math.max(30, Math.round(50 + (avgAppear / maxAppear) * 50));
    } else {
      dims['后区'] = 70;
    }
  }
  if (def.dims.includes('特码')) {
    const data = typeId ? getMockFreq(typeId) : null;
    if (data && result.extra && result.extra.length) {
      const special = result.extra[result.extra.length - 1];
      const appear = data.freq[special] || 0;
      const maxAppear = Math.max(...Object.values(data.freq), 1);
      dims['特码'] = Math.max(30, Math.round(50 + (appear / maxAppear) * 50));
    } else {
      dims['特码'] = 70;
    }
  }
  if (def.dims.includes('形态')) { const u = new Set(main).size; dims['形态'] = u === 3 ? 95 : u === 2 ? 60 : 20; }
  if (def.dims.includes('每位')) dims['每位'] = Math.round(50 + Math.random() * 50);
  if (def.dims.includes('重复控制')) { const u = new Set(main).size; dims['重复控制'] = u >= 4 ? 90 : u === 3 ? 60 : 30; }

  let total = 0, tw = 0;
  for (let i = 0; i < def.dims.length; i++) {
    if (dims[def.dims[i]] !== undefined) { total += dims[def.dims[i]] * def.dimW[i]; tw += def.dimW[i]; }
  }
  return { overall: tw > 0 ? Math.round(total / tw) : 70, dims };
}

// ==================== 玩法特定生成器路由 ====================
// 某些玩法的玩法名和其他玩法相同但需要不同的实现
const TYPE_GENERATORS = {
  pl5: {
    sum: genPL5Sum,
    weighted: genPL5Weighted,
  },
  qlc: {
    weighted: genQlcWeighted,
  },
  qxc: {
    weighted: genQxcWeighted,
    qxc_front: genQxcFront,
    qxc_last: genQxcLast,
    qxc_full: genQxcFull,
  },
};

// ==================== 统一生成入口 ====================
const GENERATORS = {
  weighted: genWeighted,
  dantuo: genDantuo,
  fushi: genFushi,
  sum: genSum,
  oddeven: genOddEven,
  zone: genZone,
  hotcold: genWeighted,
  consec: genConsec,
  straight: genStraight,
  group3: genGroup3,
  group6: genGroup6,
  sum3d: genSum3D,
  span3d: genSpan3D,
  oddeven3d: genOE3D,
  bigsmall: genBigSmall,
  position: genPosition,
  playN: genPlayN,
};

function generateOne(typeId, methodId, config) {
  const def = LOTTERY_DEFS[typeId];
  if (!def) return null;
  const data = getMockFreq(typeId);
  const typeGens = TYPE_GENERATORS[typeId] || {};
  const genFn = typeGens[methodId] || GENERATORS[methodId] || genWeighted;
  const result = genFn(def, data.hc, config || {});
  const score = scoreIt(def, result, typeId);
  return { result, score };
}

function generateBatch(typeId, methodId, count, config, dedupEnabled) {
  const def = LOTTERY_DEFS[typeId];
  if (!def) return { items: [], totalAttempts: 0, duplicateCount: 0 };
  const data = getMockFreq(typeId);
  const typeGens = TYPE_GENERATORS[typeId] || {};
  const genFn = typeGens[methodId] || GENERATORS[methodId] || genWeighted;
  const items = [];
  const usedFps = new Set();

  // 从 config 中读取本期已随机过的整组号码（排除列表）
  const excludedGroups = (config && config.excludedGroups) || [];
  const excludedSet = new Set(excludedGroups);

  let totalAttempts = 0;
  let duplicateCount = 0;

  for (let i = 0; i < count; i++) {
    let result, fp;
    let attempts = 0;
    do {
      result = genFn(def, data.hc, config || {});
      const ms = result.main.map(n => String(n).padStart(2, '0')).sort().join(',');
      const es = result.extra && result.extra.length ? '|' + result.extra.map(n => String(n).padStart(2, '0')).join(',') : '';
      fp = ms + es;
      attempts++;
    } while ((dedupEnabled && usedFps.has(fp)) || excludedSet.has(fp) && attempts < 100);

    if (attempts >= 100 && (usedFps.has(fp) || excludedSet.has(fp))) {
      duplicateCount += attempts;
      totalAttempts += attempts;
      continue;
    }

    if (attempts > 1) duplicateCount += attempts - 1;
    totalAttempts += attempts;
    usedFps.add(fp);
    const score = scoreIt(def, result, typeId);
    items.push({ result, score, fingerprint: fp });
  }

  items.sort((a, b) => b.score.overall - a.score.overall);
  return { items, totalAttempts, duplicateCount };
}

function scoreColor(s) {
  return s >= 85 ? '#48BB78' : s >= 70 ? '#ECC94B' : s >= 50 ? '#ED8936' : '#FC8181';
}

module.exports = {
  LOTTERY_DEFS,
  getMockFreq,
  refreshFreq,
  generateOne,
  generateBatch,
  scoreIt,
  scoreColor,
};
