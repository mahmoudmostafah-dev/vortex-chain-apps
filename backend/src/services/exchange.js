// src/services/exchange.js - خدمة تبادل العملات (Binance)

const ccxt = require('ccxt');

class ExchangeService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.binance = new ccxt.binance({
      apiKey: config.api.apiKey,
      secret: config.api.apiSecret,
      enableRateLimit: config.api.enableRateLimit,
      options: {
        defaultType: 'spot',
        adjustForTimeDifference: config.api.adjustForTimeDifference,
      },
    });
  }

  async retryWithBackoff(
    fn,
    context,
    maxRetries = this.config.retry.maxRetries
  ) {
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

        const delay = this.config.retry.retryDelay * Math.pow(2, attempt - 1);
        this.logger.warning(
          `${context} failed (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  async loadMarkets() {
    return await this.retryWithBackoff(
      () => this.binance.loadMarkets(),
      'loadMarkets'
    );
  }

  async fetchBalance() {
    return await this.retryWithBackoff(
      () => this.binance.fetchBalance(),
      'fetchBalance'
    );
  }

  async fetchTicker(symbol) {
    return await this.retryWithBackoff(
      () => this.binance.fetchTicker(symbol),
      `fetchTicker ${symbol}`
    );
  }

  async fetchTickers() {
    return await this.retryWithBackoff(
      () => this.binance.fetchTickers(),
      'fetchTickers'
    );
  }

  async fetchOHLCV(symbol, timeframe, limit) {
    return await this.retryWithBackoff(
      () => this.binance.fetchOHLCV(symbol, timeframe, undefined, limit),
      `fetchOHLCV ${symbol}`
    );
  }

  async getMarket(symbol) {
    return await this.retryWithBackoff(
      () => this.binance.market(symbol),
      `market ${symbol}`
    );
  }

  async createLimitBuyOrder(symbol, amount, price) {
    return await this.retryWithBackoff(
      () => this.binance.createLimitBuyOrder(symbol, amount, price),
      `createLimitBuyOrder ${symbol}`
    );
  }

  async createLimitSellOrder(symbol, amount, price) {
    return await this.retryWithBackoff(
      () => this.binance.createLimitSellOrder(symbol, amount, price),
      `createLimitSellOrder ${symbol}`
    );
  }

  async fetchOrder(orderId, symbol) {
    return await this.retryWithBackoff(
      () => this.binance.fetchOrder(orderId, symbol),
      `fetchOrder ${symbol}`
    );
  }

  async createOrder(symbol, type, side, amount, price, params = {}) {
    return await this.retryWithBackoff(
      () => this.binance.createOrder(symbol, type, side, amount, price, params),
      `createOrder ${symbol}`
    );
  }

  // ✅ OCO Order (One-Cancels-the-Other) - Stop Loss + Take Profit معاً
  async createOCOOrder(symbol, amount, price, stopLoss, takeProfit) {
    return await this.retryWithBackoff(
      () =>
        this.binance.privatePostOrderOco({
          symbol: symbol.replace('/', ''),
          side: 'SELL',
          quantity: amount,
          price: takeProfit,
          stopPrice: stopLoss,
          stopLimitPrice: stopLoss * 0.995, // 0.5% below stop for execution
          stopLimitTimeInForce: 'GTC',
        }),
      `createOCOOrder ${symbol}`
    );
  }

  async fetchOpenOrders(symbol) {
    return await this.retryWithBackoff(
      () => this.binance.fetchOpenOrders(symbol),
      `fetchOpenOrders ${symbol}`
    );
  }

  async cancelOrder(orderId, symbol) {
    return await this.retryWithBackoff(
      () => this.binance.cancelOrder(orderId, symbol),
      `cancelOrder ${symbol}`
    );
  }
}

module.exports = ExchangeService;
