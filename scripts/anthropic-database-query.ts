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

interface CacheEntry {
  result: QueryResult;
  timestamp: number;
  ttl: number;
}

class AnthropicDatabaseQuery {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly AI_CACHE_TTL = 60 * 60 * 1000; // 1 hour
  
  // Fast-path patterns for common queries
  private readonly FAST_PATTERNS = {
    homeRunLeaders: /who.*most.*home.*runs?|home.*run.*lead|hr.*lead/i,
    rbiLeaders: /who.*most.*rbi|rbi.*lead/i,
    battingAverageLeaders: /who.*highest.*average|batting.*average.*lead/i,
    runsLeaders: /who.*most.*runs?|runs.*lead|r.*lead(?!.*pitcher)/i,
    opsLeaders: /who.*highest.*ops|ops.*lead|best.*ops/i,
    stolenBaseLeaders: /who.*most.*stolen.*bases?|stolen.*base.*lead|sb.*lead/i,
    doublesLeaders: /who.*most.*doubles?|doubles.*lead|2b.*lead/i,
    walkLeaders: /who.*most.*walks?|walk.*lead|bb.*lead/i,
    hitsLeaders: /who.*most.*hits?|hits.*lead|h.*lead(?!.*pitcher)/i,
    pitchingWinsLeaders: /who.*most.*wins?|pitcher.*most.*wins?|pitching.*wins.*lead|wins.*lead.*pitcher/i,
    strikeoutLeaders: /who.*most.*strikeouts?|strikeout.*lead|k.*lead.*pitcher/i,
    eraLeaders: /who.*lowest.*era|era.*lead|best.*era/i,
    savesLeaders: /who.*most.*saves?|saves.*lead|closer.*lead/i,
    currentStats: /current.*stats|latest.*stats|recent.*performance/i
  };
  
