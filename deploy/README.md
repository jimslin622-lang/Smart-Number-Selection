# Deploy 文件夹说明

这个文件夹包含了部署 lottery-app 项目所需的所有脚本和文档。

## 文件说明

| 文件 | 说明 |
|------|------|
| `DEPLOY_GUIDE.md` | 详细的部署指南文档 |
| `QUICK_REFERENCE.md` | 快速参考卡片（推荐先看这个） |
| `package-project.ps1` | Windows PowerShell 打包脚本 |
| `quick-deploy.ps1` | 一键打包脚本（更简单） |
| `deploy-server.sh` | 服务器端部署脚本 |
| `rollback-server.sh` | 服务器端回滚脚本 |

## 开始使用

### 1. 本地打包
在 Windows 上，双击或运行：
```powershell
.\quick-deploy.ps1
```

### 2. 上传到服务器
将生成的 `lottery-app.zip` 上传到服务器的 `/home/ubuntu/` 目录

### 3. 服务器部署
SSH 登录服务器后，运行：
```bash
cd /home/ubuntu/lottery-app/deploy
./deploy-server.sh
```

详细步骤请参考 `QUICK_REFERENCE.md` 或 `DEPLOY_GUIDE.md`。
