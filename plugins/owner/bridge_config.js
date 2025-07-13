exports.run = {
   usage: ['bridgeconfig'],
   use: 'token|chatid|logchannel',
   category: 'owner',
   async: async (m, {
      client,
      text,
      isPrefix,
      command,
      setting,
      Func
   }) => {
      try {
         if (!text) {
            const config = setting.telegramBridge;
            let configText = `🌉 *Telegram Bridge Configuration*\n\n`;
            configText += `• *Enabled*: ${config?.enabled ? '✅' : '❌'}\n`;
            configText += `• *Bot Token*: ${config?.botToken ? '✅ Set' : '❌ Not Set'}\n`;
            configText += `• *Chat ID*: ${config?.chatId || 'Not Set'}\n`;
            configText += `• *Log Channel*: ${config?.logChannel || 'Not Set'}\n\n`;
            configText += `*Usage:*\n`;
            configText += `${isPrefix}${command} token|YOUR_BOT_TOKEN\n`;
            configText += `${isPrefix}${command} chatid|YOUR_CHAT_ID\n`;
            configText += `${isPrefix}${command} logchannel|YOUR_LOG_CHANNEL`;
            
            return client.reply(m.chat, configText, m);
         }

         const [key, value] = text.split('|');
         if (!key || !value) {
            return client.reply(m.chat, `❌ Invalid format. Use: ${isPrefix}${command} key|value`, m);
         }

         if (!setting.telegramBridge) {
            setting.telegramBridge = {
               enabled: false,
               botToken: '',
               chatId: '',
               logChannel: '',
               features: {
                  topics: true,
                  mediaSync: true,
                  profilePicSync: true,
                  callLogs: true,
                  statusSync: true,
                  biDirectional: true,
                  welcomeMessage: false,
                  sendOutgoingMessages: false,
                  presenceUpdates: true,
                  readReceipts: false,
                  animatedStickers: true
               }
            };
         }

         switch (key.toLowerCase()) {
            case 'token':
               setting.telegramBridge.botToken = value;
               client.reply(m.chat, '✅ Bot token updated', m);
               break;
            case 'chatid':
               setting.telegramBridge.chatId = value;
               client.reply(m.chat, '✅ Chat ID updated', m);
               break;
            case 'logchannel':
               setting.telegramBridge.logChannel = value;
               client.reply(m.chat, '✅ Log channel updated', m);
               break;
            default:
               client.reply(m.chat, '❌ Invalid key. Use: token, chatid, or logchannel', m);
         }
      } catch (e) {
         client.reply(m.chat, Func.jsonFormat(e), m);
      }
   },
   owner: true,
   cache: true,
   location: __filename
}
