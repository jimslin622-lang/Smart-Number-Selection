-- ========================================
-- lottery_draw 新表结构（替代旧表 templates / history_numbers / api_events）
-- ========================================

-- 彩种类型
CREATE TABLE IF NOT EXISTS lottery_type (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  number_rule JSONB,
  draw_days JSONB,
  status INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 开奖记录
CREATE TABLE IF NOT EXISTS lottery_draw (
  id BIGSERIAL PRIMARY KEY,
  lottery_code TEXT NOT NULL REFERENCES lottery_type(code),
  issue TEXT NOT NULL,
  draw_date DATE NOT NULL,
  numbers JSONB NOT NULL,
  data_source TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lottery_code, issue)
);
CREATE INDEX IF NOT EXISTS idx_lottery_draw_code_date ON lottery_draw(lottery_code, draw_date DESC, id DESC);

-- 开奖分析
CREATE TABLE IF NOT EXISTS lottery_draw_analysis (
  id BIGSERIAL PRIMARY KEY,
  draw_id BIGINT NOT NULL REFERENCES lottery_draw(id) UNIQUE,
  lottery_code TEXT NOT NULL,
  issue TEXT NOT NULL,
  sum_value INTEGER NOT NULL DEFAULT 0,
  span_value INTEGER NOT NULL DEFAULT 0,
  odd_count INTEGER NOT NULL DEFAULT 0,
  even_count INTEGER NOT NULL DEFAULT 0,
  big_count INTEGER NOT NULL DEFAULT 0,
  small_count INTEGER NOT NULL DEFAULT 0,
  prime_count INTEGER NOT NULL DEFAULT 0,
  composite_count INTEGER NOT NULL DEFAULT 0,
  zone_ratio TEXT NOT NULL DEFAULT '',
  road_012 TEXT NOT NULL DEFAULT '',
  consecutive_count INTEGER NOT NULL DEFAULT 0,
  ac_value INTEGER,
  tail_ratio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 号码统计
CREATE TABLE IF NOT EXISTS number_statistics (
  id BIGSERIAL PRIMARY KEY,
  lottery_code TEXT NOT NULL,
  number_value INTEGER NOT NULL,
  appear_count INTEGER NOT NULL DEFAULT 0,
  current_miss INTEGER NOT NULL DEFAULT 0,
  max_miss INTEGER NOT NULL DEFAULT 0,
  avg_miss NUMERIC(10,2) NOT NULL DEFAULT 0,
  consecutive_count INTEGER NOT NULL DEFAULT 0,
  hot_score NUMERIC(10,4) NOT NULL DEFAULT 0,
  cold_score NUMERIC(10,4) NOT NULL DEFAULT 0,
  probability NUMERIC(10,6) NOT NULL DEFAULT 0,
  ai_score NUMERIC(10,4) NOT NULL DEFAULT 0,
  last_issue TEXT,
  statistic_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lottery_code, number_value)
);
CREATE INDEX IF NOT EXISTS idx_number_stats_code ON number_statistics(lottery_code);

-- 走势数据
CREATE TABLE IF NOT EXISTS trend_statistics (
  id BIGSERIAL PRIMARY KEY,
  draw_id BIGINT NOT NULL REFERENCES lottery_draw(id),
  lottery_code TEXT NOT NULL,
  issue TEXT NOT NULL,
  trend_type TEXT NOT NULL,
  trend_value TEXT NOT NULL DEFAULT '',
  trend_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trend_stats_code ON trend_statistics(lottery_code, issue);

-- 六合彩号码属性
CREATE TABLE IF NOT EXISTS marksix_property (
  number INTEGER PRIMARY KEY,
  color TEXT NOT NULL,
  zodiac TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 开奖日历（预留）
CREATE TABLE IF NOT EXISTS issue_calendar (
  id BIGSERIAL PRIMARY KEY,
  lottery_code TEXT NOT NULL,
  issue TEXT NOT NULL,
  draw_date DATE NOT NULL,
  draw_time TIME,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户
CREATE TABLE IF NOT EXISTS users (
  openid TEXT PRIMARY KEY,
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户记录
CREATE TABLE IF NOT EXISTS user_records (
  id BIGSERIAL PRIMARY KEY,
  lottery_code TEXT NOT NULL DEFAULT 'lhc',
  method_id TEXT NOT NULL DEFAULT 'weighted',
  method_name TEXT NOT NULL DEFAULT '',
  main_numbers INTEGER[] NOT NULL DEFAULT '{}',
  extra_numbers INTEGER[],
  display_text TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  score_dims JSONB NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'manual',
  batch_id TEXT,
  starred BOOLEAN NOT NULL DEFAULT false,
  openid TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_records_openid ON user_records(openid);
CREATE INDEX IF NOT EXISTS idx_user_records_lottery ON user_records(lottery_code);