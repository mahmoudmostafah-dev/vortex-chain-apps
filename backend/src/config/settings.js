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
    chatId:
      Number(process.env.TELEGRAM_CHAT_ID) || process.env.TELEGRAM_CHAT_ID, // ✅ تحويل لرقم
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
    ohlcvLimit: 500, // ✅ زيادة من 200 إلى 500 للتأكد من الحصول على بيانات كافية
    priceCheckInterval: 100, // ms between price checks
    paperTrading: process.env.PAPER_TRADING === 'true', // ✅ وضع التداول الوهمي
    paperBalance: Number(process.env.PAPER_BALANCE) || 1000, // ✅ رصيد وهمي
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
    minVolume: 5_000_000, // ✅ خفض من 10M إلى 5M - عملات أكثر
    minPrice: 0.01, // ✅ خفض من 0.05 إلى 0.01 - عملات رخيصة
    maxChange24h: 100, // ✅ رفع من 50 إلى 100 - يسمح بعملات متحركة
    minChange24h: -30, // ✅ خفض من -15 إلى -30 - يسمح بانتعاش بعد هبوط
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
    volumeSurgeMultiplier: 1.3, // ✅ خفض من 1.5 إلى 1.3 - حجم أقل صرامة
    rsiBuyZoneMin: 30,
    rsiBuyZoneMax: 70, // ✅ رفع من 65 إلى 70 - مرونة أكبر
    rsiOverbought: 75, // ✅ رفع من 70 إلى 75 - يسمح بزخم أقوى
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
