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

// تشغيل البوت المقسم لملفات منفصلة
const bot = new VortexChainBot();
bot.start().catch((err) => console.error('Bot startup error:', err));

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Vortex-Chain bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Bot terminated');
  process.exit(0);
});
