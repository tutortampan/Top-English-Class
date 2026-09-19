// TOPS CORE — Supabase Configuration & Client Init
// Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project credentials.

export const SUPABASE_URL = window.__ENV__?.SUPABASE_URL || 'https://xuiszvwfjccvucqpactf.supabase.co';
export const SUPABASE_ANON_KEY = window.__ENV__?.SUPABASE_ANON_KEY || 'sb_publishable_dvMkwNJpPlryF0KNiaJRfQ_-fR1WW_4';

// Import Supabase JS from CDN (ES Module compatible)
let _supabase = null;
let _initPromise = null;

export async function getSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  if (_supabase) return _supabase;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      if (!window.supabaseClient) {
        window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false
          }
        });
      }
      _supabase = window.supabaseClient;
      return _supabase;
    } catch (err) {
      _initPromise = null; // Reset on failure so subsequent attempts can retry
      throw err;
    }
  })();

  return _initPromise;
}

// Add callEdgeFunction to easily invoke Edge Functions
export async function callEdgeFunction(functionName, payload) {
  const sb = await getSupabase();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const { data, error } = await sb.functions.invoke(functionName, {
      body: payload,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (error) {
      throw new Error(error.message || `Edge function ${functionName} failed`);
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error("AI Evaluation timed out. Your answer is saved, please refresh and try submitting again.");
    }
    throw err;
  }
}
