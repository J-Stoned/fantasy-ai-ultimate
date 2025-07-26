/**
 * PostgreSQL Database Adapter (Supabase-compatible API)
 * Enterprise-grade adapter connecting to fantasy AI PostgreSQL database
 */

import { cookies } from 'next/headers';
import { Pool } from 'pg';
import { logger } from '../logging/logger';

// Enterprise-grade connection pool with environment-based configuration
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Production-ready configuration
    const config = {
      // Use connection string if available (production), fallback to individual params (development)
      connectionString: process.env.DATABASE_URL,
      
      // Fallback configuration for development
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fantasy_ai',
      user: process.env.DB_USER || 'fantasy_user',
      password: process.env.DB_PASSWORD || 'fantasy_password',
      
      // Production-optimized connection pool settings
      max: isProduction ? 5 : 20, // Smaller pool for serverless
      min: isProduction ? 0 : 2,  // No minimum connections in serverless
      idleTimeoutMillis: isProduction ? 10000 : 30000, // Faster cleanup in serverless
      connectionTimeoutMillis: isProduction ? 10000 : 5000,
      
      // SSL configuration for production
      ssl: isProduction ? {
        rejectUnauthorized: false, // Allow self-signed certificates
        sslmode: 'require'
      } : undefined,
      
      // Query timeout for serverless
      query_timeout: isProduction ? 15000 : 30000,
      statement_timeout: isProduction ? 15000 : 30000,
      
      // Connection keep-alive for production
      keepAlive: isProduction,
      keepAliveInitialDelayMillis: isProduction ? 10000 : 0,
    };
    
    // Remove undefined values
    Object.keys(config).forEach(key => {
      if (config[key as keyof typeof config] === undefined) {
        delete config[key as keyof typeof config];
      }
    });
    
    pool = new Pool(config);
    
    // Enhanced error handling for production
    pool.on('error', (err) => {
      logger.error('PostgreSQL pool error:', { 
        error: err,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
      });
      
      // In production, attempt to recreate the pool
      if (isProduction) {
        pool = null;
        logger.info('Pool reset due to error, will recreate on next request');
      }
    });
    
    pool.on('connect', (client) => {
      logger.debug('New database connection established', {
        totalCount: pool?.totalCount,
        idleCount: pool?.idleCount,
        environment: process.env.NODE_ENV
      });
    });
    
    // Production health monitoring
    if (isProduction) {
      setInterval(async () => {
        try {
          const client = await pool?.connect();
          await client?.query('SELECT 1');
          client?.release();
        } catch (error) {
          logger.error('Database health check failed:', error);
        }
      }, 60000); // Check every minute
    }
  }
  
  return pool;
}

export interface SupabaseClient {
  from: (table: string) => any;
  auth: {
    getUser: () => Promise<{ data: { user: any } | null; error: any }>;
    signInWithPassword: (credentials: any) => Promise<any>;
    signOut: () => Promise<any>;
    getSession: () => Promise<{ data: { session: any } | null; error: any }>;
  };
}

interface QueryBuilder {
  select: (fields?: string) => QueryBuilder;
  eq: (field: string, value: any) => QueryBuilder;
  in: (field: string, values: any[]) => QueryBuilder;
  gte: (field: string, value: any) => QueryBuilder;
  order: (field: string, options?: { ascending?: boolean; nullsFirst?: boolean }) => QueryBuilder;
  limit: (count: number) => QueryBuilder;
  single: () => Promise<{ data: any; error: any }>;
  then: (callback: (result: { data: any[]; error: any }) => any) => Promise<any>;
}

// PostgreSQL to API field mapping
const fieldMappings: Record<string, Record<string, string>> = {
  players: {
    'name': 'COALESCE(name, CONCAT(firstname, \' \', lastname))',
    'first_name': 'firstname',
    'last_name': 'lastname', 
    'current_team': 'team',
    'image_url': 'COALESCE(photo_url, avatar_photo_url, avatar_2d_url)',
    'sport': 'CASE WHEN sport_id = \'1\' THEN \'NFL\' WHEN sport_id = \'2\' THEN \'NBA\' WHEN sport_id = \'3\' THEN \'MLB\' WHEN sport_id = \'4\' THEN \'NHL\' ELSE sport_id END'
  }
};

function mapFields(table: string, fields: string): string {
  if (!fields || fields === '*') {
    // Return common mapped fields for the table
    if (table === 'players') {
      return `
        id,
        COALESCE(name, CONCAT(firstname, ' ', lastname)) as name,
        firstname as first_name,
        lastname as last_name,
        position,
        team,
        team as current_team,
        COALESCE(photo_url, avatar_photo_url, avatar_2d_url) as image_url,
        CASE WHEN sport_id = '1' THEN 'NFL' WHEN sport_id = '2' THEN 'NBA' WHEN sport_id = '3' THEN 'MLB' WHEN sport_id = '4' THEN 'NHL' ELSE sport_id END as sport,
        avatar_tier,
        avatar_2d_url,
        avatar_3d_url,
        overall_rating
      `;
    }
    return '*';
  }
  
  const mapping = fieldMappings[table];
  if (!mapping) return fields;
  
  // Apply field mappings
  let mappedFields = fields;
  Object.entries(mapping).forEach(([apiField, dbField]) => {
    mappedFields = mappedFields.replace(new RegExp(`\\b${apiField}\\b`, 'g'), `${dbField} as ${apiField}`);
  });
  
  return mappedFields;
}

