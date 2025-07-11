#!/bin/bash

echo "🚀 FANTASY AI ULTIMATE STATS - AUTOMATED DEPLOYMENT"
echo "=================================================="

# Use the GitHub CLI we just downloaded
GH_CLI="./gh_2.62.0_linux_amd64/bin/gh"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "\n${YELLOW}📋 Step 1: GitHub Repository Setup${NC}"
echo "First, you need to authenticate with GitHub."
echo "Run: $GH_CLI auth login"
echo "Follow the prompts to authenticate."
echo ""
echo "Once authenticated, run this script again with 'create-repo' argument:"
echo "./deploy-ultimate-stats.sh create-repo"
echo ""

if [ "$1" == "create-repo" ]; then
    echo -e "\n${YELLOW}Creating GitHub repository...${NC}"
    
    # Create the repository
    REPO_NAME="fantasy-ai-ultimate"
    $GH_CLI repo create $REPO_NAME --public --description "AI-powered fantasy sports platform with Ultimate Stats API v3" --confirm || {
        echo -e "${RED}Repository creation failed or already exists${NC}"
    }
    
    # Get the remote URL
    REMOTE_URL=$($GH_CLI repo view $REPO_NAME --json sshUrl -q .sshUrl)
    
    if [ -z "$REMOTE_URL" ]; then
        # Try HTTPS URL instead
        REMOTE_URL=$($GH_CLI repo view $REPO_NAME --json url -q .url)
        REMOTE_URL="${REMOTE_URL}.git"
    fi
    
    echo -e "${GREEN}✅ Repository ready at: $REMOTE_URL${NC}"
    
    # Add remote if not exists
    git remote get-url origin &>/dev/null || git remote add origin "$REMOTE_URL"
    
    # Push to GitHub
    echo -e "\n${YELLOW}Pushing code to GitHub...${NC}"
    git push -u origin main --force
    
    echo -e "\n${GREEN}✅ Code pushed to GitHub!${NC}"
    echo -e "\n${YELLOW}📋 Next Steps:${NC}"
    echo "1. Go to https://vercel.com/new"
    echo "2. Import your repository: $REPO_NAME"
    echo "3. Configure:"
    echo "   - Root Directory: apps/web"
    echo "   - Framework: Next.js"
    echo "4. Add Environment Variables:"
    echo "   - NEXT_PUBLIC_SUPABASE_URL"
    echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY" 
    echo "   - SUPABASE_SERVICE_ROLE_KEY"
    echo "   - UPSTASH_REDIS_REST_URL"
    echo "   - UPSTASH_REDIS_REST_TOKEN"
    echo ""
    echo "5. Deploy!"
    
elif [ "$1" == "test-api" ]; then
    echo -e "\n${YELLOW}Testing Ultimate Stats API...${NC}"
    
    read -p "Enter your Vercel URL (e.g., https://your-app.vercel.app): " VERCEL_URL
    
    echo -e "\n${YELLOW}Testing health endpoint...${NC}"
    curl -s "$VERCEL_URL/api/v3/ultimate-stats/health" | jq '.' || echo "Failed"
    
    echo -e "\n${YELLOW}Testing main endpoint...${NC}"
    curl -s "$VERCEL_URL/api/v3/ultimate-stats?limit=5" | jq '.' || echo "Failed"
    
else
    echo -e "\n${YELLOW}Available commands:${NC}"
    echo "  ./deploy-ultimate-stats.sh create-repo  - Create GitHub repo and push code"
    echo "  ./deploy-ultimate-stats.sh test-api     - Test deployed API endpoints"
fi