const { LOTTERY_TYPES, LOTTERY_MAP, BALL_COLORS } = require('./config');
const { LOTTERY_RULES } = require('./rules');
// generateNumbers 仅供内部 mock.js 使用，外部页面通过 engine.js 生成
const { formatNumbers, formatDisplay } = require('./formatter');
const { MOCK_LATEST, parseDisplay, getMockResults } = require('./mock');
const {
  LOTTERY_DEFS, getMockFreq, refreshFreq,
  generateOne, generateBatch, scoreIt, scoreColor
} = require('./engine');

module.exports = {
  LOTTERY_TYPES,
  LOTTERY_MAP,
  LOTTERY_RULES,
  // HISTORY_COUNTS 已废弃，通过 API /api/v1/templates 动态获取
  MOCK_LATEST,
  BALL_COLORS,
  // generateNumbers, 仅供内部 mock.js 使用，外部页面通过 engine.js 生成
  formatNumbers,
  formatDisplay,
  getMockResults,
  parseDisplay,
  LOTTERY_DEFS,
  getMockFreq,
  refreshFreq,
  generateOne,
  generateBatch,
  scoreIt,
  scoreColor
};
