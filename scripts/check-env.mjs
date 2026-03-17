// Check which env vars are available
const vars = ['ANTHROPIC_API_KEY', 'DATABASE_URL', 'POSTGRES_URL'];
for (const v of vars) {
  const val = process.env[v];
  console.log(`${v}: ${val ? `SET (length: ${val.length}, starts: ${val.substring(0, 8)}...)` : 'NOT SET'}`);
}
