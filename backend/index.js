// index.js
require('dotenv').config();

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
