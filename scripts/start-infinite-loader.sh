#!/bin/bash
# 🚀 START INFINITE LOADER - Runs forever in background

echo "🚀 STARTING INFINITE LOADER..."
echo "=============================="
echo ""

# Change to project directory
cd "/mnt/c/Users/st0ne/Hey Fantasy/fantasy-ai-ultimate"

# Kill any existing loaders
pkill -f "infinite-loader.ts" 2>/dev/null
echo "✅ Cleaned up old processes"

# Start the infinite loader in background
nohup tsx scripts/infinite-loader.ts > infinite-loader.log 2>&1 &
LOADER_PID=$!

echo "✅ Infinite loader started with PID: $LOADER_PID"
echo ""
echo "📊 Monitor progress with:"
echo "   tail -f infinite-loader.log"
echo ""
echo "📈 Check database status with:"
echo "   npm run db:status"
echo ""
echo "🛑 Stop loader with:"
echo "   kill $LOADER_PID"
echo ""
echo "The loader will run FOREVER until you stop it!"
echo "Your database will grow continuously! 🚀"

# Save PID to file for easy stopping later
echo $LOADER_PID > infinite-loader.pid
echo ""
echo "PID saved to infinite-loader.pid"