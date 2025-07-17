#!/bin/bash

# 🔥 FANTASY AI ULTIMATE - START ALL SERVICES 🔥
# This script starts all backend services for the pattern detection empire

echo "🚀 Starting Fantasy AI Ultimate Backend Services..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo -e "${YELLOW}⚠️  Redis is not running. Starting Redis...${NC}"
    redis-server --daemonize yes
    sleep 2
fi

# Function to start a service in background
start_service() {
    local name=$1
    local path=$2
    local port=$3
    
    echo -e "${GREEN}Starting $name on port $port...${NC}"
    cd "$path" && npm start > "../logs/${name}.log" 2>&1 &
    echo $! > "../pids/${name}.pid"
    sleep 3
    
    # Check if service started
    if curl -s "http://localhost:$port/health" > /dev/null; then
        echo -e "${GREEN}✅ $name started successfully${NC}"
    else
        echo -e "${RED}❌ $name failed to start${NC}"
    fi
}

# Create directories for logs and PIDs
mkdir -p logs pids

# Kill any existing services
echo "Stopping any existing services..."
for pid_file in pids/*.pid; do
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null; then
            kill $pid 2>/dev/null
        fi
    fi
done
rm -f pids/*.pid

# Start services in order
echo -e "\n${YELLOW}1. Starting Pattern Detection APIs...${NC}"
cd pattern-detection
npx tsx production-pattern-api-v4.ts > ../logs/pattern-v4.log 2>&1 &
echo $! > ../pids/pattern-v4.pid
sleep 3

npx tsx unified-pattern-api.ts > ../logs/pattern-unified.log 2>&1 &
echo $! > ../pids/pattern-unified.pid
sleep 3
cd ..

# Start API Gateway
echo -e "\n${YELLOW}2. Starting API Gateway...${NC}"
start_service "API Gateway" "api-gateway" 3000

# Start WebSocket Server
echo -e "\n${YELLOW}3. Starting WebSocket Server...${NC}"
start_service "WebSocket Server" "websocket" 3338

# Start Enhanced Prediction Service
echo -e "\n${YELLOW}4. Starting Enhanced Prediction Service...${NC}"
start_service "Prediction Service" "production-services" 3339

# Start Pattern Scanner
echo -e "\n${YELLOW}5. Starting Real-time Pattern Scanner...${NC}"
cd pattern-detection
npx tsx realtime-pattern-scanner.ts > ../logs/pattern-scanner.log 2>&1 &
echo $! > ../pids/pattern-scanner.pid
cd ..

# Summary
echo -e "\n${GREEN}================================================${NC}"
echo -e "${GREEN}🔥 FANTASY AI SERVICES RUNNING:${NC}"
echo -e "${GREEN}================================================${NC}"
echo "✅ Pattern API V4:          http://localhost:3337"
echo "✅ Unified Pattern API:     http://localhost:3336"
echo "✅ API Gateway:             http://localhost:3000"
echo "✅ WebSocket Server:        ws://localhost:3338"
echo "✅ Prediction Service:      http://localhost:3339"
echo "✅ Pattern Scanner:         Running in background"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "📊 View logs in: ./logs/"
echo "🛑 Stop all: ./stop-all-services.sh"
echo ""
echo -e "${GREEN}🚀 Ready for pattern detection domination!${NC}"