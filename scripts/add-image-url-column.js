const { Client } = require('pg');
require('dotenv').config();

async function addImageUrlColumn() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:your_password@localhost:5432/fantasy_ai_local'
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Check if column exists
    const checkColumn = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' AND column_name = 'image_url'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('image_url column already exists');
      return;
    }

    // Add the column
    await client.query('ALTER TABLE players ADD COLUMN image_url TEXT;');
    console.log('Added image_url column');

    // Add comment
    await client.query(`COMMENT ON COLUMN players.image_url IS 'URL to player headshot or profile image';`);
    console.log('Added column comment');

    // Create index
    await client.query(`CREATE INDEX idx_players_image_url ON players(image_url) WHERE image_url IS NOT NULL;`);
    console.log('Created index on image_url');

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}

addImageUrlColumn();