/**
 * Supabase client for server environment
 * Currently using mock implementation - replace with actual Supabase when ready
 */

import { cookies } from 'next/headers';

export interface SupabaseClient {
  from: (table: string) => any;
  auth: {
    getUser: () => Promise<{ data: { user: any } | null; error: any }>;
    signInWithPassword: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
    getSession: () => Promise<{ data: { session: any } | null; error: any }>;
  };
}

// Mock Supabase client for build compatibility
export const createClient = async (): Promise<SupabaseClient> => {
  // In a real implementation, this would use cookies to get the session
  const cookieStore = await cookies();
  
  return {
    from: (table: string) => ({
      select: (fields?: string) => ({
        eq: (field: string, value: any) => ({
          single: () => Promise.resolve({ data: null, error: null }),
          then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
        }),
        then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
      }),
      insert: (data: any) => Promise.resolve({ data: null, error: null }),
      update: (data: any) => ({
        eq: (field: string, value: any) => Promise.resolve({ data: null, error: null }),
      }),
      delete: () => ({
        eq: (field: string, value: any) => Promise.resolve({ data: null, error: null }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
  };
};

// For server actions that don't need async cookies
export const createServerClient = (): SupabaseClient => {
  return {
    from: (table: string) => ({
      select: (fields?: string) => ({
        eq: (field: string, value: any) => ({
          single: () => Promise.resolve({ data: null, error: null }),
          then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
        }),
        then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
      }),
      insert: (data: any) => Promise.resolve({ data: null, error: null }),
      update: (data: any) => ({
        eq: (field: string, value: any) => Promise.resolve({ data: null, error: null }),
      }),
      delete: () => ({
        eq: (field: string, value: any) => Promise.resolve({ data: null, error: null }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
  };
};