import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

async function testSupabase() {
  console.log('====================================================');
  console.log('🔍 Testing Supabase Connection');
  console.log('====================================================');

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  console.log(`Supabase URL: ${supabaseUrl || '(not configured)'}`);
  console.log(`Anon Key:     ${anonKey ? 'configured (' + anonKey.slice(0, 15) + '...)' : '(not configured)'}`);

  // Test REST API ping first
  if (supabaseUrl && anonKey) {
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });
      console.log(`✅ Supabase REST API reachable (HTTP ${response.status})`);
    } catch (err: unknown) {
      console.warn(`⚠️  REST API ping warning: ${(err as Error).message}`);
    }
  }

  // Check Database URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set in .env');
    process.exit(1);
  }

  if (databaseUrl.includes('[YOUR-PASSWORD]')) {
    console.log('\n⚠️  ACTION REQUIRED:');
    console.log('Your DATABASE_URL contains "[YOUR-PASSWORD]".');
    console.log('Please replace [YOUR-PASSWORD] in your .env file with your actual Supabase database password:');
    console.log('\n  DATABASE_URL=postgresql://postgres:<YOUR_REAL_PASSWORD>@db.yrqlmrnnnkyumkoudaae.supabase.co:5432/postgres\n');
    console.log('💡 If you do not remember your password:');
    console.log('   1. Go to https://supabase.com/dashboard/project/yrqlmrnnnkyumkoudaae/settings/database');
    console.log('   2. Click "Reset Database Password"');
    console.log('   3. Put the new password into your .env file');
    console.log('====================================================');
    return;
  }

  console.log('\nConnecting to Supabase PostgreSQL...');
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to Supabase PostgreSQL!');

    const res = await client.query('SELECT current_database(), current_user, version()');
    console.log(`Database: ${res.rows[0].current_database} | User: ${res.rows[0].current_user}`);

    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('accounts', 'transactions', 'transfers');
    `);

    const existingTables = tableCheck.rows.map((r) => r.table_name);
    console.log(`Found tables: ${existingTables.length ? existingTables.join(', ') : 'None yet'}`);

    if (existingTables.length < 3) {
      console.log('\nDeploying schema to Supabase...');
      const schemaSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase_schema.sql'), 'utf-8');
      await client.query(schemaSql);
      console.log('✅ Schema (accounts, transactions, transfers, triggers) created in Supabase!');
    } else {
      console.log('✅ All tables and triggers already exist in Supabase!');
    }

    client.release();
    await pool.end();
    console.log('\n🎉 Supabase setup verified successfully!');
  } catch (error: unknown) {
    const err = error as Error;
    console.error('\n❌ Failed to connect to PostgreSQL:', err.message);

    if (err.message.includes('ENOTFOUND') || err.message.includes('ENODATA')) {
      console.log('\n💡 Notice: db.yrqlmrnnnkyumkoudaae.supabase.co uses IPv6.');
      console.log('If your network uses IPv4, use the Supabase Connection Pooler URI:');
      console.log('1. Go to Supabase Dashboard -> Project Settings -> Database');
      console.log('2. Under "Connection string", select "Connection Pooler" (Session mode or Transaction mode)');
      console.log('3. Copy that URI into your .env file as DATABASE_URL');
    }
  }
}

testSupabase();
