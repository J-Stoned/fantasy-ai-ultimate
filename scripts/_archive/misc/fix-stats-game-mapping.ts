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

async function fixStatsGameMapping() {
  console.log('🔧 Fixing stats-game mapping issue...\n');

  try {
    // 1. First, let's check external_ids to see if we can match them
    console.log('📊 Checking external_id mapping...');
    
    // Get games with stats that have external_ids
    const gamesWithStatsIds = [3563186, 3563187, 3563188, 3560530, 3563190, 3560532, 3563183, 3563189, 3560507, 3560508];
    
    const { data: badGames, error: badGamesError } = await supabase
      .from('games')
      .select('id, external_id')
      .in('id', gamesWithStatsIds);

    if (badGamesError) throw badGamesError;

    console.log('\nGames with stats (bad mapping):');
    badGames?.forEach(game => {
      console.log(`  Game ${game.id}: external_id = ${game.external_id}`);
    });

    // 2. Now find the correct games with matching external_ids
    console.log('\n🔍 Finding correct games with matching external_ids...');
    
    const externalIds = badGames?.map(g => g.external_id).filter(id => id) || [];
    
    const { data: correctGames, error: correctGamesError } = await supabase
      .from('games')
      .select('id, external_id, sport, home_score, away_score')
      .in('external_id', externalIds)
      .not('sport', 'is', null);

    if (correctGamesError) throw correctGamesError;

    console.log('\nCorrect games found:');
    const idMapping = new Map<number, number>(); // bad_id -> correct_id
    
    correctGames?.forEach(correctGame => {
      const badGame = badGames?.find(bg => bg.external_id === correctGame.external_id);
      if (badGame) {
        console.log(`  ${badGame.id} -> ${correctGame.id} (${correctGame.external_id}, ${correctGame.sport})`);
        idMapping.set(badGame.id, correctGame.id);
      }
    });

    // 3. Count stats that need to be remapped
    console.log('\n📈 Stats to be remapped:');
    let totalStatsToRemap = 0;
    
    for (const [badId, correctId] of idMapping.entries()) {
      const { count, error } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', badId);

      if (!error && count) {
        console.log(`  Game ${badId} -> ${correctId}: ${count} stats`);
        totalStatsToRemap += count;
      }
    }

    console.log(`\n📊 Total stats to remap: ${totalStatsToRemap.toLocaleString()}`);

    // 4. Ask for confirmation before proceeding
    console.log('\n⚠️  Ready to remap stats to correct game IDs.');
    console.log('This will update the game_id field in player_stats table.');
    console.log('\nProceed with remapping? (Comment out the return statement below to proceed)');
    
    return; // Safety check - comment this out to actually perform the update

    // 5. Perform the remapping
    console.log('\n🔄 Remapping stats...');
    
    for (const [badId, correctId] of idMapping.entries()) {
      const { error } = await supabase
        .from('player_stats')
        .update({ game_id: correctId })
        .eq('game_id', badId);

      if (error) {
        console.error(`❌ Error remapping game ${badId} to ${correctId}:`, error);
      } else {
        console.log(`✅ Remapped stats from game ${badId} to ${correctId}`);
      }
    }

    // 6. Verify the fix
    console.log('\n✅ Verifying the fix...');
    const { data: uniqueGamesAfter, error: afterError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null);

    if (!afterError) {
      const uniqueGameIds = new Set(uniqueGamesAfter.map(s => s.game_id));
      
      // Count how many are in correct range
      const correctRangeCount = Array.from(uniqueGameIds).filter(id => id < 100000).length;
      
      console.log(`\n📊 After remapping:`);
      console.log(`  Total unique games with stats: ${uniqueGameIds.size}`);
      console.log(`  Games in correct ID range (< 100000): ${correctRangeCount}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the fix
fixStatsGameMapping();