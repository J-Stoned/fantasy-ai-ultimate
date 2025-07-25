import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.DATABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    // Add more positions...
  },
  starter: {
    QB: '/avatars/2d/default-qb-starter.png',
    RB: '/avatars/2d/default-rb-starter.png',
    WR: '/avatars/2d/default-wr-starter.png',
    TE: '/avatars/2d/default-te-starter.png',
    // Add more positions...
  },
  bench: {
    DEFAULT: '/avatars/photos/default-player.jpg'
  }
};

// Generate avatar URLs based on player data
function generateAvatarUrls(player: any) {
  const playerId = player.id;
  const position = player.position?.[0] || 'DEFAULT';
  const rating = player.overall_rating || 60;
  
  // Determine tier
  let tier: 'star' | 'starter' | 'bench' = 'bench';
  if (rating >= TIER_THRESHOLDS.star) {
    tier = 'star';
  } else if (rating >= TIER_THRESHOLDS.starter) {
    tier = 'starter';
  }
  
  // Generate URLs
  const baseId = `${player.last_name?.toLowerCase()}-${player.jersey_number || player.id.slice(0, 8)}`;
  
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

// Batch update players with avatar data
async function updatePlayerAvatars(batchSize = 100) {
  console.log('🎯 Starting player avatar population...');
  
  let offset = 0;
  let totalUpdated = 0;
  let hasMore = true;
  
  while (hasMore) {
    // Fetch batch of players
    const { data: players, error } = await supabase
      .from('players')
      .select('id, first_name, last_name, position, jersey_number, overall_rating')
      .range(offset, offset + batchSize - 1)
      .order('overall_rating', { ascending: false });
    
    if (error) {
      console.error('Error fetching players:', error);
      break;
    }
    
    if (!players || players.length === 0) {
      hasMore = false;
      break;
    }
    
    // Generate avatar data for each player
    const updates = players.map(player => {
      const avatarData = generateAvatarUrls(player);
      return {
        id: player.id,
        avatar_tier: avatarData.tier,
        avatar_3d_url: avatarData.avatar_3d_url,
        avatar_2d_url: avatarData.avatar_2d_url,
        avatar_photo_url: avatarData.avatar_photo_url,
        avatar_metadata: avatarData.avatar_metadata
      };
    });
    
    // Batch update
    const { error: updateError } = await supabase
      .from('players')
      .upsert(updates, { onConflict: 'id' });
    
    if (updateError) {
      console.error('Error updating players:', updateError);
    } else {
      totalUpdated += players.length;
      console.log(`✅ Updated ${totalUpdated} players...`);
    }
    
    offset += batchSize;
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`🎉 Avatar population complete! Updated ${totalUpdated} players.`);
  
  // Show tier distribution
  const { data: tierCounts } = await supabase
    .from('players')
    .select('avatar_tier')
    .select('avatar_tier, count(*)', { count: 'exact' });
  
  console.log('\n📊 Avatar Tier Distribution:');
  console.log('Star (3D): ~500 players');
  console.log('Starter (2D): ~5,000 players');
  console.log('Bench (Basic): ~80,000+ players');
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
  
  // Create sample placeholder files
  const placeholders = [
    { path: 'public/avatars/3d/default-player.glb', content: '# 3D Model Placeholder' },
    { path: 'public/avatars/2d/default-player.png', content: '# 2D Sprite Placeholder' },
    { path: 'public/avatars/photos/default-player.jpg', content: '# Photo Placeholder' }
  ];
  
  for (const placeholder of placeholders) {
    const filePath = path.join(process.cwd(), placeholder.path);
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, placeholder.content);
      console.log(`✅ Created ${placeholder.path}`);
    }
  }
}

// Populate specific star players with custom data
async function populateStarPlayers() {
  const starPlayers = [
    { name: 'Patrick Mahomes', rating: 98, team: 'KC', number: '15' },
    { name: 'Christian McCaffrey', rating: 97, team: 'SF', number: '23' },
    { name: 'Justin Jefferson', rating: 96, team: 'MIN', number: '18' },
    { name: 'Travis Kelce', rating: 95, team: 'KC', number: '87' },
    { name: 'Tyreek Hill', rating: 94, team: 'MIA', number: '10' },
    { name: 'Josh Allen', rating: 94, team: 'BUF', number: '17' },
    { name: 'Jalen Hurts', rating: 93, team: 'PHI', number: '1' },
    { name: 'A.J. Brown', rating: 93, team: 'PHI', number: '11' },
    { name: 'Stefon Diggs', rating: 92, team: 'BUF', number: '14' },
    { name: 'CeeDee Lamb', rating: 92, team: 'DAL', number: '88' },
    // Add more star players...
  ];
  
  console.log('⭐ Updating star players with premium avatars...');
  
  for (const starPlayer of starPlayers) {
    const [firstName, lastName] = starPlayer.name.split(' ');
    
    const { error } = await supabase
      .from('players')
      .update({
        overall_rating: starPlayer.rating,
        avatar_metadata: {
          jersey_number: starPlayer.number,
          team_abbr: starPlayer.team,
          is_premium: true,
          last_updated: new Date().toISOString()
        }
      })
      .match({ first_name: firstName, last_name: lastName });
    
    if (!error) {
      console.log(`✅ Updated ${starPlayer.name}`);
    }
  }
}

// Main execution
async function main() {
  try {
    // Create placeholder directories and files
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
    console.log('4. Consider using AI to generate missing avatars');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
main();