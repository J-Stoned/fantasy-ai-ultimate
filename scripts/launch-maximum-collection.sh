#!/bin/bash
# 🚀 LAUNCH MAXIMUM DATA COLLECTION

echo "🚀 LAUNCHING MAXIMUM DATA COLLECTION"
echo "===================================="
echo ""

# First, stop any existing collectors
echo "🛑 Stopping existing collectors..."
./scripts/stop-all-collectors.sh
echo ""

# Install p-limit for parallel processing
echo "📦 Installing dependencies..."
npm install p-limit --save
echo ""

# Launch all collectors
echo "🔥 Starting collectors..."
echo ""

# 1. Turbo NBA Collector
echo "1️⃣ Starting Turbo NBA Collector..."
nohup tsx scripts/turbo-nba-collector.ts > turbo-nba.log 2>&1 &
NBA_PID=$!
echo "   ✅ Started with PID: $NBA_PID"

# 2. Mega Parallel Collector
echo ""
echo "2️⃣ Starting Mega Parallel Collector..."
nohup tsx scripts/mega-parallel-collector.ts > mega-parallel.log 2>&1 &
MEGA_PID=$!
echo "   ✅ Started with PID: $MEGA_PID"

# 3. Keep the optimized collector running
echo ""
echo "3️⃣ Starting Optimized Collector..."
nohup tsx scripts/optimized-data-collector.ts > optimized-collector.log 2>&1 &
OPT_PID=$!
echo "   ✅ Started with PID: $OPT_PID"

# 4. Weather specialist
echo ""
echo "4️⃣ Starting Weather Specialist..."
nohup tsx scripts/weather-collector-no-city.ts > weather-specialist.log 2>&1 &
WEATHER_PID=$!
echo "   ✅ Started with PID: $WEATHER_PID"

# Save PIDs
echo $NBA_PID > turbo-nba.pid
echo $MEGA_PID > mega-parallel.pid
echo $OPT_PID > optimized.pid
echo $WEATHER_PID > weather.pid

echo ""
echo "✅ ALL COLLECTORS LAUNCHED!"
echo "==========================="
echo ""
echo "📊 Monitor with:"
echo "   tail -f turbo-nba.log          # NBA data"
echo "   tail -f mega-parallel.log      # All sports parallel"
echo "   tail -f optimized-collector.log # Odds & weather"
echo "   tail -f weather-specialist.log  # Weather focus"
echo ""
echo "📈 Check database growth:"
echo "   watch -n 5 'npm run db:status'"
echo ""
echo "🛑 Stop all:"
echo "   ./scripts/stop-all-collectors.sh"
echo ""
echo "🔥 MAXIMUM DATA COLLECTION ACTIVE! 🔥"