/**
 * 🔥 LOCAL DATABASE CONFIGURATION
 * Using Docker PostgreSQL with 1.3M game logs!
 */

export const databaseConfig = {
  // Local Docker PostgreSQL
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fantasy_ai',
  user: process.env.DB_USER || 'fantasy_user',
  password: process.env.DB_PASSWORD || 'fantasy_password',
  
  // Connection pool settings
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  
  // No SSL for local connection
  ssl: false,
  
  // Query timeouts
  query_timeout: 30000,
  statement_timeout: 30000,
};

// Direct connection string
export const getDatabaseUrl = () => {
  return process.env.DATABASE_URL || 
    `postgresql://${databaseConfig.user}:${databaseConfig.password}@${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}`;
};

console.log('🔥 Using LOCAL Docker database with 1.3M game logs!');