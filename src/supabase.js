import { createClient } from '@supabase/supabase-js';

// Audit branch is deliberately locked to the isolated savixara-test project.
// Never fall back to production or silently use an empty/misconfigured target.
const EXPECTED_TEST_SUPABASE_URL =
  'https://bumoiebziefburtmisnn.supabase.co';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (supabaseUrl !== EXPECTED_TEST_SUPABASE_URL) {
  throw new Error(
    'SAVIXARA audit build blocked: VITE_SUPABASE_URL must target the isolated savixara-test project.'
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    'SAVIXARA audit build blocked: VITE_SUPABASE_PUBLISHABLE_KEY is missing.'
  );
}

if (!supabasePublishableKey.startsWith('sb_publishable_')) {
  const parts = supabasePublishableKey.split('.');
  let payload;

  try {
    if (parts.length !== 3) throw new Error('Invalid JWT format');
    payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
  } catch {
    throw new Error(
      'SAVIXARA audit build blocked: Supabase key is not a publishable key or valid anon JWT.'
    );
  }

  if (payload.role !== 'anon') {
    throw new Error(
      'SAVIXARA audit build blocked: privileged Supabase keys are forbidden in the frontend.'
    );
  }
}

export const supabase = createClient(
  EXPECTED_TEST_SUPABASE_URL,
  supabasePublishableKey
);
