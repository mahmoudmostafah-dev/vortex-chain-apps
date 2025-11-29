// src/services/api-server.js - خدمة API للـ Dashboard

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

class ApiServer {
  constructor(config, database, logger) {
    this.config = config;
    this.database = database;
    this.logger = logger;
    this.app = express();
    this.port = process.env.API_PORT || 3000;
  }

  init() {
    // Middleware
    this.app.use(cors());
    this.app.use(express.json());

    // Routes
    this.setupRoutes();

    // Start server
    this.app.listen(this.port, () => {
      this.logger.info(`API Server running on port ${this.port}`);
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // Get trades by period
    this.app.get('/api/trades', async (req, res) => {
      try {
        const period = req.query.period || 'day';
        const timestamp = this.getPeriodTimestamp(period);

        const trades = await this.database.db.all(
          `SELECT * FROM trades 
           WHERE timestamp > ? AND side = 'SELL'
           ORDER BY timestamp DESC`,
          [timestamp]
        );

        res.json(trades);
      } catch (err) {
        this.logger.error(`API /trades error: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });

    // Get open positions
    this.app.get('/api/positions', async (req, res) => {
      try {
        const positions = await this.database.db.all(
          'SELECT * FROM positions ORDER BY timestamp DESC'
        );

        res.json(positions);
      } catch (err) {
        this.logger.error(`API /positions error: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });

    // Get daily statistics
    this.app.get('/api/stats/daily', async (req, res) => {
      try {
        const period = req.query.period || 'week';
        const days = this.getPeriodDays(period);
        const stats = [];

        for (let i = days - 1; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setHours(0, 0, 0, 0);

          const startTimestamp = date.getTime();
          const endTimestamp = startTimestamp + 86400000; // +24 hours

          const dayStats = await this.database.db.get(
            `SELECT 
              COUNT(*) as total_trades,
              SUM(CASE WHEN profit_percent > 0 THEN 1 ELSE 0 END) as wins,
              SUM(CASE WHEN profit_percent <= 0 THEN 1 ELSE 0 END) as losses,
              SUM(profit_usdt) as total_profit,
              AVG(profit_percent) as avg_profit,
              SUM(fees) as total_fees
            FROM trades 
            WHERE timestamp >= ? AND timestamp < ? AND side = 'SELL'`,
            [startTimestamp, endTimestamp]
          );

          const winRate =
            dayStats.total_trades > 0
              ? (dayStats.wins / dayStats.total_trades) * 100
              : 0;

          stats.push({
            date: date.toISOString().split('T')[0],
            total_trades: dayStats.total_trades || 0,
            wins: dayStats.wins || 0,
            losses: dayStats.losses || 0,
            win_rate: winRate,
            total_profit: dayStats.total_profit || 0,
            avg_profit: dayStats.avg_profit || 0,
            total_fees: dayStats.total_fees || 0,
          });
        }

        res.json(stats);
      } catch (err) {
        this.logger.error(`API /stats/daily error: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });

    // Get logs
    this.app.get('/api/logs', async (req, res) => {
      try {
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const logFile = path.join(this.config.logging.logDir, `${date}.log`);

        if (!fs.existsSync(logFile)) {
          return res.status(404).json({ error: 'Log file not found' });
        }

        const content = fs.readFileSync(logFile, 'utf-8');
        res.type('text/plain').send(content);
      } catch (err) {
        this.logger.error(`API /logs error: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });

    // Get available log dates
    this.app.get('/api/logs/dates', async (req, res) => {
      try {
        const logDir = this.config.logging.logDir;

        if (!fs.existsSync(logDir)) {
          return res.json([]);
        }

        const files = fs.readdirSync(logDir);
        const dates = files
          .filter((f) => f.endsWith('.log'))
          .map((f) => f.replace('.log', ''))
          .sort()
          .reverse();

        res.json(dates);
      } catch (err) {
        this.logger.error(`API /logs/dates error: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });

    // Get summary statistics
    this.app.get('/api/stats/summary', async (req, res) => {
      try {
        const allTime = await this.database.db.get(
          `SELECT 
            COUNT(*) as total_trades,
            SUM(CASE WHEN profit_percent > 0 THEN 1 ELSE 0 END) as wins,
            SUM(profit_usdt) as total_profit,
            AVG(profit_percent) as avg_profit,
            SUM(fees) as total_fees,
            MAX(profit_percent) as best_trade,
            MIN(profit_percent) as worst_trade
          FROM trades 
          WHERE side = 'SELL'`
        );

        const today = await this.database.db.get(
          `SELECT 
            COUNT(*) as total_trades,
            SUM(profit_usdt) as total_profit
          FROM trades 
          WHERE timestamp > ? AND side = 'SELL'`,
          [Date.now() - 86400000]
        );

        res.json({
          all_time: allTime,
          today: today,
        });
      } catch (err) {
        this.logger.error(`API /stats/summary error: ${err.message}`);
        res.status(500).json({ error: err.message });
      }
    });
  }

  getPeriodTimestamp(period) {
    const now = Date.now();
    switch (period) {
      case 'day':
        return now - 86400000; // 24 hours
      case 'week':
        return now - 604800000; // 7 days
      case 'month':
        return now - 2592000000; // 30 days
      case 'year':
        return now - 31536000000; // 365 days
      default:
        return now - 86400000;
    }
  }

  getPeriodDays(period) {
    switch (period) {
      case 'week':
        return 7;
      case 'month':
        return 30;
      case 'year':
        return 365;
      default:
        return 7;
    }
  }
}

module.exports = ApiServer;
