#!/bin/bash

# Full Database Migration Script
# Migrates entire PostgreSQL 16 database to Docker container

set -e

echo "🚀 Starting full database migration..."
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

# Step 1: Test connections
echo "📡 Testing source database connection..."
PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Source database connection successful"
else
    echo "❌ Failed to connect to source database"
    exit 1
fi

echo "📡 Testing target database connection..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d postgres -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Target database connection successful"
else
    echo "❌ Failed to connect to target database"
    exit 1
fi

# Step 2: Get source database info
echo ""
echo "📊 Source database info:"
PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c "
SELECT 
    pg_size_pretty(pg_database_size('$SOURCE_DB')) as size,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as tables,
    (SELECT COUNT(*) FROM players) as players
"

# Step 3: Create dump file
echo ""
echo "📦 Creating database dump..."
echo "This may take several minutes for a 3.3GB database..."

DUMP_FILE="/tmp/fantasy_ai_full_dump_$(date +%Y%m%d_%H%M%S).sql"

# Use parallel jobs for faster dump
PGPASSWORD=$SOURCE_PASS pg_dump \
    -h $SOURCE_HOST \
    -p $SOURCE_PORT \
    -U $SOURCE_USER \
    -d $SOURCE_DB \
    --no-owner \
    --no-privileges \
    --verbose \
    --jobs=4 \
    -Fd \
    -f "${DUMP_FILE}_dir"

if [ $? -eq 0 ]; then
    echo "✅ Database dump created successfully"
else
    echo "❌ Database dump failed"
    exit 1
fi

# Step 4: Drop and recreate target database
echo ""
echo "🔄 Preparing target database..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d postgres -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
"

docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;"
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d postgres -c "CREATE DATABASE $TARGET_DB OWNER $TARGET_USER;"

# Step 5: Copy dump to container
echo ""
echo "📤 Copying dump to Docker container..."
docker cp "${DUMP_FILE}_dir" $TARGET_CONTAINER:/tmp/

# Step 6: Restore database
echo ""
echo "🔄 Restoring database in Docker container..."
echo "This may take several minutes..."

docker exec $TARGET_CONTAINER pg_restore \
    -U $TARGET_USER \
    -d $TARGET_DB \
    --verbose \
    --jobs=4 \
    --no-owner \
    --no-privileges \
    /tmp/$(basename "${DUMP_FILE}_dir")

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully"
else
    echo "⚠️  Some warnings during restore (this is normal)"
fi

# Step 7: Verify migration
echo ""
echo "🔍 Verifying migration..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -c "
SELECT 
    'Tables' as type, COUNT(*) as count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT 'Players', COUNT(*) FROM players
UNION ALL
SELECT 'Game Stats', COUNT(*) FROM player_game_stats
UNION ALL
SELECT 'Teams', COUNT(*) FROM teams_master;
"

# Step 8: Run avatar migration
echo ""
echo "🎨 Adding avatar columns..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -c "
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS avatar_tier VARCHAR(10) DEFAULT 'bench' CHECK (avatar_tier IN ('star', 'starter', 'bench')),
ADD COLUMN IF NOT EXISTS avatar_3d_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_2d_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_photo_url TEXT,
ADD COLUMN IF NOT EXISTS overall_rating INTEGER DEFAULT 60 CHECK (overall_rating >= 0 AND overall_rating <= 99),
ADD COLUMN IF NOT EXISTS avatar_metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_players_avatar_tier ON players(avatar_tier);
CREATE INDEX IF NOT EXISTS idx_players_overall_rating ON players(overall_rating);
"

# Step 9: Clean up
echo ""
echo "🧹 Cleaning up temporary files..."
rm -rf "${DUMP_FILE}_dir"
docker exec $TARGET_CONTAINER rm -rf /tmp/$(basename "${DUMP_FILE}_dir")

echo ""
echo "✨ Migration complete!"
echo "================================================"
echo "📊 Final database statistics:"
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -t -c "
SELECT 
    pg_size_pretty(pg_database_size('$TARGET_DB')) as database_size,
    (SELECT COUNT(*) FROM players) as total_players,
    (SELECT COUNT(*) FROM player_game_stats) as total_game_stats;
"

echo ""
echo "🎯 Next steps:"
echo "1. Run: npm run avatars:populate"
echo "2. Update .env to use Docker database"
echo "3. Restart the web application"