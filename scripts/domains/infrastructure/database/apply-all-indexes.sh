#!/bin/bash
# Apply all performance indexes in sequence
# This avoids timeout issues by running smaller batches

echo "🔥 APPLYING FANTASY AI PERFORMANCE INDEXES"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Please set: export DATABASE_URL='your_database_url'"
    exit 1
fi

# Function to run SQL file and check result
run_sql_file() {
    local file=$1
    local description=$2
    
    echo "⏳ Applying $description..."
    echo "   File: $file"
    
    if psql $DATABASE_URL -f $file; then
        echo "✅ $description completed successfully!"
    else
        echo "❌ ERROR: Failed to apply $description"
        echo "   Check the error messages above"
        return 1
    fi
    echo ""
}

# Apply indexes in order
echo "Starting index creation..."
echo "Note: Using CONCURRENTLY to avoid locking tables"
echo ""

# Part 1: Player game logs (largest table)
run_sql_file "scripts/database/indexes-01-player-game-logs.sql" "Player Game Logs indexes"
if [ $? -ne 0 ]; then exit 1; fi

# Part 2: Games table
run_sql_file "scripts/database/indexes-02-games.sql" "Games table indexes"
if [ $? -ne 0 ]; then exit 1; fi

# Part 3: Players and Teams
run_sql_file "scripts/database/indexes-03-players-teams.sql" "Players & Teams indexes"
if [ $? -ne 0 ]; then exit 1; fi

# Part 4: ML Enrichment tables
run_sql_file "scripts/database/indexes-04-ml-enrichment.sql" "ML Enrichment indexes"
if [ $? -ne 0 ]; then exit 1; fi

# Part 5: Pattern Detection & ML
run_sql_file "scripts/database/indexes-05-patterns-ml.sql" "Pattern Detection & ML indexes"
if [ $? -ne 0 ]; then exit 1; fi

echo "=========================================="
echo "✅ ALL INDEXES APPLIED SUCCESSFULLY!"
echo ""
echo "Expected performance improvements:"
echo "- 10x+ query speed for player game logs"
echo "- Faster pattern detection queries"
echo "- Improved API response times"
echo "- Better join performance"
echo ""
echo "To monitor index usage, run:"
echo "psql $DATABASE_URL -c \"SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC LIMIT 20;\""

# Make script executable
chmod +x scripts/database/apply-all-indexes.sh