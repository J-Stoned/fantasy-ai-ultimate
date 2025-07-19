import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findNonStandardSports() {
  console.log('🔍 Finding non-standard sport values in players table...\n');

  const standardSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL', 'NCAA_HKY', 'MILB'];
  
  // Get all unique sport values
  const { data: allSports, error: sportsError } = await supabase
    .from('players')
    .select('sport')
    .not('sport', 'in', `(${standardSports.join(',')})`)
    .not('sport', 'is', null);

  if (sportsError) {
    console.error('Error fetching sports:', sportsError);
    return;
  }

  // Count occurrences of each non-standard sport
  const sportCounts = new Map<string, number>();
  
  allSports?.forEach(row => {
    const sport = row.sport;
    sportCounts.set(sport, (sportCounts.get(sport) || 0) + 1);
  });

  // Sort by count
  const sortedSports = Array.from(sportCounts.entries())
    .sort((a, b) => b[1] - a[1]);

  if (sortedSports.length === 0) {
    console.log('✅ No non-standard sport values found! All sports are standard.');
    return;
  }

  console.log('❌ Found non-standard sport values:\n');
  console.log('Sport | Count');
  console.log('------|-------');
  
  sortedSports.forEach(([sport, count]) => {
    console.log(`${sport.padEnd(20)} | ${count}`);
  });

  console.log(`\nTotal non-standard records: ${allSports?.length || 0}`);
  
  // Also check for NULL sports
  const { count: nullCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .is('sport', null);

  if (nullCount && nullCount > 0) {
    console.log(`\n⚠️  NULL sport values: ${nullCount}`);
  }

  // Show total player count for context
  const { count: totalCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total players in database: ${totalCount}`);
  console.log(`📊 Players with standard sports: ${(totalCount || 0) - (allSports?.length || 0) - (nullCount || 0)}`);
}

// Run the check
findNonStandardSports()
  .then(() => {
    console.log('\n✅ Sport field analysis complete!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });