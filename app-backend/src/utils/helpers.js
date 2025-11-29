// src/utils/helpers.js - دوال مساعدة

class Helpers {
  static calculatePositionSize(
    balance,
    riskPercent,
    maxPositions,
    minPositionUsd
  ) {
    const riskAmount = (balance * riskPercent) / 100;
    const maxPerPosition = balance / maxPositions;
    return Math.max(minPositionUsd, Math.min(riskAmount, maxPerPosition));
  }

  static calculateProfitPercent(entryPrice, exitPrice) {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  }

  static calculateProfitUsdt(entryPrice, exitPrice, amount) {
    return (exitPrice - entryPrice) * amount;
  }

  static calculateStopLoss(entryPrice, stopLossPercent) {
    return entryPrice * (1 - stopLossPercent / 100);
  }

  static calculateTakeProfit(entryPrice, takeProfitPercent) {
    return entryPrice * (1 + takeProfitPercent / 100);
  }

  static calculateTrailingStop(highest, trailingStopPercent) {
    return highest * (1 - trailingStopPercent / 100);
  }

  static calculateBuyPrice(currentPrice, slippage) {
    return currentPrice * (1 - slippage / 100);
  }

  static calculateSellPrice(currentPrice, slippage) {
    return currentPrice * (1 + slippage / 100);
  }

  static getDailyPnL(currentBalance, initialBalance) {
    if (initialBalance === 0) return 0;
    return ((currentBalance - initialBalance) / initialBalance) * 100;
  }

  static isNewDay(lastTime) {
    const now = new Date();
    const last = new Date(lastTime);
    return (
      now.getDate() !== last.getDate() ||
      now.getMonth() !== last.getMonth() ||
      now.getFullYear() !== last.getFullYear()
    );
  }

  static formatPrice(price) {
    return price.toFixed(6);
  }

  static formatPercent(percent) {
    return `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`;
  }

  static formatMoney(amount) {
    return `$${amount.toFixed(2)}`;
  }

  static formatVolume(volume) {
    return volume.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = Helpers;
