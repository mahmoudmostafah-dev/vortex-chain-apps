// src/bot.js - Vortex-Chain v4.1 (Fixed & Enhanced)
require('dotenv').config();
const ccxt = require('ccxt');
const TelegramBot = require('node-telegram-bot-api');
const { sma, rsi, macd, atr } = require('ta.js');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs');

class TradingBot {
  constructor() {
    // ====== الإعدادات الأساسية ======
    this.API_KEY = process.env.BINANCE_API_KEY;
    this.API_SECRET = process.env.BINANCE_SECRET_KEY;
    this.TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    this.TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    // إدارة المخاطر
    this.RISK_PERCENTAGE = Number(process.env.RISK_PERCENTAGE) || 2;
    this.MAX_POSITIONS = Number(process.env.MAX_POSITIONS) || 5;
    this.STOP_LOSS_PERCENT = 2.5;
    this.TAKE_PROFIT_PERCENT = 7;
    this.TRAILING_STOP_PERCENT = 3.5;

    // حدود الأمان
    this.MAX_DAILY_LOSS = -5; // توقف تلقائي عند -5% يومي
    this.MIN_POSITION_USD = 15; // حد أدنى للصفقة
    this.MAX_BUY_SLIPPAGE = 0.3; // 0.3% سماحية للدخول
    this.MIN_SELL_PROFIT = 0.5; // أقل ربح للخروج بالتوقف المرتفع

    // الحالة
    this.positions = {};
    this.pendingOrders = {};
    this.balance = 0;
    this.initialBalance = 0;
    this.isConnected = false;
    this.wsConnected = false;
    this.reconnectAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 5;
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 2000;

    // التخزين المؤقت
    this.marketCache = [];
    this.tickersCache = {};
    this.ohlcvCache = {};
    this.lastMessageTime = {};
    this.MARKET_CACHE_DURATION = 3600000;
    this.TICKERS_CACHE_DURATION = 30000;
    this.OHLCV_CACHE_DURATION = 300000;
    this.MESSAGE_COOLDOWN = 600000;
    this.lastReport = 0;
    this.lastBalanceUpdate = 0;
    this.BALANCE_UPDATE_INTERVAL = 300000;

    // WebSocket
    this.ws = null;
    this.wsReconnectInterval = null;
    this.lastWsPing = Date.now();

    // تهيئة Binance
    this.binance = new ccxt.binance({
      apiKey: this.API_KEY,
      secret: this.API_SECRET,
      enableRateLimit: true,
      options: {
        defaultType: 'spot',
        adjustForTimeDifference: true,
      },
    });

    // تهيئة Telegram
    this.tgBot = new TelegramBot(this.TELEGRAM_TOKEN, { polling: false });

    // قفل لتجنب التعارضات
    this.dbLock = Promise.resolve();
  }

  // ====== معالجة الأخطاء والإعادة ======
  async retryWithBackoff(fn, context, maxRetries = this.MAX_RETRIES) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const isLastAttempt = attempt === maxRetries;
        const noRetryErrors = [
          'insufficient',
          'balance',
          'MIN_NOTIONAL',
          'INVALID_',
          'banned',
          'IP_BAN',
        ];
        const shouldNotRetry = noRetryErrors.some((e) =>
          err.message.includes(e)
        );

        if (shouldNotRetry || isLastAttempt) {
          throw err;
        }

        const delay = this.RETRY_DELAY * Math.pow(2, attempt - 1);
        this.logToFile(
          'WARNING',
          `${context} failed (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // ====== قاعدة البيانات (مع قفل) ======
  async initDatabase() {
    this.db = await open({
      filename: './trades.db',
      driver: sqlite3.Database,
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL,
        entry_price REAL,
        exit_price REAL,
        amount REAL NOT NULL,
        profit_percent REAL,
        profit_usdt REAL,
        fees REAL,
        reason TEXT,
        timestamp INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS positions (
        symbol TEXT PRIMARY KEY,
        entry_price REAL NOT NULL,
        amount REAL NOT NULL,
        highest_price REAL NOT NULL,
        stop_loss REAL NOT NULL,
        take_profit REAL NOT NULL,
        atr_stop REAL,
        timestamp INTEGER NOT NULL
      );
    `);

