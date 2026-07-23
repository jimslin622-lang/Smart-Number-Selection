const { LOTTERY_MAP } = require('./config');

// ==================== 随机生成 ====================
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

// 生成号码
function generateNumbers(typeName) {
  const id = LOTTERY_MAP[typeName]?.id;
  switch (id) {
    case 'lhc':
      return {
        main: randomUnique(1, 49, 6).map(n => n.toString().padStart(2, '0')),
        special: randomUnique(1, 49, 1).map(n => n.toString().padStart(2, '0'))
      };
    case 'ssq':
      return {
        red: randomUnique(1, 33, 6).map(n => n.toString().padStart(2, '0')),
        blue: randomUnique(1, 16, 1).map(n => n.toString().padStart(2, '0'))
      };
    case 'dlt':
      return {
        front: randomUnique(1, 35, 5).map(n => n.toString().padStart(2, '0')),
        back: randomUnique(1, 12, 2).map(n => n.toString().padStart(2, '0'))
      };
    case 'qlc':
      return {
        numbers: randomUnique(1, 30, 7).map(n => n.toString().padStart(2, '0'))
      };
    case 'qxc':
      return {
        digits: randomDigits(0, 9, 7)
      };
    case 'fc3d':
      return {
        digits: randomDigits(0, 9, 3)
      };
    case 'pl3':
      return {
        digits: randomDigits(0, 9, 3)
      };
    case 'pl5':
      return {
        digits: randomDigits(0, 9, 5)
      };
    case 'kl8':
      return {
        numbers: randomUnique(1, 80, 10).map(n => n.toString().padStart(2, '0'))
      };
    default:
      return { numbers: randomUnique(1, 33, 6).map(n => n.toString().padStart(2, '0')) };
  }
}


module.exports = { generateNumbers };
