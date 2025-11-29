// src/api-server.js - API Server للفرونت إند

const express = require('express');
const cors = require('cors');

class ApiServer {
  constructor(bot, config) {
    this.bot = bot;
    this.config = config;
    this.app = express();
    this.port = process.env.API_PORT || 3000;

    this.setupMiddleware();
    this.setupRoutes();
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
        const limit = parseInt(req.query.limit) || 50;
        const coins = await this.bot.getTopVolumeCoins(limit);

        // Get detailed info for each coin
        const tickers = this.bot.ws.isConnected()
          ? this.bot.ws.getTickersCache()
          : await this.bot.exchange.fetchTickers();

        const coinsData = coins.map((symbol) => {
          const ticker = tickers[symbol] || {};
          return {
            symbol,
            price: ticker.last || 0,
            change24h: ticker.percentage || 0,
            volume24h: ticker.quoteVolume || 0,
            high24h: ticker.high || 0,
            low24h: ticker.low || 0,
          };
        });

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

        const trades = await this.bot.database.db.all(
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
        const stats = await this.bot.database.getDailyStats();
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
    this.server = this.app.listen(this.port, () => {
      console.log(`🌐 API Server running on port ${this.port}`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

module.exports = ApiServer;
