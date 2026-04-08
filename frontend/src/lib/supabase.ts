import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'

// Browser client via @supabase/ssr — stores session in cookies so proxy.ts
// (server-side middleware) can read and verify auth state server-side.
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
