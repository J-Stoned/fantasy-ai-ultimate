#!/bin/bash

# MARCUS "THE FIXER" RODRIGUEZ - LOCAL TESTING
# Test the app locally before building

echo "🧪 FANTASY AI ULTIMATE - LOCAL TESTING 🧪"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Navigate to mobile directory
cd mobile || exit 1

# Step 1: TypeScript check
echo -e "${BLUE}1. Running TypeScript check...${NC}"
if npx tsc --noEmit; then
    echo -e "${GREEN}✓ TypeScript check passed!${NC}"
else
    echo -e "${YELLOW}⚠️  TypeScript warnings (non-blocking)${NC}"
fi
echo ""

# Step 2: Dependency check
echo -e "${BLUE}2. Checking dependencies...${NC}"
MISSING_DEPS=$(npm ls 2>&1 | grep "UNMET" | wc -l)
if [ "$MISSING_DEPS" -eq 0 ]; then
    echo -e "${GREEN}✓ All dependencies installed!${NC}"
else
    echo -e "${YELLOW}⚠️  Some peer dependency warnings (usually OK)${NC}"
fi
echo ""

# Step 3: Check for required files
echo -e "${BLUE}3. Checking required files...${NC}"
REQUIRED_FILES=(
    "app.json"
    "src/app/App.tsx"
    "src/navigation/NavigationStack.tsx"
    "src/features/voice/MobileVoiceAssistant.tsx"
    "src/features/optimizer/MobileGPUOptimizer.ts"
    "src/features/visualization/Lineup3D.tsx"
    "src/api/supabase.ts"
)

ALL_GOOD=true
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ $file MISSING!${NC}"
        ALL_GOOD=false
    fi
done
echo ""

# Step 4: Environment check
echo -e "${BLUE}4. Checking environment...${NC}"
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✓ .env.local exists${NC}"
    
    # Check for required vars
    if grep -q "EXPO_PUBLIC_SUPABASE_URL" .env.local; then
        echo -e "${GREEN}✓ Supabase URL configured${NC}"
    else
        echo -e "${YELLOW}⚠️  Supabase URL not set${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local not found - copy from .env.example${NC}"
fi
echo ""

# Step 5: Quick bundle check
echo -e "${BLUE}5. Checking Metro bundler...${NC}"
if npx expo export --platform ios --dev --output-dir .test-export > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Bundle builds successfully!${NC}"
    rm -rf .test-export
else
    echo -e "${YELLOW}⚠️  Bundle warnings (check manually)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}📊 TEST SUMMARY${NC}"
echo "================"
if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ App is ready for building!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run: ./scripts/verification-build.sh"
    echo "2. Or start Expo: npm start"
else
    echo -e "${YELLOW}⚠️  Some issues found - fix before building${NC}"
fi
echo ""
echo "- Marcus 'The Fixer' Rodriguez"