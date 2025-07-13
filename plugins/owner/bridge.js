const TelegramBridge = require('../../bridge/bridge'); // Adjust path

let telegramBridge = null;

exports.run = {
   usage: ['bridge'],
   use: 'on/off/status',
   category: 'owner',
   async: async (m, {
      client,
      args,
      isPrefix,
      command,
      setting,
      Func
   }) => {
      try {
         if (!args || !args[0]) {
            const status = setting.telegramBridge?.enabled ? 'ON' : 'OFF';
            return client.reply(m.chat, `🌉 Bridge Status: ${status}\n\nUsage: ${isPrefix}${command} on/off/status`, m);
         }

         const action = args[0].toLowerCase();

         switch (action) {
            case 'on':
               if (!telegramBridge) {
                  telegramBridge = new TelegramBridge({
                     sock: client,
                     user: client.user,
                     sendMessage: client.sendMessage.bind(client),
                  });
                  await telegramBridge.initialize();
               }
               
               setting.telegramBridge = { enabled: true };
               client.reply(m.chat, '✅ Telegram bridge enabled', m);
               break;

            case 'off':
               if (telegramBridge) {
                  await telegramBridge.shutdown();
                  telegramBridge = null;
               }
               
               setting.telegramBridge = { enabled: false };
               client.reply(m.chat, '❌ Telegram bridge disabled', m);
               break;

            case 'status':
               const bridgeStatus = telegramBridge ? 'Active' : 'Inactive';
               const configStatus = setting.telegramBridge?.enabled ? 'Enabled' : 'Disabled';
               client.reply(m.chat, `🌉 Bridge Status:\n• Config: ${configStatus}\n• Instance: ${bridgeStatus}`, m);
               break;

            default:
               client.reply(m.chat, `❌ Invalid option. Use: on/off/status`, m);
         }
      } catch (e) {
         client.reply(m.chat, Func.jsonFormat(e), m);
      }
   },
   owner: true,
   cache: true,
   location: __filename
}
