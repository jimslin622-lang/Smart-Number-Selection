#!/bin/bash
# 回滚脚本 - 恢复到上一个版本

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="/home/ubuntu/lottery-app"

echo -e "${YELLOW}查找可用的备份...${NC}"
BACKUPS=($(ls -d /home/ubuntu/lottery-app_backup_* 2>/dev/null | sort -r))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}没有找到备份！${NC}"
    exit 1
fi

echo -e "${GREEN}找到以下备份:${NC}"
for i in "${!BACKUPS[@]}"; do
    echo "  [$i] ${BACKUPS[$i]}"
done

echo ""
read -p "请选择要回滚的备份编号 (默认 0): " choice
choice=${choice:-0}

if [ -z "${BACKUPS[$choice]}" ]; then
    echo -e "${RED}无效的选择！${NC}"
    exit 1
fi

BACKUP_TO_RESTORE=${BACKUPS[$choice]}
echo -e "${YELLOW}即将回滚到: $BACKUP_TO_RESTORE${NC}"
read -p "确认？(y/N): " confirm

if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo -e "${RED}取消回滚${NC}"
    exit 0
fi

# 执行回滚
echo -e "${YELLOW}停止当前服务...${NC}"
cd "$PROJECT_DIR" && docker-compose down || true

echo -e "${YELLOW}恢复备份...${NC}"
rm -rf "$PROJECT_DIR"
mv "$BACKUP_TO_RESTORE" "$PROJECT_DIR"

echo -e "${YELLOW}启动服务...${NC}"
cd "$PROJECT_DIR"
docker-compose up -d

echo -e "${GREEN}=== 回滚完成 ===${NC}"
