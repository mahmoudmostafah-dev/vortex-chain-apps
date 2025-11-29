// src/api-server.js - API Server للفرونت إند

const express = require('express');
const cors = require('cors');

class ApiServer {
  constructor(config, database, logger) {
    this.config = config;
    this.database = database;
    this.logger = logger;
    this.bot = null; // Will be set later
    this.app = express();
    this.port = process.env.API_PORT || 3000;
  }

  init() {
    this.setupMiddleware();
    this.setupRoutes();
    this.start();
  }

  setBot(bot) {
    this.bot = bot;
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Get top coins being scanned
    this.app.get('/api/market/top-coins', async (req, res) => {
      try {
        if (!this.bot) {
          return res.status(503).json({
            success: false,
            error: 'Bot not initialized yet',
          });
        }

        const limit = parseInt(req.query.limit) || 50;
        const coins = await this.bot.getTopVolumeCoins(limit);

        // Get detailed info for each coin
        const tickers = this.bot.ws.isConnected()
          ? this.bot.ws.getTickersCache()
          : await this.bot.exchange.fetchTickers();

        // Get technical analysis for each coin
        const coinsData = await Promise.all(
          coins.map(async (symbol) => {
            const ticker = tickers[symbol] || {};

            // Get technical analysis
            let analysis = null;
            try {
              const ohlcv = await this.bot.exchange.fetchOHLCV(
                symbol,
                this.config.trading.ohlcvTimeframe,
                undefined,
                100
              );

              if (ohlcv && ohlcv.length >= 50) {
                analysis = await this.bot.analyzeCoin(symbol, ohlcv, ticker);
              }
            } catch (err) {
              this.logger.warning(
                `Failed to analyze ${symbol}: ${err.message}`
              );
            }

            return {
              symbol,
              price: ticker.last || 0,
              change24h: ticker.percentage || 0,
              volume24h: ticker.quoteVolume || 0,
              high24h: ticker.high || 0,
              low24h: ticker.low || 0,
              analysis: analysis || {
                rsi: null,
                macd: null,
                trend: null,
                volumeSurge: null,
                score: 0,
                total: 4,
              },
            };
          })
        );

        res.json({
          success: true,
          count: coinsData.length,
          data: coinsData,
          timestamp: Date.now(),
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message,
        });
      }
    });

    // Get current positions
    this.app.get('/api/positions', (req, res) => {
      if (!this.bot) {
        return res.status(503).json({
          success: false,
          error: 'Bot not initialized yet',
        });
      }

      const positions = Object.entries(this.bot.positions).map(
        ([symbol, pos]) => ({
          symbol,
          entry_price: pos.entry,
          amount: pos.amount,
          highest_price: pos.highest,
          stop_loss: pos.stopLoss,
          take_profit: pos.takeProfit,
          current_profit: ((pos.highest - pos.entry) / pos.entry) * 100,
        })
      );

      res.json({
        success: true,
        count: positions.length,
        data: positions,
      });
    });

    // Get trades history
    this.app.get('/api/trades', async (req, res) => {
      try {
        const period = req.query.period || 'day';
        const limit = parseInt(req.query.limit) || 100;

        const periodMap = {
          day: 86400000,
          week: 604800000,
          month: 2592000000,
          year: 31536000000,
        };

        const startTime = Date.now() - (periodMap[period] || 86400000);

        const trades = await this.database.db.all(
          `SELECT * FROM trades WHERE timestamp > ? ORDER BY timestamp DESC LIMIT ?`,
          [startTime, limit]
        );

        res.json({
          success: true,
          count: trades.length,
          data: trades,
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message,
        });
      }
    });

    // Get bot stats
    this.app.get('/api/stats', async (req, res) => {
      try {
        if (!this.bot) {
          return res.status(503).json({
            success: false,
            error: 'Bot not initialized yet',
          });
        }

        const stats = await this.database.getDailyStats();
        const marketStats = this.bot.marketMonitor.getMarketStats();
        const protectionStatus = this.bot.marketMonitor.getProtectionStatus();

        res.json({
          success: true,
          data: {
            balance: this.bot.balance,
            initialBalance: this.bot.initialBalance,
            paperTrading: this.bot.paperTrading,
            openPositions: Object.keys(this.bot.positions).length,
            dailyStats: stats,
            marketStats,
            protectionStatus,
          },
        });
      } catch (err) {
        res.status(500).json({
          success: false,
          error: err.message,
        });
      }
    });
  }

  start() {
    this.server = this.app.listen(this.port, '0.0.0.0', () => {
      this.logger.success(`🌐 API Server running on port ${this.port}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = ApiServer;
