FROM node:18-alpine

ARG GIT_REPO

WORKDIR /app

# 安装 git 和必要的依赖
RUN apk update \
    && apk add --no-cache git bash \
    && git clone ${GIT_REPO} -b master --depth=1 luoxu-search-bot

# 安装 corepack 和 pnpm
RUN npm install -g corepack \
    && corepack prepare pnpm@latest --activate

WORKDIR /app/luoxu-search-bot

# 复制环境文件
COPY .env .

# 给脚本添加执行权限
RUN chmod +x build.sh
