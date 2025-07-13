import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config({ path: resolve(__dirname, '../.env') });

const execAsync = promisify(exec);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CollectionJob {
  sport: string;
  queries: string[];
  targetCoverage: number;
  batchSize: number;
  priority: number;
}

const COLLECTION_JOBS: CollectionJob[] = [
  {
    sport: 'NBA',
    queries: ['sport.eq.NBA', 'sport_id.eq.nba'],
    targetCoverage: 95,
    batchSize: 500,
    priority: 1
  },
  {
    sport: 'NFL',
    queries: ['sport.eq.NFL', 'sport_id.eq.nfl'],
    targetCoverage: 95,
    batchSize: 300,
    priority: 2
  },
  {
    sport: 'NHL',
    queries: ['sport.eq.NHL', 'sport_id.eq.nhl'],
    targetCoverage: 95,
    batchSize: 400,
    priority: 3
  },
  {
    sport: 'MLB',
    queries: ['sport.eq.MLB', 'sport_id.eq.mlb'],
    targetCoverage: 95,
    batchSize: 300,
    priority: 4
  }
];

async function checkCoverage(job: CollectionJob): Promise<{ coverage: number; needed: number }> {
  const { count: totalGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or(job.queries.join(','))
    .not('home_score', 'is', null);
  
  const { data: sample } = await supabase
    .from('games')
    .select('id')
    .or(job.queries.join(','))
    .not('home_score', 'is', null)
    .limit(200);
  
  if (!sample || sample.length === 0) {
    return { coverage: 0, needed: 0 };
  }
  
  const { data: withStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .in('game_id', sample.map(g => g.id));
  
  const coverage = (new Set(withStats?.map(s => s.game_id) || []).size / sample.length) * 100;
  const estimatedWithStats = Math.round((totalGames || 0) * (coverage / 100));
  const needed = Math.max(0, Math.ceil((totalGames || 0) * (job.targetCoverage / 100)) - estimatedWithStats);
  
  return { coverage, needed };
}

async function runCollector(sport: string, games: number) {
  console.log(`\n🚀 Starting ${sport} collector for ${games} games...`);
  
  try {
    // Run the appropriate collector script
    const script = sport === 'NBA' ? 'ultra-fast-nba-collector.ts' :
                   sport === 'NFL' ? 'rapid-nfl-collector.ts' :
                   sport === 'NHL' ? 'rapid-nhl-collector.ts' :
                   'supercharged-auto-collector.ts';
    
    const { stdout, stderr } = await execAsync(
      `npx tsx scripts/${script}`,
      { cwd: resolve(__dirname, '..') }
    );
    
    console.log(`✅ ${sport} collection completed`);
    
    // Extract stats added from output
    const statsMatch = stdout.match(/Net gain: \+?([\d,]+) stats/);
    if (statsMatch) {
      const statsAdded = parseInt(statsMatch[1].replace(/,/g, ''));
      console.log(`   Added ${statsAdded.toLocaleString()} stats`);
    }
    
  } catch (error: any) {
    console.error(`❌ ${sport} collection failed:`, error.message);
  }
}

async function autoCollectorDaemon() {
  console.log('🤖 AUTO-COLLECTOR DAEMON STARTED');
  console.log('='.repeat(80));
  console.log('This daemon will automatically collect stats to reach 95% coverage\n');
  
  while (true) {
    console.log(`\n⏰ ${new Date().toLocaleString()}`);
    console.log('📊 Checking coverage...\n');
    
    const jobsNeeded: Array<{ job: CollectionJob; coverage: number; needed: number }> = [];
    
    // Check each sport
    for (const job of COLLECTION_JOBS) {
      const { coverage, needed } = await checkCoverage(job);
      console.log(`${job.sport}: ${coverage.toFixed(1)}% coverage (${needed} games needed)`);
      
      if (coverage < job.targetCoverage && needed > 0) {
        jobsNeeded.push({ job, coverage, needed });
      }
    }
    
    if (jobsNeeded.length === 0) {
      console.log('\n🎉 ALL SPORTS HAVE REACHED 95% COVERAGE!');
      console.log('Daemon will continue monitoring...');
    } else {
      // Sort by priority and coverage (lowest coverage first)
      jobsNeeded.sort((a, b) => {
        if (a.job.priority !== b.job.priority) {
          return a.job.priority - b.job.priority;
        }
        return a.coverage - b.coverage;
      });
      
      // Process the highest priority job
      const nextJob = jobsNeeded[0];
      const gamesToProcess = Math.min(nextJob.needed, nextJob.job.batchSize);
      
      console.log(`\n📌 Next job: ${nextJob.job.sport} (${gamesToProcess} games)`);
      
      await runCollector(nextJob.job.sport, gamesToProcess);
    }
    
    // Wait before next cycle
    const waitMinutes = jobsNeeded.length > 0 ? 5 : 30;
    console.log(`\n💤 Waiting ${waitMinutes} minutes before next check...`);
    console.log('(Press Ctrl+C to stop daemon)');
    
    await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Auto-collector daemon stopped');
  process.exit(0);
});

autoCollectorDaemon().catch(console.error);