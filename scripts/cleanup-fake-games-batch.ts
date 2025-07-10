import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupFakeGames() {
  console.log('🧹 Starting fake games cleanup...\n');
  
  let totalDeleted = 0;
  let batchSize = 200; // Start with 200, will adjust if needed
  let consecutiveTimeouts = 0;
  const maxConsecutiveTimeouts = 3;
  
  try {
    // First, get count of remaining fake games
    const { count: totalFakeGames, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('external_id', null);
    
    if (countError) {
      console.error('Error counting fake games:', countError);
      return;
    }
    
    console.log(`📊 Found ${totalFakeGames} fake games to delete\n`);
    
    while (true) {
      // Get a batch of fake game IDs
      const { data: gamesBatch, error: fetchError } = await supabase
        .from('games')
        .select('id')
        .is('external_id', null)
        .limit(batchSize);
      
      if (fetchError) {
        console.error('Error fetching games batch:', fetchError);
        break;
      }
      
      if (!gamesBatch || gamesBatch.length === 0) {
        console.log('\n✅ No more fake games found!');
        break;
      }
      
      const gameIds = gamesBatch.map(g => g.id);
      console.log(`\n🎯 Processing batch of ${gameIds.length} games...`);
      
      try {
        // Delete related player_stats
        const { error: statsError, count: statsCount } = await supabase
          .from('player_stats')
          .delete()
          .in('game_id', gameIds);
        
        if (statsError) {
          if (statsError.message.includes('timeout')) {
            consecutiveTimeouts++;
            console.warn(`⏱️ Timeout deleting player_stats (attempt ${consecutiveTimeouts}/${maxConsecutiveTimeouts})`);
            
            if (consecutiveTimeouts >= maxConsecutiveTimeouts) {
              batchSize = Math.max(50, Math.floor(batchSize / 2));
              console.log(`📉 Reducing batch size to ${batchSize}`);
              consecutiveTimeouts = 0;
            }
            continue;
          }
          throw statsError;
        }
        
        if (statsCount) {
          console.log(`  ✓ Deleted ${statsCount} player_stats records`);
        }
        
        // Delete related player_game_logs
        const { error: logsError, count: logsCount } = await supabase
          .from('player_game_logs')
          .delete()
          .in('game_id', gameIds);
        
        if (logsError) {
          if (logsError.message.includes('timeout')) {
            consecutiveTimeouts++;
            console.warn(`⏱️ Timeout deleting player_game_logs (attempt ${consecutiveTimeouts}/${maxConsecutiveTimeouts})`);
            
            if (consecutiveTimeouts >= maxConsecutiveTimeouts) {
              batchSize = Math.max(50, Math.floor(batchSize / 2));
              console.log(`📉 Reducing batch size to ${batchSize}`);
              consecutiveTimeouts = 0;
            }
            continue;
          }
          throw logsError;
        }
        
        if (logsCount) {
          console.log(`  ✓ Deleted ${logsCount} player_game_logs records`);
        }
        
        // Finally, delete the games themselves
        const { error: gamesError, count: gamesCount } = await supabase
          .from('games')
          .delete()
          .in('id', gameIds);
        
        if (gamesError) {
          if (gamesError.message.includes('timeout')) {
            consecutiveTimeouts++;
            console.warn(`⏱️ Timeout deleting games (attempt ${consecutiveTimeouts}/${maxConsecutiveTimeouts})`);
            
            if (consecutiveTimeouts >= maxConsecutiveTimeouts) {
              batchSize = Math.max(50, Math.floor(batchSize / 2));
              console.log(`📉 Reducing batch size to ${batchSize}`);
              consecutiveTimeouts = 0;
            }
            continue;
          }
          throw gamesError;
        }
        
        if (gamesCount) {
          console.log(`  ✓ Deleted ${gamesCount} games`);
          totalDeleted += gamesCount;
          
          // Reset timeout counter on successful batch
          consecutiveTimeouts = 0;
          
          // Progress report every 1,000 games
          if (totalDeleted % 1000 < gamesCount) {
            const remaining = totalFakeGames! - totalDeleted;
            console.log(`\n📈 Progress: ${totalDeleted} deleted, ${remaining} remaining`);
            console.log(`   Current batch size: ${batchSize}`);
          }
          
          // Increase batch size if things are going well
          if (consecutiveTimeouts === 0 && batchSize < 500) {
            batchSize = Math.min(500, batchSize + 50);
          }
        }
        
      } catch (error: any) {
        console.error('\n❌ Error during batch deletion:', error.message);
        
        // Try to continue with smaller batches
        if (batchSize > 50) {
          batchSize = Math.max(50, Math.floor(batchSize / 2));
          console.log(`📉 Reducing batch size to ${batchSize} and continuing...`);
          consecutiveTimeouts = 0;
        } else {
          console.log('❌ Batch size already at minimum. Stopping.');
          break;
        }
      }
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Final verification
    const { count: remainingFake, error: finalCountError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('external_id', null);
    
    const { count: totalGames, error: totalCountError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 CLEANUP COMPLETE!');
    console.log('='.repeat(50));
    console.log(`✅ Total fake games deleted: ${totalDeleted}`);
    
    if (!finalCountError && !totalCountError) {
      console.log(`📊 Remaining fake games: ${remainingFake}`);
      console.log(`📊 Total games in database: ${totalGames}`);
      console.log(`📊 Real games (with external_id): ${totalGames! - remainingFake!}`);
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  }
}

// Run the cleanup
cleanupFakeGames().catch(console.error);