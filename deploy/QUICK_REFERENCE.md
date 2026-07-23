# 快速部署参考卡片

## 📦 本地打包（Windows）

### 方法一：使用一键脚本
```powershell
cd C:\Users\84653\Desktop\lottery-app_v1
.\deploy\quick-deploy.ps1
```

### 方法二：手动重新打包
如果需要重新生成压缩包：
```powershell
# 删除旧压缩包
Remove-Item lottery-app.zip -Force

# 重新运行打包
# 复制 deploy 文件夹中的脚本到项目根目录运行
```

## 🚀 上传到服务器

### 使用 SCP
```powershell
# 替换 your-server-ip 为你的服务器IP
scp lottery-app.zip ubuntu@your-server-ip:/home/ubuntu/
```

### 或使用其他工具
- FileZilla
- WinSCP
- VS Code Remote SSH

## 🖥️ 服务器部署

### SSH 登录
```bash
ssh ubuntu@your-server-ip
```

### 运行部署脚本
```bash
cd /home/ubuntu

# 确保脚本有执行权限
chmod +x lottery-app/deploy/deploy-server.sh
chmod +x lottery-app/deploy/rollback-server.sh

# 执行部署
cd lottery-app/deploy
./deploy-server.sh
```

## ✅ 验证部署

### 检查容器状态
```bash
cd /home/ubuntu/lottery-app
docker-compose ps
```

### 查看日志
```bash
docker-compose logs -f api
```

### 健康检查
```bash
curl http://localhost:3000/health
```

### 检查 Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 🔄 回滚（如需要）

```bash
cd /home/ubuntu/lottery-app/deploy
./rollback-server.sh
```

## 📂 服务器文件位置

| 项目 | 路径 |
|------|------|
| 项目目录 | `/home/ubuntu/lottery-app/` |
| 压缩包位置 | `/home/ubuntu/lottery-app.zip` |
| Docker Compose | `/home/ubuntu/lottery-app/docker-compose.yml` |
| 数据同步脚本 | `/home/ubuntu/lottery-app/backend/scripts/update-stats.js` |
| Nginx 配置 | `/etc/nginx/sites-enabled/lottery-api` |
| 同步日志 | `/var/log/lottery-update-stats.log` |
