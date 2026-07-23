# 快速部署脚本 - 一键执行打包
# 这是 package-project.ps1 的简化版本

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Lottery App 一键部署工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否在正确的目录
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath

Set-Location $projectRoot
Write-Host "当前目录: $projectRoot" -ForegroundColor Yellow

# 运行打包脚本
Write-Host ""
Write-Host "开始打包项目..." -ForegroundColor Green
& "$scriptPath\package-project.ps1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  打包完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "接下来的步骤:" -ForegroundColor Yellow
Write-Host "1. 将 lottery-app.zip 上传到服务器"
Write-Host "2. 在服务器上运行 deploy/deploy-server.sh"
Write-Host ""
Write-Host "上传命令示例 (替换 your-server-ip):" -ForegroundColor Cyan
Write-Host "  scp lottery-app.zip ubuntu@your-server-ip:/home/ubuntu/"
Write-Host ""
