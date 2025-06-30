#!/bin/bash

# MARCUS "THE FIXER" RODRIGUEZ - LOCAL BUILD
# Build and test locally without EAS

echo "🏗️ FANTASY AI ULTIMATE - LOCAL BUILD 🏗️"
echo "========================================"
echo "Building locally for immediate testing"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Navigate to mobile directory
cd mobile || exit 1

# Check dependencies
echo -e "${BLUE}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install --legacy-peer-deps
fi

# TypeScript check
echo -e "${BLUE}🔧 Running TypeScript check...${NC}"
npx tsc --noEmit || echo -e "${YELLOW}⚠️  TypeScript warnings (continuing)${NC}"

# Start Metro bundler and Expo
echo -e "${BLUE}🚀 Starting Expo...${NC}"
echo ""
echo -e "${GREEN}EXPO WILL START IN A NEW PROCESS${NC}"
echo ""
echo "Options:"
echo "1. Press 'i' for iOS Simulator"
echo "2. Press 'a' for Android Emulator"
echo "3. Scan QR code with Expo Go app on your phone"
echo "4. Press 'w' for web browser"
echo ""
echo -e "${YELLOW}Make sure you have:${NC}"
echo "- iOS Simulator installed (Mac only)"
echo "- Android Studio/Emulator installed"
echo "- Expo Go app on your phone"
echo ""

# Check if Expo CLI is installed
if ! command -v expo &> /dev/null; then
    echo -e "${YELLOW}Installing Expo CLI...${NC}"
    npm install -g expo-cli
fi

# Start Expo
echo -e "${GREEN}Starting Expo Dev Server...${NC}"
npx expo start

# This script will keep running until you stop it with Ctrl+C