#!/bin/bash

echo "🔧 MARCUS FIX: Cleaning and reinstalling with compatible React versions..."

# Clean everything
echo "📦 Cleaning node_modules and lock files..."
rm -rf node_modules
rm -f package-lock.json
rm -f yarn.lock

# Clear npm cache
echo "🧹 Clearing npm cache..."
npm cache clean --force

# Install with legacy peer deps to handle any remaining conflicts
echo "📥 Installing dependencies with legacy peer deps..."
npm install --legacy-peer-deps

# Verify installation
echo "✅ Verifying installation..."
npm ls react react-dom react-native next || true

echo "🎯 Testing build..."
npm run build:web || echo "⚠️  Build failed - check errors above"

echo "✨ Done! Check for any remaining errors above."