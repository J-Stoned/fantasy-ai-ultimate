#!/bin/bash
# 🧹 CLEANUP REDUNDANT SCRIPTS

echo "🧹 CLEANING UP REDUNDANT SCRIPTS"
echo "================================"
echo ""

# Create archive directory
mkdir -p scripts/archive

# COLLECTORS TO KEEP (the ones that work)
# - ultra-collector.ts (fastest, working)
# - optimized-data-collector.ts (stable, working)
# - mega-data-collector.ts (has ESPN integration)
# - launch-maximum-collection.sh (launcher)
# - stop-all-collectors.sh (stopper)
# - check-database-status.ts (monitor)

# COLLECTORS TO ARCHIVE (old/broken/redundant)
echo "📦 Archiving old collectors..."
mv scripts/simple-data-collector.ts scripts/archive/ 2>/dev/null
mv scripts/enhanced-data-collector.ts scripts/archive/ 2>/dev/null
mv scripts/massive-data-collector.ts scripts/archive/ 2>/dev/null
mv scripts/fixed-massive-collector.ts scripts/archive/ 2>/dev/null
mv scripts/real-data-collector.ts scripts/archive/ 2>/dev/null
mv scripts/fix-api-collectors.ts scripts/archive/ 2>/dev/null
mv scripts/safe-real-data-collector.ts scripts/archive/ 2>/dev/null
mv scripts/real-collector-fixed.ts scripts/archive/ 2>/dev/null
mv scripts/turbo-nba-collector.ts scripts/archive/ 2>/dev/null
mv scripts/mega-parallel-collector.ts scripts/archive/ 2>/dev/null
mv scripts/weather-collector-no-city.ts scripts/archive/ 2>/dev/null

# SQL SCRIPTS TO KEEP
# - create-tables-no-city.sql (final working version)
# - check-database-status.ts (monitor)
# - fix-id-overflow-hybrid.sql (important fix)

# SQL SCRIPTS TO ARCHIVE (all the city column attempts)
echo "📦 Archiving redundant SQL scripts..."
mv scripts/add-city-column-only.sql scripts/archive/ 2>/dev/null
mv scripts/quick-fix-city.sql scripts/archive/ 2>/dev/null
mv scripts/fix-teams-and-create-tables.sql scripts/archive/ 2>/dev/null
mv scripts/diagnose-city-error.sql scripts/archive/ 2>/dev/null
mv scripts/nuclear-fix-teams.sql scripts/archive/ 2>/dev/null
mv scripts/check-teams-relationship.sql scripts/archive/ 2>/dev/null
mv scripts/minimal-test.sql scripts/archive/ 2>/dev/null
mv scripts/create-weather-table-only.sql scripts/archive/ 2>/dev/null
mv scripts/fix-teams-indexes.sql scripts/archive/ 2>/dev/null
mv scripts/complete-real-data-setup.sql scripts/archive/ 2>/dev/null
mv scripts/create-all-real-data-tables.sql scripts/archive/ 2>/dev/null
mv scripts/safe-create-tables.sql scripts/archive/ 2>/dev/null
mv scripts/create-real-data-tables-clean.sql scripts/archive/ 2>/dev/null
mv scripts/fix-real-data-tables.sql scripts/archive/ 2>/dev/null
mv scripts/create-real-data-tables.sql scripts/archive/ 2>/dev/null
mv scripts/diagnose-tables.sql scripts/archive/ 2>/dev/null
mv scripts/add-columns-separately.sql scripts/archive/ 2>/dev/null
mv scripts/create-only-new-tables.sql scripts/archive/ 2>/dev/null

# Old column fix scripts
mv scripts/add-fantasy-columns.sql scripts/archive/ 2>/dev/null
mv scripts/add-fantasy-columns-safe.sql scripts/archive/ 2>/dev/null
mv scripts/check-and-add-columns.sql scripts/archive/ 2>/dev/null
mv scripts/fix-columns-now.sql scripts/archive/ 2>/dev/null
mv scripts/fix-players-and-load.sql scripts/archive/ 2>/dev/null
mv scripts/add-external-id-column.sql scripts/archive/ 2>/dev/null

# ID overflow intermediate steps
mv scripts/fix-id-overflow-step1.sql scripts/archive/ 2>/dev/null
mv scripts/fix-id-overflow-step2.sql scripts/archive/ 2>/dev/null

# List what's left
echo ""
echo "✅ Active Scripts:"
echo "------------------"
ls -la scripts/*.ts scripts/*.sh scripts/*.sql 2>/dev/null | grep -v archive | wc -l
echo "scripts remaining"

echo ""
echo "📦 Archived Scripts:"
echo "-------------------"
ls scripts/archive/ 2>/dev/null | wc -l
echo "scripts archived"

echo ""
echo "🔥 Active Collectors:"
echo "--------------------"
echo "• ultra-collector.ts - Maximum speed collector"
echo "• optimized-data-collector.ts - Stable odds & weather"
echo "• mega-data-collector.ts - ESPN & multi-source"
echo "• ai-powered-scraper.ts - OpenAI analysis"
echo ""
echo "🛠️ Utility Scripts:"
echo "------------------"
echo "• launch-maximum-collection.sh - Start all collectors"
echo "• stop-all-collectors.sh - Stop everything"
echo "• check-database-status.ts - Monitor database"
echo "• create-tables-no-city.sql - Setup tables"
echo ""
echo "✨ Cleanup complete!"