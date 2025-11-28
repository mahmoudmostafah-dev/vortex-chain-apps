// index.js
require('dotenv').config();

const TradingBot = require('./src/bot');

// إنشاء وتشغيل البوت
const bot = new TradingBot();
bot.start().catch((err) => console.error('error start bot', err));

process.on('SIGINT', () => {
  console.log('\nStopping Vortex-Chain... Bye bye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nBot terminated');
  process.exit(0);
});
