#!/bin/bash

# 🛑 Stop all Fantasy AI services

echo "🛑 Stopping Fantasy AI Services..."

# Kill all services using PID files
for pid_file in pids/*.pid; do
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null; then
            echo "Stopping process $pid..."
            kill $pid 2>/dev/null
        fi
        rm "$pid_file"
    fi
done

echo "✅ All services stopped"