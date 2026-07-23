#!/bin/bash
# 服务器部署脚本 - Ubuntu/Linux

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_DIR="/home/ubuntu/lottery-app"
BACKUP_DIR="/home/ubuntu/lottery-app_backup_$(date +%Y%m%d_%H%M%S)"
ZIP_FILE="/home/ubuntu/lottery-app.zip"
TEMP_DIR="/home/ubuntu/lottery-app_temp"

echo -e "${GREEN}=== 开始部署 lottery-app ===${NC}"

# 检查压缩包是否存在
if [ ! -f "$ZIP_FILE" ]; then
    echo -e "${RED}错误: 找不到压缩包 $ZIP_FILE${NC}"
    exit 1
fi

# 1. 备份当前版本
echo -e "${YELLOW}1. 备份当前版本...${NC}"
if [ -d "$PROJECT_DIR" ]; then
    mv "$PROJECT_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}备份完成: $BACKUP_DIR${NC}"
fi

# 2. 解压新项目
echo -e "${YELLOW}2. 解压新项目...${NC}"
mkdir -p "$TEMP_DIR"
unzip -q "$ZIP_FILE" -d "$TEMP_DIR"
mv "$TEMP_DIR" "$PROJECT_DIR"
echo -e "${GREEN}解压完成${NC}"

# 3. 进入项目目录
cd "$PROJECT_DIR"

# 4. 停止旧容器
echo -e "${YELLOW}3. 停止旧容器...${NC}"
if [ -f "docker-compose.yml" ]; then
    docker-compose down || true
fi

# 5. 重新构建并启动
echo -e "${YELLOW}4. 构建并启动新容器...${NC}"
docker-compose up -d --build

# 6. 等待服务启动
echo -e "${YELLOW}5. 等待服务启动...${NC}"
sleep 15

# 7. 检查服务状态
echo -e "${YELLOW}6. 检查服务状态...${NC}"
docker-compose ps

# 8. 运行数据同步脚本（如果存在）
echo -e "${YELLOW}7. 运行数据同步...${NC}"
if [ -f "$PROJECT_DIR/backend/scripts/update-stats.js" ]; then
    echo -e "${GREEN}数据同步脚本已就位${NC}"
    # 注意：实际运行需要根据项目情况调整
fi

# 9. 清理旧压缩包
echo -e "${YELLOW}8. 清理临时文件...${NC}"
rm -f "$ZIP_FILE"

echo -e "${GREEN}=== 部署完成 ===${NC}"
echo -e "${YELLOW}下一步操作:${NC}"
echo "1. 查看日志: docker-compose logs -f api"
echo "2. 测试健康检查: curl http://localhost:3000/health"
echo "3. 如需要，更新 Nginx 配置"
