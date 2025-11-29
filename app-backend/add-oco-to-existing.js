// Script to add OCO Orders to existing open positions
require('dotenv').config();
const VortexChainBot = require('./src/bot-modular');

async function addOcoToExisting() {
  console.log('🔄 Adding OCO Orders to existing positions...\n');

  const bot = new VortexChainBot();
  await bot.init();

  const positions = Object.keys(bot.positions);

  if (positions.length === 0) {
    console.log('✅ No open positions found.\n');
    process.exit(0);
  }

  console.log(`📊 Found ${positions.length} open positions:\n`);

  for (const symbol of positions) {
    const pos = bot.positions[symbol];

    console.log(`\n🔍 Processing ${symbol}:`);
    console.log(`  Entry: ${pos.entry}`);
    console.log(`  Stop Loss: ${pos.stopLoss}`);
    console.log(`  Take Profit: ${pos.takeProfit}`);

    // Skip if already has OCO
    if (pos.ocoOrderId) {
      console.log(`  ✅ Already has OCO Order: ${pos.ocoOrderId}`);
      continue;
    }

    // Skip paper trading positions
    if (bot.paperTrading || pos.paper) {
      console.log(`  ⏭️  Skipped (Paper Trading)`);
      continue;
    }

    try {
      // Create OCO Order
      const ocoOrder = await bot.exchange.createOCOOrder(
        symbol,
        pos.amount,
        pos.entry,
        pos.stopLoss,
        pos.takeProfit
      );

      pos.ocoOrderId = ocoOrder.orderListId;
      await bot.database.savePosition(symbol, pos);

      console.log(`  ✅ OCO Order created: ${ocoOrder.orderListId}`);

      await bot.telegram.send(
        `🛡️ OCO Order added to existing position\n${symbol}\n📉 SL: ${pos.stopLoss}\n📈 TP: ${pos.takeProfit}`
      );
    } catch (err) {
      console.log(`  ❌ Failed: ${err.message}`);
      await bot.telegram.send(
        `⚠️ Failed to add OCO for ${symbol}: ${err.message}`
      );
    }

    // Delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('\n✅ Completed!\n');
  process.exit(0);
}

addOcoToExisting().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
