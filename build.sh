#!/bin/bash

cd /app/luoxu-search-bot

# 更新代码
git pull

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 安装 pm2
npm install -g pm2

# 运行应用程序
pm2-runtime /app/luoxu-search-bot/dist/index.js
