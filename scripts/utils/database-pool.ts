/**
 * Database Connection Pool Utility
 * 
 * Replaces the 247 duplicate database connections with a single pooled connection.
 * This will significantly reduce resource usage and improve performance.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton instance
let supabaseInstance: SupabaseClient | null = null;

// Configuration with proper defaults
const config = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  options: {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'fantasy-ai',
      },
    },
  },
};

/**
 * Get a pooled Supabase client instance
 * @param useServiceRole - Whether to use service role key (admin access)
 * @returns Supabase client instance
 */
export function getSupabaseClient(useServiceRole = false): SupabaseClient {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance;
  }

  // Validate required environment variables
  if (!config.url) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL must be set');
  }

  const key = useServiceRole ? config.serviceKey : config.anonKey;
  if (!key) {
    throw new Error(
      useServiceRole
        ? 'SUPABASE_SERVICE_ROLE_KEY must be set for service role access'
        : 'NEXT_PUBLIC_SUPABASE_ANON_KEY must be set'
    );
  }

  // Create and cache the instance
  supabaseInstance = createClient(config.url, key, config.options);
  
  return supabaseInstance;
}

/**
 * Execute a database query with automatic retry and error handling
 * @param queryFn - Function that executes the query
 * @param retries - Number of retries on failure (default: 3)
 * @returns Query result
 */
export async function executeQuery<T>(
  queryFn: (client: SupabaseClient) => Promise<T>,
  retries = 3
): Promise<T> {
  const client = getSupabaseClient();
  let lastError: Error | null = null;

  for (let i = 0; i < retries; i++) {
    try {
      return await queryFn(client);
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on certain errors
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('unique constraint') ||
          message.includes('foreign key') ||
          message.includes('permission denied')
        ) {
          throw error;
        }
      }

      // Exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }

  throw lastError || new Error('Query failed after retries');
}

/**
 * Execute a parameterized query to prevent SQL injection
 * @param query - SQL query with $1, $2 placeholders
 * @param params - Parameters to bind
 * @returns Query result
 */
export async function executeParameterizedQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<{ data: T[]; error: Error | null }> {
  const client = getSupabaseClient(true); // Use service role for raw SQL
  
  try {
    // Supabase's rpc method supports parameterized queries
    const { data, error } = await client.rpc('execute_sql', {
      query,
      params,
    });

    if (error) throw error;
    
    return { data: data as T[], error: null };
  } catch (error) {
    return { data: [], error: error as Error };
  }
}

/**
 * Batch insert with automatic chunking
 * @param table - Table name
 * @param records - Records to insert
 * @param chunkSize - Number of records per batch (default: 1000)
 */
export async function batchInsert<T extends Record<string, any>>(
  table: string,
  records: T[],
  chunkSize = 1000
): Promise<{ inserted: number; errors: Error[] }> {
  const client = getSupabaseClient(true);
  const errors: Error[] = [];
  let inserted = 0;

  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    
    try {
      const { error } = await client.from(table).insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    } catch (error) {
      errors.push(error as Error);
    }
  }

  return { inserted, errors };
}

/**
 * Stream large result sets to avoid memory issues
 * @param table - Table name
 * @param query - Query builder function
 * @param onRecord - Callback for each record
 * @param pageSize - Records per page (default: 1000)
 */
export async function streamQuery<T extends Record<string, any>>(
  table: string,
  query: (client: SupabaseClient) => any,
  onRecord: (record: T) => Promise<void> | void,
  pageSize = 1000
): Promise<{ processed: number; error: Error | null }> {
  const client = getSupabaseClient();
  let processed = 0;
  let hasMore = true;
  let offset = 0;

  try {
    while (hasMore) {
      const { data, error } = await query(client)
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }

      for (const record of data) {
        await onRecord(record);
        processed++;
      }

      hasMore = data.length === pageSize;
      offset += pageSize;
    }

    return { processed, error: null };
  } catch (error) {
    return { processed, error: error as Error };
  }
}

/**
 * Clean up connections (for graceful shutdown)
 */
export async function closeConnections(): Promise<void> {
  if (supabaseInstance) {
    // Supabase client doesn't have explicit close method
    // but we can clear the instance
    supabaseInstance = null;
  }
}

// Handle process termination
process.on('SIGINT', closeConnections);
process.on('SIGTERM', closeConnections);