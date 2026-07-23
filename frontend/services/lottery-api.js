const { MOCK_LATEST, getMockResults, LOTTERY_MAP } = require('../utils/lottery');
const MARKSIX_LATEST = require('../utils/lottery/marksix-latest');
const { USE_REMOTE_API } = require('./config');
const { request } = require('./request');

let marksixHistoryCache = null;

function getMarkSixHistory() {
  if (!marksixHistoryCache) {
    // 懒加载：避免首页启动时同步解析 4352 期大数组导致 WAServiceMainContext timeout。
    marksixHistoryCache = require('../utils/lottery/marksix-history');
  }
  return marksixHistoryCache;
}

function getTypeId(typeOrId) {
  if (typeOrId === '6+1模式' || typeOrId === '6+1模式') return 'lhc';
  return LOTTERY_MAP[typeOrId]?.id || typeOrId || 'lhc';
}

function getTypeName(typeOrId) {
  if (typeOrId === '6+1模式') return '6+1模式';
  return LOTTERY_MAP[typeOrId]?.name || typeOrId || '6+1模式';
}

function normalizeMarkSixRow(row) {
  if (!row) return null;
  const [period, date, mainCsv, special, source] = row;
  const main = String(mainCsv || '').split(',').filter(Boolean);
  const specialList = special ? [special] : [];
  return {
    type: '6+1模式',
    period,
    date,
    display: `主码：${main.join(' ')}\n附加号：${specialList.join(' ')}`,
    parsed: [
      { label: '主码', numbers: main },
      { label: '附加号', numbers: specialList },
    ],
    formatted: `主码:${main.join(',')} 附加号:${specialList.join(',')}`,
    raw: { main, special: specialList },
    numberList: main.concat(specialList),
    source,
  };
}

function normalizeRemoteResult(item) {
  if (!item) return null;
  return {
    type: item.type,
    period: item.period,
    date: item.date,
    display: item.display,
    parsed: item.parsed,
    formatted: item.formatted,
    raw: item.raw,
    numberList: item.numberList,
    source: item.source,
  };
}

function getLatestResult(typeId) {
  const id = getTypeId(typeId);
  if (USE_REMOTE_API) {
    return request({ path: '/api/v1/examples/latest', query: { typeId: id } })
      .then(normalizeRemoteResult)
      .catch(() => {
        if (id === 'lhc') return normalizeMarkSixRow(MARKSIX_LATEST);
        return MOCK_LATEST[id] || null;
      });
  }
  if (id === 'lhc') return Promise.resolve(normalizeMarkSixRow(MARKSIX_LATEST));
  return Promise.resolve(MOCK_LATEST[id] || null);
}

function getHistoryResults(typeName, count = 20) {
  const id = getTypeId(typeName);
  const name = getTypeName(typeName);
  if (USE_REMOTE_API) {
    return request({ path: '/api/v1/examples/history', query: { typeId: id, count } })
      .then(list => (list || []).map(normalizeRemoteResult))
      .catch(() => {
        if (id === 'lhc') return getMarkSixHistory().slice(0, count).map(normalizeMarkSixRow);
        return getMockResults(name).slice(0, count);
      });
  }
  if (id === 'lhc') {
    const history = getMarkSixHistory();
    return Promise.resolve(history.slice(0, count).map(normalizeMarkSixRow));
  }
  return Promise.resolve(getMockResults(name).slice(0, count));
}

function generateRemoteNumbers(typeOrId, count = 1) {
  const id = getTypeId(typeOrId);
  if (id === 'lhc' || !USE_REMOTE_API) return Promise.resolve(null);
  return request({ path: '/api/v1/random/generate', method: 'POST', data: { typeId: id, count } }).catch(() => null);
}

function getAnalysisData(typeName) {
  const id = getTypeId(typeName);
  const name = getTypeName(typeName);
  if (id === 'lhc') {
    const history = getMarkSixHistory();
    return Promise.resolve(history.map(normalizeMarkSixRow));
  }
  if (USE_REMOTE_API) {
    return request({ path: '/api/v1/analysis', query: { typeId: id } })
      .catch(() => getMockResults(name));
  }
  return Promise.resolve(getMockResults(name));
}

let _templatesCache = null;

/**
 * 获取玩法列表（含真实 historyCount，来自 lottery_draw 表）
 * 缓存 5 分钟
 * ⚠️ HISTORY_COUNTS 硬编码已移除，统一通过 API 获取
 * 旧表 history_numbers 已废弃，数据迁移至 lottery_draw
 */
function getTemplates() {
  if (_templatesCache && Date.now() - _templatesCache.ts < 300000) {
    return Promise.resolve(_templatesCache.data);
  }
  if (!USE_REMOTE_API) {
    return Promise.resolve([]);
  }
  return request({ path: '/api/v1/templates' })
    .then(list => {
      _templatesCache = { data: list, ts: Date.now() };
      return list;
    })
    .catch(() => {
      // API 不可用时返回空数组，前端显示 0
      _templatesCache = { data: [], ts: Date.now() };
      return [];
    });
}

function getNumberStats(typeId) {
  if (!USE_REMOTE_API) return Promise.resolve([]);
  return request({ path: '/api/v1/stats', query: { typeId } })
    .then(list => list || [])
    .catch(() => []);
}

/**
 * 获取最新期号
 */
function getLatestPeriod(typeId) {
  const id = getTypeId(typeId);
  if (!USE_REMOTE_API) return Promise.resolve('');
  return request({ path: '/api/v1/examples/latest', query: { typeId: id } })
    .then(data => data && data.period ? data.period : '')
    .catch(() => '');
}

module.exports = {
  getLatestResult,
  getHistoryResults,
  getAnalysisData,
  generateRemoteNumbers,
  getTemplates,
  getNumberStats,
  getLatestPeriod,
};
