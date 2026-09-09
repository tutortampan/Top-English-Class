// TOP ENGLISH CLASS — Supabase Configuration & Client Init
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials.

export const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || 'https://xuiszvwfjccvucqpactf.supabase.co';
export const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

// Import Supabase JS from CDN (ES Module compatible)
let _supabase = null;
let _initPromise = null;

export async function getSupabase() {
  if (_supabase) return _supabase;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });
      return _supabase;
    } catch (err) {
      _initPromise = null; // Reset on failure so subsequent attempts can retry
      throw err;
    }
  })();

  return _initPromise;
}
