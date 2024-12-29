import dotenv from 'dotenv'
import { Bot, CommandContext, Context } from "grammy";

dotenv.config();

(function checkEnv() {
    const requiredList = [
        'BOT_TOKEN',
        'API_ADDRESS',
    ];

    const missingList = requiredList.filter(key => !process.env[key]);
    if (missingList.length) {
        throw new Error(`Missing required environment variables: ${missingList.join(', ')}`);
    }
})();

// 波特实例
const bot = new Bot(process.env.BOT_TOKEN);

bot.api.setMyCommands([
    { command: "help", description: "获取帮助信息" },
    { command: "search", description: "使用 /search 或 /s 加查找内容来搜索消息" },
]);

bot.command(['start', 'help'], ctx => {
    ctx.reply(
        `
使用 /search 或 /s 加查找内容来搜索消息

搜索消息时，搜索字符串不区分简繁（会使用 OpenCC 自动转换），也不进行分词（请手动将可能不连在一起的词语以空格分开）。

搜索字符串支持以下功能：

以空格分开的多个搜索词是「与」的关系
使用 \`OR\`（全大写）来表达「或」条件
使用 \`-\` 来表达排除，如 \`落絮 - 测试\`
使用小括号来分组

结果会过滤搜索和 bot 自身的消息，当结果过多时请点击按钮查看更早的消息
        `,
        { parse_mode: 'Markdown' },
    );
});

type Group = {
    group_id: string;
    name: string;
    pub_id: string;
}

type Message = {
    id: number;
    from_id: number;
    from_name: string;
    group_id: number;
    html: string;
    t: number;
    edited: number;
}

interface SearchResponse {
    groupinfo: {
        [group_id: string]: [pub_id: string, name: string];
    }
    has_more: boolean;
    messages: Message[];
}


bot.command(['s', 'search'], async ctx => {
    const chatId = ctx.chat?.id;
    const match = ctx.match;
    const isPrivate = ctx.chat?.type === 'private';

    if (isPrivate) {
        ctx.reply('仅支持在群组中使用');
        return;
    } else if (!chatId) {
        ctx.reply('未获取到 chatId');
        return;
    } else if (!match) {
        ctx.reply('查找内容不能为空');
        return;
    }

    const isSupergroup = ctx.chat.type === "supergroup";
    const groupId = String(isSupergroup ? -(chatId + 1000000000000) : chatId);

    let indexedGroups: Group[] = [];

    try {
        indexedGroups = (await (await fetch(`${process.env.API_ADDRESS}/groups`)).json()).groups;
    } catch (error) {
        console.error('error:', error);
        ctx.reply('获取群组信息出现错误，请稍后再试');
    }

    if (!indexedGroups.find(group => group.group_id === groupId)) {
        ctx.reply('当前群组未被索引');
        return;
    }

    try {
        handleSearch(ctx, { groupId, match });
    } catch (error) {
        console.error('error:', error);
        ctx.reply('搜索消息出现错误，请稍后再试');
    }
})

