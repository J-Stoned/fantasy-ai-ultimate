#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  const { count, data } = await supabase
    .from('ml_predictions')
    .select(`
      *,
      games!inner(
        id,
        status,
        home_score,
        away_score,
        home_team_id,
        away_team_id
      )
    `, { count: 'exact' })
    .eq('model_name', 'ensemble_v2')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('Total ensemble predictions:', count);
  console.log('Latest predictions:', data?.length || 0);
  
  if (data && data.length > 0) {
    console.log('\nPredictions with game status:');
    data.forEach(pred => {
      const game = pred.games;
      console.log(`  Game ${pred.game_id}: status=${game?.status || 'unknown'}, scores=${game?.home_score || 'null'}-${game?.away_score || 'null'}`);
    });
    
    // Count by status
    const completed = data.filter(p => p.games?.status === 'completed').length;
    const scheduled = data.filter(p => p.games?.status === 'scheduled').length;
    const inProgress = data.filter(p => p.games?.status === 'in_progress').length;
    
    console.log('\nStatus breakdown:');
    console.log(`  Completed: ${completed}`);
    console.log(`  Scheduled: ${scheduled}`);
    console.log(`  In Progress: ${inProgress}`);
  }
})().catch(console.error);