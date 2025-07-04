#!/bin/bash

# 🚀 KAFKA SETUP SCRIPT
# Creates all topics and configurations for Fantasy AI

set -e

echo "🎯 FANTASY AI KAFKA SETUP"
echo "=========================="

# Wait for Kafka to be ready
echo "⏳ Waiting for Kafka cluster to be ready..."
sleep 10

# Kafka broker addresses
KAFKA_BROKERS="localhost:9092,localhost:9093,localhost:9094"

# Create topics
echo "📦 Creating Kafka topics..."

# Predictions topic - High volume, 16 partitions
docker exec fantasy-kafka-1 kafka-topics --create \
  --bootstrap-server kafka-1:29092 \
  --topic predictions \
  --partitions 16 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config compression.type=lz4 \
  --config segment.ms=3600000 \
  --if-not-exists

# Game events topic
docker exec fantasy-kafka-1 kafka-topics --create \
  --bootstrap-server kafka-1:29092 \
  --topic game-events \
  --partitions 8 \
  --replication-factor 3 \
  --config retention.ms=2592000000 \
  --if-not-exists

# ML metrics topic
docker exec fantasy-kafka-1 kafka-topics --create \
  --bootstrap-server kafka-1:29092 \
  --topic ml-metrics \
  --partitions 4 \
  --replication-factor 3 \
  --config retention.ms=7776000000 \
  --if-not-exists

# User actions topic
docker exec fantasy-kafka-1 kafka-topics --create \
  --bootstrap-server kafka-1:29092 \
  --topic user-actions \
  --partitions 8 \
  --replication-factor 3 \
  --config retention.ms=2592000000 \
  --if-not-exists

# Betting odds topic
docker exec fantasy-kafka-1 kafka-topics --create \
  --bootstrap-server kafka-1:29092 \
  --topic betting-odds \
  --partitions 4 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --if-not-exists

# Notifications topic
docker exec fantasy-kafka-1 kafka-topics --create \
  --bootstrap-server kafka-1:29092 \
  --topic notifications \
  --partitions 8 \
  --replication-factor 3 \
  --config retention.ms=86400000 \
  --if-not-exists

# List all topics
echo ""
echo "📋 Created topics:"
docker exec fantasy-kafka-1 kafka-topics --list --bootstrap-server kafka-1:29092

# Show topic details
echo ""
echo "📊 Topic configurations:"
docker exec fantasy-kafka-1 kafka-topics --describe \
  --bootstrap-server kafka-1:29092 \
  --topic predictions

echo ""
echo "✅ KAFKA SETUP COMPLETE!"
echo ""
echo "🌐 Access Points:"
echo "   Kafka UI: http://localhost:8090"
echo "   Schema Registry: http://localhost:8081"
echo "   Kafka Connect: http://localhost:8083"
echo ""
echo "📡 Kafka Brokers:"
echo "   Broker 1: localhost:9092"
echo "   Broker 2: localhost:9093"
echo "   Broker 3: localhost:9094"
echo ""
echo "🔥 Ready to stream millions of predictions!"