#!/bin/bash
# START DATA COLLECTION - Marcus "The Fixer" Rodriguez
# This script activates all data collection services

echo "🚀 STARTING FANTASY AI ULTIMATE DATA COLLECTION"
echo "=============================================="

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis not running. Starting Redis..."
    # For Windows/WSL
    sudo service redis-server start || {
        echo "Installing Redis..."
        sudo apt update && sudo apt install redis-server -y
        sudo service redis-server start
    }
fi

echo "✅ Redis is running"

# Test database connection
echo "🔍 Testing database connection..."
npm run test:db || {
    echo "❌ Database connection failed!"
    echo "Please check your .env.local credentials"
    exit 1
}

echo "✅ Database connected"

# Run migrations if needed
echo "📊 Checking database schema..."
npm run migrate || {
    echo "⚠️  Migration failed, but continuing..."
}

# Create a cron starter script
cat > start-cron.ts << 'EOF'
import { registerAllCronJobs } from './lib/cron/jobs/registerJobs';
import { cronLogger } from './lib/utils/logger';

async function startCronJobs() {
  cronLogger.info('🚀 Starting Fantasy AI Ultimate Data Collection');
  
  try {
    await registerAllCronJobs();
    cronLogger.info('✅ All cron jobs registered and running');
    
    // Keep the process alive
    process.on('SIGINT', () => {
      cronLogger.info('Shutting down cron jobs...');
      process.exit(0);
    });
    
    // Log status every 5 minutes
    setInterval(() => {
      cronLogger.info('Data collection running...', {
        uptime: process.uptime(),
        memory: process.memoryUsage()
      });
    }, 5 * 60 * 1000);
    
  } catch (error) {
    cronLogger.error('Failed to start cron jobs', error);
    process.exit(1);
  }
}

startCronJobs();
EOF

# Start the cron jobs
echo "🎯 Starting cron jobs..."
npx tsx start-cron.ts &
CRON_PID=$!

echo "✅ Data collection started! (PID: $CRON_PID)"
echo ""
echo "📊 ACTIVE DATA COLLECTORS:"
echo "  - NFL Live Scores (every 30s during games)"
echo "  - NBA Live Scores (every 30s during games)"
echo "  - Player Stats (every 2 minutes)"
echo "  - Injury Reports (every 30 minutes)"
echo "  - Sports News (every 15 minutes)"
echo "  - Social Mentions (every 10 minutes)"
echo ""
echo "🔍 Monitor logs at: logs/cron.log"
echo "📈 Check status at: http://localhost:3000/api/cron/status"
echo ""
echo "To stop: kill $CRON_PID"