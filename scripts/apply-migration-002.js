#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...rest] = trimmed.split('=');
    env[key.trim()] = rest.join('=').trim();
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase credentials');
  console.error(`NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗'}`);
  console.error(`SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? '✓' : '✗'}`);
  process.exit(1);
}

console.log('🔄 Applying migration 002_add_approval_flow...\n');

// Read migration file
const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '002_add_approval_flow.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Extract project ID from URL
const projectMatch = supabaseUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
if (!projectMatch) {
  console.error('❌ Invalid Supabase URL format');
  process.exit(1);
}

const projectId = projectMatch[1];
const apiUrl = `https://${projectId}.supabase.co`;

console.log(`📍 Project: ${projectId}`);
console.log(`🌐 API URL: ${apiUrl}\n`);

// Execute via Supabase RPC endpoint
const payload = JSON.stringify({
  sql: migrationSQL
});

const options = {
  hostname: `${projectId}.supabase.co`,
  path: '/rest/v1/rpc/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Authorization': `Bearer ${serviceRoleKey}`,
    'apikey': serviceRoleKey,
  }
};

console.log('📝 Executing SQL statements...\n');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`\n📊 Response Status: ${res.statusCode}`);
    
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ Migration 002 executed successfully!\n');
      console.log('📋 Next steps for Phase 0:');
      console.log('  1. ✓ Collect Supabase credentials');
      console.log('  2. ✓ Update .env.local');
      console.log('  3. ✓ Restart dev server');
      console.log('  4. ✓ Apply migration 002');
      console.log('  5. ⏳ Verify profile trigger (sets approval_status)');
      console.log('  6. ⏳ Add auth error handling');
      console.log('  7. ⏳ Verify admin dashboard');
      console.log('\n💡 Remember to collect remaining credentials: n8n, Azure OpenAI');
    } else {
      console.error(`❌ Error (${res.statusCode}): ${data}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.error('\n⚠️  Note: If the RPC endpoint is not available, manually execute the migration:');
  console.error('1. Go to Supabase Studio: https://app.supabase.com/project/');
  console.error('2. Click "SQL Editor"');
  console.error('3. Create a new query');
  console.error('4. Paste the migration SQL and execute');
  console.error('\nMigration SQL:');
  console.error(migrationSQL);
  process.exit(1);
});

req.write(payload);
req.end();
