#!/usr/bin/env tsx
/**
 * 🔍 DEBUG DATA EXTRACTION
 * Quick debug to see what's happening with data filtering
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function debugData() {
  console.log('🔍 DEBUGGING DATA EXTRACTION');
  console.log('============================');
  
  // Load financial data
  const { data: teamsWithFinance } = await supabase
    .from('teams')
    .select('id, metadata')
    .not('metadata->cap_percentage_2024', 'is', null);
  
  console.log(`Teams with finance: ${teamsWithFinance?.length}`);
  if (teamsWithFinance?.length > 0) {
    console.log('Sample team finance:', teamsWithFinance[0]);
  }
  
  const teamFinance: Record<string, any> = {};
  teamsWithFinance?.forEach(team => {
    teamFinance[team.id] = {
      cap_percentage: team.metadata?.cap_percentage_2024 || 0,
      over_tax: team.metadata?.financial_data?.over_tax_line || false
    };
  });
  
  // Load games
  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .in('sport_id', ['nfl', 'nba'])
    .order('start_time', { ascending: true })
    .limit(100); // Limit for debugging
  
  console.log(`Total games loaded: ${allGames?.length}`);
  if (allGames?.length > 0) {
    console.log('Sample game:', allGames[0]);
  }
  
  // Filter games with financial data
  const gamesWithData = allGames?.filter(g => 
    teamFinance[g.home_team_id] || teamFinance[g.away_team_id]
  ) || [];
  
  console.log(`Games with financial data: ${gamesWithData.length}`);
  
  // Check specific game filtering
  if (allGames && allGames.length > 0) {
    const sampleGame = allGames[10];
    console.log('\\nSample game check:');
    console.log('Home team ID:', sampleGame.home_team_id);
    console.log('Away team ID:', sampleGame.away_team_id);
    console.log('Home team has finance?', !!teamFinance[sampleGame.home_team_id]);
    console.log('Away team has finance?', !!teamFinance[sampleGame.away_team_id]);
    console.log('Would be included?', teamFinance[sampleGame.home_team_id] || teamFinance[sampleGame.away_team_id]);
  }
  
  // Check available team IDs
  const availableTeamIds = Object.keys(teamFinance);
  console.log('\\nAvailable finance team IDs:', availableTeamIds.slice(0, 5));
  
  if (allGames && allGames.length > 0) {
    const gameTeamIds = [...new Set([
      ...allGames.map(g => g.home_team_id),
      ...allGames.map(g => g.away_team_id)
    ])];
    console.log('Game team IDs (first 5):', gameTeamIds.slice(0, 5));
    
    // Find intersection
    const intersection = gameTeamIds.filter(id => availableTeamIds.includes(id));
    console.log('Team IDs with both games and finance:', intersection.length);
  }
}

debugData().catch(console.error);