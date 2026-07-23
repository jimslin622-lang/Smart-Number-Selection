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

const foldersToProcess = ['pages', 'utils', 'services', 'server'];

let filesProcessed = 0;
let filesModified = 0;

console.log('开始处理...');
console.log('-------------------');

foldersToProcess.forEach(folder => {
    const fullPath = path.join(__dirname, folder);
    processFolder(fullPath);
});

const rootFiles = ['package.json', 'app.json'];
rootFiles.forEach(file => {
    processFile(path.join(__dirname, file));
});

console.log('-------------------');
console.log(`处理完成！共处理 ${filesProcessed} 个文件，修改了 ${filesModified} 个！`);

function processFolder(folderPath) {
    if (!fs.existsSync(folderPath)) return;
    
    const items = fs.readdirSync(folderPath);
    items.forEach(item => {
        const fullItemPath = path.join(folderPath, item);
        const stat = fs.statSync(fullItemPath);
        if (stat.isDirectory()) {
            processFolder(fullItemPath);
        } else if (stat.isFile()) {
            processFile(fullItemPath);
        }
    });
}

function processFile(filePath) {
    const ext = path.extname(filePath);
    if (['.js', '.wxml', '.wxss', '.json'].indexOf(ext) === -1) return;
    
    filesProcessed++;
    
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let original = content;
        
        replacements.forEach(repl => {
            content = content.replace(repl.from, repl.to);
        });
        
        if (content !== original) {
            console.log(`修改: ${path.relative(__dirname, filePath)}`);
            fs.writeFileSync(filePath, content, 'utf8');
            filesModified++;
        }
    } catch (err) {
        console.error(`处理失败: ${filePath} - ${err.message}`);
    }
}
