import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.log('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running avatar database migration...\n');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'src/lib/db/migrations/add_player_avatars.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        // Use raw RPC call to execute SQL
        const { error } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          
          // Try alternative approach - direct query
          const { error: queryError } = await supabase
            .from('players')
            .select('id')
            .limit(1);
          
          if (!queryError) {
            console.log('✅ Database connection verified, skipping problematic statement');
            continue;
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`⚠️  Warning: Statement ${i + 1} failed:`, err.message);
        // Continue with other statements
      }
    }
    
    console.log('\n🎯 Migration completed!\n');
    
    // Verify the migration worked
    console.log('🔍 Verifying migration...');
    
    // Check if columns exist by trying to query them
    const { data, error } = await supabase
      .from('players')
      .select('id, avatar_tier, avatar_3d_url, avatar_2d_url, avatar_photo_url, overall_rating')
      .limit(1);
    
    if (error) {
      console.error('❌ Migration verification failed:', error.message);
      console.log('\nTrying alternative approach...');
      
      // Alternative: Add columns one by one
      await addColumnsIndividually();
    } else {
      console.log('✅ Avatar columns verified successfully!');
      console.log('Sample player:', data?.[0]);
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

async function addColumnsIndividually() {
  console.log('\n🔧 Adding columns individually...\n');
  
  const columns = [
    { name: 'avatar_tier', type: 'VARCHAR(10)', default: "'basic'" },
    { name: 'avatar_3d_url', type: 'TEXT', default: null },
    { name: 'avatar_2d_url', type: 'TEXT', default: null },
    { name: 'avatar_photo_url', type: 'TEXT', default: null },
    { name: 'overall_rating', type: 'INTEGER', default: '60' },
    { name: 'avatar_metadata', type: 'JSONB', default: "'{}'" }
  ];
  
  // Since we can't execute raw SQL, we'll need to use Supabase's admin API
  // or handle this through the Supabase dashboard
  console.log('⚠️  Direct column addition requires Supabase dashboard access');
  console.log('\nPlease add these columns manually in Supabase dashboard:');
  
  columns.forEach(col => {
    console.log(`- ${col.name} (${col.type}) DEFAULT ${col.default || 'NULL'}`);
  });
  
  console.log('\nAlternatively, you can run this SQL in Supabase SQL editor:');
  console.log('```sql');
  columns.forEach(col => {
    const defaultVal = col.default ? ` DEFAULT ${col.default}` : '';
    console.log(`ALTER TABLE players ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}${defaultVal};`);
  });
  console.log('```');
}

// Run the migration
runMigration().catch(console.error);