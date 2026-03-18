/**
 * Test Azure Whisper Endpoint
 * Diagnostics for audio transcription issues
 */

import fs from 'fs';
import path from 'path';

// Load environment variables
const env = {};
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && !key.startsWith('#')) {
    env[key.trim()] = rest.join('=').trim();
  }
});

const AZURE_ENDPOINT = env.AZURE_OPENAI_ENDPOINT || '';
const AZURE_API_KEY = env.AZURE_OPENAI_API_KEY || '';
const WHISPER_DEPLOYMENT = env.AZURE_OPENAI_WHISPER_DEPLOYMENT || 'whisper';
const GPT_DEPLOYMENT = env.AZURE_OPENAI_GPT_DEPLOYMENT || 'gpt-4o';

console.log('\n=== AZURE CONFIGURATION DIAGNOSTICS ===\n');
console.log('AZURE_ENDPOINT:', AZURE_ENDPOINT);
console.log('AZURE_API_KEY:', AZURE_API_KEY?.substring(0, 10) + '...');
console.log('WHISPER_DEPLOYMENT:', WHISPER_DEPLOYMENT);
console.log('GPT_DEPLOYMENT:', GPT_DEPLOYMENT);

// Check if deployments look correct
const warnings = [];

if (!AZURE_ENDPOINT) warnings.push('❌ AZURE_ENDPOINT not set');
if (!AZURE_API_KEY) warnings.push('❌ AZURE_API_KEY not set');
if (GPT_DEPLOYMENT === 'gpt-5.3-chat') {
  warnings.push('⚠️  GPT_DEPLOYMENT "gpt-5.3-chat" looks suspicious. Standard deployments are "gpt-4o", "gpt-4-turbo", etc.');
}

if (warnings.length > 0) {
  console.log('\n⚠️  CONFIGURATION ISSUES:\n');
  warnings.forEach(w => console.log('  ' + w));
}

// Test Whisper URL construction
const whisperUrl = `${AZURE_ENDPOINT}/openai/deployments/${WHISPER_DEPLOYMENT}/audio/transcriptions?api-version=2024-06-01`;
console.log('\n=== WHISPER ENDPOINT URL ===\n');
console.log('Full URL:', whisperUrl);

// Test GPT URL construction
const gptUrl = `${AZURE_ENDPOINT}/openai/deployments/${GPT_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview`;
console.log('\n=== GPT ENDPOINT URL ===\n');
console.log('Full URL:', gptUrl);

console.log('\n=== HYPOTHESIS ===\n');
console.log('Issue: Audio is likely being sent to the API, but Azure Whisper');
console.log('is either:');
console.log('  1. Returning empty transcription (wrong config)');
console.log('  2. Failing with 401/403 (auth issues)');
console.log('  3. Returning error that\'s being silently caught\n');
console.log('FIX: Add detailed logging to tutor/route.ts to capture');
console.log('     actual Azure API responses and error messages.\n');