  async queryDatabase(userQuestion: string): Promise<QueryResult> {
    const totalStartTime = Date.now();
    console.log(`🔍 Processing question: "${userQuestion}"\n`);
    
    // Check cache first
    const cacheKey = this.generateCacheKey(userQuestion);
    console.log(`🔑 Cache key: ${cacheKey}`);
    console.log(`📊 Cache size: ${this.cache.size}`);
    
    const cachedResult = this.getCachedResult(cacheKey);
    
    if (cachedResult) {
      const cacheTime = Date.now() - totalStartTime;
      console.log(`⚡ Cache hit! Response served in ${cacheTime}ms\n`);
      return cachedResult;
    }
    
    console.log('🔄 Cache miss - processing fresh query...');
    
    // Check for fast-path patterns first
    const fastResult = await this.tryFastPath(userQuestion);
    if (fastResult) {
      const fastTime = Date.now() - totalStartTime;
      console.log(`⚡ Fast-path response generated in ${fastTime}ms\n`);
      
      // Cache fast results too
      this.setCachedResult(cacheKey, fastResult, this.AI_CACHE_TTL);
      return fastResult;
    }
    
    console.log('🔄 No fast-path match - using full AI analysis...');
    
    // Step 1: Analyze the question and determine what data to fetch
    const analysisStartTime = Date.now();
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

    const analysisTime = Date.now() - analysisStartTime;
    console.log(`🧠 Query analysis completed in ${analysisTime}ms`);
    console.log('📊 Query Analysis:', analysis);

    // Step 2: Fetch relevant data from multiple sources
    const data = await this.fetchRelevantData(analysis);
    
    // Step 3: Generate intelligent response using Anthropic
    const responseStartTime = Date.now();
    // Optimize data payload for AI - extract key information and reduce size
    const compactData = this.compactDataForAI(data);
    
    const responsePrompt = `
You are a fantasy baseball expert providing detailed answers based on database analysis.

User Question: "${userQuestion}"

Database Results (${data.length} total records):
${JSON.stringify(compactData, null, 2)}

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

    const responseTime = Date.now() - responseStartTime;
    const totalTime = Date.now() - totalStartTime;
    
    console.log(`🤖 AI response generated in ${responseTime}ms`);
    console.log(`⚡ Total query time: ${totalTime}ms\n`);

    // Extract sources and confidence
    const sources = this.extractSources(data);
    const confidence = this.assessConfidence(data);

    const result: QueryResult = {
      answer,
      sources,
      confidence,
      data: data.slice(0, 10) // Return top 10 data points for reference
    };

    // Cache the result
    this.setCachedResult(cacheKey, result, this.AI_CACHE_TTL);
    console.log(`💾 Result cached with key: ${cacheKey} (TTL: ${this.AI_CACHE_TTL}ms)`);

    return result;
  }

  async fetchRelevantData(analysis: any) {
    const startTime = Date.now();
    console.log('🚀 Starting parallel database queries...');
    
    try {
      // Prepare all queries in parallel based on analysis
      const queries: Promise<any>[] = [];
      const queryTypes: string[] = [];

      // News articles query
      if (analysis.tables_needed.includes('news_articles')) {
        let newsQuery = supabase.from('news_articles').select('title, content, source, published_at, tags');
        
        if (analysis.search_focus.toLowerCase().includes('home run') || 
            analysis.search_focus.toLowerCase().includes('most home runs')) {
          newsQuery = newsQuery.ilike('title', '%Home Run Leaders%');
        } else {
          newsQuery = newsQuery.ilike('content', `%${analysis.search_focus}%`);
        }
        
        queries.push(newsQuery.order('published_at', { ascending: false }).limit(10));
        queryTypes.push('news');
      }

      // Video content query
      if (analysis.tables_needed.includes('video_content')) {
        const videoQuery = supabase
          .from('video_content')
          .select('title, channel_name, description, players_mentioned, published_at')
          .or(`title.ilike.%${analysis.search_focus}%,description.ilike.%${analysis.search_focus}%`)
          .order('published_at', { ascending: false })
          .limit(20);
        
        queries.push(videoQuery);
        queryTypes.push('video');
      }

      // Social sentiment query
      if (analysis.tables_needed.includes('social_sentiment')) {
        const socialQuery = supabase
          .from('social_sentiment')
          .select('content, score, mentions, sentiment, platform')
          .ilike('content', `%${analysis.search_focus}%`)
          .order('created_at', { ascending: false })
          .limit(15);
        
        queries.push(socialQuery);
        queryTypes.push('social');
      }

      // Trending players query - Always included for stats questions
      let trendingQuery = supabase.from('trending_players').select('player_name, trend_type, platform, mentions_count');
      
      const searchLower = analysis.search_focus.toLowerCase();
      if (searchLower.includes('home run') || searchLower.includes('most home runs')) {
        trendingQuery = trendingQuery.eq('trend_type', 'home_run_leader');
      } else if (searchLower.includes('wins') || searchLower.includes('pitcher')) {
        trendingQuery = trendingQuery.eq('trend_type', 'pitching_wins_leader');
      }
      
      queries.push(trendingQuery.order('mentions_count', { ascending: false }).limit(10));
      queryTypes.push('trending');

      // Player stats query - Always included  
      let statsQuery = supabase.from('player_stats').select('stat_type, stat_value, fantasy_points');
      
      if (searchLower.includes('home run') || searchLower.includes('most home runs')) {
        statsQuery = statsQuery.eq('stat_type', 'current_season_hitting');
      } else if (searchLower.includes('wins') || searchLower.includes('pitcher') || 
                 searchLower.includes('era') || searchLower.includes('strikeout') || 
                 searchLower.includes('saves')) {
        statsQuery = statsQuery.eq('stat_type', 'current_season_pitching');
      } else if (searchLower.includes('runs') || searchLower.includes('ops') || 
                 searchLower.includes('stolen') || searchLower.includes('doubles') || 
                 searchLower.includes('walks') || searchLower.includes('hits')) {
        statsQuery = statsQuery.eq('stat_type', 'current_season_hitting');
      } else {
        statsQuery = statsQuery.eq('stat_type', 'fantasy_intelligence');
      }
      
      queries.push(statsQuery.limit(20));
      queryTypes.push('stats');

      // Execute all queries in parallel
      console.log(`⚡ Executing ${queries.length} parallel database queries...`);
      const queryResults = await Promise.all(queries);
      
      // Process results and combine into single array
      const results: any[] = [];
      
      queryResults.forEach((result, index) => {
        const sourceType = queryTypes[index];
        if (result.data && result.data.length > 0) {
          results.push(...result.data.map((item: any) => ({ ...item, source_type: sourceType })));
          console.log(`✅ ${sourceType}: ${result.data.length} records`);
        } else {
          console.log(`⚠️ ${sourceType}: 0 records`);
        }
      });

      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      console.log(`🎯 Parallel queries completed in ${queryTime}ms`);
      console.log(`📊 Total data points: ${results.length}\n`);
      
      return results;

    } catch (error) {
      console.error('❌ Parallel database query error:', error);
      return [];
    }
  }

  compactDataForAI(data: any[]): any[] {
    // Reduce data payload size for faster AI processing
    return data.map(item => {
      const compact: any = { source_type: item.source_type };
      
      if (item.source_type === 'news') {
        compact.title = item.title?.substring(0, 100);
        compact.content = item.content?.substring(0, 200);
        compact.source = item.source;
      } else if (item.source_type === 'video') {
        compact.title = item.title?.substring(0, 100);
        compact.channel = item.channel_name;
        compact.players = item.players_mentioned;
      } else if (item.source_type === 'social') {
        compact.content = item.content?.substring(0, 150);
        compact.sentiment = item.sentiment;
        compact.platform = item.platform;
      } else if (item.source_type === 'trending') {
        compact.player_name = item.player_name;
        compact.trend_type = item.trend_type;
        compact.mentions = item.mentions_count;
      } else if (item.source_type === 'stats') {
        compact.stat_type = item.stat_type;
        compact.stat_value = item.stat_value;
        compact.fantasy_points = item.fantasy_points;
      }
      
      return compact;
    }).slice(0, 50); // Limit to top 50 most relevant items
  }

  async tryFastPath(question: string): Promise<QueryResult | null> {
    console.log('🚀 Checking fast-path patterns...');
    
    // Home run leaders query
    if (this.FAST_PATTERNS.homeRunLeaders.test(question)) {
      console.log('💨 Fast-path: Home run leaders query detected');
      return await this.getHomeRunLeaders();
    }
    
    // RBI leaders query
    if (this.FAST_PATTERNS.rbiLeaders.test(question)) {
      console.log('💨 Fast-path: RBI leaders query detected');
      return await this.getRBILeaders();
    }
    
    // Batting average leaders query
    if (this.FAST_PATTERNS.battingAverageLeaders.test(question)) {
      console.log('💨 Fast-path: Batting average leaders query detected');
      return await this.getBattingAverageLeaders();
    }
    
    // Pitching wins leaders query
    if (this.FAST_PATTERNS.pitchingWinsLeaders.test(question)) {
      console.log('💵 Fast-path: Pitching wins leaders query detected');
      return await this.getPitchingWinsLeaders();
    }
    
    // Strikeout leaders query
    if (this.FAST_PATTERNS.strikeoutLeaders.test(question)) {
      console.log('🔥 Fast-path: Strikeout leaders query detected');
      return await this.getStrikeoutLeaders();
    }
    
    // ERA leaders query
    if (this.FAST_PATTERNS.eraLeaders.test(question)) {
      console.log('✨ Fast-path: ERA leaders query detected');
      return await this.getERALeaders();
    }
    
    // Saves leaders query
    if (this.FAST_PATTERNS.savesLeaders.test(question)) {
      console.log('💫 Fast-path: Saves leaders query detected');
      return await this.getSavesLeaders();
    }
    
    // Runs leaders query
    if (this.FAST_PATTERNS.runsLeaders.test(question)) {
      console.log('🏃 Fast-path: Runs leaders query detected');
      return await this.getRunsLeaders();
    }
    
    // OPS leaders query
    if (this.FAST_PATTERNS.opsLeaders.test(question)) {
      console.log('⚡ Fast-path: OPS leaders query detected');
      return await this.getOPSLeaders();
    }
    
    // Stolen base leaders query
    if (this.FAST_PATTERNS.stolenBaseLeaders.test(question)) {
      console.log('🏃‍♂️ Fast-path: Stolen base leaders query detected');
      return await this.getStolenBaseLeaders();
    }
    
    return null; // No fast-path match
  }

  async getHomeRunLeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Direct optimized queries for home run data
      const [newsData, trendingData, statsData] = await Promise.all([
        supabase
          .from('news_articles')
          .select('title, content, source, published_at')
          .ilike('title', '%Home Run Leaders%')
          .order('published_at', { ascending: false })
          .limit(3),
        
        supabase
          .from('trending_players')
          .select('player_name, trend_type, mentions_count')
          .eq('trend_type', 'home_run_leader')
          .order('mentions_count', { ascending: false })
          .limit(10),
        
        supabase
          .from('player_stats')
          .select('stat_value')
          .eq('stat_type', 'current_season_hitting')
          .limit(20)
      ]);

      const queryTime = Date.now() - startTime;
      console.log(`📊 Fast query completed in ${queryTime}ms`);

      // Extract home run data from stats
      const homeRunStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.home_runs > 0)
        .sort((a, b) => (b.home_runs || 0) - (a.home_runs || 0))
        .slice(0, 10) || [];

      // Generate fast response
      let answer = "**Current MLB Home Run Leaders:**\n\n";
      
      homeRunStats.forEach((stat, i) => {
        answer += `${i + 1}. ${stat.player_name} - ${stat.home_runs} HR`;
        if (stat.team) answer += ` (${stat.team})`;
        if (stat.batting_average) answer += ` - .${stat.batting_average?.toFixed(3).substring(2)}`;
        answer += "\n";
      });

      if (trendingData.data?.length) {
        answer += "\n**Trending Home Run Leaders:**\n";
        trendingData.data.slice(0, 5).forEach((player, i) => {
          answer += `${i + 1}. ${player.player_name} - ${player.mentions_count} HR\n`;
        });
      }

      answer += `\n✅ **High Confidence** - Data from MLB Stats API (${new Date().toLocaleDateString()})`;
      answer += "\n\n**Fantasy Advice:** Focus on the top 3-5 players for consistent power production.";

      return {
        answer,
        sources: ['MLB Stats API', 'MLB Stats 2025'],
        confidence: 'High',
        data: [...(statsData.data || []), ...(trendingData.data || [])]
      };

    } catch (error) {
      console.error('❌ Fast-path query error:', error);
      return null as any;
    }
  }

  async getRBILeaders(): Promise<QueryResult> {
    // Similar fast implementation for RBI leaders
    return {
      answer: "RBI leaders fast-path not yet implemented",
      sources: [],
      confidence: 'Low',
      data: []
    };
  }

  async getBattingAverageLeaders(): Promise<QueryResult> {
    // Similar fast implementation for batting average leaders
    return {
      answer: "Batting average leaders fast-path not yet implemented",
      sources: [],
      confidence: 'Low',
      data: []
    };
  }

  async getPitchingWinsLeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      // Direct optimized queries for pitching wins data
      const [newsData, trendingData, statsData] = await Promise.all([
        supabase
          .from('news_articles')
          .select('title, content, source, published_at')
          .ilike('title', '%Pitching Wins Leaders%')
          .order('published_at', { ascending: false })
          .limit(3),
        
        supabase
          .from('trending_players')
          .select('player_name, trend_type, mentions_count')
          .eq('trend_type', 'pitching_wins_leader')
          .order('mentions_count', { ascending: false })
          .limit(10),
        
        supabase
          .from('player_stats')
          .select('stat_value')
          .eq('stat_type', 'current_season_pitching')
          .limit(50)
      ]);

      const queryTime = Date.now() - startTime;
      console.log(`📊 Fast pitching query completed in ${queryTime}ms`);

      // Extract wins data from stats
      const winsStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.wins > 0)
        .sort((a, b) => (b.wins || 0) - (a.wins || 0))
        .slice(0, 10) || [];

      // Generate fast response
      let answer = "**Current MLB Pitching Wins Leaders:**\n\n";
      
      if (winsStats.length > 0) {
        winsStats.forEach((stat, i) => {
          answer += `${i + 1}. ${stat.player_name} - ${stat.wins} W`;
          if (stat.team) answer += ` (${stat.team})`;
          if (stat.era) answer += ` - ${stat.era.toFixed(2)} ERA`;
          if (stat.strikeouts) answer += `, ${stat.strikeouts} K`;
          answer += "\n";
        });
      } else {
        answer += "No pitching wins data currently available.\n";
        answer += "This may be due to the 2025 season not having started yet.\n";
      }

      if (trendingData.data?.length) {
        answer += "\n**Trending Wins Leaders:**\n";
        trendingData.data.slice(0, 5).forEach((player, i) => {
          answer += `${i + 1}. ${player.player_name} - ${player.mentions_count} W\n`;
        });
      }

      answer += `\n✅ **High Confidence** - Data from MLB Stats API (${new Date().toLocaleDateString()})`;
      answer += "\n\n**Fantasy Advice:** Target starting pitchers with strong win totals and low ERA for consistent fantasy value.";

      return {
        answer,
        sources: ['MLB Stats API', 'MLB Stats 2025'],
        confidence: winsStats.length > 0 ? 'High' : 'Medium',
        data: [...(statsData.data || []), ...(trendingData.data || [])]
      };

    } catch (error) {
      console.error('❌ Fast-path pitching query error:', error);
      return {
        answer: "Unable to retrieve pitching wins data at this time. This may be due to the 2025 season not having started yet.",
        sources: [],
        confidence: 'Low',
        data: []
      };
    }
  }

  async getStrikeoutLeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const statsData = await supabase
        .from('player_stats')
        .select('stat_value')
        .eq('stat_type', 'current_season_pitching')
        .limit(50);

      const strikeoutStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.strikeouts > 0)
        .sort((a, b) => (b.strikeouts || 0) - (a.strikeouts || 0))
        .slice(0, 10) || [];

      let answer = "**Current MLB Strikeout Leaders:**\n\n";
      
      if (strikeoutStats.length > 0) {
        strikeoutStats.forEach((stat, i) => {
          answer += `${i + 1}. ${stat.player_name} - ${stat.strikeouts} K`;
          if (stat.team) answer += ` (${stat.team})`;
          if (stat.era) answer += ` - ${stat.era.toFixed(2)} ERA`;
          answer += "\n";
        });
      } else {
        answer += "No strikeout data currently available.\n";
      }

      answer += `\n✅ **Confidence: ${strikeoutStats.length > 0 ? 'High' : 'Medium'}**`;

      return {
        answer,
        sources: ['MLB Stats API'],
        confidence: strikeoutStats.length > 0 ? 'High' : 'Medium',
        data: statsData.data || []
      };

    } catch (error) {
      console.error('❌ Strikeout query error:', error);
      return {
        answer: "Unable to retrieve strikeout data at this time.",
        sources: [],
        confidence: 'Low',
        data: []
      };
    }
  }

  async getERALeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const statsData = await supabase
        .from('player_stats')
        .select('stat_value')
        .eq('stat_type', 'current_season_pitching')
        .limit(50);

      const eraStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.era > 0 && stat?.innings_pitched >= 10) // Minimum innings requirement
        .sort((a, b) => (a.era || 999) - (b.era || 999)) // Ascending for ERA (lower is better)
        .slice(0, 10) || [];

      let answer = "**Current MLB ERA Leaders (Lowest ERA):**\n\n";
      
      if (eraStats.length > 0) {
        eraStats.forEach((stat, i) => {
          answer += `${i + 1}. ${stat.player_name} - ${stat.era.toFixed(2)} ERA`;
          if (stat.team) answer += ` (${stat.team})`;
          if (stat.wins) answer += ` - ${stat.wins}W`;
          answer += "\n";
        });
      } else {
        answer += "No ERA data currently available.\n";
      }

      answer += `\n✅ **Confidence: ${eraStats.length > 0 ? 'High' : 'Medium'}**`;

      return {
        answer,
        sources: ['MLB Stats API'],
        confidence: eraStats.length > 0 ? 'High' : 'Medium',
        data: statsData.data || []
      };

    } catch (error) {
      console.error('❌ ERA query error:', error);
      return {
        answer: "Unable to retrieve ERA data at this time.",
        sources: [],
        confidence: 'Low',
        data: []
      };
    }
  }

  async getSavesLeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const statsData = await supabase
        .from('player_stats')
        .select('stat_value')
        .eq('stat_type', 'current_season_pitching')
        .limit(50);

      const savesStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.saves > 0)
        .sort((a, b) => (b.saves || 0) - (a.saves || 0))
        .slice(0, 10) || [];

      let answer = "**Current MLB Saves Leaders:**\n\n";
      
      if (savesStats.length > 0) {
        savesStats.forEach((stat, i) => {
          answer += `${i + 1}. ${stat.player_name} - ${stat.saves} SV`;
          if (stat.team) answer += ` (${stat.team})`;
          if (stat.era) answer += ` - ${stat.era.toFixed(2)} ERA`;
          answer += "\n";
        });
      } else {
        answer += "No saves data currently available.\n";
      }

      answer += `\n✅ **Confidence: ${savesStats.length > 0 ? 'High' : 'Medium'}**`;
      answer += "\n\n**Fantasy Advice:** Closers with consistent save opportunities are premium fantasy assets.";

      return {
        answer,
        sources: ['MLB Stats API'],
        confidence: savesStats.length > 0 ? 'High' : 'Medium',
        data: statsData.data || []
      };

    } catch (error) {
      console.error('❌ Saves query error:', error);
      return {
        answer: "Unable to retrieve saves data at this time.",
        sources: [],
        confidence: 'Low',
        data: []
      };
    }
  }

  async getRunsLeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const statsData = await supabase
        .from('player_stats')
        .select('stat_value')
        .eq('stat_type', 'current_season_hitting')
        .limit(50);

      const runsStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.runs > 0)
        .sort((a, b) => (b.runs || 0) - (a.runs || 0))
        .slice(0, 10) || [];

      let answer = "**Current MLB Runs Leaders:**\n\n";
      
      if (runsStats.length > 0) {
        runsStats.forEach((stat, i) => {
          answer += `${i + 1}. ${stat.player_name} - ${stat.runs} R`;
          if (stat.team) answer += ` (${stat.team})`;
          if (stat.home_runs) answer += ` - ${stat.home_runs} HR`;
          answer += "\n";
        });
      } else {
        answer += "No runs data currently available.\n";
      }

      answer += `\n✅ **Confidence: ${runsStats.length > 0 ? 'High' : 'Medium'}**`;

      return {
        answer,
        sources: ['MLB Stats API'],
        confidence: runsStats.length > 0 ? 'High' : 'Medium',
        data: statsData.data || []
      };

    } catch (error) {
      console.error('❌ Runs query error:', error);
      return {
        answer: "Unable to retrieve runs data at this time.",
        sources: [],
        confidence: 'Low',
        data: []
      };
    }
  }

  async getOPSLeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const statsData = await supabase
        .from('player_stats')
        .select('stat_value')
        .eq('stat_type', 'current_season_hitting')
        .limit(50);

      const opsStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.ops > 0)
        .sort((a, b) => (b.ops || 0) - (a.ops || 0))
        .slice(0, 10) || [];

      let answer = "**Current MLB OPS Leaders:**\n\n";
      
      if (opsStats.length > 0) {
        opsStats.forEach((stat, i) => {
          answer += `${i + 1}. ${stat.player_name} - ${stat.ops?.toFixed(3)} OPS`;
          if (stat.team) answer += ` (${stat.team})`;
          if (stat.home_runs) answer += ` - ${stat.home_runs} HR`;
          answer += "\n";
        });
      } else {
        answer += "No OPS data currently available.\n";
      }

      answer += `\n✅ **Confidence: ${opsStats.length > 0 ? 'High' : 'Medium'}**`;
      answer += "\n\n**Fantasy Advice:** OPS combines power and plate discipline - target players with .900+ OPS for premium production.";

      return {
        answer,
        sources: ['MLB Stats API'],
        confidence: opsStats.length > 0 ? 'High' : 'Medium',
        data: statsData.data || []
      };

    } catch (error) {
      console.error('❌ OPS query error:', error);
      return {
        answer: "Unable to retrieve OPS data at this time.",
        sources: [],
        confidence: 'Low',
        data: []
      };
    }
  }

  async getStolenBaseLeaders(): Promise<QueryResult> {
    const startTime = Date.now();
    
    try {
      const statsData = await supabase
        .from('player_stats')
        .select('stat_value')
        .eq('stat_type', 'current_season_hitting')
        .limit(50);

      const sbStats = statsData.data?.map(stat => stat.stat_value)
        .filter(stat => stat?.stolen_bases > 0)
        .sort((a, b) => (b.stolen_bases || 0) - (a.stolen_bases || 0))
        .slice(0, 10) || [];

      let answer = "**Current MLB Stolen Base Leaders:**\n\n";
      
      if (sbStats.length > 0) {
        sbStats.forEach((stat, i) => {
          answer += `${i + 1}. ${stat.player_name} - ${stat.stolen_bases} SB`;
          if (stat.team) answer += ` (${stat.team})`;
          if (stat.caught_stealing) answer += ` (${stat.caught_stealing} CS)`;
          answer += "\n";
        });
      } else {
        answer += "No stolen base data currently available.\n";
      }

      answer += `\n✅ **Confidence: ${sbStats.length > 0 ? 'High' : 'Medium'}**`;
      answer += "\n\n**Fantasy Advice:** Speed kills in fantasy - target players with 20+ steal potential for category coverage.";

      return {
        answer,
        sources: ['MLB Stats API'],
        confidence: sbStats.length > 0 ? 'High' : 'Medium',
        data: statsData.data || []
      };

    } catch (error) {
      console.error('❌ Stolen base query error:', error);
      return {
        answer: "Unable to retrieve stolen base data at this time.",
        sources: [],
        confidence: 'Low',
        data: []
      };
    }
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

  generateCacheKey(question: string): string {
    // Create a simple hash of the question for cache key
    const normalized = question.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
    return `query:${normalized}`;
  }

  getCachedResult(cacheKey: string): QueryResult | null {
    const entry = this.cache.get(cacheKey);
    
    if (!entry) {
      return null;
    }
    
    // Check if cache entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }
    
    return entry.result;
  }

  setCachedResult(cacheKey: string, result: QueryResult, ttl: number): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl
    });
    
    // Simple cache size management - remove oldest entries if cache gets too large
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
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