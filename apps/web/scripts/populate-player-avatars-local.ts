import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

// Initialize PostgreSQL connection using the same config as the web app
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fantasy_ai',
  user: process.env.DB_USER || 'fantasy_user',
  password: process.env.DB_PASSWORD || 'fantasy_password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log('🔌 Connecting to database:', {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || '5432',
  database: process.env.DB_NAME || 'fantasy_ai_local',
  user: process.env.DB_USER || 'postgres'
});

// Avatar tier thresholds
const TIER_THRESHOLDS = {
  star: 90,      // Top 500 players (90+ rating)
  starter: 75,   // Next 5,000 players (75-89 rating)
  bench: 0       // Everyone else (0-74 rating)
};

// Default avatar URLs by position and tier
const DEFAULT_AVATARS = {
  star: {
    QB: '/avatars/3d/default-qb-star.glb',
    RB: '/avatars/3d/default-rb-star.glb',
    WR: '/avatars/3d/default-wr-star.glb',
    TE: '/avatars/3d/default-te-star.glb',
    K: '/avatars/3d/default-k-star.glb',
    DEF: '/avatars/3d/default-def-star.glb',
  },
  starter: {
    QB: '/avatars/2d/default-qb-starter.png',
    RB: '/avatars/2d/default-rb-starter.png',
    WR: '/avatars/2d/default-wr-starter.png',
    TE: '/avatars/2d/default-te-starter.png',
    K: '/avatars/2d/default-k-starter.png',
    DEF: '/avatars/2d/default-def-starter.png',
  },
  bench: {
    DEFAULT: '/avatars/photos/default-player.jpg'
  }
};

// Generate avatar URLs based on player data
function generateAvatarUrls(player: any) {
  const position = player.position || 'DEFAULT';
  const rating = player.overall_rating || 60;
  
  // Determine tier
  let tier: 'star' | 'starter' | 'bench' = 'bench';
  if (rating >= TIER_THRESHOLDS.star) {
    tier = 'star';
  } else if (rating >= TIER_THRESHOLDS.starter) {
    tier = 'starter';
  }
  
  // Generate URLs using correct column names
  const baseId = `${player.lastname?.toLowerCase() || 'player'}-${player.jersey_number || player.id}`;
  
  return {
    tier,
    avatar_3d_url: tier === 'star' ? `/avatars/3d/${baseId}.glb` : DEFAULT_AVATARS.star[position] || null,
    avatar_2d_url: tier !== 'bench' ? `/avatars/2d/${baseId}.png` : DEFAULT_AVATARS.starter[position] || null,
    avatar_photo_url: `/avatars/photos/${baseId}.jpg`,
    avatar_metadata: {
      jersey_number: player.jersey_number,
      team_colors: player.team_colors || [],
      position: position,
      generated_at: new Date().toISOString()
    }
  };
}

