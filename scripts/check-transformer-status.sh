#!/bin/bash

echo "🔍 TRANSFORMER STATUS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if process is running
if ps aux | grep -q "[c]ontinuous-stats-transformer"; then
    echo "✅ Transformer is RUNNING"
    echo ""
    
    # Show latest progress
    echo "📊 Latest Progress:"
    tail -5 stats-transformer.log | grep -E "(Coverage:|Updated:|Created:)" | tail -3
    
    # Show process info
    echo ""
    echo "🔧 Process Info:"
    ps aux | grep "[c]ontinuous-stats-transformer" | awk '{print "   PID: " $2 " | CPU: " $3 "% | Memory: " $4 "%"}'
else
    echo "❌ Transformer is NOT running"
    echo ""
    echo "To start it, run:"
    echo "   nohup npx tsx scripts/continuous-stats-transformer.ts > stats-transformer.log 2>&1 &"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"