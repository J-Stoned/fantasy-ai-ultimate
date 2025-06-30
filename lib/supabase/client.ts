// This file is for server-side use only
// For client-side, use client-browser.ts
import { createClient } from '@supabase/supabase-js'
import { serverConfig } from '../config/server-config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Service role client for elevated permissions
export const getServiceSupabase = () => {
  const serviceRoleKey = serverConfig.database.supabaseServiceRole
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}