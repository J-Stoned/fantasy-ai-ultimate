// Configuration loader for all scripts
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const config = {
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  },
  postgres: {
    connectionString: process.env.POSTGRES_CONNECTION_STRING || ''
  },
  apis: {
    ballDontLie: process.env.BALLDONTLIE_API_KEY || '',
    github: process.env.GITHUB_API_KEY || ''
  },
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || ''
  }
};

// Validation
export function validateConfig() {
  const missing: string[] = [];
  
  if (!config.supabase.url) missing.push('SUPABASE_URL');
  if (!config.supabase.serviceKey) missing.push('SUPABASE_SERVICE_KEY');
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please create a .env file based on .env.example');
    process.exit(1);
  }
}