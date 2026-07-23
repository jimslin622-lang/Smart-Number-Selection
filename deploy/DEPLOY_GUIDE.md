# 云端部署指南

## 前置准备

### 1. 本地项目信息
- 本地项目路径：`C:\Users\84653\Desktop\lottery-app_v1`
- 这是一个包含git仓库的项目，工作目录是干净的

### 2. 服务器信息
- 项目目录：`/home/ubuntu/lottery-app/`
- 项目压缩包：`/home/ubuntu/lottery-app.zip`
- Docker Compose：`/home/ubuntu/lottery-app/docker-compose.yml`
- 数据同步脚本：`/home/ubuntu/lottery-app/server/scripts/update-stats.js`
- Nginx 配置：`/etc/nginx/sites-enabled/lottery-api`
- 同步日志：`/var/log/lottery-update-stats.log`
- 废弃 crontab：`/home/ubuntu/lottery-app/crontab.bak`

## 部署步骤

### 第一步：本地打包项目

在本地 Windows 上运行打包脚本：

```powershell
# 切换到项目目录
cd C:\Users\84653\Desktop\lottery-app_v1

# 运行打包脚本
.\deploy\package-project.ps1
```

这将生成 `lottery-app.zip` 压缩包。

### 第二步：上传到服务器

使用 SCP 或 SFTP 将 `lottery-app.zip` 上传到服务器：

```powershell
# 使用 scp 上传（替换 your-server-ip）
scp lottery-app.zip ubuntu@your-server-ip:/home/ubuntu/
```

### 第三步：服务器端部署

SSH 登录到服务器，然后运行部署脚本：

```bash
# SSH 登录
ssh ubuntu@your-server-ip

# 进入项目目录
cd /home/ubuntu

# 运行部署脚本
bash deploy/deploy-server.sh
```

### 第四步：验证部署

```bash
# 检查容器状态
docker-compose ps

# 查看日志
docker-compose logs -f api

# 测试健康检查
curl http://localhost:3000/health
```

## 部署脚本说明

### package-project.ps1（本地打包脚本）
- 清理旧的压缩包
- 复制必要文件到临时目录
- 创建 zip 压缩包

### deploy-server.sh（服务器部署脚本）
- 备份当前版本
- 解压新项目
- 停止旧容器
- 重新构建并启动新容器
- 更新 Nginx 配置（如需要）
- 运行数据同步脚本
