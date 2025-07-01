#!/bin/bash
# Start both web and mobile development servers

echo "🚀 Starting Fantasy AI Ultimate Development Servers..."

# Kill any existing processes on our ports
echo "🧹 Cleaning up old processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:4200 | xargs kill -9 2>/dev/null || true
lsof -ti:8081 | xargs kill -9 2>/dev/null || true
lsof -ti:19000 | xargs kill -9 2>/dev/null || true
lsof -ti:19006 | xargs kill -9 2>/dev/null || true

# Change to project directory
cd /mnt/c/Users/st0ne/Hey\ Fantasy/fantasy-ai-ultimate

# Start web server in background
echo "🌐 Starting Web Server (Next.js)..."
npm run dev:web > web.log 2>&1 &
WEB_PID=$!
echo "   Web server PID: $WEB_PID"

# Give web server time to start
sleep 5

# Start mobile server in background
echo "📱 Starting Mobile Server (Expo)..."
npm run dev:mobile > mobile.log 2>&1 &
MOBILE_PID=$!
echo "   Mobile server PID: $MOBILE_PID"

# Wait a bit for servers to start
echo "⏳ Waiting for servers to start..."
sleep 10

# Check if servers are running
echo ""
echo "🔍 Checking server status..."

if ps -p $WEB_PID > /dev/null; then
    echo "✅ Web server is running"
    echo "   URL: http://localhost:3000"
else
    echo "❌ Web server failed to start"
    echo "   Check web.log for errors"
fi

if ps -p $MOBILE_PID > /dev/null; then
    echo "✅ Mobile server is running"
    echo "   Expo: http://localhost:19006"
    echo "   Metro: http://localhost:8081"
else
    echo "❌ Mobile server failed to start"
    echo "   Check mobile.log for errors"
fi

echo ""
echo "📝 Logs are being written to:"
echo "   - web.log (Next.js)"
echo "   - mobile.log (Expo)"
echo ""
echo "🛑 To stop servers, run:"
echo "   kill $WEB_PID $MOBILE_PID"
echo ""
echo "🎉 Happy coding!"

# Keep script running
tail -f /dev/null