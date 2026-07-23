const { LOTTERY_MAP } = require('./config');

function formatNumbers(typeName, result) {
  const id = LOTTERY_MAP[typeName]?.id;
  switch (id) {
    case 'lhc': return `主码:${result.main.join(',')} 附加号:${result.special.join(',')}`;
    case 'ssq': return `主区:${result.red.join(',')} 副区:${result.blue.join(',')}`;
    case 'dlt': return `前区:${result.front.join(',')} 后区:${result.back.join(',')}`;
    case 'qxc': return `号码:${result.digits.join(',')}`;
    case 'fc3d':
    case 'pl3':
    case 'pl5': return `号码:${result.digits.join(',')}`;
    default: return `号码:${result.numbers.join(',')}`;
  }
}

function formatDisplay(typeName, result) {
  const id = LOTTERY_MAP[typeName]?.id;
  switch (id) {
    case 'lhc': return `主码：${result.main.join(' ')}\n附加号：${result.special.join(' ')}`;
    case 'ssq': return `主区：${result.red.join(' ')}\n副区：${result.blue.join(' ')}`;
    case 'dlt': return `前区：${result.front.join(' ')}\n后区：${result.back.join(' ')}`;
    case 'qxc': return `号码：${result.digits.join(' ')}`;
    case 'fc3d':
    case 'pl3':
    case 'pl5': return `号码：${result.digits.join(' ')}`;
    default: return `号码：${result.numbers.join(' ')}`;
  }
}


module.exports = { formatNumbers, formatDisplay };
