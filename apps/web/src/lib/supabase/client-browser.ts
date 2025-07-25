/**
 * Supabase client for browser environment
 * Currently using mock implementation - replace with actual Supabase when ready
 */

export interface SupabaseClient {
  from: (table: string) => any;
  auth: {
    getUser: () => Promise<{ data: { user: any } | null; error: any }>;
    signInWithPassword: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
  };
}

// Mock Supabase client for build compatibility
export const createBrowserSupabaseClient = (): SupabaseClient => {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
      insert: () => Promise.resolve({ data: null, error: null }),
      update: () => Promise.resolve({ data: null, error: null }),
      delete: () => Promise.resolve({ data: null, error: null }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
    },
  };
};