// src/services/technical-analysis.js - التحليل الفني

const { sma, rsi, macd, atr } = require('ta.js');

class TechnicalAnalysisService {
  constructor(config) {
    this.config = config;
  }

  async calculateSMA(closes, period) {
    return await sma(closes, period);
  }

  async calculateRSI(closes, period) {
    return await rsi(closes, period);
  }

  async calculateMACD(closes) {
    const { fast, slow, signal } = this.config.indicators;
    return await macd(closes, fast, slow, signal);
  }

  async calculateATR(prices) {
    return await atr(prices, this.config.indicators.atrPeriod);
  }

  async analyzeSignal(ohlcv) {
    if (!ohlcv || ohlcv.length < 200) return null;

    const closes = ohlcv.map((c) => c[4]);
    const volumes = ohlcv.map((c) => c[5]);
    const price = closes[closes.length - 1];

    const {
      sma50Period,
      sma200Period,
      rsiPeriod,
      rsiBuyZoneMin,
      rsiBuyZoneMax,
      rsiOverbought,
    } = this.config.indicators;

    // احسب المؤشرات
    const sma50 = await this.calculateSMA(closes, sma50Period);
    const sma200 = await this.calculateSMA(closes, sma200Period);
    const rsiData = await this.calculateRSI(closes, rsiPeriod);
    const currentRsi = rsiData.slice(-1)[0];

    const macdData = await this.calculateMACD(closes);
    const macdLine = macdData.MACD.slice(-1)[0];
    const signalLine = macdData.signal.slice(-1)[0];
    const prevMacd = macdData.MACD.slice(-2)[0];
    const prevSignal = macdData.signal.slice(-2)[0];

    // حجم التداول
    const volumeSma = await this.calculateSMA(
      volumes,
      this.config.indicators.volumeSmaShort
    );
    const currentAvgVol = volumeSma.slice(-1)[0];
    const volSurge =
      volumes[volumes.length - 1] >
      currentAvgVol * this.config.indicators.volumeSurgeMultiplier;

    // ATR
    const atrData = await this.calculateATR({
      high: ohlcv.map((c) => c[2]),
      low: ohlcv.map((c) => c[3]),
      close: closes,
    });
    const currentAtr = atrData.slice(-1)[0];

    // الشروط المحسّنة - أكثر واقعية وتكرار
    const sma50Val = sma50.slice(-1)[0];
    const sma200Val = sma200.slice(-1)[0];
    const prevSma50 = sma50.slice(-2)[0];
    const prevSma200 = sma200.slice(-2)[0];

    // ❌ القديم: Golden Cross (نادر جداً ولا يحدث إلا مرات قليلة)
    // const goldenCross = sma50Val > sma200Val && prevSma50 <= prevSma200;

    // ✅ الجديد: شروط أكثر واقعية وتكرار
    const trendFollowing = price > sma50Val; // اتجاه صاعد بسيط - أعلى من SMA50
    const momentumPositive = macdCrossUp && volSurge; // زخم إيجابي
    const notOverbought = currentRsi < 65; // منطقة آمنة (رفع من 55 إلى 65)
    const aboveMa200 = price > sma200Val; // فوق المتوسط الطويل الأجل

    const strongSignal =
      trendFollowing && momentumPositive && notOverbought && aboveMa200;

    const mediumSignal =
      macdCrossUp && volSurge && trendFollowing && currentRsi < 70; // مرن أكثر

    return {
      price,
      currentRsi,
      currentAtr,
      sma50: sma50Val,
      sma200: sma200Val,
      macdCrossUp,
      trendFollowing,
      momentumPositive,
      notOverbought,
      aboveMa200,
      volSurge,
      strength: strongSignal ? 'STRONG' : mediumSignal ? 'MEDIUM' : 'WEAK',
      isSignal: strongSignal || mediumSignal,
    };
  }
}

module.exports = TechnicalAnalysisService;
