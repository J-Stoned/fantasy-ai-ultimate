import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateGameDuplicates() {
  console.log('🔍 Investigating game duplicates and missing games...\n');

  try {
    // 1. Check all games with these external_ids
    const targetExternalIds = [
      '401777460', '401777459', '401769994', '401769959',
      'nfl_401547353', 'nfl_401547404', 'nfl_401547398', 
      'nfl_401547399', 'nfl_401547405', 'nfl_401547406'
    ];

    console.log('📊 All games with target external_ids:');
    const { data: allGamesWithIds, error: allGamesError } = await supabase
      .from('games')
      .select('id, external_id, sport, home_score, away_score, home_team_id, away_team_id, start_time')
      .in('external_id', targetExternalIds)
      .order('id');

    if (allGamesError) throw allGamesError;

    allGamesWithIds?.forEach(game => {
      console.log(`\nGame ${game.id}:`);
      console.log(`  External ID: ${game.external_id}`);
      console.log(`  Sport: ${game.sport || 'NULL'}`);
      console.log(`  Teams: ${game.away_team_id} @ ${game.home_team_id}`);
      console.log(`  Score: ${game.away_score ?? 'NULL'} - ${game.home_score ?? 'NULL'}`);
      console.log(`  Date: ${new Date(game.start_time).toLocaleDateString()}`);
    });

    // 2. Check if NFL games exist with proper sport values
    console.log('\n\n📈 Checking NFL games from Sept 2023:');
    const { data: nflGames, error: nflError } = await supabase
      .from('games')
      .select('id, external_id, sport, home_score, away_score, start_time')
      .eq('sport', 'football')
      .gte('start_time', '2023-09-01')
      .lte('start_time', '2023-09-30')
      .not('home_score', 'is', null)
      .order('start_time')
      .limit(20);

    if (nflError) throw nflError;

    console.log(`Found ${nflGames?.length} NFL games from Sept 2023:`);
    nflGames?.forEach(game => {
      console.log(`  Game ${game.id}: ${game.external_id} - Score: ${game.away_score}-${game.home_score}`);
    });

    // 3. Check teams to understand the ID mapping
    console.log('\n\n🏈 Checking team IDs:');
    const teamIds = [8, 12, 30, 11, 27, 16, 10, 18, 25, 23, 22, 28];
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, abbreviation, sport')
      .in('id', teamIds);

    if (teamsError) throw teamsError;

    teams?.forEach(team => {
      console.log(`  Team ${team.id}: ${team.name} (${team.abbreviation}) - ${team.sport}`);
    });

    // 4. Check if there's a pattern in external_id prefixes
    console.log('\n\n📊 Checking external_id patterns:');
    const { data: externalIdPatterns, error: patternError } = await supabase
      .from('games')
      .select('external_id, sport')
      .not('external_id', 'is', null)
      .not('sport', 'is', null)
      .limit(100);

    if (!patternError && externalIdPatterns) {
      const patterns = new Map<string, Set<string>>();
      
      externalIdPatterns.forEach(game => {
        const prefix = game.external_id.split('_')[0];
        if (!patterns.has(game.sport)) {
          patterns.set(game.sport, new Set());
        }
        patterns.get(game.sport)?.add(prefix);
      });

      console.log('External ID prefixes by sport:');
      patterns.forEach((prefixes, sport) => {
        console.log(`  ${sport}: ${Array.from(prefixes).join(', ')}`);
      });
    }

    // 5. Final recommendation
    console.log('\n\n🎯 ANALYSIS SUMMARY:');
    console.log('- The games with stats have NULL sport values');
    console.log('- These appear to be duplicate game entries');
    console.log('- The external_ids suggest they are NFL games (nfl_ prefix) and possibly NHL games');
    console.log('- We need to either:');
    console.log('  1. Update the sport field for these games, OR');
    console.log('  2. Find the correct game entries and remap the stats');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the investigation
investigateGameDuplicates();