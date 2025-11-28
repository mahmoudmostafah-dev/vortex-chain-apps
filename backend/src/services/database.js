// src/services/database.js - إدارة قاعدة البيانات

const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

class DatabaseService {
  constructor(config) {
    this.config = config;
    this.db = null;
    this.dbLock = Promise.resolve();
  }

  async init() {
    this.db = await open({
      filename: this.config.database.path,
      driver: sqlite3.Database,
    });

    await this.createTables();
  }

  async createTables() {
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

      CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp);
      CREATE INDEX IF NOT EXISTS idx_trades_side ON trades(side);
    `);
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

  async getAllPositions() {
    const positions = {};
    const rows = await this.db.all('SELECT * FROM positions');
    for (const row of rows) {
      positions[row.symbol] = {
        entry: row.entry_price,
        amount: row.amount,
        highest: row.highest_price,
        stopLoss: row.stop_loss,
        takeProfit: row.take_profit,
        atrStop: row.atr_stop,
      };
    }
    return positions;
  }

  async getDailyStats() {
    const oneDayAgo = Date.now() - 86400000;
    const stats = await this.db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN profit_percent > 0 THEN 1 ELSE 0 END) as wins,
        SUM(profit_usdt) as total_profit,
        AVG(profit_percent) as avg_profit,
        SUM(fees) as total_fees
      FROM trades 
      WHERE timestamp > ? AND side = 'SELL'`,
      [oneDayAgo]
    );
    return stats;
  }

  async close() {
    if (this.db) {
      await this.db.close();
    }
  }
}

module.exports = DatabaseService;
