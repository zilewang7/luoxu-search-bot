# LUOXU SEARCH BOT

luoxu-search-bot 是使用 node 开发的用于在 telegram 群内以更好的中文索引搜索本群消息的的 tg bot

需要部署 [luoxu](https://github.com/lilydjwg/luoxu) 后端使用



## 用法

使用 `/search` 或 `/s` 加查找内容来搜索消息

- 结果会过滤搜索和 bot 自身的消息，当结果过多时请点击按钮查看更早的消息
- 当关键词前后超过五个字时，会以...省略以免超出回复字数限制
- 点击标题可以跳转到对应消息

![image](https://github.com/user-attachments/assets/98c7bd3a-8009-4050-bc36-91d7b81d7002)



## 部署

参考 `.env.example` 的内容创建一个 `.env` 文件

- `BOT_TOKEN` 为 bot 的 token， 从 [@BotFather](https://t.me/BotFather) 获取
- `API_ADDRESS` 为 luoxu 后端 api 地址，默认为 `http://localhost:9008/luoxu`


配置完成后使用命令

```bash
pnpm i
pnpm dev
```

或使用 docker

```bash
docker compose up -d
```

即可启动



## 感谢
- [lilydjwg/luoxu](https://github.com/lilydjwg/luoxu)
- [grammyjs/grammY](https://github.com/grammyjs/grammY)