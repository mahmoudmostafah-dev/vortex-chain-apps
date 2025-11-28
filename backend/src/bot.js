// src/bot.js
require('dotenv').config();
const ccxt = require('ccxt');
const TelegramBot = require('node-telegram-bot-api');
const { sma, rsi } = require('ta.js'); // ← تم الحل نهائيًا

class TradingBot {
  constructor() {
    this.API_KEY = process.env.BINANCE_API_KEY;
    this.API_SECRET = process.env.BINANCE_SECRET_KEY;
    this.TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    this.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
      'Vortex-Chain v2.0 is running strong, king!\nReady to take off'
    );

    while (true) {
      try {
        const markets = await this.binance.loadMarkets();
        const usdtPairs = Object.keys(markets).filter(
          (s) => s.endsWith('/USDT') && !s.includes('BUSD')
        );

        // === فتح صفقات جديدة ===
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

          const sma50 = (await sma(closes, 50)).slice(-2);
          const sma200 = (await sma(closes, 200)).slice(-2);
          const currentRsi = (await rsi(closes, 14)).slice(-1)[0];

          const goldenCross = sma50[1] > sma200[1] && sma50[0] <= sma200[0];

          if (goldenCross && currentRsi < 35) {
            const amount = Number((this.TRADE_USD / price).toFixed(8));

            try {
              await this.binance.createMarketBuyOrder(symbol, amount);
              this.positions[symbol] = { entry: price, amount };

              await this.send(`
BUY ${symbol}
Price: ${price.toFixed(6)}
Amount: ${amount}
RSI: ${currentRsi.toFixed(1)}
Reason: Golden Cross
              `);
            } catch (buyError) {
              const errMsg = buyError.toString();
              if (
                errMsg.includes('insufficient') ||
                errMsg.includes('-1013') ||
                errMsg.includes('balance')
              ) {
                await this.send(`
NOT ENOUGH BALANCE TO BUY!
Symbol: ${symbol}
Price: ${price.toFixed(6)}
Needed: ~$${this.TRADE_USD}
Add funds → Vortex will buy it next cycle!
                `);
              } else {
                console.log('Buy error:', errMsg);
              }
            }
          }
        }

        // === إغلاق الصفقات ===
        for (const symbol of Object.keys(this.positions)) {
          const pos = this.positions[symbol];
          const ticker = await this.binance.fetchTicker(symbol);
          const current = ticker.last;
          const profit = ((current - pos.entry) / pos.entry) * 100;

          if (profit >= 6 || profit <= -2.5) {
            try {
              await this.binance.createMarketSellOrder(symbol, pos.amount);
              delete this.positions[symbol];

              await this.send(`
SELL ${symbol}
Price: ${current.toFixed(6)}
Profit: ${profit.toFixed(2)}%
Reason: ${profit >= 6 ? 'Take Profit 6%' : 'Stop Loss -2.5%'}
              `);
            } catch (sellError) {
              await this.send(`Failed to sell ${symbol}: ${sellError.message}`);
            }
          }
        }
      } catch (err) {
        console.log('Main loop error:', err.message);
      }

      await new Promise((r) => setTimeout(r, 60_000)); // كل دقيقة
    }
  }
}

module.exports = TradingBot;
