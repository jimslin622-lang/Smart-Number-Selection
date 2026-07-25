# 2026-07-25 开发变更记录

## 一、域名与部署配置

### 1.1 小程序前端配置
- **文件**: `frontend/services/config.js`
- `USE_REMOTE_API: true`
- `API_BASE_URL: 'https://zhinengxuanhao.cn'`

### 1.2 Nginx 配置
- **文件**: `deploy/nginx/zhinengxuanhao.cn.conf`
- 新增 Nginx 配置文件，反向代理到本地 3000 端口
- 支持 HTTP→HTTPS 重定向，SSL 证书配置

### 1.3 域名配置指南
- **文件**: `deploy/DOMAIN_CONFIG_GUIDE.md`
- 包含域名解析、Nginx、SSL、微信公众平台配置步骤

---

## 二、导出功能重构（核心改动）

### 2.1 后端新增导出 API
- **文件**: `backend/server.js`
- **POST `/api/v1/export`**: 接收文本内容 → 生成 xlsx → 返回下载 URL
- **GET `/api/v1/export/download/:filename`**: 文件下载，Content-Disposition 处理中文文件名
- **GET `/api/v1/export/excluded`**: 返回排除的号码组（所有用户已随机 + 已开奖数据）
- **GET `/api/v1/export/remaining`**: 穷举/采样剩余组合

### 2.2 导出格式
- **格式**: xlsx（微信 wx.openDocument 不支持 txt）
- **表头**: 序号 | 彩种 | 期号 | 号码 | (得分 | 维度)
- **得分/维度**: 仅"导出全部号码文档"包含，其他导出不包含
- **依赖**: 新增 `xlsx` 包 (`npm install xlsx`)

### 2.3 前端导出流程
- **文件**: `frontend/pages/detail/detail.js`
- 点击导出 → 前端生成文本 → 后端生成 xlsx → 下载 → 打开
- 去除广告弹窗，直接导出
- 备选"复制内容"功能保留

### 2.4 文件管理
- 导出目录: `backend/exports/`
- **下载后立即删除**，不占磁盘
- **启动时清理残留**（超过 1 小时的文件）
- 文件名: 随机 hex ID + 原始文件名

---

## 三、导出未随机号码

### 3.1 排除逻辑
- 排除已开奖数据（from lottery_draw 表）
- 排除所有用户随机过的数据（from period_records 表）
- 排除本地存储的本期数据

### 3.2 小彩种全量穷举
- fc3d / pl3: 1000 组全量穷举，排除占用后导出全部剩余

### 3.3 大彩种后端采样
- ssq / dlt / lhc 等: 后端随机采样排除，默认 10000 组
- 限制: 微信下载文件最大 10MB，10000 组约 1MB

### 3.4 kl8 特殊处理
- 总组合: 1.65 万亿，不提供"导出未随机号码"按钮

### 各彩种总组合数:
| 彩种 | 总组合数 | 导出方式 |
|------|---------|---------|
| lhc | 6.01 亿 | 采样 |
| dlt | 2143 万 | 采样 |
| ssq | 1772 万 | 采样 |
| qxc | 1000 万 | 采样 |
| qlc | 204 万 | 采样 |
| pl5 | 10 万 | 采样 |
| kl8 | 1.65 万亿 | 不提供 |
| fc3d | 1000 | 全量穷举 |
| pl3 | 1000 | 全量穷举 |

---

## 四、数据库相关

### 4.1 数据导入
- **文件**: `backend/scripts/import-lhc-history.js`
- 修复路径引用（从 frontend/utils/lottery/marksix-history.js 导入）
- 修复日期处理逻辑
- 成功导入 4352 期六合彩历史数据

### 4.2 期号格式统一
- 所有彩种 period 统一为 "26/079" 格式
- 前端生成号码保存时，period 从后端 API 获取真实值
- 生成号码后同时保存到 backend user_records 表（auth 认证）

### 4.3 period_records 表
- SQL 创建脚本: 含 lottery_code, period, main_numbers, extra_numbers, num_hash 字段
- 用于记录所有用户已随机的号码组，支持去重和排除

---

## 五、前端 Bug 修复

### 5.1 特码颜色修复
- **文件**: `frontend/pages/result/result.js`, `detail.js`, `index.js`
- 六合彩(lhc)特码标签匹配: 增加"附加"和"特码"检测
- 修复后特码恢复橙色显示

### 5.2 "全部"组数按钮修复
- **文件**: `frontend/pages/result/result.js`, `result.wxml`
- 新增 `isAllSelected` 标志位
- 修复数据不够 300 组时"全部"按钮不亮的问题

### 5.3 其他
- 导出按钮去除广告弹窗（showExportDoc/showExportAnalysis）
- `_exportDoc` 恢复使用内存数据（修复 `request` 未 import 导致的导出失败）

---

## 六、配置文件变更

### 6.1 后端
- **依赖**: 新增 `xlsx` 包
- **server.js**: 新增 fs, path, crypto, XLSX 导入

### 6.2 前端
- **detail.js**: 引入 `auth` 模块用于保存记录到后端
- **lottery/config.js**: BALL_COLORS 配置未变

---

## 七、部署步骤总结

1. 后端: `npm install` → `node server.js`
2. 前端: 微信开发者工具编译
3. 数据库: 执行 `003_seed_data.sql` 插入彩种类型
4. 数据: 执行 `import-lhc-history.js` 导入历史数据
5. 上线: 前端 `API_BASE_URL` 改为 `https://zhinengxuanhao.cn`
6. 微信公众平台: 配置 request 合法域名为 `https://zhinengxuanhao.cn`
