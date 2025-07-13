import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testMLBGames() {
  console.log('🔍 Testing MLB games in database...\n');
  
  // Check different ways MLB might be stored
  const queries = [
    { query: "sport.eq.MLB", desc: "sport = 'MLB'" },
    { query: "sport_id.eq.mlb", desc: "sport_id = 'mlb'" },
    { query: "sport.ilike.%baseball%", desc: "sport LIKE '%baseball%'" },
    { query: "sport_id.ilike.%mlb%", desc: "sport_id LIKE '%mlb%'" }
  ];
  
  for (const { query, desc } of queries) {
    const { count, error } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .or(query)
      .not('home_score', 'is', null);
    
    console.log(`${desc}: ${count || 0} games`);
  }
  
  // Get sample MLB games
  console.log('\n📋 Sample MLB games:');
  const { data: samples } = await supabase
    .from('games')
    .select('id, sport, sport_id, external_id, start_time')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5);
  
  samples?.forEach(game => {
    console.log(`Game ${game.id}: sport=${game.sport}, sport_id=${game.sport_id}, external_id=${game.external_id}`);
  });
  
  // Check 2024 games specifically
  const { count: games2024 } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .gte('start_time', '2024-01-01')
    .not('home_score', 'is', null);
  
  console.log(`\n2024 MLB games: ${games2024 || 0}`);
}

testMLBGames();