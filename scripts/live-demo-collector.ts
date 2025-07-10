#!/usr/bin/env tsx
/**
 * LIVE DEMO - Show data collection in action!
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function liveDemo() {
  console.log('🚀 LIVE DEMO - WATCH DATA BEING ADDED IN REAL-TIME!\n');
  
  // Get initial counts
  const { count: initialLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  const { count: initialPhotos } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('photo_url', 'is', null);
    
  console.log('📊 STARTING COUNTS:');
  console.log(`Game logs: ${initialLogs}`);
  console.log(`Players with photos: ${initialPhotos}\n`);
  
  console.log('🎯 COLLECTING DATA FROM ESPN...\n');
  
  // Get a recent completed game
  const response = await axios.get(
    'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=2024&seasontype=2&week=18'
  );
  
  const game = response.data.events?.find((e: any) => e.status.type.completed);
  
  if (!game) {
    console.log('No completed games found');
    return;
  }
  
  console.log(`Found game: ${game.name}`);
  console.log('Getting player stats...\n');
  
  // Get box score
  const summary = await axios.get(
    `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${game.id}`
  );
  
  let playersAdded = 0;
  let statsAdded = 0;
  
  if (summary.data.boxscore?.players) {
    for (const teamData of summary.data.boxscore.players) {
      console.log(`\n📍 ${teamData.team.displayName}:`);
      
      // Process top performers in each category
      for (const statCategory of teamData.statistics || []) {
        if (statCategory.athletes?.length > 0 && ['passing', 'rushing', 'receiving'].includes(statCategory.name)) {
          console.log(`\n${statCategory.name.toUpperCase()}:`);
          
          // Process top 3 players in each category
          for (const player of statCategory.athletes.slice(0, 3)) {
            const athlete = player.athlete;
            
            // Add player with photo
            const photoUrl = `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${athlete.id}.png&w=350&h=254`;
            
            const { data: dbPlayer } = await supabase
              .from('players')
              .upsert({
                external_id: `espn_demo_${athlete.id}`,
                name: athlete.displayName,
                position: athlete.position ? [athlete.position.abbreviation] : [],
                jersey_number: athlete.jersey,
                team_name: teamData.team.displayName,
                photo_url: photoUrl
              }, { onConflict: 'external_id' })
              .select()
              .single();
              
            if (dbPlayer) {
              playersAdded++;
              console.log(`  ✅ Added: ${athlete.displayName} (#${athlete.jersey})`);
              
              // Parse stats
              const stats: any = { category: statCategory.name };
              if (statCategory.name === 'passing' && player.stats) {
                const [compAtt, yds, , td] = player.stats;
                stats.passing_yards = parseInt(yds) || 0;
                stats.passing_tds = parseInt(td) || 0;
                stats.fantasy_points = stats.passing_yards * 0.04 + stats.passing_tds * 4;
              } else if (statCategory.name === 'rushing' && player.stats) {
                const [car, yds, , td] = player.stats;
                stats.rushing_yards = parseInt(yds) || 0;
                stats.rushing_tds = parseInt(td) || 0;
                stats.fantasy_points = stats.rushing_yards * 0.1 + stats.rushing_tds * 6;
              } else if (statCategory.name === 'receiving' && player.stats) {
                const [rec, yds, , td] = player.stats;
                stats.receptions = parseInt(rec) || 0;
                stats.receiving_yards = parseInt(yds) || 0;
                stats.receiving_tds = parseInt(td) || 0;
                stats.fantasy_points = stats.receptions + stats.receiving_yards * 0.1 + stats.receiving_tds * 6;
              }
              
              if (stats.fantasy_points > 0) {
                // Add game log
                const { error } = await supabase
                  .from('player_game_logs')
                  .insert({
                    player_id: dbPlayer.id,
                    game_id: `espn_demo_${game.id}`,
                    game_date: new Date(),
                    stats: stats,
                    fantasy_points: stats.fantasy_points
                  });
                  
                if (!error) {
                  statsAdded++;
                  console.log(`     📊 Stats: ${stats.fantasy_points.toFixed(1)} fantasy points`);
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Get final counts
  const { count: finalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  const { count: finalPhotos } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .not('photo_url', 'is', null);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ DEMO COMPLETE!\n');
  console.log('📊 RESULTS:');
  console.log(`Players added: ${playersAdded}`);
  console.log(`Stats added: ${statsAdded}`);
  console.log(`\n📈 DATABASE GROWTH:`);
  console.log(`Game logs: ${initialLogs} → ${finalLogs} (+${(finalLogs || 0) - (initialLogs || 0)})`);
  console.log(`Players with photos: ${initialPhotos} → ${finalPhotos} (+${(finalPhotos || 0) - (initialPhotos || 0)})`);
  
  console.log('\n🎉 YES, IT\'S REALLY WORKING!');
}

liveDemo();