#!/bin/bash

# MARCUS "THE FIXER" RODRIGUEZ - STANDALONE BUILD
# Build APK/IPA without EAS

echo "📱 FANTASY AI ULTIMATE - STANDALONE BUILD 📱"
echo "==========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

cd mobile || exit 1

echo "Choose build type:"
echo "1. Android APK (for testing on device)"
echo "2. iOS (requires Mac with Xcode)"
echo "3. Both"
echo ""
read -p "Enter choice (1-3): " BUILD_CHOICE

case $BUILD_CHOICE in
    1)
        echo -e "${BLUE}🤖 Building Android APK...${NC}"
        
        # Check for Android SDK
        if [ -z "$ANDROID_HOME" ]; then
            echo -e "${RED}ERROR: ANDROID_HOME not set${NC}"
            echo "Please install Android Studio and set ANDROID_HOME"
            exit 1
        fi
        
        # Prebuild for Android
        echo -e "${YELLOW}Prebuilding Android project...${NC}"
        npx expo prebuild --platform android --clean
        
        # Build APK
        echo -e "${YELLOW}Building APK...${NC}"
        cd android
        ./gradlew assembleRelease
        
        APK_PATH="app/build/outputs/apk/release/app-release.apk"
        if [ -f "$APK_PATH" ]; then
            echo -e "${GREEN}✅ APK built successfully!${NC}"
            echo "Location: mobile/android/$APK_PATH"
            echo ""
            echo "To install on device:"
            echo "1. Enable Developer Mode on your Android device"
            echo "2. Enable 'Install from Unknown Sources'"
            echo "3. Transfer APK to device and install"
            echo ""
            echo "Or use ADB:"
            echo "adb install $APK_PATH"
        else
            echo -e "${RED}❌ APK build failed${NC}"
        fi
        cd ..
        ;;
        
    2)
        echo -e "${BLUE}🍎 Building for iOS...${NC}"
        
        # Check if on Mac
        if [[ "$OSTYPE" != "darwin"* ]]; then
            echo -e "${RED}ERROR: iOS builds require macOS with Xcode${NC}"
            exit 1
        fi
        
        # Prebuild for iOS
        echo -e "${YELLOW}Prebuilding iOS project...${NC}"
        npx expo prebuild --platform ios --clean
        
        echo -e "${GREEN}iOS project created in 'ios' directory${NC}"
        echo ""
        echo "To build and test:"
        echo "1. Open mobile/ios/fantasyaiultimate.xcworkspace in Xcode"
        echo "2. Select your device/simulator"
        echo "3. Click Run (Cmd+R)"
        echo ""
        echo "For TestFlight:"
        echo "1. Archive in Xcode (Product > Archive)"
        echo "2. Upload to App Store Connect"
        ;;
        
    3)
        echo -e "${BLUE}📱 Building both platforms...${NC}"
        # Run both builds
        $0 <<< "1"
        $0 <<< "2"
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Build process complete!${NC}"
echo ""
echo "- Marcus 'The Fixer' Rodriguez"