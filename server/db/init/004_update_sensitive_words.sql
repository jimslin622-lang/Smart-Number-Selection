-- 更新 lottery_type 表中的敏感词
-- 执行此脚本可以直接更新现有数据库中的数据，无需重新初始化

UPDATE lottery_type SET name = '六合' WHERE code = 'lhc';
UPDATE lottery_type SET name = '双色' WHERE code = 'ssq';
UPDATE lottery_type SET name = '乐透' WHERE code = 'dlt';
UPDATE lottery_type SET name = '七乐' WHERE code = 'qlc';
UPDATE lottery_type SET name = '七星' WHERE code = 'qxc';
UPDATE lottery_type SET name = '3列' WHERE code = 'pl3';
UPDATE lottery_type SET name = '5列' WHERE code = 'pl5';
UPDATE lottery_type SET name = '快8' WHERE code = 'kl8';

-- 更新注释中可能存在的敏感词（如果有的话）

-- 验证更新结果
SELECT code, name FROM lottery_type ORDER BY id;
