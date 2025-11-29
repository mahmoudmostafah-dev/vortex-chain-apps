// src/bot-modular.js - البوت المقسم للملفات

require('dotenv').config();
const settings = require('./config/settings');
const DatabaseService = require('./services/database');
const TelegramService = require('./services/telegram');
const LoggerService = require('./services/logger');
const ExchangeService = require('./services/exchange');
const WebSocketService = require('./services/websocket');
const TechnicalAnalysisService = require('./services/technical-analysis');
const Helpers = require('./utils/helpers');
const Diagnostics = require('./utils/diagnostics');

class VortexChainBot {
  constructor() {
    this.config = settings;
    this.logger = new LoggerService(this.config);
    this.telegram = new TelegramService(this.config);
    this.database = new DatabaseService(this.config);
    this.exchange = new ExchangeService(this.config, this.logger);
    this.ws = new WebSocketService(this.config, this.logger);
    this.technicalAnalysis = new TechnicalAnalysisService(this.config);

    this.positions = {};
    this.pendingOrders = {};
    this.balance = 0;
    this.initialBalance = 0;
    this.marketCache = [];
    this.lastMarketUpdate = 0;
    this.lastReport = 0;
    this.isConnected = false;
    this.paperTrading = this.config.trading.paperTrading; // ✅ وضع التداول الوهمي
    this.paperOrderId = 1000; // ✅ معرف الأوامر الوهمية
  }

  async init() {
    this.logger.info('🚀 Initializing Vortex-Chain Bot...');

    await this.database.init();
    this.positions = await this.database.getAllPositions();

    this.ws.init();
    await this.updateBalance();
    await this.updateMarketCache();

    const positionCount = Object.keys(this.positions).length;
    if (positionCount > 0) {
      await this.telegram.send(
        `📂 Restored ${positionCount} open position(s) from database`
      );
    }

    await this.telegram.send(`🚀 Vortex-Chain v5.0 MODULAR Edition ${
      this.paperTrading ? '📝 PAPER TRADING' : 'LIVE'
    }!
━━━━━━━━━━━━━━━━━━━━━━━━━━━
${
  this.paperTrading ? '📝 MODE: PAPER TRADING (TEST)\n' : ''
}💰 Balance: ${Helpers.formatMoney(this.balance)}
📊 Max Positions: ${this.config.risk.maxPositions}
💵 Risk per Trade: ${this.config.risk.riskPercentage}%
📉 Stop Loss: ${this.config.risk.stopLossPercent}%
📈 Take Profit: ${this.config.risk.takeProfitPercent}%
🎯 Risk/Reward: 1:${(
      this.config.risk.takeProfitPercent / this.config.risk.stopLossPercent
    ).toFixed(1)}
🛡️ Daily Loss Limit: ${this.config.risk.maxDailyLoss}%
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Auto-scanning top coins by volume...
⚠️ USING WEBSOCKET + LIMIT ORDERS${
      this.paperTrading ? '\n\n⚠️ NO REAL MONEY - TESTING ONLY' : ''
    }`);

    this.isConnected = true;
  }

  async updateBalance() {
    try {
      // ✅ وضع التداول الوهمي
      if (this.paperTrading) {
        if (this.balance === 0) {
          this.balance = this.config.trading.paperBalance;
          this.initialBalance = this.balance;
          this.logger.info(
            `📝 Paper Trading Mode: Starting with $${this.balance}`
          );
        }
        return this.balance;
      }

      const balance = await this.exchange.fetchBalance();
      this.balance = balance.USDT?.free || 0;

      if (this.initialBalance === 0) {
        this.initialBalance = this.balance;
      }

      return this.balance;
    } catch (err) {
      this.logger.error(`Balance fetch error: ${err.message}`);
      return this.balance;
    }
  }

