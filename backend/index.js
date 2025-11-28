// index.js
const TradingBot = require('./src/bot');

// إنشاء وتشغيل البوت
const bot = new TradingBot();
bot.start().catch((err) => console.error('فشل في تشغيل البوت:', err));

// إيقاف أنيق عند الضغط على Ctrl+C
process.on('SIGINT', () => {
  console.log('\nإيقاف Vortex-Chain... باي باي يا سوق');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nتم إنهاء البوت');
  process.exit(0);
});
