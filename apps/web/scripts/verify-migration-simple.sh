#!/bin/bash

# Simple Database Verification Script
# Compares table counts between source and target databases

set -e

echo "🔍 DATABASE MIGRATION VERIFICATION"
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
docker run -d --name verify-helper --network host postgres:16-alpine tail -f /dev/null

echo ""
echo "📊 SOURCE DATABASE ANALYSIS:"
echo "================================================"

# Get all table names and counts from source
docker exec verify-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c \"
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
\"" > source_tables.txt

echo "Tables in SOURCE database:"
cat source_tables.txt | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | nl

# Get row counts for each table in source
echo ""
echo "Getting row counts from SOURCE..."
printf "%-40s %15s\n" "TABLE NAME" "ROW COUNT"
echo "------------------------------------------------------------"

total_source_rows=0
while read -r table; do
    table=$(echo "$table" | xargs)  # Remove whitespace
    if [ -n "$table" ]; then
        row_count=$(docker exec verify-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c \"SELECT COUNT(*) FROM $table;\"" | xargs)
        printf "%-40s %15s\n" "$table" "$row_count"
        total_source_rows=$((total_source_rows + row_count))
        echo "$table|$row_count" >> source_counts.txt
    fi
done < source_tables.txt

echo "------------------------------------------------------------"
echo "TOTAL SOURCE ROWS: $total_source_rows"

echo ""
echo "📊 TARGET DATABASE ANALYSIS:"
echo "================================================"

# Get all table names from target
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
" > target_tables.txt

echo "Tables in TARGET database:"
cat target_tables.txt | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | nl

# Get row counts for each table in target
echo ""
echo "Getting row counts from TARGET..."
printf "%-40s %15s\n" "TABLE NAME" "ROW COUNT"
echo "------------------------------------------------------------"

total_target_rows=0
while read -r table; do
    table=$(echo "$table" | xargs)  # Remove whitespace
    if [ -n "$table" ]; then
        row_count=$(docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -c "SELECT COUNT(*) FROM $table;" | xargs)
        printf "%-40s %15s\n" "$table" "$row_count"
        total_target_rows=$((total_target_rows + row_count))
        echo "$table|$row_count" >> target_counts.txt
    fi
done < target_tables.txt

echo "------------------------------------------------------------"
echo "TOTAL TARGET ROWS: $total_target_rows"

echo ""
echo "🔍 COMPARISON RESULTS:"
echo "================================================"

# Compare table counts
source_table_count=$(cat source_tables.txt | grep -v '^[[:space:]]*$' | wc -l)
target_table_count=$(cat target_tables.txt | grep -v '^[[:space:]]*$' | wc -l)

echo "SOURCE TABLES: $source_table_count"
echo "TARGET TABLES: $target_table_count"

if [ "$source_table_count" -eq "$target_table_count" ]; then
    echo "✅ Table count matches!"
else
    echo "❌ Table count MISMATCH!"
fi

echo ""
echo "ROW COUNT COMPARISON:"
printf "%-40s %15s %15s %10s\n" "TABLE" "SOURCE" "TARGET" "STATUS"
echo "-------------------------------------------------------------------------"

# Compare each table
while IFS='|' read -r table source_count; do
    if [ -n "$table" ]; then
        target_count=$(grep "^$table|" target_counts.txt 2>/dev/null | cut -d'|' -f2)
        
        if [ -z "$target_count" ]; then
            status="❌ MISSING"
            target_count="0"
        elif [ "$source_count" -eq "$target_count" ] 2>/dev/null; then
            status="✅ MATCH"
        else
            status="❌ MISMATCH"
        fi
        
        printf "%-40s %15s %15s %10s\n" "$table" "$source_count" "$target_count" "$status"
    fi
done < source_counts.txt

echo "-------------------------------------------------------------------------"
echo "TOTAL ROWS - SOURCE: $total_source_rows | TARGET: $total_target_rows"

if [ "$total_source_rows" -eq "$total_target_rows" ]; then
    echo "✅ TOTAL ROW COUNT MATCHES!"
else
    echo "❌ TOTAL ROW COUNT MISMATCH!"
    echo "Difference: $((total_target_rows - total_source_rows)) rows"
fi

# Check for missing tables
echo ""
echo "🔍 MISSING TABLE CHECK:"
echo "================================================"

echo "Tables in SOURCE but not in TARGET:"
while read -r source_table; do
    source_table=$(echo "$source_table" | xargs)
    if [ -n "$source_table" ] && ! grep -q "^[[:space:]]*$source_table[[:space:]]*$" target_tables.txt; then
        echo "❌ MISSING: $source_table"
    fi
done < source_tables.txt

echo ""
echo "Tables in TARGET but not in SOURCE:"
while read -r target_table; do
    target_table=$(echo "$target_table" | xargs)
    if [ -n "$target_table" ] && ! grep -q "^[[:space:]]*$target_table[[:space:]]*$" source_tables.txt; then
        echo "⚠️  EXTRA: $target_table"
    fi
done < target_tables.txt

# Database sizes
echo ""
echo "💾 DATABASE SIZES:"
echo "================================================"

source_size=$(docker exec verify-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c \"SELECT pg_size_pretty(pg_database_size('$SOURCE_DB'));\"" | xargs)
target_size=$(docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -c "SELECT pg_size_pretty(pg_database_size('$TARGET_DB'));" | xargs)

echo "SOURCE: $source_size"
echo "TARGET: $target_size"

# Cleanup
echo ""
echo "🧹 Cleaning up..."
docker rm -f verify-helper
rm -f source_tables.txt target_tables.txt source_counts.txt target_counts.txt

echo ""
if [ "$total_source_rows" -eq "$total_target_rows" ] && [ "$source_table_count" -eq "$target_table_count" ]; then
    echo "✅ MIGRATION SUCCESSFUL! All data transferred correctly."
    echo "🎯 Ready to populate avatar data for $total_target_rows total records!"
else
    echo "❌ MIGRATION INCOMPLETE! Please check the differences above."
    echo "🔄 Consider re-running the migration script."
fi