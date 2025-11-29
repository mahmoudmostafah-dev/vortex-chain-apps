// src/services/market-monitor.js - مراقبة السوق وحماية رأس المال

class MarketMonitorService {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.btcPriceHistory = []; // آخر 5 دقائق
    this.marketSentiment = [];
    this.protectionMode = false;
    this.protectionUntil = 0;
    this.lastCheck = 0;
  }

  // تحديث سعر BTC
  updateBtcPrice(price) {
    const now = Date.now();
    this.btcPriceHistory.push({ price, timestamp: now });

    // الاحتفاظ بآخر 5 دقائق فقط
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    this.btcPriceHistory = this.btcPriceHistory.filter(
      (entry) => entry.timestamp > fiveMinutesAgo
    );
  }

  // حساب تغير BTC في آخر 5 دقائق
  getBtcChange5Min() {
    if (this.btcPriceHistory.length < 2) return 0;

    const latest = this.btcPriceHistory[this.btcPriceHistory.length - 1];
    const oldest = this.btcPriceHistory[0];

    const change = ((latest.price - oldest.price) / oldest.price) * 100;
    return change;
  }

  // تحديث معنويات السوق (نسبة العملات الخضراء/الحمراء)
  updateMarketSentiment(tickers) {
    const usdtPairs = Object.keys(tickers).filter((s) => s.endsWith('/USDT'));

    let greenCount = 0;
    let redCount = 0;

    for (const symbol of usdtPairs) {
      const change = tickers[symbol].percentage || 0;
      if (change > 0) greenCount++;
      else if (change < 0) redCount++;
    }

    const total = greenCount + redCount;
    const redPercentage = total > 0 ? (redCount / total) * 100 : 0;

    this.marketSentiment.push({
      redPercentage,
      timestamp: Date.now(),
    });

    // الاحتفاظ بآخر 10 قراءات
    if (this.marketSentiment.length > 10) {
      this.marketSentiment.shift();
    }

    return { greenCount, redCount, redPercentage };
  }

  // فحص حالة السوق المفاجئة
  checkMarketCrash() {
    const btcChange = this.getBtcChange5Min();

    // BTC نزل -1.5% أو أكثر في 5 دقائق
    const btcCrash = btcChange <= this.config.protection.btcDropThreshold;

    // السوق كله أحمر (أكثر من 70% عملات حمراء)
    let marketCrash = false;
    if (this.marketSentiment.length > 0) {
      const latest = this.marketSentiment[this.marketSentiment.length - 1];
      marketCrash =
        latest.redPercentage >= this.config.protection.redMarketThreshold;
    }

    return {
      btcCrash,
      marketCrash,
      btcChange: btcChange.toFixed(2),
      triggered: btcCrash || marketCrash,
    };
  }

  // تفعيل وضع الحماية
  activateProtection(reason, durationHours) {
    this.protectionMode = true;
    this.protectionUntil = Date.now() + durationHours * 60 * 60 * 1000;

    this.logger.warning(
      `🔒 CAPITAL PROTECTION MODE ACTIVATED | Reason: ${reason} | Duration: ${durationHours}h`
    );

    return {
      active: true,
      reason,
      until: new Date(this.protectionUntil).toISOString(),
      durationHours,
    };
  }

  // إلغاء وضع الحماية
  deactivateProtection() {
    if (!this.protectionMode) return false;

    this.protectionMode = false;
    this.protectionUntil = 0;

    this.logger.success('✅ Capital Protection Mode deactivated');
    return true;
  }

  // التحقق من وضع الحماية
  isProtectionActive() {
    if (!this.protectionMode) return false;

    // إذا انتهت المدة، إلغاء الحماية تلقائياً
    if (Date.now() >= this.protectionUntil) {
      this.deactivateProtection();
      return false;
    }

    return true;
  }

  // الوقت المتبقي لوضع الحماية
  getProtectionTimeRemaining() {
    if (!this.protectionMode) return 0;

    const remaining = this.protectionUntil - Date.now();
    return Math.max(0, Math.ceil(remaining / (60 * 1000))); // بالدقائق
  }

  // معلومات وضع الحماية
  getProtectionStatus() {
    return {
      active: this.protectionMode,
      until: this.protectionMode
        ? new Date(this.protectionUntil).toISOString()
        : null,
      remainingMinutes: this.getProtectionTimeRemaining(),
    };
  }

  // إحصائيات السوق
  getMarketStats() {
    const btcChange = this.getBtcChange5Min();
    const sentiment =
      this.marketSentiment.length > 0
        ? this.marketSentiment[this.marketSentiment.length - 1]
        : null;

    return {
      btcChange5Min: btcChange.toFixed(2),
      marketRedPercentage: sentiment
        ? sentiment.redPercentage.toFixed(1)
        : 'N/A',
      btcDataPoints: this.btcPriceHistory.length,
      protectionActive: this.protectionMode,
    };
  }
}

module.exports = MarketMonitorService;
