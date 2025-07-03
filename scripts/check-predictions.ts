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
    .select('*', { count: 'exact' })
    .eq('model_name', 'ensemble_v2')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('Total ensemble predictions:', count);
  console.log('Latest predictions:', data?.length || 0);
  
  if (data && data.length > 0) {
    console.log('Sample prediction:', {
      game_id: data[0].game_id,
      confidence: data[0].confidence,
      predicted_winner: data[0].predicted_winner,
      home_win_probability: data[0].home_win_probability
    });
  }
})().catch(console.error);