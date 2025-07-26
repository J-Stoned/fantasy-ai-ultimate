import { readFileSync } from 'fs';
import { join } from 'path';

async function showIndexes() {
  console.log('🔥 Performance Indexes for Fantasy AI Database 🔥\n');
  
  try {
    // Read the SQL file
    const sqlPath = join(__dirname, 'add-performance-indexes.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    console.log('📋 Copy and paste this SQL into your Supabase SQL editor:');
    console.log('=' .repeat(60));
    console.log(sql);
    console.log('=' .repeat(60));
    
    console.log('\n📌 Instructions:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Create a new query');
    console.log('4. Paste the SQL above');
    console.log('5. Click "Run" to apply all indexes');
    console.log('\n✨ These indexes will significantly improve:');
    console.log('   - Pattern detection query performance');
    console.log('   - ML prediction lookups');
    console.log('   - Fantasy betting insights queries');
    console.log('   - Real-time game updates');
    
  } catch (error) {
    console.error('Error reading SQL file:', error);
  }
}

showIndexes();