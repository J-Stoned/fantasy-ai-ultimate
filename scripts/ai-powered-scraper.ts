#!/usr/bin/env tsx
/**
 * 🤖 AI-POWERED SCRAPER - Uses OpenAI to intelligently scrape and analyze data
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: '.env.local' });

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Stats tracking
const stats = {
  articles: 0,
  insights: 0,
  predictions: 0,
  analyses: 0,
  errors: 0,
  startTime: Date.now()
};

// 📰 SCRAPE AND ANALYZE ESPN
async function scrapeESPNWithAI() {
  console.log('🤖 AI-powered ESPN scraping...');
  
  try {
    // Scrape ESPN headlines
    const response = await axios.get('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news');
    const articles = response.data.articles || [];
    
    for (const article of articles.slice(0, 10)) { // Process top 10 articles
      // Use OpenAI to analyze the article
      const analysisPrompt = `
        Analyze this sports news article for fantasy football relevance:
        
        Title: ${article.headline}
        Description: ${article.description || 'No description'}
        
        Extract and provide:
        1. Player names mentioned (if any)
        2. Team names mentioned
        3. Fantasy impact score (0-10)
        4. Key takeaways for fantasy managers
        5. Injury information (if any)
        6. Trade/roster move information (if any)
        
        Format as JSON.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a fantasy sports expert analyst." },
          { role: "user", content: analysisPrompt }
        ],
        temperature: 0.3,
      });
      
      const analysis = completion.choices[0].message?.content;
      
      if (analysis) {
        try {
          const parsed = JSON.parse(analysis);
          
          // Store the enhanced article
          await supabase.from('news_articles').insert({
            title: article.headline,
            content: article.description || 'Click to read full article',
            url: article.links.web.href,
            source: 'ESPN (AI-Enhanced)',
            published_at: article.published,
            fantasy_relevance: parsed.fantasy_impact_score,
            player_mentions: parsed.player_names || [],
            team_mentions: parsed.team_names || []
          });
          
          stats.articles++;
          
          // Create AI insight if high fantasy relevance
          if (parsed.fantasy_impact_score >= 7) {
            await supabase.from('ai_insights').insert({
              insight_type: 'news_analysis',
              subject: article.headline,
              analysis: JSON.stringify(parsed.key_takeaways),
              confidence_score: parsed.fantasy_impact_score / 10,
              data_sources: ['ESPN'],
              recommendations: {
                injury_info: parsed.injury_information,
                roster_moves: parsed.trade_roster_info
              }
            });
            
            stats.insights++;
          }
        } catch (e) {
          console.error('Failed to parse AI response');
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ ESPN scraping error:', error.message);
    stats.errors++;
  }
}

// 🏈 GENERATE GAME PREDICTIONS
async function generateGamePredictions() {
  console.log('🤖 Generating AI game predictions...');
  
  try {
    // Get upcoming games
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'scheduled')
      .gte('start_time', new Date().toISOString())
      .limit(10);
    
    if (!games) return;
    
    for (const game of games) {
      // Get team stats and recent performance
      const { data: homeGames } = await supabase
        .from('games')
        .select('home_score, away_score')
        .eq('home_team_id', game.home_team_id)
        .eq('status', 'completed')
        .limit(5);
      
      const { data: awayGames } = await supabase
        .from('games')
        .select('home_score, away_score')
        .eq('away_team_id', game.away_team_id)
        .eq('status', 'completed')
        .limit(5);
      
      // Use AI to predict the game
      const predictionPrompt = `
        Analyze this upcoming game and provide predictions:
        
        Home Team ID: ${game.home_team_id}
        Recent home scores: ${JSON.stringify(homeGames || [])}
        
        Away Team ID: ${game.away_team_id}
        Recent away scores: ${JSON.stringify(awayGames || [])}
        
        Provide:
        1. Predicted winner
        2. Predicted score (home-away)
        3. Total points over/under
        4. Key fantasy players to watch
        5. Weather impact (if outdoor venue)
        6. Confidence level (0-100%)
        
        Format as JSON.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are an expert sports analyst and predictor." },
          { role: "user", content: predictionPrompt }
        ],
        temperature: 0.4,
      });
      
      const prediction = completion.choices[0].message?.content;
      
      if (prediction) {
        try {
          const parsed = JSON.parse(prediction);
          
          await supabase.from('ai_insights').insert({
            insight_type: 'game_prediction',
            subject: `Game ${game.id}: Team ${game.home_team_id} vs Team ${game.away_team_id}`,
            analysis: prediction,
            confidence_score: (parsed.confidence_level || 50) / 100,
            data_sources: ['historical_games', 'ai_analysis'],
            recommendations: {
              predicted_winner: parsed.predicted_winner,
              predicted_score: parsed.predicted_score,
              fantasy_players: parsed.key_fantasy_players,
              total_points: parsed.total_points_over_under
            }
          });
          
          stats.predictions++;
        } catch (e) {
          console.error('Failed to parse prediction');
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Prediction error:', error.message);
    stats.errors++;
  }
}

// 🎯 ANALYZE PLAYER PERFORMANCE TRENDS
async function analyzePlayerTrends() {
  console.log('🤖 Analyzing player trends with AI...');
  
  try {
    // Get top players by recent stats
    const { data: topPlayers } = await supabase
      .from('players')
      .select('id, firstname, lastname, position')
      .eq('sport_id', 'nfl')
      .limit(20);
    
    if (!topPlayers) return;
    
    for (const player of topPlayers) {
      // Get player's recent stats
      const { data: stats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (!stats || stats.length === 0) continue;
      
      // Use AI to analyze trends
      const trendPrompt = `
        Analyze this player's recent performance:
        
        Player: ${player.firstname} ${player.lastname} (${player.position})
        Recent stats: ${JSON.stringify(stats)}
        
        Provide:
        1. Performance trend (improving/declining/stable)
        2. Fantasy value assessment (buy/sell/hold)
        3. Projected next game performance
        4. Injury risk assessment
        5. Key strengths and weaknesses
        6. Similar player comparisons
        
        Format as JSON.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a fantasy football analyst specializing in player evaluation." },
          { role: "user", content: trendPrompt }
        ],
        temperature: 0.3,
      });
      
      const analysis = completion.choices[0].message?.content;
      
      if (analysis) {
        try {
          const parsed = JSON.parse(analysis);
          
          await supabase.from('ai_insights').insert({
            insight_type: 'player_analysis',
            subject: `${player.firstname} ${player.lastname}`,
            analysis: analysis,
            confidence_score: 0.8,
            data_sources: ['player_stats', 'ai_analysis'],
            recommendations: {
              trend: parsed.performance_trend,
              fantasy_action: parsed.fantasy_value_assessment,
              projection: parsed.projected_next_game,
              comparisons: parsed.similar_player_comparisons
            }
          });
          
          stats.analyses++;
        } catch (e) {
          console.error('Failed to parse player analysis');
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Player analysis error:', error.message);
    stats.errors++;
  }
}

// 🌍 SCRAPE REDDIT WITH AI SENTIMENT ANALYSIS
async function scrapeRedditWithAI() {
  console.log('🤖 AI-powered Reddit sentiment analysis...');
  
  try {
    const response = await axios.get('https://www.reddit.com/r/fantasyfootball/hot.json?limit=25', {
      headers: { 'User-Agent': 'FantasyAI/2.0' }
    });
    
    const posts = response.data.data.children;
    
    for (const post of posts.slice(0, 10)) {
      const postData = post.data;
      
      // Use AI for sentiment analysis
      const sentimentPrompt = `
        Analyze this Reddit post for fantasy football insights:
        
        Title: ${postData.title}
        Score: ${postData.score} upvotes
        Comments: ${postData.num_comments}
        
        Extract:
        1. Overall sentiment (positive/negative/neutral)
        2. Player names mentioned
        3. Key insights or advice
        4. Credibility score (0-10)
        5. Actionable takeaways
        
        Format as JSON.
      `;
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are analyzing Reddit posts for fantasy football insights." },
          { role: "user", content: sentimentPrompt }
        ],
        temperature: 0.3,
      });
      
      const sentiment = completion.choices[0].message?.content;
      
      if (sentiment) {
        try {
          const parsed = JSON.parse(sentiment);
          
          await supabase.from('social_sentiment').insert({
            platform: 'reddit',
            content: postData.title,
            author: postData.author,
            score: postData.score,
            url: `https://reddit.com${postData.permalink}`,
            sport_id: 'nfl',
            mentions: parsed.player_names || [],
            sentiment_score: parsed.credibility_score / 10,
            external_id: `reddit_ai_${postData.id}`
          });
          
          // Create insight for high-value posts
          if (parsed.credibility_score >= 7 && parsed.actionable_takeaways) {
            await supabase.from('ai_insights').insert({
              insight_type: 'community_wisdom',
              subject: postData.title,
              analysis: JSON.stringify(parsed),
              confidence_score: parsed.credibility_score / 10,
              data_sources: ['reddit'],
              recommendations: {
                takeaways: parsed.actionable_takeaways,
                sentiment: parsed.overall_sentiment
              }
            });
            
            stats.insights++;
          }
        } catch (e) {
          console.error('Failed to parse Reddit sentiment');
        }
      }
    }
    
  } catch (error: any) {
    console.error('❌ Reddit scraping error:', error.message);
    stats.errors++;
  }
}

// 📊 SHOW STATS
function showStats() {
  const runtime = Math.floor((Date.now() - stats.startTime) / 1000);
  const total = stats.articles + stats.insights + stats.predictions + stats.analyses;
  
  console.clear();
  console.log('🤖 AI-POWERED SCRAPER STATS');
  console.log('===========================\n');
  
  console.log(`⏱️  Runtime: ${Math.floor(runtime / 60)}m ${runtime % 60}s`);
  console.log(`📈 Total processed: ${total.toLocaleString()}\n`);
  
  console.log('📊 AI Analysis Breakdown:');
  console.log(`  📰 Articles analyzed: ${stats.articles.toLocaleString()}`);
  console.log(`  💡 Insights generated: ${stats.insights.toLocaleString()}`);
  console.log(`  🎯 Game predictions: ${stats.predictions.toLocaleString()}`);
  console.log(`  📈 Player analyses: ${stats.analyses.toLocaleString()}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  
  console.log('\n🔌 API Status:');
  console.log(`  ${process.env.OPENAI_API_KEY ? '✅' : '❌'} OpenAI: ${process.env.OPENAI_API_KEY ? 'Connected' : 'No API key'}`);
}

// 🚀 MAIN EXECUTION
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OpenAI API key not found! Add OPENAI_API_KEY to .env.local');
    return;
  }
  
  console.log('🤖 Starting AI-powered data collection...\n');
  
  // Test database
  const { error } = await supabase.from('ai_insights').select('count').limit(1);
  if (error) {
    console.error('❌ Database error. Run create-real-data-tables.sql first!');
    return;
  }
  
  console.log('✅ Database connected!\n');
  
  // Run all AI scrapers
  await scrapeESPNWithAI();
  await generateGamePredictions();
  await analyzePlayerTrends();
  await scrapeRedditWithAI();
  
  // Show stats
  showStats();
  
  // Schedule recurring AI analysis
  console.log('\n📅 Scheduling AI analysis...');
  
  // Every 30 minutes
  setInterval(async () => {
    await scrapeESPNWithAI();
    await scrapeRedditWithAI();
  }, 30 * 60 * 1000);
  
  // Every hour
  setInterval(async () => {
    await generateGamePredictions();
    await analyzePlayerTrends();
  }, 60 * 60 * 1000);
  
  // Update display every minute
  setInterval(showStats, 60000);
  
  console.log('✅ AI-powered scraping active!\n');
  console.log('The AI is analyzing data and generating insights...\n');
}

// Handle shutdown
process.on('SIGINT', () => {
  showStats();
  console.log('\n\n🤖 AI scraper shutting down...');
  process.exit(0);
});

// Start AI scraping
main().catch(console.error);