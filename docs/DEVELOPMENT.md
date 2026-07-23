# 智能选号小程序开发说明

## 当前正式项目目录

```text
D:\AI zhushou\project
```

微信开发者工具请打开这个目录。

## 当前结构

```text
project
  assets/              # 图标资源
  docs/                # 项目开发文档
  pages/               # 小程序页面
  services/            # 数据服务层，后续接真实接口
  utils/
    lottery.js         # 兼容出口，页面仍可 require('../../utils/lottery')
    lottery/
      config.js        # 彩种配置、颜色、历史期数、映射
      rules.js         # 玩法规则
      generator.js     # 随机生成逻辑
      formatter.js     # 号码格式化
      mock.js          # 模拟示例和解析逻辑
      index.js         # 聚合导出
```

## 数据层说明

当前仍使用本地模拟数据，入口在：

```text
services/lottery-api.js
```

后续接云端接口时，优先替换 `services/lottery-api.js`，避免页面层大改。

建议接口：

```text
GET /api/lottery/latest?type=ssq
GET /api/lottery/history?type=ssq&count=50
GET /api/lottery/analysis?type=ssq
```

## 已完成优化

- 第一阶段：合规文案、参考周期、随机一组/五组、记录保存、记录复制和空状态。
- 第二阶段：热低频数字/奇偶/大小/重号统计、历史页彩种筛选、记录收藏筛选、手动生成与随机补全。
- 第三阶段：拆分 `utils/lottery.js`，新增 `services` 数据层和开发文档。

## 注意事项

- 当前统计和历史开奖基于模拟数据，仅作页面和交互验证。
- 文案需保持“随机生成、娱乐参考、轻松使用”，避免暗示预测结果。
- 不要直接删除归档目录，确认无用后再清理。