  async updateMarketCache() {
    const now = Date.now();
    if (
      now - this.lastMarketUpdate < this.config.cache.marketDuration &&
      this.marketCache.length > 0
    ) {
      return this.marketCache;
    }

    try {
      this.logger.info('Updating market list...');
      const markets = await this.exchange.loadMarkets();

      const filtered = Object.keys(markets).filter((symbol) => {
        if (!symbol.endsWith('/USDT')) return false;

        const excludeList = this.config.filters.excludeCoins;
        if (excludeList.some((coin) => symbol.includes(coin))) return false;

        const market = markets[symbol];
        return (
          market.active &&
          market.spot &&
          (market.limits?.cost?.min || 10) <= this.config.risk.minPositionUsd
        );
      });

      this.marketCache = filtered;
      this.lastMarketUpdate = now;
      this.logger.success(`Found ${filtered.length} active USDT pairs`);
      return filtered;
    } catch (err) {
      this.logger.error(`Market cache update error: ${err.message}`);
      return this.marketCache;
    }
  }

  async getTopVolumeCoins(limit = 50) {
    // ✅ زيادة من 30 إلى 50 عملة
    try {
      const tickers = this.ws.isConnected()
        ? this.ws.getTickersCache()
        : await this.exchange.fetchTickers();

      const sortedByVolume = Object.entries(tickers)
        .filter(([symbol, ticker]) => {
          if (!symbol.endsWith('/USDT')) return false;

          const excludeList = this.config.filters.excludeCoins;
          if (excludeList.some((coin) => symbol.includes(coin))) return false;

          const volume = ticker.quoteVolume || 0;
          const price = ticker.last || 0;
          const change = ticker.percentage || 0;

          return (
            volume > this.config.filters.minVolume &&
            price > this.config.filters.minPrice &&
            change > this.config.filters.minChange24h &&
            change < this.config.filters.maxChange24h
          );
        })
        .sort((a, b) => (b[1].quoteVolume || 0) - (a[1].quoteVolume || 0))
        .slice(0, limit)
        .map(([symbol]) => symbol);

      this.logger.info(
        `✅ Filtered ${sortedByVolume.length} coins from ${
          Object.keys(tickers).length
        } total`
      ); // ✅ لوج للتتبع
      return sortedByVolume;
    } catch (err) {
      this.logger.error(`Get top volume error: ${err.message}`);
      return [];
    }
  }

  async scanMarket() {
    const signals = [];
    const topCoins = await this.getTopVolumeCoins(50); // ✅ زيادة من 30 إلى 50

    if (topCoins.length === 0) {
      this.logger.warning('⚠️ No coins passed filters - check filter settings');
      return signals;
    }

    this.logger.info(`📊 Scanning top ${topCoins.length} coins...`);

    for (const symbol of topCoins) {
      try {
        if (this.positions[symbol] || this.pendingOrders[symbol]) continue;

        const ticker = await this.exchange.fetchTicker(symbol);
        const volume24h = ticker.quoteVolume || 0;
        const change24h = ticker.percentage || 0;

        if (
          volume24h < this.config.filters.minVolume ||
          change24h < this.config.filters.minChange24h
        )
          continue;

        const ohlcv = await this.exchange.fetchOHLCV(
          symbol,
          this.config.trading.ohlcvTimeframe,
          this.config.trading.ohlcvLimit
        );

        if (!ohlcv) continue;

        const analysis = await this.technicalAnalysis.analyzeSignal(ohlcv);
        if (!analysis || !analysis.isSignal) continue;

        signals.push({
          symbol,
          ...analysis,
          volume24h,
          change24h,
        });

        const msg = `🔍 Scan: ${symbol}
💰 Price: ${Helpers.formatPrice(analysis.price)}
📊 24h Vol: ${Helpers.formatVolume(volume24h)}
📈 24h Δ: ${Helpers.formatPercent(change24h)}
🎯 RSI: ${analysis.currentRsi.toFixed(1)}
⚡ Momentum: ${analysis.momentumPositive ? 'BULLISH 📈' : 'BEARISH 📉'}
📍 Above SMA50: ${analysis.trendFollowing ? 'YES ✅' : 'NO ❌'}
📍 Above SMA200: ${analysis.aboveMa200 ? 'YES ✅' : 'NO ❌'}
⚖️ Overbought: ${analysis.notOverbought ? 'NO ✅' : 'YES ⚠️'}
📏 ATR: ${analysis.currentAtr.toFixed(4)}
🎲 Status: ${
          analysis.strength === 'STRONG'
            ? '🔥 STRONG BUY SIGNAL'
            : analysis.strength === 'MEDIUM'
            ? '⚡ MEDIUM BUY SIGNAL'
            : '⚠️ Weak Signal'
        }`;

        await this.telegram.sendWithCooldown(symbol, msg, 'scan');
      } catch (err) {
        this.logger.warning(`Scan error ${symbol}: ${err.message}`);
      }

      await Helpers.delay(this.config.trading.priceCheckInterval);
    }

    return signals;
  }

