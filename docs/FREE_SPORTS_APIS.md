# 🏆 FREE SPORTS APIs FOR FANTASY AI ULTIMATE

## 🚀 TIER 1: MUST-HAVE FREE APIs

### 1. **Sleeper API** ⭐⭐⭐⭐⭐
- **URL**: https://docs.sleeper.app/
- **What**: Complete fantasy platform API
- **Rate Limit**: 1000/min (GENEROUS!)
- **Features**:
  - Real-time player stats
  - League management
  - Roster updates
  - Webhooks for live updates
  - Historical data
- **No API Key Required!**

### 2. **ESPN Hidden API** ⭐⭐⭐⭐
- **URL**: site.api.espn.com/apis/site/v2/sports/
- **What**: ESPN's internal API (unofficial but stable)
- **Rate Limit**: ~100/min (be respectful)
- **Features**:
  - Live scores
  - Player stats
  - Team rosters
  - News articles
- **Example**: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`

### 3. **The Odds API** ⭐⭐⭐⭐
- **URL**: https://the-odds-api.com/
- **What**: Sports betting odds
- **Free Tier**: 500 requests/month
- **Features**:
  - Live odds from 70+ bookmakers
  - Spreads, totals, moneylines
  - Prop bets
  - Historical odds

### 4. **NBA Data API** ⭐⭐⭐⭐
- **URL**: https://www.balldontlie.io/
- **What**: Free NBA stats
- **Rate Limit**: 60/min
- **Features**:
  - Player stats
  - Game data
  - Team info
  - Season averages

## 🎯 TIER 2: VALUABLE FREE ADDITIONS

### 5. **SportsDB** ⭐⭐⭐
- **URL**: https://www.thesportsdb.com/api.php
- **What**: Sports metadata
- **Free Tier**: Patreon-supported
- **Features**:
  - Team logos/badges
  - Player images
  - Stadium info
  - League details

### 6. **NFL Arrests API** ⭐⭐⭐
- **URL**: http://nflarrest.com/api/
- **What**: Player arrest records
- **Features**:
  - Historical arrest data
  - Crime categories
  - Team crime rates
  - (Great for risk analysis!)

### 7. **Reddit Sports API** ⭐⭐⭐
- **URL**: reddit.com/r/{sport}.json
- **What**: Community sentiment
- **Rate Limit**: 60/hour
- **Features**:
  - Hot topics
  - Player sentiment
  - Injury rumors
  - Trade speculation

### 8. **Twitter API v2** ⭐⭐⭐
- **URL**: https://developer.twitter.com/
- **Free Tier**: 1,500 tweets/month
- **Features**:
  - Player tweets
  - Breaking news
  - Injury updates
  - Sentiment analysis

## 🔥 TIER 3: HIDDEN GEMS

### 9. **Yahoo Fantasy (Unofficial)** ⭐⭐⭐
- **URL**: fantasysports.yahooapis.com/fantasy/v2/
- **What**: Yahoo league data
- **Auth**: OAuth required
- **Features**:
  - User leagues
  - Player projections
  - Transaction trends

### 10. **Pro Football Reference** ⭐⭐
- **URL**: Scraping allowed with limits
- **What**: Historical stats goldmine
- **Features**:
  - Career stats
  - Advanced metrics
  - Historical comparisons

### 11. **Weather API** ⭐⭐⭐⭐
- **URL**: https://openweathermap.org/api
- **Free Tier**: 1000 calls/day
- **Features**:
  - Game day weather
  - Wind speed (affects kickers!)
  - Precipitation
  - Temperature

### 12. **College Football Data** ⭐⭐⭐
- **URL**: https://collegefootballdata.com/
- **What**: Complete CFB stats
- **Features**:
  - Player stats
  - Recruiting data
  - Team rankings
  - Draft projections

## 🛠️ IMPLEMENTATION PRIORITY

1. **Sleeper API** - Complete fantasy data, webhooks
2. **ESPN Hidden API** - Live scores, news
3. **The Odds API** - Betting lines for analysis
4. **Weather API** - Game conditions
5. **Reddit API** - Community sentiment

## 💡 PRO TIPS

1. **Combine APIs**: 
   - Sleeper for core data
   - ESPN for live updates
   - Reddit for sentiment
   - Weather for conditions

2. **Cache Everything**:
   - Redis for real-time data
   - PostgreSQL for historical
   - Update cycles based on data type

3. **Rate Limit Strategy**:
   - Stagger API calls
   - Priority queue for important updates
   - Fallback to cached data

4. **Data Enrichment**:
   - Cross-reference player IDs
   - Build unified player profiles
   - Aggregate stats from multiple sources

## 🚨 AVOID THESE

- **Sportsradar**: Expensive AF
- **STATS Perform**: Enterprise only
- **Sportradar**: Requires partnership
- **Official league APIs**: Usually paid

## 🎯 NEXT STEPS

1. Start with Sleeper (already partially integrated)
2. Add ESPN hidden endpoints
3. Layer in weather data
4. Add odds for advanced analytics
5. Social sentiment from Reddit/Twitter

With these FREE APIs, you'll have MORE data than most paid platforms! 🚀