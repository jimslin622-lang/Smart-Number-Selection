const { generateNumbers } = require('./generator');
const { formatNumbers, formatDisplay } = require('./formatter');

// ==================== 模拟示例组合 ====================
const MOCK_LATEST = {
  lhc: { type: '6+1模式', period: '示例A-01', date: '今日示例', display: '主码：05 12 18 23 31 42\n附加号：38',
    parsed:[{label:'主码',numbers:['05','12','18','23','31','42']},{label:'附加号',numbers:['38']}] },
  ssq: { type: '红蓝模式', period: '示例B-01', date: '今日示例', display: '主区：01 09 13 18 24 27\n副区：11',
    parsed:[{label:'主区',numbers:['01','09','13','18','24','27']},{label:'副区',numbers:['11']}] },
  dlt: { type: '双区模式', period: '示例C-01', date: '今日示例', display: '前区：02 09 17 24 28\n后区：04 10',
    parsed:[{label:'前区',numbers:['02','09','17','24','28']},{label:'后区',numbers:['04','10']}] },
  qlc: { type: '七位模式', period: '示例D-01', date: '今日示例', display: '号码：03 07 12 15 19 23 26',
    parsed:[{label:'号码',numbers:['03','07','12','15','19','23','26']}] },
  qxc: { type: '七星模式', period: '示例E-01', date: '今日示例', display: '号码：2 3 1 0 5 8 9',
    parsed:[{label:'号码',numbers:['2','3','1','0','5','8','9']}] },
  fc3d: { type: '三位模式', period: '示例3D-01', date: '今日示例', display: '号码：5 1 3',
    parsed:[{label:'号码',numbers:['5','1','3']}] },
  pl3: { type: '三星模式', period: '示例3-01', date: '今日示例', display: '号码：3 4 9',
    parsed:[{label:'号码',numbers:['3','4','9']}] },
  pl5: { type: '五星模式', period: '示例5-01', date: '今日示例', display: '号码：8 2 7 1 5',
    parsed:[{label:'号码',numbers:['8','2','7','1','5']}] },
  kl8: { type: '八选模式', period: '示例10-01', date: '今日示例', display: '号码：03 11 15 27 35 42 48 53 64 72',
    parsed:[{label:'号码',numbers:['03','11','15','27','35','42','48','53','64','72']}] },
};

function parseDisplay(display) {
  const lines = display.split('\n');
  const result = [];
  lines.forEach(line => {
    const parts = line.split('：');
    if (parts.length === 2) {
      result.push({
        label: parts[0],
        numbers: parts[1].trim().split(/\s+/)
      });
    }
  });
  return result;
}

// ==================== 模拟历史示例 ====================
function getMockResults(typeName) {
  const results = [];
  const now = new Date();
  for (let i = 0; i < 20; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
    const res = generateNumbers(typeName);
    const formatted = formatNumbers(typeName, res);
    const display = formatDisplay(typeName, res);
    
    // 生成看起来像真实期号的格式
    let period;
    const year = now.getFullYear();
    if (typeName === '6+1模式') {
      const shortYear = String(year).slice(-2);
      period = `${shortYear}/${String(100 - i).padStart(3, '0')}`;
    } else if (typeName === '红蓝模式' || typeName === '双区模式' || typeName === '七位模式') {
      period = `${year}${String(150 - i).padStart(3, '0')}`;
    } else if (typeName === '七星模式') {
      period = `${year}${String(180 - i).padStart(3, '0')}`;
    } else if (typeName === '三位模式' || typeName === '三星模式' || typeName === '五星模式') {
      const dayOfYear = Math.floor((now - new Date(year, 0, 1)) / (24 * 60 * 60 * 1000)) + 1 - i;
      period = `${year}${String(dayOfYear).padStart(3, '0')}`;
    } else if (typeName === '八选模式') {
      period = `${year}${String(200 - i).padStart(3, '0')}`;
    } else {
      period = `${year}${String(100 - i).padStart(3, '0')}`;
    }
    
    results.push({
      date: dateStr,
      period,
      numbers: formatted,
      numberList: formatted.replace(/[^\d,]/g, '').split(',').filter(s => s),
      display: display
    });
  }
  return results;
}

module.exports = { MOCK_LATEST, parseDisplay, getMockResults };
