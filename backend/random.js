function randomUnique(min, max, count) {
  const nums = [];
  while (nums.length < count) {
    const n = Math.floor(Math.random() * (max - min + 1)) + min;
    if (!nums.includes(n)) nums.push(n);
  }
  return nums.sort((a, b) => a - b);
}

function randomDigits(min, max, count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * (max - min + 1)) + min);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function generateById(id) {
  switch (id) {
    case 'lhc':
      return { main: randomUnique(1, 49, 6).map(pad2), special: randomUnique(1, 49, 1).map(pad2) };
    case 'ssq':
      return { red: randomUnique(1, 33, 6).map(pad2), blue: randomUnique(1, 16, 1).map(pad2) };
    case 'dlt':
      return { front: randomUnique(1, 35, 5).map(pad2), back: randomUnique(1, 12, 2).map(pad2) };
    case 'qlc':
      return { numbers: randomUnique(1, 30, 7).map(pad2) };
    case 'qxc':
      return { digits: randomDigits(0, 9, 7) };
    case 'fc3d':
      return { digits: randomDigits(0, 9, 3) };
    case 'pl3':
      return { digits: randomDigits(0, 9, 3) };
    case 'pl5':
      return { digits: randomDigits(0, 9, 5) };
    case 'kl8':
      return { numbers: randomUnique(1, 80, 10).map(pad2) };
    default:
      return { numbers: randomUnique(1, 33, 6).map(pad2) };
  }
}

function formatDisplay(id, result) {
  switch (id) {
    case 'lhc': return `主码：${result.main.join(' ')}\n附加号：${result.special.join(' ')}`;
    case 'ssq': return `主区：${result.red.join(' ')}\n副区：${result.blue.join(' ')}`;
    case 'dlt': return `前区：${result.front.join(' ')}\n后区：${result.back.join(' ')}`;
    case 'qxc':
    case 'fc3d':
    case 'pl3':
    case 'pl5': return `号码：${result.digits.join(' ')}`;
    default: return `号码：${result.numbers.join(' ')}`;
  }
}

function formatText(id, result) {
  switch (id) {
    case 'lhc': return `主码:${result.main.join(',')} 附加号:${result.special.join(',')}`;
    case 'ssq': return `主区:${result.red.join(',')} 副区:${result.blue.join(',')}`;
    case 'dlt': return `前区:${result.front.join(',')} 后区:${result.back.join(',')}`;
    case 'qxc':
    case 'fc3d':
    case 'pl3':
    case 'pl5': return `号码:${result.digits.join(',')}`;
    default: return `号码:${result.numbers.join(',')}`;
  }
}

function parseDisplay(display) {
  return display.split('\n').map(line => {
    const [label, nums = ''] = line.split('：');
    return { label, numbers: nums.trim().split(/\s+/).filter(Boolean) };
  }).filter(item => item.label);
}

module.exports = { generateById, formatDisplay, formatText, parseDisplay };
