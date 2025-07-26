import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { logger } from '../apps/web/src/lib/logging/logger';

// Load environment variables
config();

// Sample player image URLs (using placeholder service for demo)
const samplePlayerImages = {
  'QB': [
    'https://ui-avatars.com/api/?name=Patrick+Mahomes&background=c0392b&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Josh+Allen&background=3498db&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Jalen+Hurts&background=27ae60&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Lamar+Jackson&background=8e44ad&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Joe+Burrow&background=f39c12&color=fff&size=256'
  ],
  'RB': [
    'https://ui-avatars.com/api/?name=Christian+McCaffrey&background=e74c3c&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Austin+Ekeler&background=2980b9&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Derrick+Henry&background=16a085&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Nick+Chubb&background=9b59b6&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Jonathan+Taylor&background=e67e22&color=fff&size=256'
  ],
  'WR': [
    'https://ui-avatars.com/api/?name=Justin+Jefferson&background=c0392b&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Tyreek+Hill&background=3498db&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Davante+Adams&background=27ae60&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Stefon+Diggs&background=8e44ad&color=fff&size=256',
    'https://ui-avatars.com/api/?name=CeeDee+Lamb&background=f39c12&color=fff&size=256'
  ],
  'TE': [
    'https://ui-avatars.com/api/?name=Travis+Kelce&background=e74c3c&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Mark+Andrews&background=2980b9&color=fff&size=256',
    'https://ui-avatars.com/api/?name=TJ+Hockenson&background=16a085&color=fff&size=256',
    'https://ui-avatars.com/api/?name=George+Kittle&background=9b59b6&color=fff&size=256',
    'https://ui-avatars.com/api/?name=Darren+Waller&background=e67e22&color=fff&size=256'
  ]
};

async function populatePlayerImages() {
  try {
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    logger.info('Starting player image population...');
    
    // Get NFL players by position
    for (const [position, imageUrls] of Object.entries(samplePlayerImages)) {
      logger.info(`Processing ${position} players...`);
      
      const { data: players, error } = await supabase
        .from('players')
        .select('id, name, position')
        .eq('sport', 'NFL')
        .eq('position', position)
        .is('image_url', null) // Only update players without images
        .limit(imageUrls.length);
      
      if (error) {
        logger.error(`Error fetching ${position} players:`, error);
        continue;
      }
      
      if (!players || players.length === 0) {
        logger.warn(`No ${position} players found without images`);
        continue;
      }
      
      // Update each player with a sample image
      for (let i = 0; i < Math.min(players.length, imageUrls.length); i++) {
        const player = players[i];
        const imageUrl = imageUrls[i];
        
        const { error: updateError } = await supabase
          .from('players')
          .update({ image_url: imageUrl })
          .eq('id', player.id);
        
        if (updateError) {
          logger.error(`Error updating player ${player.name}:`, updateError);
        } else {
          logger.info(`Updated ${player.name} with image URL`);
        }
      }
    }
    
    // Also add some specific player images by name
    const specificPlayers = [
      { name: 'Patrick Mahomes', imageUrl: 'https://ui-avatars.com/api/?name=Patrick+Mahomes&background=c0392b&color=fff&size=256' },
      { name: 'Christian McCaffrey', imageUrl: 'https://ui-avatars.com/api/?name=Christian+McCaffrey&background=e74c3c&color=fff&size=256' },
      { name: 'Justin Jefferson', imageUrl: 'https://ui-avatars.com/api/?name=Justin+Jefferson&background=c0392b&color=fff&size=256' },
      { name: 'Travis Kelce', imageUrl: 'https://ui-avatars.com/api/?name=Travis+Kelce&background=e74c3c&color=fff&size=256' },
      { name: 'Tyreek Hill', imageUrl: 'https://ui-avatars.com/api/?name=Tyreek+Hill&background=3498db&color=fff&size=256' }
    ];
    
    for (const { name, imageUrl } of specificPlayers) {
      const { error } = await supabase
        .from('players')
        .update({ image_url: imageUrl })
        .eq('name', name)
        .eq('sport', 'NFL');
      
      if (!error) {
        logger.info(`Updated ${name} with specific image URL`);
      }
    }
    
    logger.info('Player image population completed!');
    
  } catch (error) {
    logger.error('Failed to populate player images:', error);
    process.exit(1);
  }
}

populatePlayerImages();