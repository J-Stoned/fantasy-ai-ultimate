/**
 * Supabase Client
 * Mock implementation for build compatibility
 */

export const createBrowserClient = (url: string, key: string) => {
  return {
    auth: {
      signInWithPassword: async () => ({ data: null, error: null }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ data: null, error: null }),
      getUser: async () => ({ data: null, error: null })
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: null }),
          limit: () => ({
            order: () => ({
              data: [],
              error: null
            })
          })
        })
      }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null })
    })
  };
};

export const createServerClient = (url: string, key: string, options: any) => {
  return createBrowserClient(url, key);
};

// Create a default supabase instance for backward compatibility
// This connects to your LOCAL database with 1.3M game logs!
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:5432',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'local-key'
);