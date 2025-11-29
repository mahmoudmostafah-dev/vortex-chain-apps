// src/services/telegram.js - خدمة التليجرام

class TelegramService {
  constructor(config) {
    this.config = config;
    this.token = config.telegram.token;
    this.chatId = config.telegram.chatId;
    this.lastMessageTime = {};
    this.apiUrl = `https://api.telegram.org/bot${this.token}`;

    console.log(
      `[Telegram] Initialized with chatId: ${this.chatId} (type: ${typeof this
        .chatId})`
    );
  }

  async send(message) {
    try {
      const url = `${this.apiUrl}/sendMessage`;
      const payload = {
        chat_id: this.chatId,
        text: message + '\n\n#VortexChain',
      };

      console.log(`[Telegram] URL: ${url}`);
      console.log(`[Telegram] Token length: ${this.token.length}`);
      console.log(`[Telegram] Payload:`, JSON.stringify(payload));

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log(`[Telegram] Response:`, JSON.stringify(data));

      if (!data.ok) {
        throw new Error(`Telegram API error: ${data.description}`);
      }

      console.log(`[Telegram] ✅ Message sent successfully`);
      return data;
    } catch (err) {
      console.error('Telegram error:', err.message);
      console.error(
        'Telegram chatId:',
        this.chatId,
        'type:',
        typeof this.chatId
      );
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
Total P/L: ${total_profit > 0 ? '+' : ''}${(total_profit || 0).toFixed(2)}
Avg P/L: ${avg_profit > 0 ? '+' : ''}${(avg_profit || 0).toFixed(2)}%
Total Fees: ${(total_fees || 0).toFixed(2)}
Daily P/L: ${dailyPnL > 0 ? '+' : ''}${dailyPnL.toFixed(2)}%
Active Positions: ${positionsCount}
Balance: ${balance.toFixed(2)}
━━━━━━━━━━━━━━━`;

    await this.send(report);
  }
}

module.exports = TelegramService;
