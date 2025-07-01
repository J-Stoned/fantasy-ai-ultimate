#!/bin/bash
# 🔄 SWITCH FROM SYNTHETIC TO REAL DATA COLLECTION

echo "🔄 SWITCHING TO REAL DATA COLLECTION"
echo "===================================="
echo ""

# Stop the infinite loader
if [ -f infinite-loader.pid ]; then
    PID=$(cat infinite-loader.pid)
    echo "⏹️  Stopping infinite loader (PID: $PID)..."
    kill $PID 2>/dev/null
    rm infinite-loader.pid
    echo "✅ Infinite loader stopped"
else
    echo "ℹ️  No infinite loader running"
fi

# Kill any other synthetic loaders
pkill -f "infinite-loader.ts" 2>/dev/null
pkill -f "simple-data-collector.ts" 2>/dev/null
pkill -f "mega-data-collector.ts" 2>/dev/null

echo ""
echo "📊 Current database status:"
npm run db:status

echo ""
echo "🚀 Starting REAL data collectors..."
echo ""

# Start the real data collector
echo "1️⃣ Starting real-data-collector.ts (uses all your APIs)..."
nohup tsx scripts/real-data-collector.ts > real-data-collector.log 2>&1 &
REAL_PID=$!
echo "   ✅ Started with PID: $REAL_PID"

# Start the AI-powered scraper
echo ""
echo "2️⃣ Starting ai-powered-scraper.ts (OpenAI analysis)..."
nohup tsx scripts/ai-powered-scraper.ts > ai-scraper.log 2>&1 &
AI_PID=$!
echo "   ✅ Started with PID: $AI_PID"

# Start the updated mega collector
echo ""
echo "3️⃣ Starting mega-data-collector.ts (fixed with your API keys)..."
nohup tsx scripts/mega-data-collector.ts > mega-collector.log 2>&1 &
MEGA_PID=$!
echo "   ✅ Started with PID: $MEGA_PID"

# Save PIDs
echo $REAL_PID > real-collector.pid
echo $AI_PID > ai-scraper.pid
echo $MEGA_PID > mega-collector.pid

echo ""
echo "✅ ALL REAL DATA COLLECTORS RUNNING!"
echo "===================================="
echo ""
echo "📊 Monitor with:"
echo "   tail -f real-data-collector.log"
echo "   tail -f ai-scraper.log"
echo "   tail -f mega-collector.log"
echo ""
echo "📈 Check status:"
echo "   npm run db:status"
echo ""
echo "🛑 Stop all:"
echo "   ./scripts/stop-all-collectors.sh"
echo ""
echo "Your database is now collecting REAL sports data! 🎉"