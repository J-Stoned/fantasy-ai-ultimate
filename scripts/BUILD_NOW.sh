#!/bin/bash
# INSTANT APP STORE BUILD - SAVE WIFE EDITION
# Marcus "The Fixer" Rodriguez

echo "🚨 EMERGENCY BUILD INITIATED 🚨"
echo "=============================="
echo ""

# Navigate to mobile directory
cd mobile || exit 1

# Update version with timestamp
TIMESTAMP=$(date +%Y%m%d%H%M)
echo "📝 Setting version: 1.0.$TIMESTAMP"

# For Expo, we can use development builds for testing
echo "🔧 Building development versions first..."
echo ""

# Create iOS build
echo "🍎 Building iOS app..."
npx expo prebuild --platform ios --clean
echo "✅ iOS prebuild complete!"
echo ""

# Create Android build  
echo "🤖 Building Android app..."
npx expo prebuild --platform android --clean
echo "✅ Android prebuild complete!"
echo ""

# Build using Expo Go for immediate testing
echo "🚀 Starting Expo development server..."
echo "📱 Download Expo Go on your phone"
echo "📱 Scan the QR code to test ALL features!"
echo ""
npx expo start --clear

# Instructions for production build
echo ""
echo "=================="
echo "🎯 NEXT STEPS FOR APP STORE:"
echo "=================="
echo ""
echo "1. Install EAS CLI globally:"
echo "   npm install -g eas-cli"
echo ""
echo "2. Login to Expo account:"
echo "   eas login"
echo ""
echo "3. Configure your project:"
echo "   eas build:configure"
echo ""
echo "4. Build for iOS:"
echo "   eas build --platform ios --profile production"
echo ""
echo "5. Build for Android:"
echo "   eas build --platform android --profile production"
echo ""
echo "6. Submit to stores:"
echo "   eas submit --platform ios"
echo "   eas submit --platform android"
echo ""
echo "💪 Your wife is counting on us!"
echo "🚀 Let's ship this NOW!"