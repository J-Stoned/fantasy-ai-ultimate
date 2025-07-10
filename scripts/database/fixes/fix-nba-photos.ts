#!/usr/bin/env tsx
/**
 * FIX NBA PHOTOS
 * Specifically target NBA players and fix sport_id issues
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixNBAPhotos() {
  console.log('🏀 FIXING NBA PLAYER PHOTOS');
  console.log('===========================\n');
  
  const stats = {
    fixed: 0,
    added: 0,
    errors: 0
  };
  
  try {
    // First, fix players with 'nba' sport_id but no photos
    console.log('Step 1: Fixing existing NBA players...');
    const { data: nbaPlayers } = await supabase
      .from('players')
      .select('id, name, external_id')
      .eq('sport_id', 'nba')
      .is('photo_url', null);
    
    console.log(`Found ${nbaPlayers?.length || 0} NBA players without photos\n`);
    
    // Get fresh NBA rosters from ESPN
    console.log('Step 2: Getting current NBA rosters...');
    const teams = [
      { abbr: 'lal', name: 'Lakers' },
      { abbr: 'gsw', name: 'Warriors' },
      { abbr: 'bos', name: 'Celtics' },
      { abbr: 'mia', name: 'Heat' },
      { abbr: 'mil', name: 'Bucks' },
      { abbr: 'den', name: 'Nuggets' },
      { abbr: 'phx', name: 'Suns' },
      { abbr: 'phi', name: '76ers' },
      { abbr: 'dal', name: 'Mavericks' },
      { abbr: 'mem', name: 'Grizzlies' },
      { abbr: 'sac', name: 'Kings' },
      { abbr: 'no', name: 'Pelicans' },
      { abbr: 'ny', name: 'Knicks' },
      { abbr: 'bkn', name: 'Nets' },
      { abbr: 'atl', name: 'Hawks' },
      { abbr: 'chi', name: 'Bulls' },
      { abbr: 'cle', name: 'Cavaliers' },
      { abbr: 'det', name: 'Pistons' },
      { abbr: 'ind', name: 'Pacers' },
      { abbr: 'orl', name: 'Magic' },
      { abbr: 'tor', name: 'Raptors' },
      { abbr: 'wsh', name: 'Wizards' },
      { abbr: 'cha', name: 'Hornets' },
      { abbr: 'min', name: 'Timberwolves' },
      { abbr: 'okc', name: 'Thunder' },
      { abbr: 'por', name: 'Trail Blazers' },
      { abbr: 'sa', name: 'Spurs' },
      { abbr: 'utah', name: 'Jazz' },
      { abbr: 'hou', name: 'Rockets' },
      { abbr: 'lac', name: 'Clippers' }
    ];
    
    for (const team of teams) {
      try {
        const response = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.abbr}/roster`
        );
        
        const athletes = response.data.athletes || [];
        let teamCount = 0;
        
        for (const group of athletes) {
          for (const player of group.items || []) {
            try {
              const photoUrl = player.headshot?.href || 
                `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${player.id}.png&w=350&h=254`;
              
              // Try alternate photo URLs if main one doesn't exist
              const alternateUrls = [
                `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.displayName.toLowerCase().replace(' ', '')}.png`,
                `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${player.id}.png`
              ];
              
              const playerData = {
                external_id: `espn_nba_${player.id}`,
                name: player.displayName,
                firstname: player.firstName || player.displayName.split(' ')[0],
                lastname: player.lastName || player.displayName.split(' ').slice(1).join(' '),
                position: player.position ? [player.position.abbreviation] : [],
                jersey_number: player.jersey ? parseInt(player.jersey) : null,
                team: response.data.team.displayName,
                team_abbreviation: response.data.team.abbreviation,
                heightinches: player.displayHeight ? parseHeight(player.displayHeight) : null,
                weightlbs: player.displayWeight ? parseInt(player.displayWeight) : null,
                birthdate: player.dateOfBirth || null,
                sport_id: 'nba', // Ensure correct sport_id
                sport: 'basketball',
                photo_url: photoUrl,
                college: player.college?.name || null,
                metadata: {
                  espn_id: player.id,
                  experience: player.experience?.years,
                  draft_year: player.draft?.year,
                  alternate_photos: alternateUrls
                }
              };
              
              const { data, error } = await supabase
                .from('players')
                .upsert(playerData, { onConflict: 'external_id' })
                .select()
                .single();
              
              if (!error && data) {
                teamCount++;
                stats.added++;
              }
            } catch (playerError) {
              stats.errors++;
            }
          }
        }
        
        console.log(`  ✓ ${team.name}: ${teamCount} players`);
        
      } catch (teamError) {
        console.log(`  ✗ ${team.name}: Failed`);
        stats.errors++;
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Step 3: Fix players that might be tagged with wrong sport_id
    console.log('\nStep 3: Checking for mistagged NBA players...');
    const { data: possibleNBA } = await supabase
      .from('players')
      .select('id, name, external_id, sport_id')
      .or('external_id.ilike.%nba%,name.ilike.%lebron%,name.ilike.%curry%,name.ilike.%durant%')
      .is('photo_url', null)
      .limit(100);
    
    if (possibleNBA?.length) {
      console.log(`Found ${possibleNBA.length} possible NBA players to fix`);
      
      for (const player of possibleNBA) {
        if (player.external_id?.includes('nba')) {
          const espnId = player.external_id.match(/\d+/)?.[0];
          if (espnId) {
            const photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${espnId}.png&w=350&h=254`;
            
            const { error } = await supabase
              .from('players')
              .update({ 
                photo_url: photoUrl,
                sport_id: 'nba',
                sport: 'basketball'
              })
              .eq('id', player.id);
            
            if (!error) {
              stats.fixed++;
            }
          }
        }
      }
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ NBA PHOTO FIX COMPLETE');
    console.log(`📸 Players added/updated: ${stats.added}`);
    console.log(`🔧 Players fixed: ${stats.fixed}`);
    console.log(`❌ Errors: ${stats.errors}`);
    
    // Final check
    const { count: nbaTotal } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nba');
    
    const { count: nbaWithPhotos } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nba')
      .not('photo_url', 'is', null);
    
    const coverage = nbaTotal ? ((nbaWithPhotos || 0) / nbaTotal * 100).toFixed(1) : '0';
    console.log(`\n📊 NBA COVERAGE: ${nbaWithPhotos || 0}/${nbaTotal || 0} (${coverage}%)`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

function parseHeight(heightStr: string): number | null {
  const match = heightStr.match(/(\d+)'?\s*(\d+)?/);
  if (match) {
    const feet = parseInt(match[1]) || 0;
    const inches = parseInt(match[2]) || 0;
    return feet * 12 + inches;
  }
  return null;
}

fixNBAPhotos();