  async openPosition(signal) {
    const { symbol, price, strength, currentAtr } = signal;
    const positionUsd = Helpers.calculatePositionSize(
      this.balance,
      this.config.risk.riskPercentage,
      this.config.risk.maxPositions,
      this.config.risk.minPositionUsd
    );

    if (positionUsd < this.config.risk.minPositionUsd) {
      await this.telegram.send(
        `⚠️ Position size too small: ${Helpers.formatMoney(
          positionUsd
        )}. Need more balance.`
      );
      return;
    }

    try {
      const amount = Number((positionUsd / price).toFixed(8));
      const limitPrice = Helpers.calculateBuyPrice(
        price,
        this.config.risk.maxBuySlippage
      );

      // ✅ وضع التداول الوهمي
      if (this.paperTrading) {
        const orderId = `PAPER_${this.paperOrderId++}`;

        this.logger.info(
          `📝 PAPER: Limit BUY order placed: ${symbol} @ ${limitPrice} | Amount: ${amount}`
        );

        this.pendingOrders[symbol] = {
          orderId,
          side: 'buy',
          price: limitPrice,
          amount,
          timestamp: Date.now(),
          signal,
          paper: true,
        };

        const msg = `📝 PAPER TRADING - LIMIT BUY ORDER
${symbol}
💰 Limit Price: ${Helpers.formatPrice(limitPrice)}
📊 Amount: ${amount}
💵 Position: ${Helpers.formatMoney(positionUsd)}
🎯 RSI: ${signal.currentRsi.toFixed(1)}
📏 ATR: ${currentAtr.toFixed(4)}
⚡ Signal: ${strength}
⏰ Simulating execution in 10 seconds...

⚠️ NO REAL MONEY - TESTING ONLY`;

        await this.telegram.send(msg);

        // محاكاة التنفيذ بعد 10 ثواني
        setTimeout(() => this.checkPendingOrder(symbol), 10000);
        return;
      }

      // التداول الحقيقي
      const market = await this.exchange.getMarket(symbol);
      const minCost = market.limits?.cost?.min || 10;

      if (positionUsd < minCost) {
        await this.telegram.send(
          `⚠️ ${symbol} requires min ${minCost}. Skipping.`
        );
        return;
      }

      const order = await this.exchange.createLimitBuyOrder(
        symbol,
        amount,
        limitPrice
      );

      this.logger.info(
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

      const msg = `⏳ LIMIT BUY ORDER PLACED
${symbol}
💰 Limit Price: ${Helpers.formatPrice(limitPrice)}
📊 Amount: ${amount}
💵 Position: ${Helpers.formatMoney(positionUsd)}
🎯 RSI: ${signal.currentRsi.toFixed(1)}
📏 ATR: ${currentAtr.toFixed(4)}
⚡ Signal: ${strength}
⏰ Waiting for execution...`;

      await this.telegram.send(msg);

      setTimeout(() => this.checkPendingOrder(symbol), 120000);
    } catch (err) {
      const msg = err.message || err.toString();
      this.logger.error(`Buy failed ${symbol}: ${msg}`);

      if (msg.includes('insufficient') || msg.includes('balance')) {
        await this.telegram.send(
          `❌ INSUFFICIENT BALANCE!\nSymbol: ${symbol}\nRequired: ${Helpers.formatMoney(
            positionUsd
          )}\nAvailable: ${Helpers.formatMoney(this.balance)}`
        );
      } else if (!msg.includes('MIN_NOTIONAL')) {
        await this.telegram.send(`❌ Buy failed ${symbol}: ${msg}`);
      }
    }
  }

  async checkPendingOrder(symbol) {
    const pending = this.pendingOrders[symbol];
    if (!pending) return;

    try {
      // ✅ وضع التداول الوهمي - محاكاة التنفيذ
      if (this.paperTrading && pending.paper) {
        const avgPrice = pending.price;
        const filledAmount = pending.amount;

        const stopLoss = Helpers.calculateStopLoss(
          avgPrice,
          this.config.risk.stopLossPercent
        );
        const takeProfit = Helpers.calculateTakeProfit(
          avgPrice,
          this.config.risk.takeProfitPercent
        );

        this.positions[symbol] = {
          entry: avgPrice,
          amount: filledAmount,
          highest: avgPrice,
          stopLoss,
          takeProfit,
          atrStop: null,
          atr: pending.signal.currentAtr || null,
          paper: true,
        };

        // خصم من الرصيد الوهمي
        const cost = avgPrice * filledAmount;
        this.balance -= cost;

        await this.database.savePosition(symbol, this.positions[symbol]);
        await this.database.saveTrade({
          symbol,
          side: 'BUY',
          entryPrice: avgPrice,
          amount: filledAmount,
          reason: `Paper Trading - Simulated Buy`,
        });

        const feeBuy = avgPrice * filledAmount * 0.001;
        const msg = `✅ 📝 PAPER BUY EXECUTED ${symbol}
� Entr y: ${Helpers.formatPrice(avgPrice)}
� Ameount: ${filledAmount}
💵 Total: ${Helpers.formatMoney(cost)}
📉 Stop Loss: ${Helpers.formatPrice(stopLoss)}
📈 Take Profit: ${Helpers.formatPrice(takeProfit)}
💸 Fee: ${feeBuy.toFixed(4)}
💰 Balance: ${Helpers.formatMoney(this.balance)}

⚠️ NO REAL MONEY - TESTING ONLY`;

        await this.telegram.send(msg);
        delete this.pendingOrders[symbol];
        this.logger.success(`📝 PAPER BUY executed: ${symbol} @ ${avgPrice}`);
        return;
      }

      // التداول الحقيقي
      const order = await this.exchange.fetchOrder(pending.orderId, symbol);

      if (order.status === 'closed' || order.filled > 0) {
        const avgPrice = order.average || pending.price;
        const filledAmount = order.filled || pending.amount;

        const stopLoss = Helpers.calculateStopLoss(
          avgPrice,
          this.config.risk.stopLossPercent
        );
        const takeProfit = Helpers.calculateTakeProfit(
          avgPrice,
          this.config.risk.takeProfitPercent
        );

        this.positions[symbol] = {
          entry: avgPrice,
          amount: filledAmount,
          highest: avgPrice,
          stopLoss,
          takeProfit,
          atrStop: null,
          atr: pending.signal.currentAtr || null,
        };

        await this.database.savePosition(symbol, this.positions[symbol]);
        await this.database.saveTrade({
          symbol,
          side: 'BUY',
          entryPrice: avgPrice,
          amount: filledAmount,
          reason: `Limit Order Executed`,
        });

        const feeBuy = avgPrice * filledAmount * 0.001;
        const msg = `✅ BUY EXECUTED ${symbol}
💰 Entry: ${Helpers.formatPrice(avgPrice)}
📊 Amount: ${filledAmount}
💵 Total: ${Helpers.formatMoney(avgPrice * filledAmount)}
📉 Stop Loss: ${Helpers.formatPrice(stopLoss)}
📈 Take Profit: ${Helpers.formatPrice(takeProfit)}
💸 Fee: ${feeBuy.toFixed(4)}`;

        await this.telegram.send(msg);
        delete this.pendingOrders[symbol];
        this.logger.success(`BUY executed: ${symbol} @ ${avgPrice}`);
      } else if (
        order.status === 'canceled' ||
        Date.now() - pending.timestamp > 600000
      ) {
        await this.telegram.send(`⏰ Limit order expired/canceled: ${symbol}`);
        delete this.pendingOrders[symbol];
        this.logger.warning(`Limit order not filled: ${symbol}`);
      }
    } catch (err) {
      this.logger.error(`Check pending order error ${symbol}: ${err.message}`);
    }
  }

  async closePosition(symbol, reason) {
    const pos = this.positions[symbol];
    if (!pos) return;

    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const currentPrice = ticker.last;

      const limitPrice = Helpers.calculateSellPrice(
        currentPrice,
        this.config.risk.maxBuySlippage
      );

      // ✅ وضع التداول الوهمي
      if (this.paperTrading && pos.paper) {
        const profit = Helpers.calculateProfitPercent(pos.entry, currentPrice);
        const profitUsdt = Helpers.calculateProfitUsdt(
          pos.entry,
          currentPrice,
          pos.amount
        );
        const feeSell = currentPrice * pos.amount * 0.001;
        const netProfit = profitUsdt - feeSell;

        // إضافة للرصيد الوهمي
        const saleAmount = currentPrice * pos.amount;
        this.balance += saleAmount;

        await this.database.saveTrade({
          symbol,
          side: 'SELL',
          entryPrice: pos.entry,
          exitPrice: currentPrice,
          amount: pos.amount,
          profitPercent: profit,
          profitUsdt: netProfit,
          fees: feeSell,
          reason: `Paper Trading - ${reason}`,
        });

        delete this.positions[symbol];
        await this.database.deletePosition(symbol);

        const emoji = profit > 0 ? '🟢' : '🔴';
        const msg = `${emoji} 📝 PAPER SELL ${symbol}
💰 Entry: ${Helpers.formatPrice(pos.entry)}
💵 Exit: ${Helpers.formatPrice(currentPrice)}
📊 Profit: ${Helpers.formatPercent(profit)}
💵 P/L: ${netProfit > 0 ? '+' : ''}${Helpers.formatMoney(netProfit)}
💸 Fee: ${feeSell.toFixed(4)}
💰 Balance: ${Helpers.formatMoney(this.balance)}
📝 Reason: ${reason}

⚠️ NO REAL MONEY - TESTING ONLY`;

        await this.telegram.send(msg);
        this.logger.trade(
          `📝 PAPER SELL ${symbol} | Entry: ${
            pos.entry
          } | Exit: ${currentPrice} | P/L: ${profit.toFixed(2)}%`
        );
        return;
      }

      // التداول الحقيقي
      await this.exchange.createLimitSellOrder(symbol, pos.amount, limitPrice);

      const profit = Helpers.calculateProfitPercent(pos.entry, currentPrice);
      const profitUsdt = Helpers.calculateProfitUsdt(
        pos.entry,
        currentPrice,
        pos.amount
      );
      const feeSell = currentPrice * pos.amount * 0.001;

      await this.database.saveTrade({
        symbol,
        side: 'SELL',
        entryPrice: pos.entry,
        exitPrice: currentPrice,
        amount: pos.amount,
        profitPercent: profit,
        profitUsdt: profitUsdt - feeSell,
        fees: feeSell,
        reason,
      });

      delete this.positions[symbol];
      await this.database.deletePosition(symbol);

      const emoji = profit > 0 ? '🟢' : '🔴';
      const msg = `${emoji} SELL ${symbol}
💰 Entry: ${Helpers.formatPrice(pos.entry)}
💵 Exit: ${Helpers.formatPrice(currentPrice)}
📊 Profit: ${Helpers.formatPercent(profit)}
💸 Fee: ${feeSell.toFixed(4)}
📝 Reason: ${reason}`;

      await this.telegram.send(msg);
      this.logger.trade(
        `SELL ${symbol} | Entry: ${
          pos.entry
        } | Exit: ${currentPrice} | P/L: ${profit.toFixed(2)}%`
      );

      await this.updateBalance();
    } catch (err) {
      await this.telegram.send(`❌ Sell failed ${symbol}: ${err.message}`);
      this.logger.error(`Sell failed ${symbol}: ${err.message}`);
    }
  }

