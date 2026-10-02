/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

export { mapSupabaseRowToVideoItem } from './videoData';

export const SUPABASE_URL = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Missing configuration is an explicit demo state, not a request to a fictitious project.
function initializeClient() {
  if (!SUPABASE_URL && !SUPABASE_ANON_KEY) return { client: null, error: '' };
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Incomplete configuration');
    return { client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY), error: '' };
  } catch {
    return { client: null, error: 'Supabase 設定無效；請檢查公開網址與公開金鑰' };
  }
}

const initialized = initializeClient();
export const supabase = initialized.client;
export const supabaseConfigError = initialized.error;
