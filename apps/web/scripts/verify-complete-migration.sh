#!/bin/bash

# Complete Database Verification Script
# Compares every table and row count between source and target databases

set -e

echo "🔍 COMPLETE DATABASE VERIFICATION"
echo "================================================"

# Configuration
SOURCE_HOST="172.30.176.1"
SOURCE_PORT="5432"
SOURCE_DB="fantasy_ai_local"
SOURCE_USER="postgres"
SOURCE_PASS="postgres"

TARGET_CONTAINER="fantasy_postgres_db"
TARGET_DB="fantasy_ai"
TARGET_USER="fantasy_user"
TARGET_PASS="fantasy_password"

# Create helper container
echo "🐳 Creating verification helper container..."
docker run -d --name db-verify-helper --network host postgres:16-alpine tail -f /dev/null

# Function to get table list and counts from source
echo ""
echo "📊 Getting complete table inventory from SOURCE database..."
docker exec db-verify-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c \"
SELECT 
    schemaname || '.' || tablename as full_table_name,
    n_tup_ins as estimated_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
\"" > source_tables.txt

# Function to get table list and counts from target
echo "📊 Getting complete table inventory from TARGET database..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -c "
SELECT 
    schemaname || '.' || tablename as full_table_name,
    n_tup_ins as estimated_rows
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
" > target_tables.txt

# Get exact row counts for all tables
echo ""
echo "🔢 Getting EXACT row counts from SOURCE database..."
docker exec db-verify-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c \"
SELECT 'SELECT ''' || tablename || ''' as table_name, COUNT(*) as row_count FROM ' || tablename || ' UNION ALL'
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY tablename;
\"" | sed '$s/ UNION ALL$/;/' > source_count_query.sql

# Execute the count query on source
echo "📊 Executing row count query on SOURCE..."
docker exec db-verify-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -f source_count_query.sql" | grep -v "^$" > source_counts.txt

# Get exact row counts from target
echo "🔢 Getting EXACT row counts from TARGET database..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -c "
SELECT 'SELECT ''' || tablename || ''' as table_name, COUNT(*) as row_count FROM ' || tablename || ' UNION ALL'
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY tablename;
" | sed '$s/ UNION ALL$/;/' > target_count_query.sql

echo "📊 Executing row count query on TARGET..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -f target_count_query.sql | grep -v "^$" > target_counts.txt

# Compare the results
echo ""
echo "🔍 COMPARISON RESULTS:"
echo "================================================"

# Show total table counts
SOURCE_TABLE_COUNT=$(cat source_counts.txt | wc -l)
TARGET_TABLE_COUNT=$(cat target_counts.txt | wc -l)

echo "📋 TOTAL TABLES:"
echo "   Source: $SOURCE_TABLE_COUNT tables"
echo "   Target: $TARGET_TABLE_COUNT tables"

if [ "$SOURCE_TABLE_COUNT" -eq "$TARGET_TABLE_COUNT" ]; then
    echo "   ✅ Table count matches!"
else
    echo "   ❌ Table count MISMATCH!"
fi

echo ""
echo "📊 ROW COUNT COMPARISON:"
echo "================================================"
printf "%-40s %15s %15s %10s\n" "TABLE NAME" "SOURCE ROWS" "TARGET ROWS" "STATUS"
echo "--------------------------------------------------------------------------------"

# Compare row counts
while IFS='|' read -r table_name source_count; do
    # Clean up whitespace
    table_name=$(echo "$table_name" | xargs)
    source_count=$(echo "$source_count" | xargs)
    
    # Get corresponding target count
    target_count=$(grep "^[[:space:]]*$table_name[[:space:]]*|" target_counts.txt | cut -d'|' -f2 | xargs)
    
    if [ -z "$target_count" ]; then
        target_count="MISSING"
        status="❌ MISSING"
    elif [ "$source_count" -eq "$target_count" ] 2>/dev/null; then
        status="✅ MATCH"
    else
        status="❌ MISMATCH"
    fi
    
    printf "%-40s %15s %15s %10s\n" "$table_name" "$source_count" "$target_count" "$status"
done < source_counts.txt

# Check for tables that exist in target but not source
echo ""
echo "🔍 Checking for TARGET-ONLY tables..."
while IFS='|' read -r table_name target_count; do
    table_name=$(echo "$table_name" | xargs)
    if ! grep -q "^[[:space:]]*$table_name[[:space:]]*|" source_counts.txt; then
        echo "⚠️  Target-only table: $table_name ($target_count rows)"
    fi
done < target_counts.txt

# Calculate totals
echo ""
echo "📈 SUMMARY STATISTICS:"
echo "================================================"

SOURCE_TOTAL=$(awk -F'|' '{sum += $2} END {print sum}' source_counts.txt)
TARGET_TOTAL=$(awk -F'|' '{sum += $2} END {print sum}' target_counts.txt)

echo "Total rows in SOURCE: $SOURCE_TOTAL"
echo "Total rows in TARGET: $TARGET_TOTAL"

if [ "$SOURCE_TOTAL" -eq "$TARGET_TOTAL" ] 2>/dev/null; then
    echo "✅ TOTAL ROW COUNT MATCHES!"
else
    echo "❌ TOTAL ROW COUNT MISMATCH!"
    echo "   Difference: $((TARGET_TOTAL - SOURCE_TOTAL)) rows"
fi

# Check database sizes
echo ""
echo "💾 DATABASE SIZE COMPARISON:"
echo "================================================"

SOURCE_SIZE=$(docker exec db-verify-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c \"SELECT pg_size_pretty(pg_database_size('$SOURCE_DB'));\"" | xargs)
TARGET_SIZE=$(docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -c "SELECT pg_size_pretty(pg_database_size('$TARGET_DB'));" | xargs)

echo "Source database size: $SOURCE_SIZE"
echo "Target database size: $TARGET_SIZE"

# Check for missing critical tables
echo ""
echo "🔍 CRITICAL TABLE VERIFICATION:"
echo "================================================"

CRITICAL_TABLES=("players" "player_game_stats" "teams_master" "games_master")

for table in "${CRITICAL_TABLES[@]}"; do
    SOURCE_COUNT=$(grep "^[[:space:]]*$table[[:space:]]*|" source_counts.txt | cut -d'|' -f2 | xargs)
    TARGET_COUNT=$(grep "^[[:space:]]*$table[[:space:]]*|" target_counts.txt | cut -d'|' -f2 | xargs)
    
    if [ -z "$SOURCE_COUNT" ]; then
        echo "⚠️  Critical table $table not found in SOURCE"
    elif [ -z "$TARGET_COUNT" ]; then
        echo "❌ Critical table $table MISSING in TARGET"
    elif [ "$SOURCE_COUNT" -eq "$TARGET_COUNT" ] 2>/dev/null; then
        echo "✅ Critical table $table: $SOURCE_COUNT rows (MATCH)"
    else
        echo "❌ Critical table $table: SOURCE=$SOURCE_COUNT, TARGET=$TARGET_COUNT (MISMATCH)"
    fi
done

# Cleanup
echo ""
echo "🧹 Cleaning up..."
docker rm -f db-verify-helper
rm -f source_tables.txt target_tables.txt source_counts.txt target_counts.txt source_count_query.sql target_count_query.sql

echo ""
echo "✨ Verification complete!"
echo ""
echo "🎯 If there are any mismatches, we'll need to re-run the migration"
echo "🎯 If everything matches, we can proceed with avatar population"