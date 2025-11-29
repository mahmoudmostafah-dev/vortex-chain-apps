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
    try {
      if (!ohlcv || ohlcv.length < 200) {
        return null;
      }

      const closes = ohlcv.map((c) => c[4]);
      const volumes = ohlcv.map((c) => c[5]);
      const price = closes[closes.length - 1];

      if (!price || price <= 0 || closes.length === 0) {
        return null;
      }

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

      if (!sma50 || !sma200 || !rsiData) {
        return null;
      }

      const currentRsi = rsiData.slice(-1)[0];

      const macdData = await this.calculateMACD(closes);
      if (!macdData || !macdData.MACD || !macdData.signal) {
        return null;
      }

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
        currentAvgVol > 0 &&
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

      // ✅ شروط محسّنة - أكثر واقعية وتكرار
      const macdCrossUp = macdLine > signalLine && prevMacd <= prevSignal;
      const macdPositive = macdLine > signalLine; // ✅ جديد: MACD فوق الإشارة (بدون كروس)
      const trendFollowing = price > sma50Val; // اتجاه صاعد بسيط
      const momentumPositive = macdCrossUp || (macdPositive && volSurge); // ✅ زخم مرن
      const notOverbought = currentRsi < rsiBuyZoneMax; // منطقة آمنة (70)
      const aboveMa200 = price > sma200Val; // فوق المتوسط الطويل
      const rsiInBuyZone =
        currentRsi >= rsiBuyZoneMin && currentRsi < rsiBuyZoneMax; // ✅ RSI في منطقة الشراء

      // ✅ إشارة قوية: 3 شروط فقط (بدلاً من 4)
      const strongSignal = trendFollowing && momentumPositive && notOverbought;

      // ✅ إشارة متوسطة: شروط أكثر مرونة
      const mediumSignal =
        (macdPositive || volSurge) &&
        trendFollowing &&
        currentRsi < rsiOverbought &&
        rsiInBuyZone;

      return {
        price,
        currentRsi,
        currentAtr,
        sma50: sma50Val,
        sma200: sma200Val,
        macdCrossUp,
        macdPositive,
        trendFollowing,
        momentumPositive,
        notOverbought,
        aboveMa200,
        volSurge,
        rsiInBuyZone,
        strength: strongSignal ? 'STRONG' : mediumSignal ? 'MEDIUM' : 'WEAK',
        isSignal: strongSignal || mediumSignal,
      };
    } catch (err) {
      console.error('analyzeSignal error:', err.message);
      return null;
    }
  }
}

module.exports = TechnicalAnalysisService;
