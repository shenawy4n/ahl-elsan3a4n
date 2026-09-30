// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseAdminClient() {
  let SUPABASE_URL = (process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'] || '').replace(/^["']|["']$/g, '');
  let SUPABASE_SERVICE_ROLE_KEY = (process.env['SUPABASE_SERVICE_ROLE_KEY'] || '').replace(/^["']|["']$/g, '');

  // If SUPABASE_SERVICE_ROLE_KEY is a Supabase JWT (starts with eyJ), ensure we connect directly to supabase.co
  if (SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ')) {
    if (SUPABASE_URL.includes('lovable.cloud')) {
      SUPABASE_URL = 'https://ahuelbhmosyrozlaxbgb.supabase.co';
    }
  } else if (!SUPABASE_SERVICE_ROLE_KEY) {
    SUPABASE_SERVICE_ROLE_KEY = (process.env['SUPABASE_PUBLISHABLE_KEY'] || process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] || '').replace(/^["']|["']$/g, '');
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ['SUPABASE_SERVICE_ROLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role - bypasses RLS
// SECURITY: Only use this for trusted server-side operations, never expose to client code
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) {
      _supabaseAdmin = createSupabaseAdminClient();
    }
    const target = _supabaseAdmin as any;
    const value = target[prop];
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return Reflect.get(target, prop, receiver);
  },
});
