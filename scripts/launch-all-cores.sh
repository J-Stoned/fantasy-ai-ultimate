#!/bin/bash

# 🚀 LAUNCH ALL CORES - MAX CPU UTILIZATION!
echo "🚀 LAUNCHING ALL CPU CORES FOR MAXIMUM STATS COLLECTION!"
echo "=================================================="
echo "CPU Cores: $(nproc)"
echo "Starting time: $(date)"
echo ""

# Kill any existing collectors
echo "🧹 Cleaning up existing processes..."
pkill -f "tsx.*collector" || true
sleep 2

# Create logs directory
mkdir -p logs

# Function to launch collector with specific date range
launch_collector() {
    local WORKER_ID=$1
    local START_DATE=$2
    local END_DATE=$3
    local SCRIPT=$4
    
    echo "🚀 Launching Worker $WORKER_ID: $START_DATE to $END_DATE"
    
    # Set environment variables for date range
    export COLLECTOR_START_DATE=$START_DATE
    export COLLECTOR_END_DATE=$END_DATE
    export WORKER_ID=$WORKER_ID
    
    # Launch in background, redirect output to log
    npx tsx scripts/$SCRIPT > logs/worker-$WORKER_ID.log 2>&1 &
    
    echo "   PID: $!"
}

# Launch MLB collectors for different date ranges
echo -e "\n⚾ LAUNCHING MLB COLLECTORS (2024 Season Priority)..."

# Current month (July 2024)
launch_collector 1 "2024-07-01" "2024-07-31" "turbo-mlb-max-cpu.ts"
launch_collector 2 "2024-07-01" "2024-07-31" "turbo-mlb-max-cpu.ts"

# June 2024
launch_collector 3 "2024-06-01" "2024-06-30" "turbo-mlb-max-cpu.ts"
launch_collector 4 "2024-06-01" "2024-06-30" "turbo-mlb-max-cpu.ts"

# May 2024
launch_collector 5 "2024-05-01" "2024-05-31" "turbo-mlb-max-cpu.ts"
launch_collector 6 "2024-05-01" "2024-05-31" "turbo-mlb-max-cpu.ts"

# April 2024
launch_collector 7 "2024-04-01" "2024-04-30" "turbo-mlb-max-cpu.ts"
launch_collector 8 "2024-04-01" "2024-04-30" "turbo-mlb-max-cpu.ts"

# 2023 Season (for historical data)
launch_collector 9 "2023-04-01" "2023-10-31" "supercharged-auto-collector.ts"
launch_collector 10 "2023-04-01" "2023-10-31" "supercharged-auto-collector.ts"

# Universal collectors for other sports
launch_collector 11 "2024-01-01" "2024-12-31" "supercharged-auto-collector.ts"
launch_collector 12 "2024-01-01" "2024-12-31" "supercharged-auto-collector.ts"

# Wait a moment for processes to start
sleep 3

# Show running processes
echo -e "\n📊 ACTIVE COLLECTORS:"
ps aux | grep -E "tsx.*collector" | grep -v grep | wc -l | xargs echo "Total running:"

# Launch monitoring in foreground
echo -e "\n📈 LAUNCHING LIVE MONITOR..."
echo "Press Ctrl+C to stop all collectors"
echo ""

# Trap to kill all collectors on exit
trap 'echo -e "\n🛑 Stopping all collectors..."; pkill -f "tsx.*collector"; exit' INT

# Run monitor
npx tsx scripts/coverage-monitor.ts

# This line only runs if monitor exits normally
echo "Monitor exited. Collectors still running in background."
echo "To stop all: pkill -f 'tsx.*collector'"