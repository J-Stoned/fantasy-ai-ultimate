#!/usr/bin/env node
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

console.log('🤖 ANTHROPIC DATABASE QUERY ENGINE');
console.log('🎯 Intelligent Fantasy Baseball Intelligence System\n');

interface QueryResult {
  answer: string;
  sources: string[];
  confidence: string;
  data: any[];
}

class AnthropicDatabaseQuery {
  
  async queryDatabase(userQuestion: string): Promise<QueryResult> {
    console.log(`🔍 Processing question: "${userQuestion}"\n`);
    
    // Step 1: Analyze the question and determine what data to fetch
    const analysisPrompt = `
You are a fantasy baseball expert analyzing a user question to determine what database queries are needed.

User Question: "${userQuestion}"

Available Database Tables:
1. news_articles (title, content, source, published_at, tags, player_ids, team_ids)
2. player_stats (stat_type, stat_value, fantasy_points) 
3. trending_players (player_name, trend_type, platform, mentions_count)
4. social_sentiment (content, score, mentions, sentiment, urgency)
5. video_content (title, channel_name, description, players_mentioned, teams_mentioned, tags)
6. youtube_fantasy_insights (title, channel, players_mentioned, positive_mentions, negative_mentions, injury_mentions, key_insights)

Based on the user question, provide:
1. What type of information they're seeking (prospects, injuries, waiver adds, etc.)
2. Which tables should be queried
3. What filters should be applied (time range, player type, etc.)
4. Key search terms to look for

Format your response as JSON:
{
  "query_type": "prospect_analysis",
  "tables_needed": ["news_articles", "video_content", "social_sentiment"],
  "filters": {
    "time_range": "past_week",
    "player_type": "pitchers",
    "content_keywords": ["prospect", "call up", "promotion", "minor league"]
  },
  "search_focus": "pitching prospects likely for promotion after all-star break"
}
`;

    const analysisResponse = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [{ role: "user", content: analysisPrompt }]
    });

    let analysis;
    try {
      const analysisText = analysisResponse.content[0].type === 'text' 
        ? analysisResponse.content[0].text 
        : '';
      analysis = JSON.parse(analysisText);
    } catch (e) {
      console.error('Failed to parse analysis, using fallback');
      analysis = {
        query_type: "general_fantasy",
        tables_needed: ["news_articles", "video_content", "social_sentiment"],
        filters: { time_range: "past_week" },
        search_focus: userQuestion
      };
    }

    console.log('📊 Query Analysis:', analysis);

    // Step 2: Fetch relevant data from multiple sources
    const data = await this.fetchRelevantData(analysis);
    
    // Step 3: Generate intelligent response using Anthropic
    const responsePrompt = `
You are a fantasy baseball expert providing detailed answers based on database analysis.

User Question: "${userQuestion}"

Database Results:
${JSON.stringify(data, null, 2)}

Based on this data, provide a comprehensive answer that includes:
1. Direct answer to their question with specific player names and details
2. Supporting evidence from the data (which videos, articles, mentions)
3. Confidence level in your assessment
4. Actionable fantasy advice

If asking about prospects or call-ups, rank players and explain likelihood.
If asking about current players, provide current status and recommendations.
Always cite your sources from the data provided.

Format as a detailed, helpful response that a fantasy baseball player would find valuable.
`;

    const responseMessage = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2000,
      messages: [{ role: "user", content: responsePrompt }]
    });

    const answer = responseMessage.content[0].type === 'text' 
      ? responseMessage.content[0].text 
      : 'Unable to generate response';

    // Extract sources and confidence
    const sources = this.extractSources(data);
    const confidence = this.assessConfidence(data);

    return {
      answer,
      sources,
      confidence,
      data: data.slice(0, 10) // Return top 10 data points for reference
    };
  }

  async fetchRelevantData(analysis: any) {
    const results: any[] = [];
    
    try {
      // Query news articles
      if (analysis.tables_needed.includes('news_articles')) {
        console.log('📰 Querying news articles...');
        
        // Special handling for current stats questions
        let newsQuery = supabase.from('news_articles').select('title, content, source, published_at, tags');
        
        if (analysis.search_focus.toLowerCase().includes('home run') || 
            analysis.search_focus.toLowerCase().includes('most home runs')) {
          newsQuery = newsQuery.ilike('title', '%Home Run Leaders%');
        } else {
          newsQuery = newsQuery.ilike('content', `%${analysis.search_focus}%`);
        }
        
        const { data: newsData } = await newsQuery
          .order('published_at', { ascending: false })
          .limit(20);
        
        if (newsData) {
          results.push(...newsData.map(item => ({ ...item, source_type: 'news' })));
        }
      }

      // Query video content 
      if (analysis.tables_needed.includes('video_content')) {
        console.log('📺 Querying video content...');
        const { data: videoData } = await supabase
          .from('video_content')
          .select('title, channel_name, description, players_mentioned, published_at')
          .or(`title.ilike.%${analysis.search_focus}%,description.ilike.%${analysis.search_focus}%`)
          .order('published_at', { ascending: false })
          .limit(50);
        
        if (videoData) {
          results.push(...videoData.map(item => ({ ...item, source_type: 'video' })));
        }
      }

      // Query social sentiment
      if (analysis.tables_needed.includes('social_sentiment')) {
        console.log('💬 Querying social sentiment...');
        const { data: socialData } = await supabase
          .from('social_sentiment')
          .select('content, score, mentions, sentiment, platform')
          .ilike('content', `%${analysis.search_focus}%`)
          .order('created_at', { ascending: false })
          .limit(30);
        
        if (socialData) {
          results.push(...socialData.map(item => ({ ...item, source_type: 'social' })));
        }
      }

      // Query trending players - Always query for current stats questions
      console.log('📈 Querying trending players...');
      let trendingQuery = supabase.from('trending_players').select('player_name, trend_type, platform, mentions_count');
      
      if (analysis.search_focus.toLowerCase().includes('home run') || 
          analysis.search_focus.toLowerCase().includes('most home runs')) {
        trendingQuery = trendingQuery.eq('trend_type', 'home_run_leader');
      }
      
      const { data: trendingData } = await trendingQuery
        .order('mentions_count', { ascending: false })
        .limit(20);
      
      if (trendingData) {
        results.push(...trendingData.map(item => ({ ...item, source_type: 'trending' })));
      }

      // Query player stats for intelligence data
      console.log('📊 Querying player stats...');
      let statsQuery = supabase.from('player_stats').select('stat_type, stat_value, fantasy_points');
      
      if (analysis.search_focus.toLowerCase().includes('home run') || 
          analysis.search_focus.toLowerCase().includes('most home runs')) {
        statsQuery = statsQuery.eq('stat_type', 'current_season_hitting');
      } else {
        statsQuery = statsQuery.eq('stat_type', 'fantasy_intelligence');
      }
      
      const { data: statsData } = await statsQuery.limit(30);
      
      if (statsData) {
        results.push(...statsData.map(item => ({ ...item, source_type: 'stats' })));
      }

    } catch (error) {
      console.error('Database query error:', error);
    }

    console.log(`✅ Fetched ${results.length} relevant data points\n`);
    return results;
  }

  extractSources(data: any[]): string[] {
    const sources = new Set<string>();
    
    data.forEach(item => {
      if (item.source) sources.add(item.source);
      if (item.channel_name) sources.add(item.channel_name);
      if (item.platform) sources.add(item.platform);
    });

    return Array.from(sources).slice(0, 10);
  }

  assessConfidence(data: any[]): string {
    const videoCount = data.filter(d => d.source_type === 'video').length;
    const newsCount = data.filter(d => d.source_type === 'news').length;
    const socialCount = data.filter(d => d.source_type === 'social').length;
    
    const totalSources = videoCount + newsCount + socialCount;
    
    if (totalSources >= 20) return 'High';
    if (totalSources >= 10) return 'Medium';
    if (totalSources >= 5) return 'Low';
    return 'Very Low';
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const question = args.join(' ');
  
  if (!question) {
    console.log('💡 Usage: npx tsx anthropic-database-query.ts "your question here"');
    console.log('\nExample questions:');
    console.log('• "Who are the top 5 pitchers in the minors that could get promoted after the all-star break?"');
    console.log('• "Which players should I add from waivers this week?"');
    console.log('• "Tell me about Juan Soto\'s recent performance"');
    console.log('• "Any injury updates affecting fantasy lineups?"');
    return;
  }

  const queryEngine = new AnthropicDatabaseQuery();
  
  try {
    const result = await queryEngine.queryDatabase(question);
    
    console.log('🎯 ANTHROPIC DATABASE QUERY RESULT\n');
    console.log('=' .repeat(60));
    console.log(`📝 Question: ${question}\n`);
    console.log(`🤖 Answer:\n${result.answer}\n`);
    console.log(`📊 Confidence: ${result.confidence}`);
    console.log(`📚 Sources (${result.sources.length}): ${result.sources.join(', ')}`);
    console.log(`🔍 Data Points Analyzed: ${result.data.length}`);
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Query failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { AnthropicDatabaseQuery };