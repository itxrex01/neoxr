const TelegramBridge = require('../../bridge/bridge'); // Adjust path to your bridge file

let telegramBridge = null;

exports.run = {
   async: async (m, {
      client,
      body,
      setting,
      Func
   }) => {
      try {
         // Initialize bridge if enabled and not already done
         if (setting.telegramBridge?.enabled && !telegramBridge) {
            telegramBridge = new TelegramBridge({
               sock: client,
               user: client.user,
               sendMessage: client.sendMessage.bind(client),
               // Add other methods your bridge needs
            });
            await telegramBridge.initialize();
         }

         // Sync message to Telegram if bridge is active
         if (telegramBridge && setting.telegramBridge?.enabled) {
            await telegramBridge.syncMessage(m, body);
         }
      } catch (e) {
         console.log('Bridge error:', e);
      }
   },
   error: false,
   cache: true,
   location: __filename
}
