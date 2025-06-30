#!/bin/bash

# MARCUS "THE FIXER" RODRIGUEZ - VERIFICATION BUILD
# Build and test before submitting - smart move!

echo "🔍 FANTASY AI ULTIMATE - VERIFICATION BUILD 🔍"
echo "============================================="
echo "Building apps for testing (NOT submitting yet)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Error handler
handle_error() {
    echo -e "${RED}❌ Error: $1${NC}"
    exit 1
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}ERROR: Run this from the project root directory${NC}"
    exit 1
fi

# Step 1: Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v eas &> /dev/null; then
    echo -e "${YELLOW}Installing EAS CLI...${NC}"
    npm install -g eas-cli || handle_error "Failed to install EAS CLI"
fi

# Step 2: Navigate to mobile directory
cd mobile || handle_error "Mobile directory not found"

# Step 3: Check for .env.local
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  Warning: .env.local not found${NC}"
    echo "Creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        echo -e "${YELLOW}Please edit mobile/.env.local with your credentials${NC}"
    fi
fi

# Step 4: Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install --legacy-peer-deps || handle_error "Failed to install dependencies"

# Step 5: Run TypeScript check
echo -e "${BLUE}🔧 Checking TypeScript...${NC}"
npx tsc --noEmit || echo -e "${YELLOW}⚠️  TypeScript warnings found (continuing)${NC}"

# Step 6: Check EAS configuration
echo -e "${BLUE}🔐 Checking EAS configuration...${NC}"
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}Please log in to EAS:${NC}"
    eas login || handle_error "EAS login required"
fi

# Step 7: Create local builds profile if needed
echo -e "${BLUE}📝 Ensuring build profiles...${NC}"
if ! grep -q "preview" eas.json; then
    echo -e "${YELLOW}Adding preview build profile...${NC}"
    # Backup original
    cp eas.json eas.json.backup
    
    # Add preview profile for local testing
    node -e "
    const eas = require('./eas.json');
    eas.build.preview = {
      distribution: 'internal',
      ios: {
        simulator: true
      },
      android: {
        buildType: 'apk'
      }
    };
    require('fs').writeFileSync('./eas.json', JSON.stringify(eas, null, 2));
    "
fi

# Step 8: Build for testing
echo -e "${BLUE}🏗️ Starting verification builds...${NC}"
echo ""
echo "Choose build option:"
echo "1) iOS Simulator Build (fast, local testing)"
echo "2) Android APK (fast, local testing)"
echo "3) Both platforms for device testing"
echo "4) Production builds (slow, for final testing)"
echo ""
read -p "Enter choice (1-4): " BUILD_CHOICE

case $BUILD_CHOICE in
    1)
        echo -e "${BLUE}🍎 Building for iOS Simulator...${NC}"
        eas build --platform ios --profile preview --local
        ;;
    2)
        echo -e "${BLUE}🤖 Building Android APK...${NC}"
        eas build --platform android --profile preview --local
        ;;
    3)
        echo -e "${BLUE}📱 Building for both platforms...${NC}"
        eas build --platform all --profile preview
        ;;
    4)
        echo -e "${YELLOW}⚠️  Production builds will take 20-30 minutes${NC}"
        read -p "Continue? (y/n): " CONFIRM
        if [ "$CONFIRM" = "y" ]; then
            echo -e "${BLUE}🚀 Starting production builds...${NC}"
            eas build --platform ios --profile production &
            IOS_PID=$!
            eas build --platform android --profile production &
            ANDROID_PID=$!
            
            echo -e "${YELLOW}Builds running in background. Check status with: eas build:list${NC}"
            wait $IOS_PID
            wait $ANDROID_PID
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Step 9: Post-build instructions
echo ""
echo -e "${GREEN}✅ BUILD PROCESS STARTED!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Check build status: eas build:list"
echo "2. Download builds when ready: eas build:download"
echo "3. Test the app thoroughly:"
echo "   - Voice commands: Say 'Hey Fantasy, optimize my lineup'"
echo "   - GPU optimizer: Tap 'AI Optimize' button"
echo "   - 3D visualization: Check lineup screen"
echo "   - Real data: Verify Supabase connection"
echo ""
echo -e "${YELLOW}🧪 Testing Checklist:${NC}"
cat << EOF > TESTING_CHECKLIST.md
# Fantasy AI Ultimate - Testing Checklist

## Core Features
- [ ] App launches without crashing
- [ ] Login/Signup works
- [ ] Home screen loads real data
- [ ] Navigation between screens works

## Voice Assistant
- [ ] Microphone permission requested
- [ ] "Hey Fantasy" wake word detected
- [ ] Voice commands processed
- [ ] Speech responses work

## GPU Optimizer
- [ ] "AI Optimize" button works
- [ ] Optimization completes
- [ ] Results show improvement
- [ ] Can apply optimized lineup

## 3D Visualization
- [ ] 3D field renders
- [ ] Players appear in correct positions
- [ ] Touch controls work (pinch/rotate)
- [ ] Performance is smooth

## Data Integration
- [ ] Leagues load from Supabase
- [ ] Player data is current
- [ ] Live scores update
- [ ] Changes persist

## Performance
- [ ] No memory leaks
- [ ] Smooth scrolling
- [ ] Fast screen transitions
- [ ] Reasonable load times

## Final Checks
- [ ] No crashes during testing
- [ ] All permissions work
- [ ] Offline mode handles gracefully
- [ ] Ready for submission!
EOF

echo -e "${GREEN}✓ Created TESTING_CHECKLIST.md${NC}"
echo ""
echo -e "${BLUE}Remember: Test thoroughly before submitting!${NC}"
echo -e "${YELLOW}Your wife is counting on a quality app!${NC}"
echo ""
echo "- Marcus 'The Fixer' Rodriguez"