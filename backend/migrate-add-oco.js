// Migration script to add oco_order_id column to positions table
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

async function migrate() {
  console.log('🔄 Starting database migration...\n');

  const db = await open({
    filename: './trades.db',
    driver: sqlite3.Database,
  });

  try {
    // Check if positions table exists
    const tables = await db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='positions'"
    );

    if (tables.length === 0) {
      console.log('⚠️  positions table does not exist yet.');
      console.log('✅ It will be created automatically when the bot starts.\n');
      console.log('💡 The new schema already includes oco_order_id column.\n');
      await db.close();
      return;
    }

    // Check if column already exists
    const tableInfo = await db.all('PRAGMA table_info(positions)');
    const hasOcoColumn = tableInfo.some((col) => col.name === 'oco_order_id');

    if (hasOcoColumn) {
      console.log(
        '✅ Column oco_order_id already exists. No migration needed.\n'
      );
      await db.close();
      return;
    }

    // Add the new column
    await db.exec('ALTER TABLE positions ADD COLUMN oco_order_id TEXT');

    console.log(
      '✅ Successfully added oco_order_id column to positions table\n'
    );
    console.log('📊 Updated schema:');

    const updatedInfo = await db.all('PRAGMA table_info(positions)');
    updatedInfo.forEach((col) => {
      console.log(`  - ${col.name} (${col.type})`);
    });

    console.log('\n✅ Migration completed successfully!\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    await db.close();
  }
}

migrate().catch(console.error);
