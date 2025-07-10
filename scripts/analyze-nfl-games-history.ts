import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeNFLGamesHistory() {
  console.log('🏈 Analyzing NFL Games History in Database...\n');

  // Get overall stats
  const { data: overallStats, error: overallError } = await supabase
    .from('games')
    .select('id, date, external_id, home_team, away_team, home_score, away_score', { count: 'exact' })
    .eq('sport', 'NFL')
    .order('date', { ascending: true });

  if (overallError) {
    console.error('Error fetching overall stats:', overallError);
    return;
  }

  console.log(`Total NFL games in database: ${overallStats?.length || 0}`);
  
  if (overallStats && overallStats.length > 0) {
    console.log(`Earliest game: ${overallStats[0].date} (${overallStats[0].away_team} @ ${overallStats[0].home_team})`);
    console.log(`Latest game: ${overallStats[overallStats.length - 1].date}`);
    console.log(`\nExternal ID format examples:`);
    
    // Show some example external IDs
    const sampleIds = overallStats.slice(0, 5).map(g => ({
      date: g.date,
      external_id: g.external_id,
      teams: `${g.away_team} @ ${g.home_team}`
    }));
    console.table(sampleIds);
  }

  // Analyze by season
  const seasonStats = new Map<number, {
    count: number,
    earliestDate: string,
    latestDate: string,
    externalIdFormats: Set<string>,
    sampleIds: string[]
  }>();

  overallStats?.forEach(game => {
    const gameDate = new Date(game.date);
    // NFL season year is based on when playoffs occur (January games belong to previous year's season)
    const season = gameDate.getMonth() === 0 ? gameDate.getFullYear() - 1 : gameDate.getFullYear();
    
    if (!seasonStats.has(season)) {
      seasonStats.set(season, {
        count: 0,
        earliestDate: game.date,
        latestDate: game.date,
        externalIdFormats: new Set(),
        sampleIds: []
      });
    }
    
    const stats = seasonStats.get(season)!;
    stats.count++;
    if (game.date < stats.earliestDate) stats.earliestDate = game.date;
    if (game.date > stats.latestDate) stats.latestDate = game.date;
    
    // Analyze external_id format
    if (game.external_id) {
      const format = game.external_id.replace(/\d/g, '#').replace(/[a-z]/g, 'x').replace(/[A-Z]/g, 'X');
      stats.externalIdFormats.add(format);
      if (stats.sampleIds.length < 3) {
        stats.sampleIds.push(game.external_id);
      }
    }
  });

  console.log('\n🏈 NFL Games by Season:');
  console.log('Season | Games | Date Range | External ID Formats | Sample IDs');
  console.log('-------|-------|------------|---------------------|------------');
  
  const sortedSeasons = Array.from(seasonStats.entries()).sort((a, b) => a[0] - b[0]);
  
  sortedSeasons.forEach(([season, stats]) => {
    const dateRange = `${stats.earliestDate} to ${stats.latestDate}`;
    const formats = Array.from(stats.externalIdFormats).join(', ');
    const samples = stats.sampleIds.join(', ');
    console.log(`${season}  | ${stats.count.toString().padStart(5)} | ${dateRange} | ${formats} | ${samples}`);
  });

  // Check for external_id consistency
  console.log('\n🔍 External ID Format Analysis:');
  const allFormats = new Map<string, number>();
  overallStats?.forEach(game => {
    if (game.external_id) {
      const format = game.external_id.replace(/\d/g, '#').replace(/[a-z]/g, 'x').replace(/[A-Z]/g, 'X');
      allFormats.set(format, (allFormats.get(format) || 0) + 1);
    }
  });

  console.log('Format Pattern | Count | Percentage');
  console.log('---------------|-------|------------');
  Array.from(allFormats.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([format, count]) => {
      const percentage = ((count / (overallStats?.length || 1)) * 100).toFixed(1);
      console.log(`${format.padEnd(14)} | ${count.toString().padStart(5)} | ${percentage}%`);
    });

  // Show some older game examples
  console.log('\n📅 Oldest NFL Games in Database:');
  const oldestGames = overallStats?.slice(0, 10).map(g => ({
    date: g.date,
    external_id: g.external_id,
    matchup: `${g.away_team} @ ${g.home_team}`,
    score: `${g.away_score}-${g.home_score}`
  }));
  if (oldestGames) {
    console.table(oldestGames);
  }
}

analyzeNFLGamesHistory().catch(console.error);