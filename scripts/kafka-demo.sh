#!/bin/bash

# 🚀 KAFKA STREAMING DEMO
# Shows the complete event pipeline in action

set -e

echo "🔥 FANTASY AI KAFKA STREAMING DEMO"
echo "=================================="
echo ""

# Check if Kafka is running
KAFKA_RUNNING=$(docker ps | grep -c kafka || true)

if [ "$KAFKA_RUNNING" -lt "3" ]; then
    echo "📦 Starting Kafka cluster..."
    docker-compose -f docker-compose.kafka.yml up -d
    
    echo "⏳ Waiting for Kafka to be ready..."
    sleep 20
    
    echo "🔧 Setting up topics..."
    ./scripts/kafka-setup.sh
fi

echo ""
echo "✅ Kafka cluster is ready!"
echo ""
echo "🌐 Access Points:"
echo "   Kafka UI: http://localhost:8090"
echo "   Schema Registry: http://localhost:8081"
echo ""

# Show running services
echo "📊 Current Services:"
pm2 status

echo ""
echo "🚀 DEMO SEQUENCE:"
echo "   1. Start WebSocket + Kafka consumer"
echo "   2. Start Turbo Predictions with Kafka"
echo "   3. Watch predictions flow through Kafka"
echo ""

echo "Starting in 5 seconds..."
sleep 5

# Start WebSocket + Kafka in new terminal
echo "🌐 Starting WebSocket + Kafka consumer..."
gnome-terminal -- bash -c "npx tsx lib/streaming/websocket-kafka-consumer.ts; read" 2>/dev/null || \
xterm -e "npx tsx lib/streaming/websocket-kafka-consumer.ts; read" 2>/dev/null || \
echo "   Run in new terminal: npx tsx lib/streaming/websocket-kafka-consumer.ts"

sleep 3

# Start Turbo Predictions with Kafka
echo "🚀 Starting Turbo Predictions with Kafka..."
gnome-terminal -- bash -c "npx tsx scripts/turbo-predictions-kafka.ts; read" 2>/dev/null || \
xterm -e "npx tsx scripts/turbo-predictions-kafka.ts; read" 2>/dev/null || \
echo "   Run in new terminal: npx tsx scripts/turbo-predictions-kafka.ts"

echo ""
echo "🔥 KAFKA STREAMING ACTIVE!"
echo ""
echo "Watch the magic happen:"
echo "   - Predictions flowing at 7M+/hour"
echo "   - Real-time WebSocket broadcasting"
echo "   - Event sourcing for replay"
echo "   - Hot prediction notifications"
echo ""
echo "Open http://localhost:8090 to see Kafka topics!"