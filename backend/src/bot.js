// src/bot.js
const ccxt = require('ccxt');
const TelegramBot = require('node-telegram-bot-api');

class TradingBot {
  constructor() {
    // إعداداتك (غيّر دول بس)
    this.API_KEY = process.env.BINANCE_API_KEY || 'ضع_API_KEY_هنا';
    this.API_SECRET = process.env.BINANCE_SECRET_KEY || 'ضع_SECRET_KEY_هنا';
    this.TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'ضع_توكن_البوت_هنا';
    this.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || 'ضع_شات_ID_هنا';

    this.TRADE_USD = 50;
    this.MAX_POSITIONS = 5;
    this.positions = {};

    this.binance = new ccxt.binance({
      apiKey: this.API_KEY,
      secret: this.API_SECRET,
      enableRateLimit: true,
      options: { defaultType: 'spot' },
    });

    this.tgBot = new TelegramBot(this.TELEGRAM_TOKEN);
  }

  async send(msg) {
    console.log(msg);
    await this.tgBot
      .sendMessage(this.TELEGRAM_CHAT_ID, msg + '\n\n#VortexChain')
      .catch(() => {});
  }

  async start() {
    await this.send(
      'Vortex-Chain v2.0 (Class Version) شغال بقوة يا ملك\nجاهز للانطلاق'
    );

    while (true) {
      try {
        const markets = await this.binance.loadMarkets();
        const usdtPairs = Object.keys(markets).filter(
          (s) => s.endsWith('/USDT') && !s.includes('BUSD')
        );

        // فتح صفقات جديدة
        for (const symbol of usdtPairs) {
          if (Object.keys(this.positions).length >= this.MAX_POSITIONS) break;
          if (this.positions[symbol]) continue;

          const ohlcv = await this.binance.fetchOHLCV(
            symbol,
            '5m',
            undefined,
            300
          );
          const closes = ohlcv.map((c) => c[4]);
          const price = closes[closes.length - 1];

          if (price < 0.1) continue;

          const sma50 = (await require('ta.js').sma(closes, 50)).slice(-2);
          const sma200 = (await require('ta.js').sma(closes, 200)).slice(-2);
          const rsi = (await require('ta.js').rsi(closes, 14)).slice(-1)[0];

          const goldenCross = sma50[1] > sma200[1] && sma50[0] <= sma200[0];

          if (goldenCross && rsi < 35) {
            const amount = Number((this.TRADE_USD / price).toFixed(8));
            await this.binance.createMarketBuyOrder(symbol, amount);
            this.positions[symbol] = { entry: price, amount };

            await this.send(`
شراء ${symbol}
السعر: ${price.toFixed(6)}
الكمية: ${amount}
RSI: ${rsi.toFixed(1)}
السبب: Golden Cross
                        `);
          }
        }

        // إغلاق الصفقات
        for (const symbol of Object.keys(this.positions)) {
          const pos = this.positions[symbol];
          const ticker = await this.binance.fetchTicker(symbol);
          const current = ticker.last;
          const profit = ((current - pos.entry) / pos.entry) * 100;

          if (profit >= 6 || profit <= -2.5) {
            await this.binance.createMarketSellOrder(symbol, pos.amount);
            delete this.positions[symbol];

            await this.send(`
بيع ${symbol}
السعر: ${current.toFixed(6)}
الربح: ${profit.toFixed(2)}%
السبب: ${profit >= 6 ? 'Take Profit 6%' : 'Stop Loss -2.5%'}
                        `);
          }
        }
      } catch (err) {
        console.log('خطأ مؤقت:', err.message);
      }

      await new Promise((r) => setTimeout(r, 60_000)); // كل دقيقة
    }
  }
}

module.exports = TradingBot;
