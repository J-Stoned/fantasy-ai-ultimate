#!/usr/bin/env tsx
/**
 * 🔗 CROSS-REFERENCE ANALYSIS SYSTEM
 * Finds hidden connections and patterns across multiple data sources
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CrossReferenceInsight {
  type: string;
  confidence: number;
  impact: string;
  dataPoints: any[];
  recommendation: string;
}

class CrossReferenceAnalyzer {
  private insights: CrossReferenceInsight[] = [];
  
  async analyze() {
    console.log(chalk.cyan.bold('\n🔗 CROSS-REFERENCE ANALYSIS SYSTEM\n'));
    console.log(chalk.yellow('Analyzing connections across all data sources...\n'));
    
    await Promise.all([
      this.analyzeNewsToMarketMovement(),
      this.analyzeWeatherToInjuries(),
      this.analyzeSocialToPerformance(),
      this.analyzeScheduleAdvantages(),
      this.analyzeTeamTravelPatterns(),
      this.analyzeMediaBias(),
      this.analyzeValuePlays(),
      this.analyzeContrarianOpportunities()
    ]);
    
    this.displayTopInsights();
  }
  
  // News mentions → ownership changes
  async analyzeNewsToMarketMovement() {
    console.log(chalk.yellow('📰 Analyzing news impact on player ownership...'));
    
    try {
      // Get recent news and trending players
      const { data: news } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(500);
      
      const { data: trending } = await supabase
        .from('trending_players')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (!news || !trending) return;
      
      // Find players mentioned in news who also trended
      const playerMentions: Record<string, { newsCount: number, trendCount: number, avgChange: number }> = {};
      
      news.forEach(article => {
        // Extract player names from title and summary
        const text = `${article.title} ${article.summary || ''}`;
        const playerPattern = /([A-Z][a-z]+ [A-Z][a-z]+)/g;
        const mentions = text.match(playerPattern) || [];
        
        mentions.forEach(player => {
          if (!playerMentions[player]) {
            playerMentions[player] = { newsCount: 0, trendCount: 0, avgChange: 0 };
          }
          playerMentions[player].newsCount++;
        });
      });
      
      // Cross-reference with trending data
      trending.forEach(trend => {
        if (playerMentions[trend.player_name]) {
          playerMentions[trend.player_name].trendCount++;
          playerMentions[trend.player_name].avgChange += trend.ownership_change;
        }
      });
      
      // Find strong correlations
      Object.entries(playerMentions).forEach(([player, data]) => {
        if (data.newsCount > 3 && data.trendCount > 0) {
          const avgChange = data.avgChange / data.trendCount;
          
          if (Math.abs(avgChange) > 500) {
            this.insights.push({
              type: 'News-Driven Ownership',
              confidence: Math.min(data.newsCount / 10, 0.9),
              impact: avgChange > 0 ? 'positive' : 'negative',
              dataPoints: [
                { player, newsCount: data.newsCount, avgChange }
              ],
              recommendation: `${player}: ${data.newsCount} news mentions → ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(0)} avg ownership change`
            });
          }
        }
      });
      
    } catch (error) {
      console.error(chalk.red('News analysis error:', error.message));
    }
  }
  
  // Weather patterns → injury rates
  async analyzeWeatherToInjuries() {
    console.log(chalk.yellow('🌡️ Analyzing weather impact on injuries...'));
    
    try {
      const { data: injuries } = await supabase
        .from('injuries')
        .select('*, players!inner(team_id)')
        .order('reported_date', { ascending: false })
        .limit(200);
      
      const { data: weather } = await supabase
        .from('weather_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (!injuries || !weather) return;
      
      // Group injuries by weather conditions
      const weatherInjuries: Record<string, number> = {};
      const weatherGames: Record<string, number> = {};
      
      // Simplified analysis - look for extreme weather
      weather.forEach(w => {
        const isExtreme = w.temperature < 32 || w.temperature > 85 || w.wind_speed > 20;
        if (isExtreme) {
          const key = w.temperature < 32 ? 'cold' : w.temperature > 85 ? 'hot' : 'windy';
          weatherGames[key] = (weatherGames[key] || 0) + 1;
        }
      });
      
      // Check injury dates against weather
      injuries.forEach(injury => {
        const injuryDate = new Date(injury.reported_date);
        const relevantWeather = weather.find(w => {
          const weatherDate = new Date(w.created_at);
          return Math.abs(weatherDate.getTime() - injuryDate.getTime()) < 24 * 60 * 60 * 1000;
        });
        
        if (relevantWeather) {
          const isExtreme = relevantWeather.temperature < 32 || relevantWeather.temperature > 85 || relevantWeather.wind_speed > 20;
          if (isExtreme) {
            const key = relevantWeather.temperature < 32 ? 'cold' : relevantWeather.temperature > 85 ? 'hot' : 'windy';
            weatherInjuries[key] = (weatherInjuries[key] || 0) + 1;
          }
        }
      });
      
      // Calculate injury rates
      Object.keys(weatherGames).forEach(condition => {
        const injuryRate = (weatherInjuries[condition] || 0) / weatherGames[condition];
        const baseRate = injuries.length / weather.length;
        const increase = ((injuryRate / baseRate) - 1) * 100;
        
        if (Math.abs(increase) > 20) {
          this.insights.push({
            type: 'Weather-Injury Correlation',
            confidence: 0.7,
            impact: increase > 0 ? 'negative' : 'positive',
            dataPoints: [
              { condition, injuryRate, increase }
            ],
            recommendation: `${condition.charAt(0).toUpperCase() + condition.slice(1)} weather: ${increase > 0 ? '+' : ''}${increase.toFixed(0)}% injury risk`
          });
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Weather-injury analysis error:', error.message));
    }
  }
  
  // Social sentiment → actual performance
  async analyzeSocialToPerformance() {
    console.log(chalk.yellow('💭 Analyzing social sentiment accuracy...'));
    
    try {
      const { data: sentiment } = await supabase
        .from('social_sentiment')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(500);
      
      if (!sentiment || !games) return;
      
      // Group sentiment by team mentions
      const teamSentiment: Record<string, { positive: number, negative: number, neutral: number }> = {};
      
      sentiment.forEach(post => {
        const mentions = post.mentions || [];
        mentions.forEach(mention => {
          // Simple team detection from mentions
          const teamKeywords = ['Chiefs', 'Bills', 'Eagles', 'Cowboys', 'Packers', '49ers', 'Ravens'];
          const team = teamKeywords.find(t => mention.includes(t));
          
          if (team) {
            if (!teamSentiment[team]) {
              teamSentiment[team] = { positive: 0, negative: 0, neutral: 0 };
            }
            teamSentiment[team][post.sentiment || 'neutral']++;
          }
        });
      });
      
      // Calculate sentiment accuracy
      Object.entries(teamSentiment).forEach(([team, sentiment]) => {
        const total = sentiment.positive + sentiment.negative + sentiment.neutral;
        if (total > 20) {
          const positiveRate = sentiment.positive / total;
          const negativeRate = sentiment.negative / total;
          
          if (positiveRate > 0.6 || negativeRate > 0.6) {
            this.insights.push({
              type: 'Social Sentiment Signal',
              confidence: 0.6,
              impact: positiveRate > negativeRate ? 'positive' : 'negative',
              dataPoints: [
                { team, sentiment, positiveRate, negativeRate }
              ],
              recommendation: `${team}: ${(positiveRate * 100).toFixed(0)}% positive sentiment (${total} mentions)`
            });
          }
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Sentiment analysis error:', error.message));
    }
  }
  
  // Schedule analysis for hidden advantages
  async analyzeScheduleAdvantages() {
    console.log(chalk.yellow('📅 Analyzing schedule-based advantages...'));
    
    try {
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .order('start_time', { ascending: true })
        .limit(1000);
      
      if (!games || games.length === 0) return;
      
      // Find teams with favorable scheduling
      const teamSchedules: Record<string, { 
        backToBack: number, 
        longRest: number, 
        primeTime: number,
        earlyGames: number 
      }> = {};
      
      // Sort games by date
      const sortedGames = games.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      
      // Track last game for each team
      const lastGame: Record<string, Date> = {};
      
      sortedGames.forEach(game => {
        const gameDate = new Date(game.start_time);
        const hour = gameDate.getHours();
        
        // Process home team
        if (!teamSchedules[game.home_team_id]) {
          teamSchedules[game.home_team_id] = { 
            backToBack: 0, longRest: 0, primeTime: 0, earlyGames: 0 
          };
        }
        
        if (lastGame[game.home_team_id]) {
          const daysSince = (gameDate.getTime() - lastGame[game.home_team_id].getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince <= 4) teamSchedules[game.home_team_id].backToBack++;
          if (daysSince >= 10) teamSchedules[game.home_team_id].longRest++;
        }
        
        if (hour >= 19) teamSchedules[game.home_team_id].primeTime++;
        if (hour <= 13) teamSchedules[game.home_team_id].earlyGames++;
        
        lastGame[game.home_team_id] = gameDate;
        
        // Process away team
        if (!teamSchedules[game.away_team_id]) {
          teamSchedules[game.away_team_id] = { 
            backToBack: 0, longRest: 0, primeTime: 0, earlyGames: 0 
          };
        }
        
        if (lastGame[game.away_team_id]) {
          const daysSince = (gameDate.getTime() - lastGame[game.away_team_id].getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince <= 4) teamSchedules[game.away_team_id].backToBack++;
          if (daysSince >= 10) teamSchedules[game.away_team_id].longRest++;
        }
        
        if (hour >= 19) teamSchedules[game.away_team_id].primeTime++;
        if (hour <= 13) teamSchedules[game.away_team_id].earlyGames++;
        
        lastGame[game.away_team_id] = gameDate;
      });
      
      // Find teams with extreme schedules
      Object.entries(teamSchedules).forEach(([team, schedule]) => {
        const totalGames = schedule.backToBack + schedule.longRest + 10; // Approximate
        
        if (schedule.backToBack > 3) {
          this.insights.push({
            type: 'Schedule Disadvantage',
            confidence: 0.8,
            impact: 'negative',
            dataPoints: [{ team, schedule }],
            recommendation: `Team ${team}: ${schedule.backToBack} short rest games - fatigue risk`
          });
        }
        
        if (schedule.longRest > 3) {
          this.insights.push({
            type: 'Schedule Advantage',
            confidence: 0.8,
            impact: 'positive',
            dataPoints: [{ team, schedule }],
            recommendation: `Team ${team}: ${schedule.longRest} long rest games - freshness advantage`
          });
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Schedule analysis error:', error.message));
    }
  }
  
  // Travel pattern analysis
  async analyzeTeamTravelPatterns() {
    console.log(chalk.yellow('✈️ Analyzing team travel patterns...'));
    
    try {
      const { data: games } = await supabase
        .from('games')
        .select('*, venues!inner(*)')
        .order('start_time', { ascending: true })
        .limit(500);
      
      if (!games || games.length === 0) return;
      
      // Calculate travel miles (simplified using time zones)
      const teamTravel: Record<string, number> = {};
      const timezoneMap: Record<string, number> = {
        'CA': -8, 'WA': -8, 'NV': -8,
        'AZ': -7, 'CO': -7,
        'TX': -6, 'MO': -6, 'IL': -6, 'MN': -6, 'WI': -6, 'LA': -6,
        'NY': -5, 'PA': -5, 'FL': -5, 'MA': -5, 'MD': -5, 'GA': -5,
        'NC': -5, 'OH': -5, 'MI': -5, 'IN': -5, 'TN': -5
      };
      
      games.forEach(game => {
        if (game.venues && game.venues.metadata?.state) {
          const venueTz = timezoneMap[game.venues.metadata.state] || -5;
          
          // Away team travels
          teamTravel[game.away_team_id] = (teamTravel[game.away_team_id] || 0) + 1;
        }
      });
      
      // Find teams with heavy travel
      Object.entries(teamTravel).forEach(([team, trips]) => {
        if (trips > 10) {
          this.insights.push({
            type: 'Heavy Travel Schedule',
            confidence: 0.7,
            impact: 'negative',
            dataPoints: [{ team, trips }],
            recommendation: `Team ${team}: ${trips} road games - consider fatigue in late season`
          });
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Travel analysis error:', error.message));
    }
  }
  
  // Media coverage bias
  async analyzeMediaBias() {
    console.log(chalk.yellow('📺 Analyzing media coverage bias...'));
    
    try {
      const { data: news } = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(1000);
      
      if (!news || news.length === 0) return;
      
      // Count mentions by team/player
      const coverageCount: Record<string, number> = {};
      const sources: Record<string, Set<string>> = {};
      
      news.forEach(article => {
        const text = `${article.title} ${article.summary || ''}`;
        
        // Popular teams/players
        const popularEntities = [
          'Chiefs', 'Cowboys', 'Patriots', 'Packers', '49ers',
          'Mahomes', 'Dak', 'Rodgers', 'Brady', 'Allen'
        ];
        
        popularEntities.forEach(entity => {
          if (text.includes(entity)) {
            coverageCount[entity] = (coverageCount[entity] || 0) + 1;
            if (!sources[entity]) sources[entity] = new Set();
            sources[entity].add(article.source);
          }
        });
      });
      
      // Find overexposed entities
      const avgCoverage = Object.values(coverageCount).reduce((a, b) => a + b, 0) / Object.keys(coverageCount).length;
      
      Object.entries(coverageCount).forEach(([entity, count]) => {
        if (count > avgCoverage * 2) {
          this.insights.push({
            type: 'Media Overexposure',
            confidence: 0.8,
            impact: 'negative',
            dataPoints: [{ entity, count, sources: sources[entity].size }],
            recommendation: `${entity}: ${count} mentions (${(count/avgCoverage).toFixed(1)}x average) - likely overvalued`
          });
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Media bias analysis error:', error.message));
    }
  }
  
  // Find value plays
  async analyzeValuePlays() {
    console.log(chalk.yellow('💎 Finding undervalued opportunities...'));
    
    try {
      // Get players with good stats but low ownership
      const { data: players } = await supabase
        .from('players')
        .select('*')
        .eq('active', true)
        .limit(500);
      
      const { data: trending } = await supabase
        .from('trending_players')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (!players || !trending) return;
      
      // Find players NOT trending
      const trendingNames = new Set(trending.map(t => t.player_name));
      const underRadar = players.filter(p => !trendingNames.has(p.name));
      
      // Simple value metric
      underRadar.forEach(player => {
        if (player.metadata?.draft_round && player.metadata.draft_round <= 3) {
          this.insights.push({
            type: 'Hidden Value',
            confidence: 0.6,
            impact: 'positive',
            dataPoints: [{ player: player.name, round: player.metadata.draft_round }],
            recommendation: `${player.name}: Round ${player.metadata.draft_round} pick with no recent buzz`
          });
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Value analysis error:', error.message));
    }
  }
  
  // Contrarian opportunities
  async analyzeContrarianOpportunities() {
    console.log(chalk.yellow('🎯 Finding contrarian plays...'));
    
    try {
      const { data: sentiment } = await supabase
        .from('social_sentiment')
        .select('*')
        .eq('sentiment', 'negative')
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (!sentiment || sentiment.length === 0) return;
      
      // Count negative mentions
      const negativePlayers: Record<string, number> = {};
      
      sentiment.forEach(post => {
        (post.mentions || []).forEach(player => {
          negativePlayers[player] = (negativePlayers[player] || 0) + 1;
        });
      });
      
      // High negative sentiment = contrarian opportunity
      Object.entries(negativePlayers).forEach(([player, count]) => {
        if (count > 5) {
          this.insights.push({
            type: 'Contrarian Opportunity',
            confidence: 0.5,
            impact: 'positive',
            dataPoints: [{ player, negativeCount: count }],
            recommendation: `${player}: ${count} negative mentions - potential buy-low candidate`
          });
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Contrarian analysis error:', error.message));
    }
  }
  
  private displayTopInsights() {
    console.log(chalk.green.bold('\n🎯 TOP CROSS-REFERENCE INSIGHTS:\n'));
    
    // Sort by confidence
    const sorted = this.insights.sort((a, b) => b.confidence - a.confidence);
    
    // Group by type
    const byType: Record<string, CrossReferenceInsight[]> = {};
    sorted.forEach(insight => {
      if (!byType[insight.type]) byType[insight.type] = [];
      byType[insight.type].push(insight);
    });
    
    // Display top insights by category
    Object.entries(byType).forEach(([type, insights]) => {
      console.log(chalk.cyan.bold(`\n${type}:`));
      
      insights.slice(0, 3).forEach(insight => {
        const emoji = insight.impact === 'positive' ? '✅' : 
                      insight.impact === 'negative' ? '⚠️' : '💡';
        console.log(`${emoji} ${insight.recommendation}`);
        console.log(chalk.gray(`   Confidence: ${(insight.confidence * 100).toFixed(0)}%\n`));
      });
    });
    
    console.log(chalk.green.bold(`\n✨ Total insights discovered: ${this.insights.length}`));
  }
}

// Main execution
async function main() {
  const analyzer = new CrossReferenceAnalyzer();
  await analyzer.analyze();
}

main().catch(console.error);