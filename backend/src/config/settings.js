// src/config/settings.js - جميع الإعدادات المركزية

module.exports = {
  // API Configuration
  api: {
    apiKey: process.env.BINANCE_API_KEY,
    apiSecret: process.env.BINANCE_SECRET_KEY,
    enableRateLimit: true,
    adjustForTimeDifference: true,
  },

  // Telegram
  telegram: {
    token: process.env.TELEGRAM_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },

  // Risk Management
  risk: {
    riskPercentage: Number(process.env.RISK_PERCENTAGE) || 2,
    maxPositions: Number(process.env.MAX_POSITIONS) || 5,
    stopLossPercent: 2.5,
    takeProfitPercent: 7,
    trailingStopPercent: 3.5,
    maxDailyLoss: -5,
    minPositionUsd: 15,
    maxBuySlippage: 0.3,
    minSellProfit: 0.5,
  },

  // Trading
  trading: {
    scanInterval: 60000, // 1 minute
    balanceUpdateInterval: 300000, // 5 minutes
    ohlcvTimeframe: '15m',
    ohlcvLimit: 200,
    priceCheckInterval: 100, // ms between price checks
  },

  // Cache
  cache: {
    marketDuration: 3600000, // 1 hour
    tickersDuration: 30000, // 30 seconds
    ohlcvDuration: 300000, // 5 minutes
    messageCooldown: 600000, // 10 minutes
  },

  // Retry Settings
  retry: {
    maxRetries: 3,
    retryDelay: 2000,
  },

  // WebSocket
  websocket: {
    endpoint: 'wss://stream.binance.com:9443/ws/!ticker@arr',
    reconnectInterval: 10000,
    pingTimeout: 60000,
  },

  // Filters
  filters: {
    minVolume: 10_000_000,
    minPrice: 0.05,
    maxChange24h: 50,
    minChange24h: -15,
    excludeCoins: ['BUSD', 'UP', 'DOWN', 'BULL', 'BEAR'],
  },

  // Technical Indicators
  indicators: {
    sma50Period: 50,
    sma200Period: 200,
    rsiPeriod: 14,
    atrPeriod: 14,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    volumeSmaShort: 20,
    volumeSurgeMultiplier: 1.5,
    rsiBuyZoneMin: 30,
    rsiBuyZoneMax: 65, // ✅ رفع من 55 إلى 65 - شروط أكثر مرونة
    rsiOverbought: 70, // حد الشراء الزائد للإشارات المتوسطة
  },

  // Database
  database: {
    path: './trades.db',
  },

  // Logging
  logging: {
    logDir: './logs',
    maxLogSize: '10m',
    maxLogFiles: 3,
  },
};
