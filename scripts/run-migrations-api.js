const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function runMigrationsViaAPI() {
  console.log('🚀 Running migrations via Supabase API...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Read migration files
  const migrationFiles = [
    '001_initial_schema.sql',
    '002_additional_data_tables.sql', 
    '003_performance_indexes.sql'
  ];

  for (const file of migrationFiles) {
    console.log(`\n📄 Running migration: ${file}`);
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', file);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ query: sql })
      });

      if (!response.ok) {
        // Try alternative approach - direct SQL endpoint
        const altResponse = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Accept-Profile': 'public',
            'Content-Profile': 'public'
          },
          body: JSON.stringify({ 
            query: sql,
            mode: 'execute'
          })
        });
        
        if (!altResponse.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`);
        }
      }
      
      console.log(`✅ Migration ${file} completed`);
    } catch (error) {
      console.error(`❌ Error in migration ${file}:`, error.message);
      
      // Log the problematic SQL for manual execution
      console.log('\n⚠️  You may need to run this migration manually in Supabase SQL Editor:');
      console.log(`File: ${file}`);
      console.log('First 500 chars of SQL:', sql.substring(0, 500) + '...');
    }
  }
  
  console.log('\n📝 Migration Summary:');
  console.log('- If any migrations failed, copy them from supabase/migrations/');
  console.log('- Paste into Supabase SQL Editor at:');
  console.log(`  ${supabaseUrl.replace('https://', 'https://app.supabase.com/project/').replace('.supabase.co', '')}/editor`);
}

runMigrationsViaAPI().catch(console.error);