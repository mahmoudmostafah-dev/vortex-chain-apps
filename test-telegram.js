// Test Telegram
const TelegramBot = require('node-telegram-bot-api');

const token = '8389147131:AAH0FnRxnoCQIOYWqJ9XCMhLKoa4bhIIPAw';
const chatId = 5626352342;

const bot = new TelegramBot(token, { polling: false });

bot
  .sendMessage(chatId, '🧪 Test message from Vortex-Chain Bot')
  .then(() => {
    console.log('✅ Message sent successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err.message);
    if (err.response) {
      console.error('Response:', err.response.body);
    }
    process.exit(1);
  });
