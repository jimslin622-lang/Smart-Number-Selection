# 项目打包脚本 - Windows PowerShell
# 用于将 lottery-app_v1 项目打包为 lottery-app.zip

$ErrorActionPreference = "Stop"

# 项目配置
$projectPath = "C:\Users\84653\Desktop\lottery-app_v1"
$deployPath = Join-Path $projectPath "deploy"
$tempDir = Join-Path $deployPath "temp"
$zipPath = Join-Path $projectPath "lottery-app.zip"

Write-Host "=== 开始打包项目 ===" -ForegroundColor Green

# 清理旧文件
if (Test-Path $zipPath) {
    Write-Host "删除旧压缩包..."
    Remove-Item $zipPath -Force
}

if (Test-Path $tempDir) {
    Write-Host "清理临时目录..."
    Remove-Item $tempDir -Recurse -Force
}

# 创建临时目录
Write-Host "创建临时目录..."
New-Item -ItemType Directory -Path $tempDir | Out-Null

# 复制必要文件
Write-Host "复制项目文件..."

# 复制后端代码
Copy-Item -Path (Join-Path $projectPath "backend") -Destination (Join-Path $tempDir "backend") -Recurse

# 复制前端代码
Copy-Item -Path (Join-Path $projectPath "frontend") -Destination (Join-Path $tempDir "frontend") -Recurse

# 复制配置文件
Copy-Item -Path (Join-Path $projectPath "docker-compose.yml") -Destination $tempDir
Copy-Item -Path (Join-Path $projectPath "Dockerfile") -Destination $tempDir
Copy-Item -Path (Join-Path $projectPath "package.json") -Destination $tempDir
Copy-Item -Path (Join-Path $projectPath "package-lock.json") -Destination $tempDir
Copy-Item -Path (Join-Path $projectPath ".dockerignore") -Destination $tempDir

# 复制文档
Copy-Item -Path (Join-Path $projectPath "docs") -Destination (Join-Path $tempDir "docs") -Recurse

# 复制部署脚本
Copy-Item -Path $deployPath -Destination (Join-Path $tempDir "deploy") -Recurse

# 创建压缩包
Write-Host "创建压缩包..."
Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -Force

# 清理临时目录
Write-Host "清理临时文件..."
Remove-Item $tempDir -Recurse -Force

Write-Host "=== 打包完成 ===" -ForegroundColor Green
Write-Host "压缩包位置: $zipPath"
Write-Host "文件大小: $([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) MB"
