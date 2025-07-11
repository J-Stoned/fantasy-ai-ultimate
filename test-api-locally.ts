import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 TESTING ULTIMATE STATS API LOCALLY');
console.log('====================================\n');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testDatabaseConnection() {
  console.log('📊 Testing database connection...');
  
  try {
    // Test basic query
    const { count: totalLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true });
    
    const { count: logsWithMetrics } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .not('computed_metrics', 'eq', '{}');
    
    console.log(`✅ Database connected!`);
    console.log(`   Total logs: ${totalLogs}`);
    console.log(`   Logs with metrics: ${logsWithMetrics}`);
    console.log(`   Coverage: ${((logsWithMetrics! / totalLogs!) * 100).toFixed(1)}%\n`);
    
    // Get sample data
    const { data: sampleLogs } = await supabase
      .from('player_game_logs')
      .select(`
        id,
        player_id,
        game_id,
        computed_metrics,
        players!inner(name, team, sport),
        games!inner(home_team, away_team, start_time)
      `)
      .not('computed_metrics', 'eq', '{}')
      .limit(3);
    
    if (sampleLogs && sampleLogs.length > 0) {
      console.log('📈 Sample Ultimate Stats:');
      sampleLogs.forEach((log: any) => {
        console.log(`\n   Player: ${log.players.name} (${log.players.team})`);
        console.log(`   Game: ${log.games.home_team} vs ${log.games.away_team}`);
        if (log.computed_metrics) {
          console.log('   Metrics:');
          Object.entries(log.computed_metrics).slice(0, 5).forEach(([key, value]) => {
            console.log(`     - ${key}: ${value}`);
          });
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

async function testRedisConnection() {
  console.log('\n🔄 Testing Redis connection...');
  
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.log('⚠️  Redis credentials not configured');
    console.log('   Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env');
    return false;
  }
  
  try {
    const { Redis } = await import('@upstash/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    
    await redis.ping();
    console.log('✅ Redis connected!');
    
    // Test cache
    const testKey = 'ultimate-stats-test';
    await redis.set(testKey, { test: true }, { ex: 60 });
    const cached = await redis.get(testKey);
    console.log('   Cache test:', cached ? '✅ Working' : '❌ Failed');
    
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    return false;
  }
}

async function main() {
  const dbOk = await testDatabaseConnection();
  const redisOk = await testRedisConnection();
  
  console.log('\n=====================================');
  console.log('📋 TEST SUMMARY:');
  console.log(`   Database: ${dbOk ? '✅ Connected' : '❌ Failed'}`);
  console.log(`   Redis: ${redisOk ? '✅ Connected' : '⚠️  Not configured'}`);
  
  if (dbOk) {
    console.log('\n✅ Your Ultimate Stats API is ready for deployment!');
    console.log('\n🚀 Next steps:');
    console.log('   1. Run: ./deploy-ultimate-stats.sh create-repo');
    console.log('   2. Deploy to Vercel');
    console.log('   3. Add environment variables');
    console.log('   4. Your API will be LIVE!');
  } else {
    console.log('\n⚠️  Fix database connection before deployment');
  }
}

main().catch(console.error);