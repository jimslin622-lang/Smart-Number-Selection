# 项目整理脚本 - 前后端分离
Write-Host "开始整理项目结构..." -ForegroundColor Green

# 创建文件夹
$folders = @("frontend", "backend")
foreach ($folder in $folders) {
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
        Write-Host "创建文件夹: $folder" -ForegroundColor Yellow
    }
}

# 移动前端文件到 frontend/
$frontendFiles = @(
    "pages",
    "components",
    "assets",
    "utils",
    "services",
    "app.js",
    "app.json",
    "app.wxss",
    "sitemap.json",
    "project.config.json",
    "project.private.config.json"
)
foreach ($file in $frontendFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "frontend/" -Force
        Write-Host "移动到前端: $file" -ForegroundColor Cyan
    }
}

# 移动后端文件到 backend/
$backendFiles = @(
    "server",
    "scripts",
    "crontab"
)
foreach ($file in $backendFiles) {
    if (Test-Path $file) {
        Move-Item -Path $file -Destination "backend/" -Force
        Write-Host "移动到后端: $file" -ForegroundColor Cyan
    }
}

# 复制配置文件到对应的位置
if (Test-Path "package.json") {
    Copy-Item -Path "package.json" -Destination "backend/" -Force
    Write-Host "复制 package.json 到后端" -ForegroundColor Cyan
}

if (Test-Path "package-lock.json") {
    Copy-Item -Path "package-lock.json" -Destination "backend/" -Force
    Write-Host "复制 package-lock.json 到后端" -ForegroundColor Cyan
}

Write-Host "`n项目结构整理完成！" -ForegroundColor Green
Write-Host "新结构："
Write-Host "  frontend/  - 小程序前端"
Write-Host "  backend/   - API 后端"
