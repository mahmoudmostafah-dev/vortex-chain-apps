// src/utils/diagnostics.js - أدوات التشخيص

class Diagnostics {
  static async runFullDiagnostic(bot) {
    const report = {
      timestamp: new Date().toISOString(),
      balance: bot.balance,
      positions: Object.keys(bot.positions).length,
      pendingOrders: Object.keys(bot.pendingOrders).length,
      marketCache: bot.marketCache.length,
      wsConnected: bot.ws.isConnected(),
      filters: {},
      lastScan: {},
    };

    // فحص الفلاتر
    try {
      const tickers = bot.ws.isConnected()
        ? bot.ws.getTickersCache()
        : await bot.exchange.fetchTickers();

      const usdtPairs = Object.keys(tickers).filter((s) => s.endsWith('/USDT'));
      report.filters.totalUsdtPairs = usdtPairs.length;

      const afterVolume = usdtPairs.filter(
        (s) => (tickers[s].quoteVolume || 0) > bot.config.filters.minVolume
      );
      report.filters.afterVolumeFilter = afterVolume.length;

      const afterPrice = afterVolume.filter(
        (s) => (tickers[s].last || 0) > bot.config.filters.minPrice
      );
      report.filters.afterPriceFilter = afterPrice.length;

      const afterChange = afterPrice.filter((s) => {
        const change = tickers[s].percentage || 0;
        return (
          change > bot.config.filters.minChange24h &&
          change < bot.config.filters.maxChange24h
        );
      });
      report.filters.afterChangeFilter = afterChange.length;

      const afterExclude = afterChange.filter((s) => {
        return !bot.config.filters.excludeCoins.some((coin) =>
          s.includes(coin)
        );
      });
      report.filters.finalCoins = afterExclude.length;
      report.filters.topCoins = afterExclude.slice(0, 10);
    } catch (err) {
      report.filters.error = err.message;
    }

    return report;
  }

  static formatReport(report) {
    return `
📊 DIAGNOSTIC REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ Time: ${report.timestamp}
💰 Balance: $${report.balance.toFixed(2)}
📈 Open Positions: ${report.positions}
⏳ Pending Orders: ${report.pendingOrders}
🌐 WebSocket: ${report.wsConnected ? '✅ Connected' : '❌ Disconnected'}
📦 Market Cache: ${report.marketCache} pairs

🔍 FILTER ANALYSIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total USDT Pairs: ${report.filters.totalUsdtPairs || 'N/A'}
After Volume Filter (>${(report.filters.minVolume || 0) / 1_000_000}M): ${
      report.filters.afterVolumeFilter || 'N/A'
    }
After Price Filter (>$${report.filters.minPrice || 0}): ${
      report.filters.afterPriceFilter || 'N/A'
    }
After Change Filter: ${report.filters.afterChangeFilter || 'N/A'}
Final Coins: ${report.filters.finalCoins || 'N/A'}

Top 10 Coins:
${(report.filters.topCoins || []).join(', ') || 'None'}

${report.filters.error ? `⚠️ Error: ${report.filters.error}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
}

module.exports = Diagnostics;
