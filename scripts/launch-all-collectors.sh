#!/bin/bash
# 🚀 LAUNCH ALL DATA COLLECTORS INCLUDING NEW SOURCES

echo "🚀 LAUNCHING ALL DATA COLLECTORS"
echo "================================="
echo ""

# First, stop any existing collectors
echo "🛑 Stopping existing collectors..."
./scripts/stop-all-collectors.sh
echo ""

# Launch all collectors
echo "🔥 Starting collectors..."
echo ""

# 1. Ultra Collector (fastest for odds/weather)
echo "1️⃣ Starting Ultra Collector..."
nohup tsx scripts/ultra-collector.ts > ultra-collector.log 2>&1 &
ULTRA_PID=$!
echo "   ✅ Started with PID: $ULTRA_PID"

# 2. Optimized Collector (stable odds & weather)
echo ""
echo "2️⃣ Starting Optimized Collector..."
nohup tsx scripts/optimized-data-collector.ts > optimized-collector.log 2>&1 &
OPT_PID=$!
echo "   ✅ Started with PID: $OPT_PID"

# 3. Mega Data Collector (ESPN integration)
echo ""
echo "3️⃣ Starting Mega Data Collector..."
nohup tsx scripts/mega-data-collector.ts > mega-data-collector.log 2>&1 &
MEGA_PID=$!
echo "   ✅ Started with PID: $MEGA_PID"

# 4. AI-Powered Scraper (OpenAI analysis)
echo ""
echo "4️⃣ Starting AI-Powered Scraper..."
nohup tsx scripts/ai-powered-scraper.ts > ai-powered-scraper.log 2>&1 &
AI_PID=$!
echo "   ✅ Started with PID: $AI_PID"

# 5. Reddit Sports Collector (NEW)
echo ""
echo "5️⃣ Starting Reddit Sports Collector..."
nohup tsx scripts/reddit-sports-collector.ts > reddit-sports.log 2>&1 &
REDDIT_PID=$!
echo "   ✅ Started with PID: $REDDIT_PID"

# 6. ESPN API Collector (NEW)
echo ""
echo "6️⃣ Starting ESPN API Collector..."
nohup tsx scripts/espn-api-collector.ts > espn-api.log 2>&1 &
ESPN_PID=$!
echo "   ✅ Started with PID: $ESPN_PID"

# Save PIDs
echo $ULTRA_PID > ultra.pid
echo $OPT_PID > optimized.pid
echo $MEGA_PID > mega.pid
echo $AI_PID > ai-scraper.pid
echo $REDDIT_PID > reddit.pid
echo $ESPN_PID > espn.pid

echo ""
echo "✅ ALL COLLECTORS LAUNCHED!"
echo "==========================="
echo ""
echo "📊 Active collectors:"
echo "   • Ultra Collector - Maximum speed odds/weather"
echo "   • Optimized Collector - Stable data collection"
echo "   • Mega Data Collector - Multi-source integration"
echo "   • AI-Powered Scraper - OpenAI analysis"
echo "   • Reddit Sports Collector - Social media insights"
echo "   • ESPN API Collector - Live scores & news"
echo ""
echo "📈 Monitor logs:"
echo "   tail -f ultra-collector.log"
echo "   tail -f reddit-sports.log"
echo "   tail -f espn-api.log"
echo ""
echo "📊 Check database growth:"
echo "   watch -n 5 'npm run db:status'"
echo ""
echo "🛑 Stop all:"
echo "   ./scripts/stop-all-collectors.sh"
echo ""
echo "🔥 ALL DATA SOURCES ACTIVE! 🔥"