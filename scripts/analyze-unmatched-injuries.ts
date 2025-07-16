import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Known unmatched players from recent injury collection runs
const UNMATCHED_PLAYERS = {
  MLB: [
    'Christian Montes De Oca',
    'Ken Waldichuk',
    'Gunnar Hoglund',
    'Maverick Handley',
    'Jud Fabian',
    'Rodolfo Martinez',
    'Carlos Tavera',
    'Justin Armbruester',
    'Franklin Barreto',
    'Hunter Dobbins',
    'Brandon Birdsell',
    'Tim Elko',
    'Mason Adams',
    'Tyler Callihan',
    'Chase DeLauter'
  ],
  NHL: [
    'Carson Meyer',
    'Justin Kirkland',
    'Sean Behrens',
    'Thomas Bordeleau',
    'Johnathan Kovacevic',
    'Nico Hischier',
    'Jesper Bratt',
    'Luke Hughes',
    'Brenden Dillon',
    'Tanner Howe',
    'Jared McCann',
    'Torey Krug',
    'Dylan Guenther',
    'Alex Pietrangelo',
    'Jeremy Lauzon',
    'Mark Stone'
  ]
};

async function analyzeUnmatchedPlayers() {
  console.log('🔍 Analyzing Unmatched Players from Injury Collection\n');

  for (const [sport, playerNames] of Object.entries(UNMATCHED_PLAYERS)) {
    console.log(`\n📊 Analyzing ${sport} Players:\n`);
    console.log('─'.repeat(80));

    for (const playerName of playerNames) {
      console.log(`\n🏃 Checking: ${playerName}`);
      
      // Check with uppercase sport_id (MLB, NHL)
      const upperResult = await supabase
        .from('players')
        .select('id, name, team, position, sport_id, espn_id')
        .eq('name', playerName)
        .eq('sport_id', sport);

      if (upperResult.data && upperResult.data.length > 0) {
        console.log(`  ✅ Found with sport_id="${sport}":`, upperResult.data[0]);
      }

      // Check with lowercase sport_id (mlb, nhl)
      const lowerResult = await supabase
        .from('players')
        .select('id, name, team, position, sport_id, espn_id')
        .eq('name', playerName)
        .eq('sport_id', sport.toLowerCase());

      if (lowerResult.data && lowerResult.data.length > 0) {
        console.log(`  ✅ Found with sport_id="${sport.toLowerCase()}":`, lowerResult.data[0]);
      }

      // Check if player exists with any sport_id
      const anyResult = await supabase
        .from('players')
        .select('id, name, team, position, sport_id, espn_id')
        .eq('name', playerName);

      if (anyResult.data && anyResult.data.length > 0) {
        console.log(`  ⚠️  Found with different sport_id(s):`);
        anyResult.data.forEach(player => {
          console.log(`     - sport_id="${player.sport_id}" (${player.team || 'no team'})`);
        });
      } else {
        console.log(`  ❌ Not found in database at all`);
      }

      // Check for similar names (in case of slight variations)
      const similarResult = await supabase
        .from('players')
        .select('id, name, sport_id')
        .ilike('name', `%${playerName.split(' ')[1]}%`)
        .in('sport_id', [sport, sport.toLowerCase()])
        .limit(5);

      if (similarResult.data && similarResult.data.length > 0) {
        console.log(`  🔍 Similar names found:`);
        similarResult.data.forEach(player => {
          if (player.name !== playerName) {
            console.log(`     - "${player.name}" (sport_id: ${player.sport_id})`);
          }
        });
      }
    }
  }

  // Check overall sport_id distribution
  console.log('\n\n📊 Sport ID Distribution Analysis:\n');
  console.log('─'.repeat(80));

  const sportDistribution = await supabase
    .from('players')
    .select('sport_id')
    .in('sport_id', ['MLB', 'mlb', 'NHL', 'nhl']);

  if (sportDistribution.data) {
    const counts: Record<string, number> = {};
    sportDistribution.data.forEach(row => {
      counts[row.sport_id] = (counts[row.sport_id] || 0) + 1;
    });

    console.log('Sport ID counts:');
    Object.entries(counts).sort().forEach(([sport_id, count]) => {
      console.log(`  ${sport_id}: ${count.toLocaleString()} players`);
    });
  }

  // Check if injury lookup is case-sensitive
  console.log('\n\n🔍 Testing Case Sensitivity in Lookups:\n');
  console.log('─'.repeat(80));

  const testPlayer = 'Connor McDavid';
  
  // Test exact match with uppercase
  const upperTest = await supabase
    .from('players')
    .select('id, name, sport_id')
    .eq('name', testPlayer)
    .eq('sport_id', 'NHL')
    .single();

  console.log(`Lookup with sport_id='NHL': ${upperTest.data ? 'Found' : 'Not found'}`);

  // Test exact match with lowercase
  const lowerTest = await supabase
    .from('players')
    .select('id, name, sport_id')
    .eq('name', testPlayer)
    .eq('sport_id', 'nhl')
    .single();

  console.log(`Lookup with sport_id='nhl': ${lowerTest.data ? 'Found' : 'Not found'}`);

  // Test case-insensitive match
  const ilikeTest = await supabase
    .from('players')
    .select('id, name, sport_id')
    .eq('name', testPlayer)
    .ilike('sport_id', 'nhl')
    .single();

  console.log(`Lookup with ilike sport_id: ${ilikeTest.data ? 'Found' : 'Not found'}`);

  // Summary recommendations
  console.log('\n\n💡 Analysis Summary:\n');
  console.log('─'.repeat(80));
  console.log('1. Check if injury collection is using the correct case for sport_id');
  console.log('2. Verify that player names match exactly (no extra spaces, special chars)');
  console.log('3. Consider using case-insensitive lookups for sport_id');
  console.log('4. May need to standardize sport_id values across the database');
}

// Run analysis
analyzeUnmatchedPlayers()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });