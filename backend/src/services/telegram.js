// src/services/telegram.js - خدمة التليجرام

const TelegramBot = require('node-telegram-bot-api');

class TelegramService {
  constructor(config) {
    this.config = config;
    this.bot = new TelegramBot(config.telegram.token, { polling: false });
    this.chatId = config.telegram.chatId;
    this.lastMessageTime = {};
  }

  async send(message) {
    try {
      await this.bot.sendMessage(this.chatId, message + '\n\n#VortexChain', {
        parse_mode: 'HTML',
      });
    } catch (err) {
      console.error('Telegram error:', err.message);
      // ✅ لوج تفصيلي للتشخيص
      if (err.response) {
        console.error('Telegram response:', err.response.body);
      }
    }
  }

  async sendWithCooldown(symbol, message, messageType = 'scan') {
    const key = `${symbol}_${messageType}`;
    const now = Date.now();
    const lastTime = this.lastMessageTime[key] || 0;

    if (now - lastTime < this.config.cache.messageCooldown) {
      return;
    }

    this.lastMessageTime[key] = now;
    await this.send(message);
  }

  async sendDailyReport(stats, balance, initialBalance, positionsCount) {
    const { total, wins, total_profit, avg_profit, total_fees } = stats;
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    const dailyPnL = ((balance - initialBalance) / initialBalance) * 100;

    const report = `📊 DAILY REPORT
━━━━━━━━━━━━━━━
Total Trades: ${total || 0}
Wins: ${wins || 0} | Losses: ${total - wins || 0}
Win Rate: ${winRate}%
Total P/L: ${total_profit > 0 ? '+' : ''}$${(total_profit || 0).toFixed(2)}
Avg P/L: ${avg_profit > 0 ? '+' : ''}${(avg_profit || 0).toFixed(2)}%
Total Fees: $${(total_fees || 0).toFixed(2)}
Daily P/L: ${dailyPnL > 0 ? '+' : ''}${dailyPnL.toFixed(2)}%
Active Positions: ${positionsCount}
Balance: $${balance.toFixed(2)}
━━━━━━━━━━━━━━━`;

    await this.send(report);
  }
}

module.exports = TelegramService;
