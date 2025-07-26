const { Client } = require('pg');
require('dotenv').config();

async function addImageUrlColumn() {
  // Connect to the local Docker PostgreSQL database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_ultimate',
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
  });

  try {
    await client.connect();
    console.log('✅ Connected to local Docker PostgreSQL database');

    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' AND column_name = 'image_url'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ image_url column already exists');
      
      // Count existing data
      const countResult = await client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(image_url) as with_images,
          COUNT(*) - COUNT(image_url) as without_images
        FROM players 
        WHERE sport = 'NFL'
      `);
      
      const stats = countResult.rows[0];
      console.log(`📊 NFL Players: ${stats.total} total, ${stats.with_images} with images, ${stats.without_images} without images`);
      
      return;
    }

    console.log('📝 Adding image_url column to players table...');

    // Add the column
    await client.query('ALTER TABLE players ADD COLUMN image_url TEXT;');
    console.log('✅ Added image_url column');

    // Add comment
    await client.query(`COMMENT ON COLUMN players.image_url IS 'URL to player headshot or profile image';`);
    console.log('✅ Added column comment');

    // Create index
    await client.query(`CREATE INDEX idx_players_image_url ON players(image_url) WHERE image_url IS NOT NULL;`);
    console.log('✅ Created index on image_url');

    console.log('🎉 Migration completed successfully!');

    // Test the new column
    const testResult = await client.query(`
      SELECT id, name, position, sport, image_url
      FROM players 
      WHERE sport = 'NFL' 
      LIMIT 3
    `);
    
    console.log('📋 Sample players after migration:');
    testResult.rows.forEach(player => {
      console.log(`  - ${player.name} (${Array.isArray(player.position) ? player.position.join(', ') : player.position}) - Image: ${player.image_url || 'null'}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
  } finally {
    await client.end();
  }
}

addImageUrlColumn();