// index.js
require('dotenv').config();

// Debug: verify environment variables are loaded
console.log('Environment check:');
console.log(
  'BINANCE_API_KEY:',
  process.env.BINANCE_API_KEY ? '✓ Loaded' : '✗ Missing'
);
console.log(
  'BINANCE_SECRET_KEY:',
  process.env.BINANCE_SECRET_KEY ? '✓ Loaded' : '✗ Missing'
);

const VortexChainBot = require('./src/bot-modular');
const ApiServer = require('./src/api-server');

// تشغيل البوت المقسم لملفات منفصلة
const bot = new VortexChainBot();
let apiServer;

bot
  .start()
  .then(() => {
    // تشغيل API Server بعد تشغيل البوت
    apiServer = new ApiServer(bot.config, bot.database, bot.logger);
    apiServer.setBot(bot);
    apiServer.init();
  })
  .catch((err) => console.error('Bot startup error:', err));

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Vortex-Chain bot...');
  if (apiServer) apiServer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Bot terminated');
  if (apiServer) apiServer.stop();
  process.exit(0);
});
