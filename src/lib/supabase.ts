import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/** false quando o .env não foi preenchido: a tela de configuração aparece no lugar do app. */
export const hasSupabaseEnv = Boolean(url && key && !key.startsWith('cole-aqui'))

export const supabase = createClient(url || 'http://127.0.0.1:54321', key || 'sem-chave', {
  auth: { persistSession: true, autoRefreshToken: true },
})
