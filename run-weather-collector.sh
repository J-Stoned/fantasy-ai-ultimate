#!/bin/bash
# Run weather collector without timeout

echo "🌤️ Starting weather collection for $1 games..."
echo "This will run until completion. Press Ctrl+C to cancel."
echo ""

# Run the weather collector
npx tsx scripts/collect-weather-data-realtime.ts --sport=$1

echo ""
echo "✅ Weather collection complete!"