#!/bin/bash
# 🛑 STOP ALL DATA COLLECTORS

echo "🛑 STOPPING ALL DATA COLLECTORS"
echo "==============================="
echo ""

# Stop collectors by PID files
for pidfile in *.pid; do
    if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        NAME=$(basename "$pidfile" .pid)
        echo "Stopping $NAME (PID: $PID)..."
        kill $PID 2>/dev/null && echo "✅ Stopped $NAME" || echo "❌ $NAME not running"
        rm "$pidfile"
    fi
done

# Kill any remaining processes
echo ""
echo "Cleaning up any remaining processes..."
pkill -f "infinite-loader.ts" 2>/dev/null
pkill -f "real-data-collector.ts" 2>/dev/null
pkill -f "ai-powered-scraper.ts" 2>/dev/null
pkill -f "mega-data-collector.ts" 2>/dev/null
pkill -f "simple-data-collector.ts" 2>/dev/null

echo ""
echo "✅ All data collectors stopped!"
echo ""
echo "📊 Final database status:"
npm run db:status