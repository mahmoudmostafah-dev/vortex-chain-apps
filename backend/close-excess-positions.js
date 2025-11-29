// Script to close excess positions
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function closeExcessPositions() {
  const db = await open({
    filename: './trades.db',
    driver: sqlite3.Database,
  });

  // Get all positions ordered by timestamp (oldest first)
  const positions = await db.all(
    'SELECT symbol, entry_price, amount, timestamp FROM positions ORDER BY timestamp ASC'
  );

  console.log(`\n📊 Total positions: ${positions.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  positions.forEach((pos, index) => {
    const date = new Date(pos.timestamp).toLocaleString();
    console.log(
      `${index + 1}. ${pos.symbol} @ $${pos.entry_price} | Amount: ${
        pos.amount
      } | ${date}`
    );
  });

  const maxPositions = 5;
  const toClose = positions.length - maxPositions;

  if (toClose <= 0) {
    console.log('\n✅ No excess positions to close.');
    await db.close();
    return;
  }

  console.log(
    `\n⚠️ Need to close ${toClose} positions to reach max of ${maxPositions}`
  );
  console.log('\n🔴 Closing oldest positions:\n');

  // Close the oldest positions
  for (let i = 0; i < toClose; i++) {
    const pos = positions[i];

    // Delete from positions table
    await db.run('DELETE FROM positions WHERE symbol = ?', [pos.symbol]);

    // Save to trades as closed
    await db.run(
      `INSERT INTO trades (symbol, side, entry_price, exit_price, amount, profit_percent, profit_usdt, fees, reason, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        pos.symbol,
        'SELL',
        pos.entry_price,
        pos.entry_price, // Same price (manual close)
        pos.amount,
        0, // No profit
        0,
        0,
        'Manual close - Excess positions cleanup',
        Date.now(),
      ]
    );

    console.log(`✅ Closed: ${pos.symbol}`);
  }

  console.log(`\n✅ Successfully closed ${toClose} positions`);
  console.log(`📊 Remaining positions: ${maxPositions}\n`);

  await db.close();
}

closeExcessPositions().catch(console.error);
