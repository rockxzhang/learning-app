#!/usr/bin/env bash
# server/deploy.sh - 在线上服务器(47.115.202.192)部署后端与管理后台，端口 9588，不影响现有 OJ/官网(80 端口)
# 用法：把本 server 目录上传到服务器后，执行  bash deploy.sh
set -e
APP_DIR="/opt/zhangjiang-server"
echo "==> 安装至 $APP_DIR"
mkdir -p "$APP_DIR"
cp -rf "$(dirname "$0")"/* "$APP_DIR/"
cd "$APP_DIR"
echo "==> 安装依赖 (ip2region)"
if [ -f package.json ]; then
  (command -v npm >/dev/null 2>&1 && npm install --production) || echo "  无 npm/pnpm，请手动安装 Node 后 npm install"
fi
echo "==> 启动(优先 pm2，其次 nohup)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop zhangjiang-server >/dev/null 2>&1 || true
  pm2 delete zhangjiang-server >/dev/null 2>&1 || true
  PORT=9588 pm2 start server.js --name zhangjiang-server
  pm2 save
else
  pkill -f "server.js" 2>/dev/null || true
  PORT=9588 nohup node server.js > /opt/zhangjiang-server/run.log 2>&1 &
fi
echo "==> 完成。管理后台: http://47.115.202.192:9588/admin  (账号 zhangxin)"
