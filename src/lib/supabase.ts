import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const projectRef = (() => {
  try {
    return new URL(supabaseUrl).hostname.split('.')[0] || 'default';
  } catch {
    return 'default';
  }
})();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: `universal-translator-auth-${projectRef}`,
  },
});

export interface Translation {
  id: string;
  source_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  translation_type: 'text' | 'audio' | 'video' | 'camera';
  created_at: string;
}