const transV2 = (str: string) => {
    // 使用负向后瞻，不匹配已经被转义的字符
    return str.replace(/(?<!\\)([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

// 在 bot 实例创建后添加回调查询处理器
bot.callbackQuery(/^search:(.+):(\d+)$/, async (ctx) => {
    const [, queryData, lastMessageTime] = ctx.callbackQuery.data.match(/^search:(.+):(\d+)$/) || [];
    if (!queryData || !lastMessageTime) return;

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const isSupergroup = ctx.chat?.type === "supergroup";
    const groupId = String(isSupergroup ? -(chatId + 1000000000000) : chatId);

    try {
        // 删除内联键盘
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });

        // 使用相同参数和 end 时间戳进行新查询
        await handleSearch(ctx, {
            groupId,
            match: queryData,
            end: parseInt(lastMessageTime)
        });
    } catch (error) {
        console.error('error:', error);
        ctx.reply('搜索更多消息时出现错误，请稍后再试');
    }
});

// 修改 handleSearch 函数支持 end 参数
const handleSearch = async (
    ctx: CommandContext<Context> | Context,
    params: {
        groupId: string;
        match: string;
        end?: number;
    }
) => {
    const { groupId, match, end } = params;

    const path = `${process.env.API_ADDRESS}/search?g=${groupId}&q=${encodeURIComponent(match)}${end ? `&end=${end}` : ''}`;
    const result: SearchResponse = await (await fetch(path)).json();

    let { messages, has_more } = result;

    // 过滤查询和 bot 自身的消息
    messages = messages.filter(message => {
        if (message.html.startsWith('/s ') || message.html.startsWith('/search ')) {
            return false
        };

        const botUserId = process.env.BOT_TOKEN.split(':')[0];
        if (message.from_id.toString() === botUserId) {
            return false;
        }

        return true;
    });

    if (messages.length === 0 && !has_more) {
        ctx.reply(`关键词 *${transV2(match)}* 未查找到消息`, {
            parse_mode: 'MarkdownV2',
        });
        return;
    }

    let replyText =
        `关键词 *${transV2(match)}* 查找到`
        + (end ? `更多早于 *${(new Date(end * 1000)).toLocaleString('zh-Hans-CN', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })}* 的` : '')
        + ` *${messages.length}${has_more ? '\\+' : ''}* 条消息`
        + "\n**";

    messages.forEach((message, index) => {
        const { id, from_name, html, t, edited } = message;
        const date = edited ? new Date(edited * 1000) : new Date(t * 1000);
        const dateStr = date.toLocaleString('zh-Hans-CN', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

        replyText += `>[${transV2(from_name)} ${dateStr}${edited ? '✏' : ''}](https://t.me/c/${groupId}/${id})\n`;

        // 处理文本
        const processedText = html.replace(/<span class="keyword">|<\/span>/g, '@@')  // 先替换标签为特殊标记
            .split('@@')  // 分割文本
            .reduce((acc, curr, i) => {
                if (i % 2 === 0) {  // 非关键词部分
                    return [...acc, { text: curr, isKeyword: false }];
                }
                return [...acc, { text: curr, isKeyword: true }];  // 关键词部分
            }, [] as { text: string, isKeyword: boolean }[]);

        let result = '';
        let lastWasEllipsis = false;  // 跟踪上一个是否是省略号

        for (let i = 0; i < processedText.length; i++) {
            const current = processedText[i];
            if (current.isKeyword) {
                const prev = processedText[i - 1]?.text || '';
                const next = processedText[i + 1]?.text || '';

                // 使用 Array.from 正确处理字符
                const prevChars = Array.from(prev);
                const nextChars = Array.from(next);

                const prevText = prevChars.slice(-5).join('');
                const nextText = nextChars.slice(0, 5).join('');

                if (i === 1) {  // 第一个关键词
                    result += prevChars.length > 5 ? '...' + prevText : prev;
                } else if (prevChars.length <= 5) {  // 如果间隔小于5个字符，直接连接
                    result += prev;
                    lastWasEllipsis = false;
                } else {  // 间隔太长，使用省略号
                    if (!lastWasEllipsis) {
                        result += '...' + prevText;
                    } else {
                        result += prevText;
                    }
                }

                result += current.text;  // 添加关键词

                if (i === processedText.length - 2) {  // 最后一个关键词
                    result += nextChars.length > 5 ? nextText + '...' : next;
                } else if (nextChars.length <= 5) {  // 如果到下一个关键词的间隔小于5个字符，不添加省略号
                    result += nextText;
                    lastWasEllipsis = false;
                } else {
                    result += nextText + '...';
                    lastWasEllipsis = true;
                }
            }
        }

        // 将换行符替换为 ↵ 符号
        result = result.replace(/\n/g, '↵');

        replyText += ('>' + transV2(result));

        if (index < messages.length - 1) {
            replyText += '\n';
        }
    });

    replyText += "||";

    // 修改回复消息部分，添加内联键盘
    const lastMessage = messages[messages.length - 1];
    const inlineKeyboard = has_more ? {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: "查询更早的消息",
                    callback_data: `search:${match}:${lastMessage.t}`
                }
            ]]
        }
    } : {};

    await ctx.reply(replyText.trim(), {
        parse_mode: 'MarkdownV2',
        ...inlineKeyboard
    });
}

// 启动
bot.start()