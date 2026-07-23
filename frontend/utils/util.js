const sampleResults = {
  "双色": ["01 06 12 18 23 31 + 04"],
  "乐透": ["07 09 17 24 31 + 05 12"],
  "排列三": ["3 7 1"]
};

function getSampleResults(type) {
  return sampleResults[type] || ["暂无数据，请返回首页选择彩票类型。"];
}

module.exports = {
  getSampleResults
};
