const expectedUrl = 'https://bumoiebziefburtmisnn.supabase.co';
const url = process.env.VITE_SUPABASE_URL ?? '';
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

if (url !== expectedUrl) {
  fail('VITE_SUPABASE_URL must point exactly to the isolated savixara-test project.');
}

if (!key) {
  fail('VITE_SUPABASE_PUBLISHABLE_KEY is missing.');
}

if (key.startsWith('sb_publishable_')) {
  console.log('Supabase publishable key format accepted; value was not displayed.');
  process.exit(0);
}

const parts = key.split('.');
if (parts.length !== 3) {
  fail('Key is neither an sb_publishable_ key nor a valid three-part JWT.');
}

try {
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (payload.role !== 'anon') {
    fail('JWT role must be anon. Privileged keys are not allowed in frontend builds.');
  }
} catch (error) {
  if (error?.message?.includes('::error::')) throw error;
  fail('JWT payload could not be validated.');
}

console.log('Supabase anon JWT accepted; credential value was not displayed.');