  async managePositions() {
    if (Object.keys(this.positions).length === 0) return;

    try {
      for (const symbol of Object.keys(this.positions)) {
        const pos = this.positions[symbol];

        try {
          const ticker = await this.exchange.fetchTicker(symbol);
          const current = ticker.last;

          if (current > pos.highest) {
            pos.highest = current;
            await this.database.savePosition(symbol, pos);
          }

          const profit = Helpers.calculateProfitPercent(pos.entry, current);

          if (current >= pos.takeProfit) {
            await this.closePosition(
              symbol,
              `Take Profit +${this.config.risk.takeProfitPercent}%`
            );
          } else if (current <= pos.stopLoss) {
            await this.closePosition(
              symbol,
              `Hard Stop -${this.config.risk.stopLossPercent}%`
            );
          } else if (
            current <=
              Helpers.calculateTrailingStop(
                pos.highest,
                this.config.risk.trailingStopPercent
              ) &&
            profit > this.config.risk.minSellProfit
          ) {
            await this.closePosition(
              symbol,
              `Trailing Stop ${this.config.risk.trailingStopPercent}% from peak`
            );
          }

          await Helpers.delay(this.config.trading.priceCheckInterval);
        } catch (err) {
          this.logger.error(`Manage position error ${symbol}: ${err.message}`);
        }
      }
    } catch (err) {
      this.logger.error(`Critical managePositions error: ${err.message}`);
    }
  }

