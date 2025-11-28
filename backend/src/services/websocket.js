// src/services/websocket.js - خدمة WebSocket

const WebSocket = require('ws');

class WebSocketService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.ws = null;
    this.connected = false;
    this.tickersCache = {};
    this.lastPing = Date.now();
    this.reconnectInterval = null;
  }

  init() {
    try {
      const ws = new WebSocket(this.config.websocket.endpoint);

      ws.on('open', () => {
        this.logger.info('WebSocket connected');
        this.connected = true;
        this.lastPing = Date.now();
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
        } catch (err) {
          this.logger.warning(`WS parse error: ${err.message}`);
        }
      });

      ws.on('ping', () => {
        this.lastPing = Date.now();
      });

      ws.on('close', () => {
        this.connected = false;
        this.logger.warning('WebSocket disconnected');
        this.scheduleReconnect();
      });

      ws.on('error', (err) => {
        this.logger.error(`WebSocket error: ${err.message}`);
        this.connected = false;
      });

      this.ws = ws;
    } catch (err) {
      this.logger.error(`WebSocket init failed: ${err.message}`);
    }
  }

  scheduleReconnect() {
    if (this.reconnectInterval) clearTimeout(this.reconnectInterval);
    this.reconnectInterval = setTimeout(() => {
      this.logger.info('Attempting WebSocket reconnect...');
      this.init();
    }, this.config.websocket.reconnectInterval);
  }

  isConnected() {
    return (
      this.connected &&
      this.ws &&
      this.ws.readyState === WebSocket.OPEN &&
      Date.now() - this.lastPing < this.config.websocket.pingTimeout
    );
  }

  getTickersCache() {
    return this.tickersCache;
  }

  close() {
    if (this.reconnectInterval) clearTimeout(this.reconnectInterval);
    if (this.ws) {
      this.ws.close();
    }
  }
}

module.exports = WebSocketService;
