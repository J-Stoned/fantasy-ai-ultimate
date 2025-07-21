import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function cleanMLPredictions() {
  console.log('🧹 Cleaning corrupted ML and pattern analysis data...');
  
  // Clean ml_predictions
  const { count: mlCount } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Found ${mlCount} ML predictions`);
  
  if (mlCount && mlCount > 0) {
    const { error: mlError } = await supabase
      .from('ml_predictions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (mlError) {
      console.error('Error deleting ML predictions:', mlError);
    } else {
      console.log(`✅ Cleaned ${mlCount} corrupted ML predictions`);
    }
  }
  
  // Clean pattern_analysis_history
  const { count: patternCount } = await supabase
    .from('pattern_analysis_history')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Found ${patternCount} pattern analyses`);
  
  if (patternCount && patternCount > 0) {
    const { error: patternError } = await supabase
      .from('pattern_analysis_history')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (patternError) {
      console.error('Error deleting pattern analyses:', patternError);
    } else {
      console.log(`✅ Cleaned ${patternCount} corrupted pattern analyses`);
    }
  }
  
  console.log('🎯 Database cleaned and ready for fresh predictions!');
}

cleanMLPredictions();