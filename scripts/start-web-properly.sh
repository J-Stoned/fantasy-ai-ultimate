#!/bin/bash

echo "🔥 STARTING FANTASY AI ULTIMATE WEB APP"
echo "===================================="
echo ""

# Change to project root
cd /mnt/c/Users/st0ne/Hey\ Fantasy/fantasy-ai-ultimate

# Load environment variables
if [ -f .env.local ]; then
  echo "✅ Loading environment variables from .env.local"
  export $(cat .env.local | grep -v '^#' | xargs)
else
  echo "❌ .env.local not found!"
  exit 1
fi

# Change to web directory
cd apps/web

# Show what we're starting
echo ""
echo "📁 Working directory: $(pwd)"
echo "🌐 Server will run on: http://localhost:3000"
echo "🔗 WSL IP: $(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)"
echo ""
echo "✅ Starting Next.js..."
echo ""

# Start Next.js with all IPs
exec npx next dev -H 0.0.0.0 -p 3000