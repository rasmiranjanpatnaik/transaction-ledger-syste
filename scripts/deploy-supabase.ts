import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const { Pool } = pg;

async function deploy() {
  const password = encodeURIComponent('ranjan123456@RRR');
  // Port 5432 session pooler or 6543 transaction pooler
  const connectionUrl = `postgresql://postgres.yrqlmrnnnkyumkoudaae:${password}@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres`;

  console.log('Connecting to Supabase (ap-northeast-1 pooler)...');
  const pool = new Pool({
    connectionString: connectionUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client = await pool.connect();
  console.log('✅ Connected to Supabase PostgreSQL successfully!');

  console.log('Executing supabase_schema.sql...');
  const schema = fs.readFileSync(path.resolve(process.cwd(), 'supabase_schema.sql'), 'utf-8');
  await client.query(schema);
  console.log('✅ Schema deployed successfully!');

  const check = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('accounts', 'transactions', 'transfers');
  `);
  console.log('✅ Verified tables in Supabase public schema:', check.rows.map((r) => r.table_name));

  client.release();
  await pool.end();

  // Update .env with working connection URL
  let env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
  env = env.replace(/DATABASE_URL=.*/, `DATABASE_URL=${connectionUrl}`);
  fs.writeFileSync(path.resolve(process.cwd(), '.env'), env);
  console.log('✅ Updated .env with working Supabase DATABASE_URL!');
}

deploy().catch((err) => {
  console.error('❌ Deployment error:', err.message);
  process.exit(1);
});
