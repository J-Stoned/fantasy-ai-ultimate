#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function extractPlayerFeatures() {
  console.log('\n🏈 PLAYER FEATURE EXTRACTION V2 - REAL DATA!');
  console.log('==================================================\n');

  try {
    // Get top players with stats
    const { data: playerStats, error } = await supabase
      .from('player_stats')
      .select(`
        player_id,
        game_id,
        stat_type,
        stat_value,
        fantasy_points,
        players!inner(
          id,
          name,
          team_id,
          position
        ),
        games!inner(
          id,
          start_time,
          home_team_id,
          away_team_id,
          sport_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) throw error;

    console.log(`Found ${playerStats?.length || 0} player stats to process\n`);

    // Group by player
    const playerMap = new Map();
    
    for (const stat of playerStats || []) {
      const playerId = stat.player_id;
      
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          playerId,
          playerName: stat.players.name,
          position: stat.players.position,
          teamId: stat.players.team_id,
          stats: [],
          totalFantasyPoints: 0,
          gamesPlayed: new Set()
        });
      }
      
      const player = playerMap.get(playerId);
      player.stats.push(stat);
      player.totalFantasyPoints += stat.fantasy_points || 0;
      player.gamesPlayed.add(stat.game_id);
    }

    console.log(`Processing ${playerMap.size} unique players...\n`);

    // Get injuries
    const { data: injuries } = await supabase
      .from('player_injuries')
      .select('player_id, status, return_date');

    const injuryMap = new Map();
    for (const injury of injuries || []) {
      injuryMap.set(injury.player_id, injury);
    }

    // Calculate features
    const playerFeatures = [];
    
    for (const [playerId, playerData] of playerMap) {
      const avgFantasyPoints = playerData.totalFantasyPoints / playerData.gamesPlayed.size;
      const injury = injuryMap.get(playerId);
      
      // Get recent form (last 5 games)
      const recentStats = playerData.stats
        .sort((a: any, b: any) => new Date(b.games.start_time).getTime() - new Date(a.games.start_time).getTime())
        .slice(0, 5);
        
      const recentAvg = recentStats.length > 0
        ? recentStats.reduce((sum: number, s: any) => sum + (s.fantasy_points || 0), 0) / recentStats.length
        : 0;

      const feature = {
        player_id: playerId,
        player_name: playerData.playerName,
        position: playerData.position,
        team_id: playerData.teamId,
        games_played: playerData.gamesPlayed.size,
        avg_fantasy_points: avgFantasyPoints,
        recent_form: recentAvg,
        form_trend: recentAvg > avgFantasyPoints ? 'improving' : 'declining',
        injury_status: injury?.status || 'healthy',
        injury_return: injury?.return_date,
        stat_types: [...new Set(playerData.stats.map((s: any) => s.stat_type))],
        last_updated: new Date().toISOString()
      };

      playerFeatures.push(feature);
    }

    // Create table if not exists
    await ensurePlayerFeaturesTable();

    // Store features
    console.log('\n💾 Storing player features...');
    
    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < playerFeatures.length; i += batchSize) {
      const batch = playerFeatures.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('player_features_v2')
        .upsert(batch, { onConflict: 'player_id' });

      if (insertError) {
        console.error('Insert error:', insertError);
      } else {
        console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(playerFeatures.length/batchSize)}`);
      }
    }

    console.log(`\n🎯 PLAYER FEATURES EXTRACTED!`);
    console.log(`==============================`);
    console.log(`Players processed: ${playerFeatures.length}`);
    console.log(`Average fantasy points: ${(playerFeatures.reduce((sum, p) => sum + p.avg_fantasy_points, 0) / playerFeatures.length).toFixed(2)}`);
    
    // Show top performers
    const topPlayers = playerFeatures
      .sort((a, b) => b.avg_fantasy_points - a.avg_fantasy_points)
      .slice(0, 5);
      
    console.log('\n🌟 TOP PERFORMERS:');
    for (const player of topPlayers) {
      console.log(`${player.player_name} (${player.position}): ${player.avg_fantasy_points.toFixed(2)} pts/game`);
    }

  } catch (error) {
    console.error('Feature extraction error:', error);
  }
}

async function ensurePlayerFeaturesTable() {
  // First check if table exists
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'player_features_v2');

  if (!tables || tables.length === 0) {
    console.log('📊 Creating player_features_v2 table...');
    
    // Note: This would need to be run in Supabase SQL editor
    const createTableSQL = `
      CREATE TABLE player_features_v2 (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        player_id TEXT UNIQUE NOT NULL,
        player_name TEXT,
        position TEXT,
        team_id TEXT,
        games_played INT,
        avg_fantasy_points FLOAT,
        recent_form FLOAT,
        form_trend TEXT,
        injury_status TEXT,
        injury_return DATE,
        stat_types TEXT[],
        last_updated TIMESTAMP DEFAULT NOW()
      );
      
      CREATE INDEX idx_player_features_team ON player_features_v2(team_id);
      CREATE INDEX idx_player_features_position ON player_features_v2(position);
    `;
    
    console.log('⚠️  Run this SQL in Supabase dashboard:', createTableSQL);
  }
}

// RUN IT!
extractPlayerFeatures().catch(console.error);