class PostgreSQLQueryBuilder implements QueryBuilder {
  private tableName: string;
  private selectFields: string = '*';
  private whereConditions: string[] = [];
  private orderBy: string = '';
  private limitCount: number | null = null;
  private params: any[] = [];
  private paramCounter: number = 1;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields?: string): QueryBuilder {
    this.selectFields = mapFields(this.tableName, fields || '*');
    return this;
  }

  eq(field: string, value: any): QueryBuilder {
    this.whereConditions.push(`${field} = $${this.paramCounter}`);
    this.params.push(value);
    this.paramCounter++;
    return this;
  }

  in(field: string, values: any[]): QueryBuilder {
    const placeholders = values.map(() => `$${this.paramCounter++}`).join(', ');
    this.whereConditions.push(`${field} = ANY(ARRAY[${placeholders}])`);
    this.params.push(...values);
    return this;
  }

  gte(field: string, value: any): QueryBuilder {
    this.whereConditions.push(`${field} >= $${this.paramCounter}`);
    this.params.push(value);
    this.paramCounter++;
    return this;
  }

  order(field: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryBuilder {
    const direction = options?.ascending === false ? 'DESC' : 'ASC';
    const nulls = options?.nullsFirst === false ? 'NULLS LAST' : 'NULLS FIRST';
    this.orderBy = `ORDER BY ${field} ${direction} ${nulls}`;
    return this;
  }

  limit(count: number): QueryBuilder {
    this.limitCount = count;
    return this;
  }

  private buildQuery(): string {
    let query = `SELECT ${this.selectFields} FROM ${this.tableName}`;
    
    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(' AND ')}`;
    }
    
    if (this.orderBy) {
      query += ` ${this.orderBy}`;
    }
    
    if (this.limitCount) {
      query += ` LIMIT ${this.limitCount}`;
    }
    
    return query;
  }

  async single(): Promise<{ data: any; error: any }> {
    try {
      const query = this.buildQuery() + ' LIMIT 1';
      const result = await getPool().query(query, this.params);
      return { data: result.rows[0] || null, error: null };
    } catch (error) {
      logger.error('Database query failed:', { error, query: this.buildQuery() });
      return { data: null, error };
    }
  }

  async then(callback: (result: { data: any[]; error: any }) => any): Promise<any> {
    try {
      const query = this.buildQuery();
      const result = await getPool().query(query, this.params);
      return callback({ data: result.rows, error: null });
    } catch (error) {
      logger.error('Database query failed:', { error, query: this.buildQuery() });
      return callback({ data: [], error });
    }
  }
}

// PostgreSQL Database Client
export const createClient = async (): Promise<SupabaseClient> => {
  // Access cookies for potential session handling
  const cookieStore = await cookies();
  
  return {
    from: (table: string) => ({
      select: (fields?: string) => new PostgreSQLQueryBuilder(table).select(fields),
      insert: async (data: any) => {
        try {
          const fields = Object.keys(data).join(', ');
          const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
          const values = Object.values(data);
          
          const query = `INSERT INTO ${table} (${fields}) VALUES (${placeholders}) RETURNING *`;
          const result = await getPool().query(query, values);
          return { data: result.rows[0], error: null };
        } catch (error) {
          logger.error('Insert failed:', error);
          return { data: null, error };
        }
      },
      update: (data: any) => ({
        eq: async (field: string, value: any) => {
          try {
            const updates = Object.keys(data).map((key, i) => `${key} = $${i + 1}`).join(', ');
            const values = [...Object.values(data), value];
            
            const query = `UPDATE ${table} SET ${updates} WHERE ${field} = $${values.length} RETURNING *`;
            const result = await getPool().query(query, values);
            return { data: result.rows, error: null };
          } catch (error) {
            logger.error('Update failed:', error);
            return { data: null, error };
          }
        }
      }),
      delete: () => ({
        eq: async (field: string, value: any) => {
          try {
            const query = `DELETE FROM ${table} WHERE ${field} = $1 RETURNING *`;
            const result = await getPool().query(query, [value]);
            return { data: result.rows, error: null };
          } catch (error) {
            logger.error('Delete failed:', error);
            return { data: null, error };
          }
        }
      })
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
      select: (fields?: string) => new PostgreSQLQueryBuilder(table).select(fields),
      insert: async (data: any) => {
        try {
          const fields = Object.keys(data).join(', ');
          const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
          const values = Object.values(data);
          
          const query = `INSERT INTO ${table} (${fields}) VALUES (${placeholders}) RETURNING *`;
          const result = await getPool().query(query, values);
          return { data: result.rows[0], error: null };
        } catch (error) {
          logger.error('Insert failed:', error);
          return { data: null, error };
        }
      },
      update: (data: any) => ({
        eq: async (field: string, value: any) => {
          try {
            const updates = Object.keys(data).map((key, i) => `${key} = $${i + 1}`).join(', ');
            const values = [...Object.values(data), value];
            
            const query = `UPDATE ${table} SET ${updates} WHERE ${field} = $${values.length} RETURNING *`;
            const result = await getPool().query(query, values);
            return { data: result.rows, error: null };
          } catch (error) {
            logger.error('Update failed:', error);
            return { data: null, error };
          }
        }
      }),
      delete: () => ({
        eq: async (field: string, value: any) => {
          try {
            const query = `DELETE FROM ${table} WHERE ${field} = $1 RETURNING *`;
            const result = await getPool().query(query, [value]);
            return { data: result.rows, error: null };
          } catch (error) {
            logger.error('Delete failed:', error);
            return { data: null, error };
          }
        }
      })
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
  };
};