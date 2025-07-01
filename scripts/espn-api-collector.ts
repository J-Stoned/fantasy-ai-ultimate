import chalk from 'chalk';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ESPN API endpoints (public, no auth required)
const ESPN_API = {
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl',
  SOCCER: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1'
};

let stats = {
  games: 0,
  teams: 0,
  players: 0,
  news: 0,
  insights: 0,
  errors: 0,
  runtime: Date.now()
};

async function collectESPNScores(sport: string, endpoint: string) {
  try {
    // Get current scores
    const scoresResponse = await axios.get(`${endpoint}/scoreboard`);
    const { events } = scoresResponse.data;
    
    if (!events || events.length === 0) return;

    const games = [];
    const insights = [];
    
    for (const event of events) {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayTeam = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) continue;

      // Store game data
      games.push({
        external_id: `espn_${event.id}`,
        sport,
        home_team: homeTeam.team.displayName,
        away_team: awayTeam.team.displayName,
        home_score: parseInt(homeTeam.score) || 0,
        away_score: parseInt(awayTeam.score) || 0,
        status: event.status.type.description,
        game_date: new Date(event.date).toISOString(),
        venue: competition.venue?.fullName || 'Unknown',
        metadata: {
          espn_id: event.id,
          attendance: competition.attendance,
          broadcast: competition.broadcasts?.[0]?.names || []
        }
      });

      // Create insights for close games or upsets
      if (competition.status.type.completed) {
        const homeFavorite = homeTeam.statistics?.find((s: any) => s.name === 'pointSpread')?.displayValue;
        const scoreGap = Math.abs(parseInt(homeTeam.score) - parseInt(awayTeam.score));
        
        if (scoreGap <= 5) {
          insights.push({
            type: 'close_game',
            content: `Nail-biter in ${sport}: ${awayTeam.team.displayName} vs ${homeTeam.team.displayName} ended with just ${scoreGap} points difference`,
            confidence: 0.9,
            source: 'espn',
            metadata: { game_id: event.id, sport }
          });
        }
      }
    }

    // Insert games
    if (games.length > 0) {
      const { error } = await supabase
        .from('games')
        .upsert(games, { onConflict: 'external_id' });
      
      if (error) throw error;
      stats.games += games.length;
    }

    // Insert insights
    if (insights.length > 0) {
      const { error } = await supabase
        .from('ai_insights')
        .insert(insights);
      
      if (error) throw error;
      stats.insights += insights.length;
    }
  } catch (error: any) {
    console.error(chalk.red(`ESPN ${sport} scores error:`, error.message));
    stats.errors++;
  }
}

async function collectESPNNews(sport: string, endpoint: string) {
  try {
    const newsResponse = await axios.get(`${endpoint}/news`);
    const { articles } = newsResponse.data;
    
    if (!articles || articles.length === 0) return;

    const newsArticles = [];
    
    for (const article of articles.slice(0, 20)) { // Limit to 20 articles per sport
      newsArticles.push({
        external_id: `espn_news_${article.id || Date.now()}_${Math.random()}`,
        title: article.headline,
        content: article.description || article.headline,
        summary: (article.description || article.headline).substring(0, 200) + '...',
        author: article.byline || 'ESPN Staff',
        source: `ESPN ${sport}`,
        url: article.links?.web?.href || '',
        published_at: new Date(article.published).toISOString(),
        sentiment_score: 0,
        metadata: {
          sport,
          categories: article.categories || [],
          images: article.images?.[0]?.url
        }
      });
    }

    if (newsArticles.length > 0) {
      const { error } = await supabase
        .from('news_articles')
        .upsert(newsArticles, { onConflict: 'external_id' });
      
      if (error) throw error;
      stats.news += newsArticles.length;
    }
  } catch (error: any) {
    console.error(chalk.red(`ESPN ${sport} news error:`, error.message));
    stats.errors++;
  }
}

async function collectESPNStandings(sport: string, endpoint: string) {
  try {
    const standingsResponse = await axios.get(`${endpoint}/standings`);
    const standings = standingsResponse.data;
    
    if (!standings.children) return;

    const insights = [];
    
    // Analyze standings for insights
    for (const group of standings.children) {
      const entries = group.standings?.entries || [];
      
      // Find surprising performances
      for (const entry of entries) {
        const team = entry.team;
        const stats = entry.stats || [];
        
        const wins = stats.find((s: any) => s.name === 'wins')?.value || 0;
        const losses = stats.find((s: any) => s.name === 'losses')?.value || 0;
        const winPct = wins / (wins + losses);
        
        // Teams performing exceptionally well or poorly
        if (winPct > 0.75 && (wins + losses) > 10) {
          insights.push({
            type: 'team_performance',
            content: `${team.displayName} dominating ${sport} with ${(winPct * 100).toFixed(1)}% win rate`,
            confidence: 0.85,
            source: 'espn_standings',
            metadata: { team: team.displayName, sport, wins, losses }
          });
        }
      }
    }

    if (insights.length > 0) {
      const { error } = await supabase
        .from('ai_insights')
        .insert(insights);
      
      if (error) throw error;
      stats.insights += insights.length;
    }
  } catch (error: any) {
    // Standings might not be available for all sports
  }
}

async function displayStats() {
  const runtime = Math.floor((Date.now() - stats.runtime) / 1000);
  const minutes = Math.floor(runtime / 60);
  const seconds = runtime % 60;
  
  console.clear();
  console.log(chalk.bold.blue('\n📺 ESPN API COLLECTOR'));
  console.log(chalk.gray('=' .repeat(30)));
  console.log(chalk.white(`\n⏱️  Runtime: ${minutes}m ${seconds}s`));
  console.log(chalk.yellow(`⚡ Speed: ${Math.floor((stats.games + stats.news) / (runtime || 1))} records/sec`));
  
  console.log(chalk.white('\n📊 Collection Progress:'));
  console.log(chalk.green(`  🏈 Games: ${stats.games.toLocaleString()}`));
  console.log(chalk.cyan(`  🏢 Teams: ${stats.teams.toLocaleString()}`));
  console.log(chalk.blue(`  📰 News: ${stats.news.toLocaleString()}`));
  console.log(chalk.magenta(`  💡 Insights: ${stats.insights.toLocaleString()}`));
  console.log(chalk.red(`  ❌ Errors: ${stats.errors}`));
  
  console.log(chalk.yellow(`\n🔥 Total Records: ${(stats.games + stats.news + stats.insights).toLocaleString()}`));
  
  console.log(chalk.gray('\n📡 Collecting from ESPN API...'));
}

async function collectAllSports() {
  console.log(chalk.green('🚀 Starting ESPN API collection...'));
  
  while (true) {
    // Collect from each sport
    for (const [sport, endpoint] of Object.entries(ESPN_API)) {
      await collectESPNScores(sport, endpoint);
      await delay(1000);
      
      await collectESPNNews(sport, endpoint);
      await delay(1000);
      
      await collectESPNStandings(sport, endpoint);
      await delay(1000);
      
      displayStats();
    }
    
    // Wait before next cycle
    console.log(chalk.gray('\n⏳ Waiting 2 minutes before next cycle...'));
    await delay(120000); // 2 minutes
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down ESPN collector...'));
  displayStats();
  process.exit(0);
});

// Start collection
collectAllSports().catch(console.error);