// Run the migration first
async function runMigration() {
  console.log('🔧 Running database migration...\n');
  
  try {
    // First, let's check if columns already exist
    const checkColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'players' 
      AND column_name IN ('avatar_tier', 'avatar_3d_url', 'avatar_2d_url', 'avatar_photo_url', 'overall_rating', 'avatar_metadata')
    `);
    
    const existingColumns = checkColumns.rows.map(row => row.column_name);
    
    // Add missing columns one by one
    const columnsToAdd = [
      { name: 'avatar_tier', sql: "ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_tier VARCHAR(10) DEFAULT 'bench' CHECK (avatar_tier IN ('star', 'starter', 'bench'))" },
      { name: 'avatar_3d_url', sql: "ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_3d_url TEXT" },
      { name: 'avatar_2d_url', sql: "ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_2d_url TEXT" },
      { name: 'avatar_photo_url', sql: "ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_photo_url TEXT" },
      { name: 'overall_rating', sql: "ALTER TABLE players ADD COLUMN IF NOT EXISTS overall_rating INTEGER DEFAULT 60 CHECK (overall_rating >= 0 AND overall_rating <= 99)" },
      { name: 'avatar_metadata', sql: "ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_metadata JSONB DEFAULT '{}'" }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        try {
          await pool.query(column.sql);
          console.log(`✅ Added column: ${column.name}`);
        } catch (err) {
          console.error(`❌ Failed to add column ${column.name}:`, err.message);
        }
      } else {
        console.log(`ℹ️  Column ${column.name} already exists`);
      }
    }
    
    // Create indexes
    try {
      await pool.query("CREATE INDEX IF NOT EXISTS idx_players_avatar_tier ON players(avatar_tier)");
      await pool.query("CREATE INDEX IF NOT EXISTS idx_players_overall_rating ON players(overall_rating)");
      console.log('✅ Indexes created');
    } catch (err) {
      console.log('ℹ️  Indexes may already exist');
    }
    
    console.log('\n✅ Migration completed!\n');
  } catch (error) {
    console.error('❌ Migration error:', error.message);
    throw error;
  }
}

// Batch update players with avatar data
async function updatePlayerAvatars(batchSize = 100) {
  console.log('🎯 Starting player avatar population...');
  
  let offset = 0;
  let totalUpdated = 0;
  let hasMore = true;
  
  while (hasMore) {
    // Fetch batch of players with correct column names
    const result = await pool.query(`
      SELECT id, firstname, lastname, position, jersey_number, overall_rating
      FROM players
      ORDER BY overall_rating DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `, [batchSize, offset]);
    
    const players = result.rows;
    
    if (!players || players.length === 0) {
      hasMore = false;
      break;
    }
    
    // Update each player
    for (const player of players) {
      const avatarData = generateAvatarUrls(player);
      
      try {
        await pool.query(`
          UPDATE players 
          SET 
            avatar_tier = $1,
            avatar_3d_url = $2,
            avatar_2d_url = $3,
            avatar_photo_url = $4,
            avatar_metadata = $5
          WHERE id = $6
        `, [
          avatarData.tier,
          avatarData.avatar_3d_url,
          avatarData.avatar_2d_url,
          avatarData.avatar_photo_url,
          JSON.stringify(avatarData.avatar_metadata),
          player.id
        ]);
        
        totalUpdated++;
      } catch (error) {
        console.error(`Error updating player ${player.id}:`, error.message);
      }
    }
    
    console.log(`✅ Updated ${totalUpdated} players...`);
    offset += batchSize;
  }
  
  console.log(`\n🎉 Avatar population complete! Updated ${totalUpdated} players.`);
  
  // Show tier distribution
  const tierResult = await pool.query(`
    SELECT 
      avatar_tier,
      COUNT(*) as count
    FROM players
    WHERE avatar_tier IS NOT NULL
    GROUP BY avatar_tier
    ORDER BY 
      CASE avatar_tier
        WHEN 'star' THEN 1
        WHEN 'starter' THEN 2
        WHEN 'bench' THEN 3
      END
  `);
  
  console.log('\n📊 Avatar Tier Distribution:');
  tierResult.rows.forEach(row => {
    console.log(`${row.avatar_tier}: ${row.count} players`);
  });
}

// Create placeholder avatar files
async function createPlaceholderAvatars() {
  console.log('📁 Creating placeholder avatar directories...');
  
  const avatarDirs = [
    'public/avatars/3d',
    'public/avatars/2d',
    'public/avatars/photos',
    'public/avatars/textures'
  ];
  
  for (const dir of avatarDirs) {
    await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
  }
  
  console.log('✅ Avatar directories created\n');
}

// Populate specific star players with custom data
async function populateStarPlayers() {
  const starPlayers = [
    { firstname: 'Patrick', lastname: 'Mahomes', rating: 98, team: 'KC', number: '15', position: 'QB' },
    { firstname: 'Christian', lastname: 'McCaffrey', rating: 97, team: 'SF', number: '23', position: 'RB' },
    { firstname: 'Justin', lastname: 'Jefferson', rating: 96, team: 'MIN', number: '18', position: 'WR' },
    { firstname: 'Travis', lastname: 'Kelce', rating: 95, team: 'KC', number: '87', position: 'TE' },
    { firstname: 'Tyreek', lastname: 'Hill', rating: 94, team: 'MIA', number: '10', position: 'WR' },
    { firstname: 'Josh', lastname: 'Allen', rating: 94, team: 'BUF', number: '17', position: 'QB' },
    { firstname: 'Jalen', lastname: 'Hurts', rating: 93, team: 'PHI', number: '1', position: 'QB' },
    { firstname: 'A.J.', lastname: 'Brown', rating: 93, team: 'PHI', number: '11', position: 'WR' },
    { firstname: 'Stefon', lastname: 'Diggs', rating: 92, team: 'BUF', number: '14', position: 'WR' },
    { firstname: 'CeeDee', lastname: 'Lamb', rating: 92, team: 'DAL', number: '88', position: 'WR' },
  ];
  
  console.log('⭐ Updating star players with premium avatars...');
  
  for (const starPlayer of starPlayers) {
    try {
      await pool.query(`
        UPDATE players 
        SET 
          overall_rating = $1,
          jersey_number = $2,
          avatar_metadata = $3
        WHERE 
          firstname = $4 
          AND lastname = $5
          AND position = $6
      `, [
        starPlayer.rating,
        starPlayer.number,
        JSON.stringify({
          jersey_number: starPlayer.number,
          team_abbr: starPlayer.team,
          is_premium: true,
          last_updated: new Date().toISOString()
        }),
        starPlayer.firstname,
        starPlayer.lastname,
        starPlayer.position
      ]);
      
      console.log(`✅ Updated ${starPlayer.firstname} ${starPlayer.lastname}`);
    } catch (error) {
      console.error(`Error updating ${starPlayer.firstname} ${starPlayer.lastname}:`, error.message);
    }
  }
  
  console.log('');
}

// Main execution
async function main() {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    console.log('✅ Connected to local PostgreSQL database\n');
    
    // Run migration
    await runMigration();
    
    // Create placeholder directories
    await createPlaceholderAvatars();
    
    // Update star players first
    await populateStarPlayers();
    
    // Then update all players
    await updatePlayerAvatars();
    
    console.log('\n✨ Avatar population complete!');
    console.log('\nNext steps:');
    console.log('1. Upload actual 3D models (.glb files) for star players');
    console.log('2. Generate or upload 2D sprites for starter players');
    console.log('3. Collect player photos for all players');
    console.log('4. Run: npm run avatars:fetch-photos to get real photos');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
main();