  async generateDailyReport() {
    try {
      const stats = await this.database.getDailyStats();
      const dailyPnL = Helpers.getDailyPnL(this.balance, this.initialBalance);
      const positionCount = Object.keys(this.positions).length;

      await this.telegram.sendDailyReport(
        stats,
        this.balance,
        this.initialBalance,
        positionCount
      );
    } catch (err) {
      this.logger.error(`Daily report error: ${err.message}`);
    }
  }

  async runDiagnostics() {
    this.logger.info('🔍 Running diagnostics...');
    const report = await Diagnostics.runFullDiagnostic(this);
    const formatted = Diagnostics.formatReport(report);
    await this.telegram.send(formatted);
    this.logger.info(formatted);
    return report;
  }

  async start() {
    await this.init();

    // ✅ تشخيص أولي بعد البدء
    setTimeout(() => this.runDiagnostics(), 30000); // بعد 30 ثانية

    while (true) {
      try {
        // تحديث الأسواق
        if (
          Date.now() - this.lastMarketUpdate >
          this.config.cache.marketDuration
        ) {
          await this.updateMarketCache();
        }

        // إدارة الصفقات
        await this.managePositions();

        // البحث عن فرص جديدة
        if (
          Object.keys(this.positions).length < this.config.risk.maxPositions
        ) {
          const signals = await this.scanMarket();

          // ✅ لوج تشخيصي
          if (signals.length === 0) {
            this.logger.warning(`⚠️ No signals found in this scan cycle`);
          } else {
            this.logger.success(`✅ Found ${signals.length} signal(s)`);
          }

          for (const signal of signals) {
            if (
              Object.keys(this.positions).length >=
              this.config.risk.maxPositions
            )
              break;
            await this.openPosition(signal);
          }
        } else {
          this.logger.info(
            `📊 Max positions reached (${this.config.risk.maxPositions})`
          );
        }

        // فحص الأوامر المعلقة
        for (const symbol of Object.keys(this.pendingOrders)) {
          await this.checkPendingOrder(symbol);
          await Helpers.delay(500);
        }

        // تحديث الرصيد
        await this.updateBalance();

        // تقرير يومي
        if (
          new Date().getHours() === 0 &&
          Date.now() - this.lastReport > 3600000
        ) {
          await this.generateDailyReport();
          this.lastReport = Date.now();
          this.initialBalance = this.balance;
        }
      } catch (err) {
        this.logger.error(`Main loop error: ${err.message}`);
        await this.telegram.send(
          `⚠️ Loop error: ${err.message}. Continuing...`
        );
      }

      await Helpers.delay(this.config.trading.scanInterval);
    }
  }
}

// Start the bot
if (require.main === module) {
  const bot = new VortexChainBot();
  bot.start().catch((err) => {
    console.error('Bot startup error:', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
  });
}

module.exports = VortexChainBot;
