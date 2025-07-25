#!/bin/bash

echo "🐘 Starting PostgreSQL database for Fantasy AI..."

# Check if PostgreSQL container already exists
if docker ps -a | grep -q fantasy-postgres; then
    echo "📦 PostgreSQL container exists, starting it..."
    docker start fantasy-postgres
else
    echo "🚀 Creating new PostgreSQL container..."
    docker run -d \
        --name fantasy-postgres \
        -e POSTGRES_USER=postgres \
        -e POSTGRES_PASSWORD=postgres \
        -e POSTGRES_DB=fantasy_ml \
        -p 5432:5432 \
        -v fantasy-postgres-data:/var/lib/postgresql/data \
        postgres:15-alpine
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec fantasy-postgres pg_isready -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        echo ""
        echo "📊 Database Information:"
        echo "  Host: localhost (or host.docker.internal from other containers)"
        echo "  Port: 5432"
        echo "  Database: fantasy_ml"
        echo "  User: postgres"
        echo "  Password: postgres"
        echo ""
        echo "🔗 Connection string: postgresql://postgres:postgres@localhost:5432/fantasy_ml"
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo "❌ PostgreSQL failed to start within 30 seconds"
exit 1