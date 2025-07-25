import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import sharp from 'sharp';
import pLimit from 'p-limit';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Rate limiter to avoid API throttling
const limit = pLimit(5); // 5 concurrent requests

// ESPN API endpoints by sport
const ESPN_ENDPOINTS = {
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams'
};

// SportsData.io endpoints (requires API key)
const SPORTSDATA_ENDPOINTS = {
  NFL: 'https://api.sportsdata.io/v3/nfl/scores/json/Players',
  NBA: 'https://api.sportsdata.io/v3/nba/scores/json/Players',
  MLB: 'https://api.sportsdata.io/v3/mlb/scores/json/Players',
  NHL: 'https://api.sportsdata.io/v3/nhl/scores/json/Players'
};

interface PlayerPhotoSource {
  playerId: string;
  photoUrl: string;
  source: string;
  quality: 'high' | 'medium' | 'low';
}

/**
 * Fetch player photos from ESPN
 */
async function fetchESPNPhotos(sport: string): Promise<PlayerPhotoSource[]> {
  console.log(`📸 Fetching ${sport} photos from ESPN...`);
  const photos: PlayerPhotoSource[] = [];
  
  try {
    // First get all teams
    const teamsResponse = await axios.get(ESPN_ENDPOINTS[sport]);
    const teams = teamsResponse.data.sports[0].leagues[0].teams;
    
    // Then get rosters for each team
    for (const team of teams) {
      const rosterUrl = `${team.team.links[1].href}?limit=1000`;
      
      try {
        const rosterResponse = await axios.get(rosterUrl);
        const athletes = rosterResponse.data.athletes || [];
        
        for (const athlete of athletes) {
          if (athlete.headshot?.href) {
            photos.push({
              playerId: athlete.id,
              photoUrl: athlete.headshot.href,
              source: 'ESPN',
              quality: 'high'
            });
          }
        }
      } catch (error) {
        console.error(`Failed to fetch roster for ${team.team.displayName}`);
      }
    }
  } catch (error) {
    console.error(`ESPN API error for ${sport}:`, error.message);
  }
  
  console.log(`✅ Found ${photos.length} ${sport} photos from ESPN`);
  return photos;
}

/**
 * Fetch player photos from SportsData.io
 */
async function fetchSportsDataPhotos(sport: string): Promise<PlayerPhotoSource[]> {
  const apiKey = process.env.SPORTSDATA_API_KEY;
  if (!apiKey) {
    console.log('⚠️  No SportsData.io API key found');
    return [];
  }
  
  console.log(`📸 Fetching ${sport} photos from SportsData.io...`);
  const photos: PlayerPhotoSource[] = [];
  
  try {
    const response = await axios.get(SPORTSDATA_ENDPOINTS[sport], {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });
    
    const players = response.data || [];
    
    for (const player of players) {
      if (player.PhotoUrl) {
        photos.push({
          playerId: player.PlayerID.toString(),
          photoUrl: player.PhotoUrl,
          source: 'SportsData',
          quality: 'high'
        });
      }
    }
  } catch (error) {
    console.error(`SportsData API error for ${sport}:`, error.message);
  }
  
  console.log(`✅ Found ${photos.length} ${sport} photos from SportsData.io`);
  return photos;
}

/**
 * Download and optimize player photo
 */
async function downloadAndOptimizePhoto(
  photoSource: PlayerPhotoSource,
  playerId: string
): Promise<string | null> {
  try {
    // Download image
    const response = await axios.get(photoSource.photoUrl, {
      responseType: 'arraybuffer',
      timeout: 10000
    });
    
    // Optimize with sharp
    const optimized = await sharp(Buffer.from(response.data))
      .resize(512, 512, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({
        quality: 85,
        progressive: true
      })
      .toBuffer();
    
    // Upload to Supabase Storage
    const fileName = `${playerId}-${Date.now()}.jpg`;
    const { data, error } = await supabase.storage
      .from('player-avatars')
      .upload(`photos/${fileName}`, optimized, {
        contentType: 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('player-avatars')
      .getPublicUrl(`photos/${fileName}`);
    
    return publicUrl;
  } catch (error) {
    console.error(`Failed to download photo for ${playerId}:`, error.message);
    return null;
  }
}

/**
 * Match external player IDs with our database
 */
async function matchPlayerWithDatabase(
  externalId: string,
  source: string,
  sport: string
): Promise<string | null> {
  // This would need proper mapping logic
  // For now, try to match by name or external ID stored in metadata
  
  const { data: player } = await supabase
    .from('players')
    .select('id')
    .eq('external_ids->' + source.toLowerCase(), externalId)
    .single();
  
  return player?.id || null;
}

/**
 * Process photos for a specific sport
 */
async function processSportPhotos(sport: string) {
  console.log(`\n🏈 Processing ${sport} player photos...`);
  
  // Fetch from multiple sources
  const espnPhotos = await fetchESPNPhotos(sport);
  const sportsDataPhotos = await fetchSportsDataPhotos(sport);
  
  // Combine all photo sources
  const allPhotos = [...espnPhotos, ...sportsDataPhotos];
  console.log(`📊 Total photos to process: ${allPhotos.length}`);
  
  // Process photos with concurrency limit
  let processed = 0;
  let successful = 0;
  
  const processPromises = allPhotos.map((photoSource) => 
    limit(async () => {
      // Match with our database
      const playerId = await matchPlayerWithDatabase(
        photoSource.playerId,
        photoSource.source,
        sport
      );
      
      if (!playerId) {
        return;
      }
      
      // Download and optimize
      const publicUrl = await downloadAndOptimizePhoto(photoSource, playerId);
      
      if (publicUrl) {
        // Update player record
        const { error } = await supabase
          .from('players')
          .update({
            avatar_photo_url: publicUrl,
            avatar_metadata: {
              photo_source: photoSource.source,
              photo_quality: photoSource.quality,
              photo_updated_at: new Date().toISOString()
            }
          })
          .eq('id', playerId);
        
        if (!error) {
          successful++;
        }
      }
      
      processed++;
      if (processed % 100 === 0) {
        console.log(`Progress: ${processed}/${allPhotos.length} photos processed`);
      }
    })
  );
  
  await Promise.all(processPromises);
  
  console.log(`\n✅ ${sport} Complete!`);
  console.log(`   Processed: ${processed}`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${processed - successful}`);
}

/**
 * Fetch photos from team websites
 */
async function fetchTeamWebsitePhotos(teamUrl: string): Promise<PlayerPhotoSource[]> {
  // This would scrape team websites for official photos
  // Implementation would vary by team
  return [];
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Starting player photo collection...\n');
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    await processSportPhotos(sport);
    
    // Add delay between sports
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Summary statistics
  const { count: totalWithPhotos } = await supabase
    .from('players')
    .select('id', { count: 'exact' })
    .not('avatar_photo_url', 'is', null);
  
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact' });
  
  console.log('\n📊 Final Statistics:');
  console.log(`   Total players: ${totalPlayers}`);
  console.log(`   Players with photos: ${totalWithPhotos}`);
  console.log(`   Coverage: ${((totalWithPhotos / totalPlayers) * 100).toFixed(1)}%`);
  
  console.log('\n✨ Photo collection complete!');
  console.log('\nNext steps:');
  console.log('1. Review photo quality and replace low-quality images');
  console.log('2. Generate AI avatars for players without photos');
  console.log('3. Create 2D sprites for starter tier players');
  console.log('4. Generate 3D models for star players');
}

// Run the script
main().catch(console.error);