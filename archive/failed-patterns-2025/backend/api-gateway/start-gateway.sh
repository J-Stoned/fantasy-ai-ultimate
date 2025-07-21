#!/bin/bash

# 🔥 Start Fantasy AI API Gateway
# This script starts the API gateway that unifies our pattern detection services

echo "🚀 Starting Fantasy AI API Gateway..."

# Load environment variables
if [ -f ../../.env ]; then
    export $(cat ../../.env | grep -v '^#' | xargs)
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if pattern APIs are running
echo "🔍 Checking pattern APIs..."

if ! curl -s http://localhost:3336/health > /dev/null; then
    echo "⚠️  Unified Pattern API (3336) is not running!"
    echo "   Start it with: npx tsx scripts/pattern-detection/unified-pattern-api.ts"
fi

if ! curl -s http://localhost:3337/health > /dev/null; then
    echo "⚠️  Pattern API V4 (3337) is not running!"
    echo "   Start it with: npx tsx scripts/pattern-detection/production-pattern-api-v4.ts"
fi

# Start the gateway
echo "🔥 Starting API Gateway on port 3000..."
npm start