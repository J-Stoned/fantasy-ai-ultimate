#!/bin/bash

# Full Database Migration Script using Docker
# Migrates entire PostgreSQL 16 database to Docker container

set -e

echo "🚀 Starting full database migration using Docker..."
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

# Create a temporary Docker container with pg_dump tools
echo "🐳 Creating helper container with PostgreSQL tools..."
docker run -d --name pg-migration-helper --network host postgres:16-alpine tail -f /dev/null

# Step 1: Test source connection using helper container
echo ""
echo "📡 Testing source database connection..."
docker exec pg-migration-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -c 'SELECT COUNT(*) as player_count FROM players;'"

if [ $? -eq 0 ]; then
    echo "✅ Source database connection successful"
else
    echo "❌ Failed to connect to source database"
    docker rm -f pg-migration-helper
    exit 1
fi

# Step 2: Get source database statistics
echo ""
echo "📊 Source database statistics:"
docker exec pg-migration-helper sh -c "PGPASSWORD=$SOURCE_PASS psql -h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB -t -c \"
SELECT 
    'Database Size: ' || pg_size_pretty(pg_database_size('$SOURCE_DB')),
    'Total Tables: ' || COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
\""

# Step 3: Prepare target database
echo ""
echo "🔄 Preparing target database..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d postgres -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '$TARGET_DB' AND pid <> pg_backend_pid();
" 2>/dev/null || true

docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d postgres -c "DROP DATABASE IF EXISTS $TARGET_DB;"
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d postgres -c "CREATE DATABASE $TARGET_DB OWNER $TARGET_USER;"

# Step 4: Direct pipe migration (fastest method)
echo ""
echo "🚀 Starting direct database migration..."
echo "This will transfer approximately 3.3GB of data..."
echo "================================================"

# Use direct pipe for fastest transfer
docker exec pg-migration-helper sh -c "
PGPASSWORD=$SOURCE_PASS pg_dump \
    -h $SOURCE_HOST \
    -p $SOURCE_PORT \
    -U $SOURCE_USER \
    -d $SOURCE_DB \
    --no-owner \
    --no-privileges \
    --no-comments \
    --if-exists \
    --clean \
    --verbose \
    2>/dev/null" | \
docker exec -i $TARGET_CONTAINER sh -c "
PGPASSWORD=$TARGET_PASS psql \
    -U $TARGET_USER \
    -d $TARGET_DB \
    -v ON_ERROR_STOP=0 \
    2>&1 | grep -E '(ERROR|CREATE|ALTER|COPY|INSERT)' || true"

# Step 5: Add avatar columns
echo ""
echo "🎨 Adding avatar columns to players table..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -c "
ALTER TABLE players 
ADD COLUMN IF NOT EXISTS avatar_tier VARCHAR(10) DEFAULT 'bench' CHECK (avatar_tier IN ('star', 'starter', 'bench')),
ADD COLUMN IF NOT EXISTS avatar_3d_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_2d_url TEXT,
ADD COLUMN IF NOT EXISTS avatar_photo_url TEXT,
ADD COLUMN IF NOT EXISTS overall_rating INTEGER DEFAULT 60 CHECK (overall_rating >= 0 AND overall_rating <= 99),
ADD COLUMN IF NOT EXISTS avatar_metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_players_avatar_tier ON players(avatar_tier);
CREATE INDEX IF NOT EXISTS idx_players_overall_rating ON players(overall_rating);"

# Step 6: Verify migration
echo ""
echo "🔍 Verifying migration results..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -c "
SELECT 
    'Total Players' as metric, COUNT(*)::text as value FROM players
UNION ALL
SELECT 'NFL Players', COUNT(*)::text FROM players WHERE sport = 'football'
UNION ALL
SELECT 'NBA Players', COUNT(*)::text FROM players WHERE sport = 'basketball'
UNION ALL
SELECT 'MLB Players', COUNT(*)::text FROM players WHERE sport = 'baseball'
UNION ALL
SELECT 'NHL Players', COUNT(*)::text FROM players WHERE sport = 'hockey'
UNION ALL
SELECT 'Total Teams', COUNT(*)::text FROM teams_master
UNION ALL
SELECT 'Total Game Stats', COUNT(*)::text FROM player_game_stats
UNION ALL
SELECT 'Database Size', pg_size_pretty(pg_database_size('$TARGET_DB'))
ORDER BY 1;"

# Step 7: Update overall ratings for star players
echo ""
echo "⭐ Setting ratings for known star players..."
docker exec $TARGET_CONTAINER psql -U $TARGET_USER -d $TARGET_DB -c "
-- NFL Stars
UPDATE players SET overall_rating = 98 WHERE last_name = 'Mahomes' AND first_name = 'Patrick' AND sport = 'football';
UPDATE players SET overall_rating = 97 WHERE last_name = 'McCaffrey' AND first_name = 'Christian' AND sport = 'football';
UPDATE players SET overall_rating = 96 WHERE last_name = 'Jefferson' AND first_name = 'Justin' AND sport = 'football';
UPDATE players SET overall_rating = 95 WHERE last_name = 'Kelce' AND first_name = 'Travis' AND sport = 'football';

-- NBA Stars  
UPDATE players SET overall_rating = 98 WHERE last_name = 'Jokic' AND first_name = 'Nikola' AND sport = 'basketball';
UPDATE players SET overall_rating = 97 WHERE last_name = 'Antetokounmpo' AND first_name = 'Giannis' AND sport = 'basketball';
UPDATE players SET overall_rating = 96 WHERE last_name = 'Doncic' AND first_name = 'Luka' AND sport = 'basketball';

-- MLB Stars
UPDATE players SET overall_rating = 98 WHERE last_name = 'Ohtani' AND first_name = 'Shohei' AND sport = 'baseball';
UPDATE players SET overall_rating = 96 WHERE last_name = 'Judge' AND first_name = 'Aaron' AND sport = 'baseball';

-- NHL Stars
UPDATE players SET overall_rating = 97 WHERE last_name = 'McDavid' AND first_name = 'Connor' AND sport = 'hockey';
UPDATE players SET overall_rating = 96 WHERE last_name = 'Matthews' AND first_name = 'Auston' AND sport = 'hockey';"

# Step 8: Clean up
echo ""
echo "🧹 Cleaning up helper container..."
docker rm -f pg-migration-helper

echo ""
echo "✨ Migration complete!"
echo "================================================"
echo ""
echo "🎯 Next steps:"
echo "1. Run: npm run avatars:populate (to populate avatar URLs)"
echo "2. Update .env DATABASE_URL_LOCAL to use Docker database"
echo "3. Restart the web application"
echo ""
echo "📝 Docker database connection info:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: fantasy_ai"
echo "   User: fantasy_user"
echo "   Password: fantasy_password"