    // استعادة الصفقات المفتوحة
    const savedPositions = await this.db.all('SELECT * FROM positions');
    for (const pos of savedPositions) {
      this.positions[pos.symbol] = {
        entry: pos.entry_price,
        amount: pos.amount,
        highest: pos.highest_price,
        stopLoss: pos.stop_loss,
        takeProfit: pos.take_profit,
        atrStop: pos.atr_stop,
      };
    }

    if (savedPositions.length > 0) {
      await this.send(
        `📂 Restored ${savedPositions.length} open position(s) from database`
      );
    }
  }

  async withDbLock(fn) {
    const release = await this.dbLock;
    this.dbLock = (async () => {
      try {
        return await fn();
      } finally {
        return;
      }
    })();
    return this.dbLock;
  }

  async savePosition(symbol, position) {
    await this.withDbLock(() =>
      this.db.run(
        `INSERT OR REPLACE INTO positions (symbol, entry_price, amount, highest_price, stop_loss, take_profit, atr_stop, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          symbol,
          position.entry,
          position.amount,
          position.highest,
          position.stopLoss,
          position.takeProfit,
          position.atrStop || null,
          Date.now(),
        ]
      )
    );
  }

  async deletePosition(symbol) {
    await this.withDbLock(() =>
      this.db.run('DELETE FROM positions WHERE symbol = ?', [symbol])
    );
  }

  async saveTrade(trade) {
    await this.withDbLock(() =>
      this.db.run(
        `INSERT INTO trades (symbol, side, entry_price, exit_price, amount, profit_percent, profit_usdt, fees, reason, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trade.symbol,
          trade.side,
          trade.entryPrice || null,
          trade.exitPrice || null,
          trade.amount,
          trade.profitPercent || null,
          trade.profitUsdt || null,
          trade.fees || 0,
          trade.reason || '',
          Date.now(),
        ]
      )
    );
  }

  // ====== تليجرام مع مكافحة الإزعاج ======
  async send(msg) {
    console.log(msg);
    try {
      await this.tgBot.sendMessage(
        this.TELEGRAM_CHAT_ID,
        msg + '\n\n#VortexChain'
      );
    } catch (err) {
      console.error('Telegram error:', err.message);
    }
  }

  async sendWithCooldown(symbol, msg, type = 'scan') {
    const key = `${symbol}_${type}`;
    const now = Date.now();
    if (
      this.lastMessageTime[key] &&
      now - this.lastMessageTime[key] < this.MESSAGE_COOLDOWN
    ) {
      return;
    }
    this.lastMessageTime[key] = now;
    await this.send(msg);
  }

  // ====== تسجيل ======
  logToFile(level, message) {
    const timestamp = new Date().toISOString();
    const logDir = './logs';
    const logFile = `${logDir}/${timestamp.split('T')[0]}.log`;

    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(logFile, logEntry);
    console.log(logEntry.trim());
  }

  // ====== الرصيد والأداء اليومي ======
  async updateBalance() {
    try {
      const balance = await this.retryWithBackoff(
        () => this.binance.fetchBalance(),
        'fetchBalance'
      );
      this.balance = balance.USDT?.free || 0;

      // حفظ الرصيد الابتدائي
      if (this.initialBalance === 0) {
        this.initialBalance = this.balance;
      }

      this.lastBalanceUpdate = Date.now();
      return this.balance;
    } catch (err) {
      this.logToFile('ERROR', `Balance fetch error: ${err.message}`);
      return this.balance;
    }
  }

  shouldUpdateBalance() {
    return Date.now() - this.lastBalanceUpdate > this.BALANCE_UPDATE_INTERVAL;
  }

  calculatePositionSize() {
    const riskAmount = (this.balance * this.RISK_PERCENTAGE) / 100;
    const maxPerPosition = this.balance / this.MAX_POSITIONS;
    return Math.max(
      this.MIN_POSITION_USD,
      Math.min(riskAmount, maxPerPosition)
    );
  }

  async checkDailyLossLimit() {
    if (this.initialBalance === 0) return false;

    const dailyLoss =
      ((this.balance - this.initialBalance) / this.initialBalance) * 100;
    if (dailyLoss <= this.MAX_DAILY_LOSS) {
      await this.send(
        `🚨 DAILY LOSS LIMIT REACHED: ${dailyLoss.toFixed(2)}%. Bot stopping!`
      );
      this.logToFile(
        'CRITICAL',
        `Daily loss limit reached: ${dailyLoss.toFixed(2)}%`
      );
      return true;
    }
    return false;
  }

  // ====== WebSocket للأسعار المباشرة ======
  initWebSocket() {
    try {
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');

      ws.on('open', () => {
        this.logToFile('INFO', 'WebSocket connected');
        this.wsConnected = true;
        this.lastWsPing = Date.now();
      });

      ws.on('message', (data) => {
        try {
          const tickers = JSON.parse(data);
          for (const ticker of tickers) {
            const symbol = ticker.s.replace(/USDT$/, '/USDT');
            this.tickersCache[symbol] = {
              last: parseFloat(ticker.c),
              quoteVolume: parseFloat(ticker.v),
              percentage: parseFloat(ticker.P),
            };
          }
          this.lastTickersUpdate = Date.now();
        } catch (err) {
          this.logToFile('WARNING', `WS parse error: ${err.message}`);
        }
      });

      ws.on('ping', () => {
        this.lastWsPing = Date.now();
      });

      ws.on('close', () => {
        this.wsConnected = false;
        this.logToFile('WARNING', 'WebSocket disconnected');
        this.scheduleWsReconnect();
      });

      ws.on('error', (err) => {
        this.logToFile('ERROR', `WebSocket error: ${err.message}`);
        this.wsConnected = false;
      });

      this.ws = ws;
    } catch (err) {
      this.logToFile('ERROR', `WebSocket init failed: ${err.message}`);
    }
  }

  scheduleWsReconnect() {
    if (this.wsReconnectInterval) clearTimeout(this.wsReconnectInterval);
    this.wsReconnectInterval = setTimeout(() => {
      this.logToFile('INFO', 'Attempting WebSocket reconnect...');
      this.initWebSocket();
    }, 10000);
  }

  // ====== تحديث الكاش ======
  async updateMarketCache() {
    const now = Date.now();
    if (
      now - this.lastMarketUpdate < this.MARKET_CACHE_DURATION &&
      this.marketCache.length > 0
    ) {
      return this.marketCache;
    }

    try {
      await this.send('🔍 Updating market list...');
      const markets = await this.retryWithBackoff(
        () => this.binance.loadMarkets(),
        'loadMarkets'
      );

      const filtered = Object.keys(markets).filter((symbol) => {
        if (!symbol.endsWith('/USDT')) return false;
        if (
          symbol.includes('BUSD') ||
          symbol.includes('UP') ||
          symbol.includes('DOWN') ||
          symbol.includes('BULL') ||
          symbol.includes('BEAR')
        )
          return false;

        const market = markets[symbol];
        return (
          market.active &&
          market.spot &&
          (market.limits?.cost?.min || 10) <= this.MIN_POSITION_USD
        );
      });

      this.marketCache = filtered;
      this.lastMarketUpdate = now;
      await this.send(`✅ Found ${filtered.length} active USDT pairs`);
      return filtered;
    } catch (err) {
      this.logToFile('ERROR', `Market cache update error: ${err.message}`);
      return this.marketCache;
    }
  }

  async updateTickersCache() {
    // استخدام WebSocket إذا كان متصلاً
    if (this.wsConnected && Date.now() - this.lastWsPing < 60000) {
      return this.tickersCache;
    }

    // الاحتياطي: استخدام REST API
    const now = Date.now();
    if (now - this.lastTickersUpdate < this.TICKERS_CACHE_DURATION) {
      return this.tickersCache;
    }

    try {
      this.logToFile('INFO', 'Fetching tickers (REST fallback)');
      const tickers = await this.retryWithBackoff(
        () => this.binance.fetchTickers(),
        'fetchTickers'
      );
      this.tickersCache = tickers;
      this.lastTickersUpdate = now;
      return tickers;
    } catch (err) {
      this.logToFile('ERROR', `Tickers fetch error: ${err.message}`);
      return this.tickersCache;
    }
  }

  async getOHLCV(symbol, timeframe = '15m', limit = 200) {
    // تغيير لـ 15 دقيقة
    const cacheKey = `${symbol}_${timeframe}_${limit}`;
    const now = Date.now();

    if (
      this.ohlcvCache[cacheKey] &&
      now - this.ohlcvCache[cacheKey].timestamp < this.OHLCV_CACHE_DURATION
    ) {
      return this.ohlcvCache[cacheKey].data;
    }

    try {
      const ohlcv = await this.retryWithBackoff(
        () => this.binance.fetchOHLCV(symbol, timeframe, undefined, limit),
        `fetchOHLCV ${symbol}`
      );

      this.ohlcvCache[cacheKey] = { data: ohlcv, timestamp: now };
      return ohlcv;
    } catch (err) {
      this.logToFile('ERROR', `OHLCV fetch error ${symbol}: ${err.message}`);
      if (this.ohlcvCache[cacheKey]) {
        return this.ohlcvCache[cacheKey].data;
      }
      return null;
    }
  }

  // ====== تحليل السوق والإشارات ======
  async getTopVolumeCoins(limit = 30) {
    try {
      const tickers = await this.updateTickersCache();
      const sortedByVolume = Object.entries(tickers)
        .filter(([symbol, ticker]) => {
          if (!symbol.endsWith('/USDT')) return false;
          if (
            symbol.includes('BUSD') ||
            symbol.includes('UP') ||
            symbol.includes('DOWN')
          )
            return false;

          const volume = ticker.quoteVolume || 0;
          const price = ticker.last || 0;
          const change = ticker.percentage || 0;

          return (
            volume > 10_000_000 && price > 0.05 && change > -15 && change < 50
          ); // تقليل التقلب
        })
        .sort((a, b) => (b[1].quoteVolume || 0) - (a[1].quoteVolume || 0))
        .slice(0, limit)
        .map(([symbol]) => symbol);

      return sortedByVolume;
    } catch (err) {
      this.logToFile('ERROR', `Get top volume error: ${err.message}`);
      return [];
    }
  }

  async scanMarket() {
    const signals = [];
    const topCoins = await this.getTopVolumeCoins(30);

    if (topCoins.length === 0) {
      console.log('No coins to scan');
      return signals;
    }

    await this.send(`📊 Scanning top ${topCoins.length} coins...`);

    for (const symbol of topCoins) {
      try {
        if (this.positions[symbol] || this.pendingOrders[symbol]) continue;

        const ticker =
          (await this.updateTickersCache()[symbol]) ||
          (await this.retryWithBackoff(
            () => this.binance.fetchTicker(symbol),
            `fetchTicker ${symbol}`
          ));
        const volume24h = ticker.quoteVolume || 0;
        const change24h = ticker.percentage || 0;

        if (volume24h < 10_000_000 || change24h < -15) continue;

        const ohlcv = await this.getOHLCV(symbol, '15m', 200); // 15 دقيقة بدل 5
        if (!ohlcv || ohlcv.length < 100) continue;

        const closes = ohlcv.map((c) => c[4]);
        const volumes = ohlcv.map((c) => c[5]);
        const price = closes[closes.length - 1];

        if (price < 0.05) continue;

        // المؤشرات
        const sma50 = await sma(closes, 50);
        const sma200 = await sma(closes, 200);
        const rsiData = await rsi(closes, 14);
        const currentRsi = rsiData.slice(-1)[0];

        const macdData = await macd(closes, 12, 26, 9);
        const macdLine = macdData.MACD.slice(-1)[0];
        const signalLine = macdData.signal.slice(-1)[0];
        const prevMacd = macdData.MACD.slice(-2)[0];
        const prevSignal = macdData.signal.slice(-2)[0];

        const avgVol = await sma(volumes, 20);
        const currentAvgVol = avgVol.slice(-1)[0];
        const volSurge = volumes[volumes.length - 1] > currentAvgVol * 1.5;

        // ATR للتوقف الديناميكي
        const atrData = await atr(
          {
            high: ohlcv.map((c) => c[2]),
            low: ohlcv.map((c) => c[3]),
            close: closes,
          },
          14
        );
        const currentAtr = atrData.slice(-1)[0];

        // الشروط المحسّنة
        const goldenCross =
          sma50.slice(-1)[0] > sma200.slice(-1)[0] &&
          sma50.slice(-2)[0] <= sma200.slice(-2)[0];
        const macdCrossUp = macdLine > signalLine && prevMacd <= prevSignal; // تقاطع صاعد
        const inUptrend = price > sma200.slice(-1)[0];
        const rsiSafe = currentRsi > 30 && currentRsi < 55; // منطقة آمنة

        const strongSignal =
          goldenCross && macdCrossUp && volSurge && inUptrend && rsiSafe;
        const mediumSignal =
          macdCrossUp && volSurge && inUptrend && currentRsi < 50;

        if (strongSignal || mediumSignal) {
          signals.push({
            symbol,
            price,
            volume24h,
            change24h,
            currentRsi,
            volSurge,
            currentAtr,
            strength: strongSignal ? 'STRONG' : 'MEDIUM',
            inUptrend,
          });

          await this.sendWithCooldown(
            symbol,
            `🔍 Scan: ${symbol}
💰 Price: ${price.toFixed(6)}
📊 24h Vol: ${volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
📈 24h Δ: ${change24h.toFixed(2)}%
🎯 RSI: ${currentRsi.toFixed(1)}
⚡ Volume Surge: ${volSurge ? 'YES' : 'NO'}
📉 Trend: ${inUptrend ? 'UPTREND ✅' : 'DOWNTREND ❌'}
📏 ATR: ${currentAtr.toFixed(4)}
🎲 Status: ${strongSignal ? '🔥 STRONG BUY SIGNAL' : '⚠️ Medium Signal'}`,
            'scan'
          );
        }
      } catch (err) {
        this.logToFile('WARNING', `Scan error ${symbol}: ${err.message}`);
      }

      // تأخير 200ms بين كل عملة لتجنب Rate Limit
      await new Promise((r) => setTimeout(r, 200));
    }

    return signals;
  }

  // ====== إدارة الصفقات ======
  async openPosition(signal) {
    const { symbol, price, currentRsi, strength, currentAtr } = signal;

    const positionUSD = this.calculatePositionSize();
    if (positionUSD < this.MIN_POSITION_USD) {
      await this.send(
        `⚠️ Position size too small: ${positionUSD.toFixed(
          2
        )} USD. Need more balance.`
      );
      return;
    }

    try {
      const market = await this.retryWithBackoff(
        () => this.binance.market(symbol),
        `market ${symbol}`
      );
      const minCost = market.limits?.cost?.min || 10;

      if (positionUSD < minCost) {
        await this.send(`⚠️ ${symbol} requires min ${minCost}. Skipping.`);
        return;
      }

      const amount = Number((positionUSD / price).toFixed(8));

      // ✅ سعر الشراء الصحيح: أقل من السوق
      const limitPrice = price * (1 - this.MAX_BUY_SLIPPAGE / 100);
      const order = await this.retryWithBackoff(
        () => this.binance.createLimitBuyOrder(symbol, amount, limitPrice),
        `createLimitBuyOrder ${symbol}`
      );

      this.logToFile(
        'INFO',
        `Limit BUY order placed: ${symbol} @ ${limitPrice} | Amount: ${amount}`
      );

      this.pendingOrders[symbol] = {
        orderId: order.id,
        side: 'buy',
        price: limitPrice,
        amount,
        timestamp: Date.now(),
        signal,
      };

      await this.send(`⏳ LIMIT BUY ORDER PLACED
${symbol}
💰 Limit Price: ${limitPrice.toFixed(6)}
📊 Amount: ${amount}
💵 Position: ${positionUSD.toFixed(2)}
🎯 RSI: ${currentRsi.toFixed(1)}
📏 ATR: ${currentAtr?.toFixed(4) || 'N/A'}
⚡ Signal: ${strength}
⏰ Waiting for execution...`);

      // فحص التنفيذ بعد دقيقتين
      setTimeout(() => this.checkPendingOrder(symbol), 120000);
    } catch (err) {
      const msg = err.message || err.toString();
      this.logToFile('ERROR', `Buy failed ${symbol}: ${msg}`);

      if (msg.includes('insufficient') || msg.includes('balance')) {
        await this.send(
          `❌ INSUFFICIENT BALANCE!\nSymbol: ${symbol}\nRequired: ${positionUSD.toFixed(
            2
          )}\nAvailable: ${this.balance.toFixed(2)}\nAdd funds to continue.`
        );
      } else if (msg.includes('MIN_NOTIONAL')) {
        await this.send(`⚠️ ${symbol} order too small. Skipping.`);
      } else {
        await this.send(`❌ Buy failed ${symbol}: ${msg}`);
      }
    }
  }

  async checkPendingOrder(symbol) {
    const pending = this.pendingOrders[symbol];
    if (!pending) return;

    try {
      const order = await this.retryWithBackoff(
        () => this.binance.fetchOrder(pending.orderId, symbol),
        `fetchOrder ${symbol}`
      );

      if (order.status === 'closed' || order.filled > 0) {
        const avgPrice = order.average || pending.price;
        const filledAmount = order.filled || pending.amount;

        // التوقف الديناميكي باستخدام ATR
        const atrStop = pending.signal.currentAtr
          ? avgPrice - pending.signal.currentAtr * 2
          : null;
        const stopLoss =
          atrStop || avgPrice * (1 - this.STOP_LOSS_PERCENT / 100);
        const takeProfit = avgPrice * (1 + this.TAKE_PROFIT_PERCENT / 100);

        this.positions[symbol] = {
          entry: avgPrice,
          amount: filledAmount,
          highest: avgPrice,
          stopLoss,
          takeProfit,
          atrStop: atrStop || null,
          atr: pending.signal.currentAtr || null,
        };

        await this.savePosition(symbol, this.positions[symbol]);
        await this.saveTrade({
          symbol,
          side: 'BUY',
          entryPrice: avgPrice,
          amount: filledAmount,
          reason: `Limit Order Executed | ATR: ${
            pending.signal.currentAtr?.toFixed(4) || 'N/A'
          }`,
        });

        const feeBuy = avgPrice * filledAmount * 0.001;
        await this.send(`✅ BUY EXECUTED ${symbol}
💰 Entry: ${avgPrice.toFixed(6)}
📊 Amount: ${filledAmount}
💵 Total: ${(avgPrice * filledAmount).toFixed(2)}
📉 Stop Loss: ${stopLoss.toFixed(6)} (${(
          (stopLoss / avgPrice - 1) *
          100
        ).toFixed(2)}%)
📈 Take Profit: ${takeProfit.toFixed(6)} (+${this.TAKE_PROFIT_PERCENT}%)
📏 ATR Stop: ${atrStop ? atrStop.toFixed(6) : 'N/A'}
💸 Fee: ${feeBuy.toFixed(4)}`);

        delete this.pendingOrders[symbol];
        this.logToFile('SUCCESS', `BUY executed: ${symbol} @ ${avgPrice}`);
      } else if (
        order.status === 'canceled' ||
        Date.now() - pending.timestamp > 600000
      ) {
        await this.send(`⏰ Limit order expired/canceled: ${symbol}`);
        delete this.pendingOrders[symbol];
        this.logToFile('WARNING', `Limit order not filled: ${symbol}`);
      }
    } catch (err) {
      this.logToFile(
        'ERROR',
        `Check pending order error ${symbol}: ${err.message}`
      );
    }
  }

  async closePosition(symbol, reason) {
    const pos = this.positions[symbol];
    if (!pos) return;

    try {
      const ticker =
        (await this.updateTickersCache()[symbol]) ||
        (await this.retryWithBackoff(
          () => this.binance.fetchTicker(symbol),
          `fetchTicker ${symbol}`
        ));
      const currentPrice = ticker.last;

      // ✅ سعر البيع الصحيح: أعلى من السوق
      const limitPrice = currentPrice * (1 + this.MAX_BUY_SLIPPAGE / 100);

      // استخدام OCO order لوقف الخسارة وجني الربح
      const amount = pos.amount;
      const stopPrice = pos.stopLoss;
      const takeProfitPrice = pos.takeProfit;

      try {
        // محاولة OCO أولاً
        await this.retryWithBackoff(
          () =>
            this.binance.createOrder(
              symbol,
              'OCO',
              'sell',
              amount,
              takeProfitPrice,
              {
                stopPrice: stopPrice,
                stopLimitPrice: stopPrice * 0.99, // 1% أدنى من stop
              }
            ),
          `OCO sell ${symbol}`
        );
        await this.send(`🎯 OCO SELL ORDER PLACED for ${symbol}`);
      } catch (err) {
        // الاحتياطي: استخدام Limit Order عادي
        this.logToFile(
          'WARNING',
          `OCO failed for ${symbol}, using limit: ${err.message}`
        );
        await this.retryWithBackoff(
          () => this.binance.createLimitSellOrder(symbol, amount, limitPrice),
          `createLimitSellOrder ${symbol}`
        );
      }

      const profit = ((currentPrice - pos.entry) / pos.entry) * 100;
      const profitUsdt = (currentPrice - pos.entry) * amount;
      const feeSell = currentPrice * amount * 0.001;
      const netProfit = profitUsdt - feeSell;

      await this.saveTrade({
        symbol,
        side: 'SELL',
        entryPrice: pos.entry,
        exitPrice: currentPrice,
        amount,
        profitPercent: profit,
        profitUsdt: netProfit,
        fees: feeSell,
        reason,
      });

      delete this.positions[symbol];
      await this.deletePosition(symbol);

      const emoji = profit > 0 ? '🟢' : '🔴';
      await this.send(`${emoji} SELL ${symbol}
💰 Entry: ${pos.entry.toFixed(6)}
💵 Exit: ${currentPrice.toFixed(6)}
📊 Profit: ${profit.toFixed(2)}% (${profit > 0 ? '+' : ''}${netProfit.toFixed(
        2
      )})
💸 Fee: ${feeSell.toFixed(4)}
📝 Reason: ${reason}`);

      this.logToFile(
        'TRADE',
        `SELL ${symbol} | Entry: ${pos.entry.toFixed(
          6
        )} | Exit: ${currentPrice.toFixed(6)} | P/L: ${profit.toFixed(2)}%`
      );

      await this.updateBalance();
    } catch (err) {
      await this.send(`❌ Sell failed ${symbol}: ${err.message}`);
      this.logToFile('ERROR', `Sell failed ${symbol}: ${err.message}`);
    }
  }

  async managePositions() {
    if (Object.keys(this.positions).length === 0) return;

    try {
      const allTickers = await this.updateTickersCache();

      for (const symbol of Object.keys(this.positions)) {
        const pos = this.positions[symbol];

        try {
          const ticker = allTickers[symbol];
          if (!ticker) {
            this.logToFile('WARNING', `No ticker data for ${symbol}`);
            continue;
          }

          const current = ticker.last;
          if (current > pos.highest) {
            pos.highest = current;
            await this.savePosition(symbol, pos);
          }

          // التوقف الديناميكي باستخدام ATR
          let trailStop = pos.atrStop;
          if (pos.atr && pos.atr > 0) {
            const newAtrStop = pos.highest - pos.atr * 2;
            if (!pos.atrStop || newAtrStop > pos.atrStop) {
              trailStop = newAtrStop;
              pos.atrStop = trailStop;
              await this.savePosition(symbol, pos);
            }
          } else {
            // التوقف الثابت الاحتياطي
            trailStop = pos.highest * (1 - this.TRAILING_STOP_PERCENT / 100);
          }

          const profit = ((current - pos.entry) / pos.entry) * 100;

          // شروط الإغلاق
          if (current >= pos.takeProfit) {
            await this.closePosition(
              symbol,
              `Take Profit +${this.TAKE_PROFIT_PERCENT}%`
            );
          } else if (current <= pos.stopLoss) {
            await this.closePosition(
              symbol,
              `Hard Stop -${this.STOP_LOSS_PERCENT}%`
            );
          } else if (current <= trailStop && profit > this.MIN_SELL_PROFIT) {
            await this.closePosition(
              symbol,
              `Trailing Stop ${this.TRAILING_STOP_PERCENT}% from peak`
            );
          }

          // تأخير 100ms بين كل عملية
          await new Promise((r) => setTimeout(r, 100));
        } catch (err) {
          this.logToFile(
            'ERROR',
            `Manage position error ${symbol}: ${err.message}`
          );
          continue;
        }
      }
    } catch (err) {
      this.logToFile('ERROR', `Critical managePositions error: ${err.message}`);
    }
  }

  async generateDailyReport() {
    const trades = await this.db.all(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN profit_percent > 0 THEN 1 ELSE 0 END) as wins,
        SUM(profit_usdt) as total_profit,
        AVG(profit_percent) as avg_profit,
        SUM(fees) as total_fees
      FROM trades 
      WHERE timestamp > ? AND side = 'SELL'`,
      [Date.now() - 86400000]
    );

    const { total, wins, total_profit, avg_profit, total_fees } = trades[0];
    const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : 0;
    const dailyPnL =
      ((this.balance - this.initialBalance) / this.initialBalance) * 100;

    await this.send(`📊 DAILY REPORT
━━━━━━━━━━━━━━━
Total Trades: ${total || 0}
Wins: ${wins || 0} | Losses: ${total - wins || 0}
Win Rate: ${winRate}%
Total P/L: ${total_profit > 0 ? '+' : ''}$${(total_profit || 0).toFixed(2)}
Avg P/L: ${avg_profit > 0 ? '+' : ''}${(avg_profit || 0).toFixed(2)}%
Total Fees: $${(total_fees || 0).toFixed(2)}
Daily P/L: ${dailyPnL > 0 ? '+' : ''}${dailyPnL.toFixed(2)}%
Active Positions: ${Object.keys(this.positions).length}
Balance: $${this.balance.toFixed(2)}
━━━━━━━━━━━━━━━`);
  }

  // ====== الحلقة الرئيسية ======
  async start() {
    await this.initDatabase();
    await this.checkConnection();

    if (!this.isConnected) {
      await this.reconnect();
    }

    // تهيئة WebSocket
    this.initWebSocket();

    await this.updateBalance();
    await this.updateMarketCache();

    await this.send(`🚀 Vortex-Chain v4.1 Fixed Edition LIVE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Balance: ${this.balance.toFixed(2)}
📊 Max Positions: ${this.MAX_POSITIONS}
💵 Risk per Trade: ${this.RISK_PERCENTAGE}%
📉 Stop Loss: ${this.STOP_LOSS_PERCENT}%
📈 Take Profit: ${this.TAKE_PROFIT_PERCENT}%
🎯 Risk/Reward: 1:${(this.TAKE_PROFIT_PERCENT / this.STOP_LOSS_PERCENT).toFixed(
      1
    )}
🛡️ Daily Loss Limit: ${this.MAX_DAILY_LOSS}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Auto-scanning top coins by volume...
⚠️ USING WEBSOCKET + LIMIT ORDERS`);

    while (true) {
      try {
        // تحقق من حد الخسارة اليومي
        if (await this.checkDailyLossLimit()) {
          process.exit(0); // إيقاف آمن
        }

        // تقرير يومي في الساعة 00:00
        if (
          new Date().getHours() === 0 &&
          Date.now() - this.lastReport > 3600000
        ) {
          await this.generateDailyReport();
          this.lastReport = Date.now();
          this.initialBalance = this.balance; // إعادة تعيين ليوم جديد
        }

        // تحديث الأسواق
        if (Date.now() - this.lastMarketUpdate > this.MARKET_CACHE_DURATION) {
          await this.updateMarketCache();
        }

        // إدارة الصفقات
        await this.managePositions();

        // البحث عن فرص جديدة
        if (Object.keys(this.positions).length < this.MAX_POSITIONS) {
          const signals = await this.scanMarket();
          for (const signal of signals) {
            if (Object.keys(this.positions).length >= this.MAX_POSITIONS) break;
            await this.openPosition(signal);
          }
        }

        // فحص الأوامر المعلقة
        for (const symbol of Object.keys(this.pendingOrders)) {
          await this.checkPendingOrder(symbol);
          await new Promise((r) => setTimeout(r, 500)); // تأخير بين كل أمر
        }

        // تحديث الرصيد
        if (this.shouldUpdateBalance()) {
          await this.updateBalance();
        }

        // فحص WebSocket
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          this.wsConnected = false;
          this.logToFile(
            'WARNING',
            'WebSocket not connected, using REST fallback'
          );
        }
      } catch (err) {
        this.logToFile('ERROR', `Main loop error: ${err.message}`);
        if (
          err.message.includes('ECONNRESET') ||
          err.message.includes('timeout')
        ) {
          this.isConnected = false;
        }
        await this.send(`⚠️ Loop error: ${err.message}. Continuing...`);
      }

      // تأخير دقيقة مع فحص للاتصال
      await new Promise((r) => setTimeout(r, 60000));

      if (!this.isConnected) {
        await this.reconnect();
      }
    }
  }
}

module.exports = TradingBot;
