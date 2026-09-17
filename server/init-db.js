const { initSchema, query } = require('./turso');

async function main() {
  await initSchema();
  const tables = await query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;");
  console.log('✅ Turso Database Tables successfully verified:', tables.map(t => t.name));
}

main().catch(err => {
  console.error('❌ Schema initialization failed:', err);
  process.exit(1);
});
