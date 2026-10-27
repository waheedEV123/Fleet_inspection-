import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from './url';

// Uses the secret service role key. Only ever import this from server code.
export function createAdminClient() {
  return createClient(supabaseUrl(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
