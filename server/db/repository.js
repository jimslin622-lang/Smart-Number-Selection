/**
 * 数据库 Repository — 从新表 (lottery_draw, lottery_type, lottery_draw_analysis 等) 读取数据
 * ⚠️ 旧表 history_numbers 和 templates 已废弃，数据迁移至 lottery_draw 和 lottery_type
 */
const { query, hasDbConfig } = require('./client');

// ============ 玩法 ============

async function listLotteryTypes() {
  if (!hasDbConfig()) return null;
  const result = await query(`
    SELECT code, name, country, category, number_rule, draw_days, status
    FROM lottery_type
    WHERE status = 1
    ORDER BY id ASC
  `);
  return result.rows;
}

// ============ 示例记录 ============

/**
 * 从 lottery_draw 表获取最新一期
 */
async function getLatestDraw(lotteryCode) {
  if (!hasDbConfig()) return null;
  const result = await query(`
    SELECT lottery_code, issue, draw_date, numbers, data_source
    FROM lottery_draw
    WHERE lottery_code = $1
    ORDER BY draw_date DESC, id DESC
    LIMIT 1
  `, [lotteryCode]);
  return result.rows[0] || null;
}

/**
 * 从 lottery_draw 表获取历史记录
 */
async function listDraws(lotteryCode, count = 20) {
  if (!hasDbConfig()) return null;
  const safeCount = Math.min(Math.max(Number(count) || 20, 1), 5000);
  const result = await query(`
    SELECT lottery_code, issue, draw_date, numbers, data_source
    FROM lottery_draw
    WHERE lottery_code = $1
    ORDER BY draw_date DESC, id DESC
    LIMIT $2
  `, [lotteryCode, safeCount]);
  return result.rows;
}

/**
 * 统计某玩法总期数
 */
async function countDraws(lotteryCode) {
  if (!hasDbConfig()) return null;
  const result = await query(
    'SELECT count(*)::int AS count FROM lottery_draw WHERE lottery_code = $1',
    [lotteryCode]
  );
  return result.rows[0]?.count || 0;
}

/**
 * 获取所有玩法的数据概览
 */
async function getDrawSummary() {
  if (!hasDbConfig()) return null;
  const result = await query(`
    SELECT lottery_code, count(*)::int AS count,
           min(draw_date)::text AS earliest,
           max(draw_date)::text AS latest
    FROM lottery_draw
    GROUP BY lottery_code
    ORDER BY lottery_code
  `);
  return result.rows;
}

// ============ 示例分析 ============

/**
 * 获取某期示例分析
 */
async function getDrawAnalysis(lotteryCode, issue) {
  if (!hasDbConfig()) return null;
  const result = await query(`
    SELECT *
    FROM lottery_draw_analysis
    WHERE lottery_code = $1 AND issue = $2
  `, [lotteryCode, issue]);
  return result.rows[0] || null;
}

/**
 * 获取最近N期的示例分析
 */
async function listDrawAnalysis(lotteryCode, count = 20) {
  if (!hasDbConfig()) return null;
  const safeCount = Math.min(Math.max(Number(count) || 20, 1), 500);
  const result = await query(`
    SELECT a.*
    FROM lottery_draw_analysis a
    JOIN lottery_draw d ON d.id = a.draw_id
    WHERE a.lottery_code = $1
    ORDER BY d.draw_date DESC, d.id DESC
    LIMIT $2
  `, [lotteryCode, safeCount]);
  return result.rows;
}

// ============ 号码统计 ============

/**
 * 获取号码冷热统计
 */
async function listNumberStats(lotteryCode, orderBy = 'hot_score', limit = 49) {
  if (!hasDbConfig()) return null;
  const allowedOrders = ['hot_score', 'cold_score', 'appear_count', 'current_miss', 'number_value'];
  const safeOrder = allowedOrders.includes(orderBy) ? orderBy : 'hot_score';
  const safeLimit = Math.min(Math.max(Number(limit) || 49, 1), 49);

  const result = await query(`
    SELECT number_value, appear_count, current_miss, max_miss, avg_miss,
           consecutive_count, hot_score, cold_score, probability, ai_score,
           last_issue, statistic_json
    FROM number_statistics
    WHERE lottery_code = $1
    ORDER BY ${safeOrder} DESC
    LIMIT $2
  `, [lotteryCode, safeLimit]);
  return result.rows;
}

// ============ 六合彩号码属性 ============

/**
 * 获取号码属性
 */
async function getMarksixProperty(number) {
  if (!hasDbConfig()) return null;
  const result = await query(
    'SELECT * FROM marksix_property WHERE number = $1',
    [number]
  );
  return result.rows[0] || null;
}

async function listMarksixProperties() {
  if (!hasDbConfig()) return null;
  const result = await query(
    'SELECT * FROM marksix_property ORDER BY number'
  );
  return result.rows;
}

// ============ 旧表兼容（保留，但内部走新表） ============

async function listTemplates() {
  return listLotteryTypes();
}

async function getLatestHistory(templateId) {
  return getLatestDraw(templateId);
}

async function listHistory(templateId, count = 20) {
  return listDraws(templateId, count);
}

async function countHistory(templateId) {
  return countDraws(templateId);
}

// ============ 示例日历 ============

async function listIssueCalendar(lotteryCode, count = 20) {
  if (!hasDbConfig()) return null;
  const safeCount = Math.min(Math.max(Number(count) || 20, 1), 100);
  const whereClause = lotteryCode ? 'WHERE c.lottery_code = $1' : '';
  const params = lotteryCode ? [lotteryCode, safeCount] : [safeCount];
  const result = await query(`
    SELECT c.*, l.name as lottery_name
    FROM issue_calendar c
    JOIN lottery_type l ON l.code = c.lottery_code
    ${whereClause}
    ORDER BY c.draw_date ASC, c.draw_time ASC
    LIMIT $${lotteryCode ? '2' : '1'}
  `, params);
  return result.rows;
}

module.exports = {
  // 新 API
  listLotteryTypes,
  getLatestDraw,
  listDraws,
  countDraws,
  getDrawSummary,
  getDrawAnalysis,
  listDrawAnalysis,
  listNumberStats,
  getMarksixProperty,
  listMarksixProperties,
  listIssueCalendar,
  // 旧兼容
  listTemplates,
  getLatestHistory,
  listHistory,
  countHistory,
};
