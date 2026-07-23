const fs = require('fs');
const path = require('path');

const replacements = [
    { from: /香港六合彩?/g, to: '六合' },
    { from: /港彩/g, to: '六合' },
    { from: /双色球/g, to: '双色' },
    { from: /大乐透/g, to: '乐透' },
    { from: /七乐彩/g, to: '七乐' },
    { from: /七星彩/g, to: '七星' },
    { from: /排列3/g, to: '3列' },
    { from: /排列5/g, to: '5列' },
    { from: /快乐8/g, to: '快8' },
    { from: /彩种/g, to: '玩法' },
    { from: /开奖/g, to: '示例' },
    { from: /历史开奖/g, to: '历史示例' },
    { from: /最新开奖/g, to: '最新示例' },
    { from: /查看开奖/g, to: '查看示例' },
];

console.log('开始处理 SQL 种子数据文件...');
console.log('-------------------');

const seedFilePath = path.join(__dirname, 'server', 'db', 'init', '003_seed_data.sql');

if (fs.existsSync(seedFilePath)) {
    let content = fs.readFileSync(seedFilePath, 'utf8');
    let original = content;
    
    replacements.forEach(repl => {
        content = content.replace(repl.from, repl.to);
    });
    
    if (content !== original) {
        console.log('修改: server/db/init/003_seed_data.sql');
        fs.writeFileSync(seedFilePath, content, 'utf8');
        
        console.log('-------------------');
        console.log('SQL 种子文件已更新！');
        console.log('');
        console.log('下一步：你需要重新初始化数据库才能让更改生效。');
        console.log('');
        console.log('更新数据库的选项：');
        console.log('1. 如果使用 Docker，运行: docker-compose down -v && docker-compose up -d');
        console.log('2. 如果直接连接数据库，执行以下 SQL:');
        console.log('');
        console.log(generateUpdateSQL());
    } else {
        console.log('SQL 种子文件已经是最新的，无需修改。');
    }
} else {
    console.log('未找到 SQL 种子文件:', seedFilePath);
}

function generateUpdateSQL() {
    return `-- 更新 lottery_type 表中的敏感词
UPDATE lottery_type SET name = '六合' WHERE code = 'lhc';
UPDATE lottery_type SET name = '双色' WHERE code = 'ssq';
UPDATE lottery_type SET name = '乐透' WHERE code = 'dlt';
UPDATE lottery_type SET name = '七乐' WHERE code = 'qlc';
UPDATE lottery_type SET name = '七星' WHERE code = 'qxc';
UPDATE lottery_type SET name = '3列' WHERE code = 'pl3';
UPDATE lottery_type SET name = '5列' WHERE code = 'pl5';
UPDATE lottery_type SET name = '快8' WHERE code = 'kl8';

-- 验证更新
SELECT code, name FROM lottery_type;`;
}
