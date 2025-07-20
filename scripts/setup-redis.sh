#!/bin/bash
# Redis installation script for WSL

echo "🔴 Installing Redis for Fantasy AI..."
echo "You'll need to enter your WSL password when prompted."
echo ""

# Update package list
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Start Redis service
sudo service redis-server start

# Enable Redis to start on boot
sudo systemctl enable redis-server 2>/dev/null || echo "systemctl not available, skipping auto-start"

# Test Redis
echo ""
echo "🧪 Testing Redis connection..."
if redis-cli ping | grep -q "PONG"; then
    echo "✅ Redis installed and running successfully!"
    echo "🟢 Redis is ready at localhost:6379"
    echo ""
    echo "📝 Redis commands:"
    echo "  Start:   sudo service redis-server start"
    echo "  Stop:    sudo service redis-server stop"
    echo "  Status:  sudo service redis-server status"
    echo "  Test:    redis-cli ping"
else
    echo "❌ Redis installation failed"
fi