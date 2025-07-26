import { Pool } from 'pg';

async function analyzeColumnMismatch() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai',
    user: 'fantasy_user',
    password: 'fantasy_password'
  });

  try {
    console.log('🔍 ANALYZING API vs DATABASE COLUMN MISMATCH\n');
    
    // Get actual column names from players table
    const actualColumns = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns 
      WHERE table_name = 'players'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 ACTUAL DATABASE COLUMNS:');
    actualColumns.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });
    
    // Columns that the API is trying to access
    const apiExpectedColumns = [
      'id', 'name', 'first_name', 'last_name', 'position', 
      'team', 'current_team', 'image_url', 'sport'
    ];
    
    console.log('\n🔍 API EXPECTED COLUMNS vs REALITY:');
    const actualColumnNames = actualColumns.rows.map(col => col.column_name);
    
    apiExpectedColumns.forEach(expectedCol => {
      const exists = actualColumnNames.includes(expectedCol);
      console.log(`  ${exists ? '✅' : '❌'} ${expectedCol}`);
      
      if (!exists) {
        // Suggest possible matches
        const possibleMatches = actualColumnNames.filter(actual => 
          actual.toLowerCase().includes(expectedCol.toLowerCase()) ||
          expectedCol.toLowerCase().includes(actual.toLowerCase())
        );
        if (possibleMatches.length > 0) {
          console.log(`      🔧 Possible matches: ${possibleMatches.join(', ')}`);
        }
      }
    });
    
    console.log('\n🖼️  AVATAR/IMAGE COLUMN ANALYSIS:');
    const imageColumns = actualColumnNames.filter(col => 
      col.includes('photo') || col.includes('avatar') || col.includes('image')
    );
    
    imageColumns.forEach(col => {
      console.log(`  📸 ${col}`);
    });
    
    // Check what avatar data actually exists
    console.log('\n📊 AVATAR DATA AVAILABILITY:');
    const avatarCounts = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(photo_url) as has_photo_url,
        COUNT(avatar_2d_url) as has_2d_avatar,
        COUNT(avatar_3d_url) as has_3d_avatar,
        COUNT(avatar_photo_url) as has_avatar_photo
      FROM players 
      WHERE sport = 'NFL';
    `);
    
    const counts = avatarCounts.rows[0];
    console.log(`  Total NFL players: ${counts.total}`);
    console.log(`  With photo_url: ${counts.has_photo_url} (${((counts.has_photo_url/counts.total)*100).toFixed(1)}%)`);
    console.log(`  With avatar_2d_url: ${counts.has_2d_avatar} (${((counts.has_2d_avatar/counts.total)*100).toFixed(1)}%)`);
    console.log(`  With avatar_3d_url: ${counts.has_3d_avatar} (${((counts.has_3d_avatar/counts.total)*100).toFixed(1)}%)`);
    console.log(`  With avatar_photo_url: ${counts.has_avatar_photo} (${((counts.has_avatar_photo/counts.total)*100).toFixed(1)}%)`);
    
    // Sample players with actual avatar data
    console.log('\n👤 SAMPLE PLAYERS WITH AVATAR DATA:');
    const sampleWithAvatars = await pool.query(`
      SELECT 
        id, name, position, team,
        CASE 
          WHEN photo_url IS NOT NULL THEN 'photo_url'
          WHEN avatar_photo_url IS NOT NULL THEN 'avatar_photo_url'
          WHEN avatar_2d_url IS NOT NULL THEN 'avatar_2d_url'
          ELSE 'none'
        END as best_image_source,
        COALESCE(photo_url, avatar_photo_url, avatar_2d_url) as image_url
      FROM players 
      WHERE sport = 'NFL' 
      AND (photo_url IS NOT NULL OR avatar_photo_url IS NOT NULL OR avatar_2d_url IS NOT NULL)
      LIMIT 10;
    `);
    
    sampleWithAvatars.rows.forEach(player => {
      console.log(`  - ${player.name} (${player.position}): ${player.best_image_source}`);
      console.log(`    URL: ${player.image_url}`);
    });
    
    console.log('\n🔧 MAPPING RECOMMENDATIONS:');
    console.log('Based on analysis, the API should use these column mappings:');
    console.log('  - name ✅ (exists)');
    console.log('  - firstname → first_name (if exists)');  
    console.log('  - lastname → last_name (if exists)');
    console.log('  - position ✅ (exists)');
    console.log('  - team ✅ (exists)');
    console.log('  - current_team → team (fallback)');
    console.log('  - image_url → COALESCE(photo_url, avatar_photo_url, avatar_2d_url)');
    
  } catch (error) {
    console.error('❌ Column analysis failed:', error);
  } finally {
    await pool.end();
  }
}

analyzeColumnMismatch();