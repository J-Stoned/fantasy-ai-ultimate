import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function describeMlPredictions() {
  // Try to insert with minimal fields to see what's required
  const testData = {
    id: 999999,  // Try with an ID
    game_id: 1,
    model_name: 'test',
    prediction: 0.5,
    confidence: 0.5,
    created_at: new Date().toISOString()
  };
  
  const { error } = await supabase
    .from('ml_predictions')
    .insert(testData);
  
  if (error) {
    console.log('Error with basic insert:', error.message);
    
    // Try without ID
    delete (testData as any).id;
    const { error: error2 } = await supabase
      .from('ml_predictions')
      .insert(testData);
    
    if (error2) {
      console.log('Error without ID:', error2.message);
      
      // Try with just game_id
      const { error: error3 } = await supabase
        .from('ml_predictions')
        .insert({ game_id: 1 });
      
      if (error3) {
        console.log('Error with just game_id:', error3.message);
      }
    }
  }
  
  // Try to select to see structure
  const { data, error: selectError } = await supabase
    .from('ml_predictions')
    .select('*')
    .limit(0);
  
  if (!selectError && data) {
    console.log('\nTable structure (from empty select):', Object.keys(data[0] || {}));
  }
}

describeMlPredictions().catch(console.error);