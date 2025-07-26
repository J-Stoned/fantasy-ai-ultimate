import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { logger } from '../apps/web/src/lib/logging/logger';

// Load environment variables
config();

async function runMigration() {
  try {
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    logger.info('Checking if image_url column exists...');
    
    // First check if the column already exists
    const { data: checkResult, error: checkError } = await supabase
      .from('players')
      .select('*')
      .limit(1);
    
    if (checkError) {
      logger.error('Error checking players table:', checkError);
      throw checkError;
    }
    
    const hasImageUrl = checkResult && checkResult[0] && 'image_url' in checkResult[0];
    
    if (hasImageUrl) {
      logger.info('image_url column already exists in players table');
      return;
    }
    
    logger.info('Adding image_url column to players table...');
    
    // Run the migration using raw SQL
    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS image_url TEXT;
        
        COMMENT ON COLUMN players.image_url IS 'URL to player headshot or profile image';
        
        CREATE INDEX IF NOT EXISTS idx_players_image_url 
        ON players(image_url) 
        WHERE image_url IS NOT NULL;
      `
    });
    
    if (migrationError) {
      // If RPC doesn't exist, try a different approach
      logger.warn('RPC method not available, trying alternative approach...');
      
      // We'll need to handle this differently - for now just log
      logger.info('Please run the following SQL manually:');
      logger.info(`
        ALTER TABLE players 
        ADD COLUMN IF NOT EXISTS image_url TEXT;
        
        COMMENT ON COLUMN players.image_url IS 'URL to player headshot or profile image';
        
        CREATE INDEX IF NOT EXISTS idx_players_image_url 
        ON players(image_url) 
        WHERE image_url IS NOT NULL;
      `);
    } else {
      logger.info('Migration completed successfully!');
    }
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();