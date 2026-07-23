-- 插入玩法类型
INSERT INTO lottery_type (code, name, country, category, number_rule, draw_days) VALUES
('lhc', '六合', '香港', '数字彩', '{"main":{"min":1,"max":49,"count":6},"extra":{"min":1,"max":49,"count":1}}', '{"days":["二","四","六/日"]}'),
('ssq', '双色', '中国', '乐透型', '{"main":{"min":1,"max":33,"count":6},"extra":{"min":1,"max":16,"count":1}}', '{"days":["二","四","日"]}'),
('dlt', '乐透', '中国', '乐透型', '{"main":{"min":1,"max":35,"count":5},"extra":{"min":1,"max":12,"count":2}}', '{"days":["一","三","六"]}'),
('qlc', '七乐', '中国', '乐透型', '{"main":{"min":1,"max":30,"count":7}}', '{"days":["一","三","五"]}'),
('qxc', '七星', '中国', '数字型', '{"main":{"min":0,"max":9,"count":7}}', '{"days":["二","五","日"]}'),
('fc3d', '福彩3D', '中国', '数字型', '{"main":{"min":0,"max":9,"count":3}}', '{"days":["每日"]}'),
('pl3', '3列', '中国', '数字型', '{"main":{"min":0,"max":9,"count":3}}', '{"days":["每日"]}'),
('pl5', '5列', '中国', '数字型', '{"main":{"min":0,"max":9,"count":5}}', '{"days":["每日"]}'),
('kl8', '快8', '中国', '基诺型', '{"main":{"min":1,"max":80,"count":10}}', '{"days":["每日"]}')
ON CONFLICT (code) DO NOTHING;

-- 插入六合彩号码属性
INSERT INTO marksix_property (number, color, zodiac, season) VALUES
(1, 'red', '鼠', 'spring'), (2, 'red', '牛', 'spring'), (3, 'blue', '虎', 'spring'), (4, 'blue', '兔', 'spring'),
(5, 'green', '龙', 'spring'), (6, 'green', '蛇', 'spring'), (7, 'red', '马', 'summer'), (8, 'red', '羊', 'summer'),
(9, 'blue', '猴', 'summer'), (10, 'blue', '鸡', 'summer'), (11, 'green', '狗', 'summer'), (12, 'green', '猪', 'summer'),
(13, 'red', '鼠', 'summer'), (14, 'blue', '牛', 'summer'), (15, 'blue', '虎', 'autumn'), (16, 'green', '兔', 'autumn'),
(17, 'green', '龙', 'autumn'), (18, 'red', '蛇', 'autumn'), (19, 'red', '马', 'autumn'), (20, 'blue', '羊', 'autumn'),
(21, 'blue', '猴', 'autumn'), (22, 'green', '狗', 'autumn'), (23, 'green', '猪', 'autumn'), (24, 'red', '鼠', 'winter'),
(25, 'blue', '牛', 'winter'), (26, 'blue', '虎', 'winter'), (27, 'green', '兔', 'winter'), (28, 'green', '龙', 'winter'),
(29, 'red', '蛇', 'winter'), (30, 'red', '马', 'winter'), (31, 'blue', '羊', 'winter'), (32, 'blue', '猴', 'winter'),
(33, 'green', '狗', 'spring'), (34, 'green', '猪', 'spring'), (35, 'red', '鼠', 'spring'), (36, 'red', '牛', 'spring'),
(37, 'blue', '虎', 'spring'), (38, 'blue', '兔', 'spring'), (39, 'green', '龙', 'spring'), (40, 'green', '蛇', 'spring'),
(41, 'red', '马', 'spring'), (42, 'red', '羊', 'spring'), (43, 'blue', '猴', 'autumn'), (44, 'blue', '鸡', 'autumn'),
(45, 'green', '狗', 'autumn'), (46, 'green', '猪', 'autumn'), (47, 'red', '鼠', 'autumn'), (48, 'red', '牛', 'autumn'),
(49, 'blue', '虎', 'autumn')
ON CONFLICT (number) DO NOTHING;