#!/bin/bash
# 🚀 FANTASY AI ONE-CLICK PRODUCTION DEPLOYMENT 🚀

set -e

echo "🔥 FANTASY AI PRODUCTION DEPLOYMENT SYSTEM 🔥"
echo "============================================"
echo ""
echo "This will deploy the Fantasy AI platform to production."
echo "Estimated time: 5-10 minutes with GPU acceleration"
echo ""

# Check if running with sudo (needed for some operations)
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  Some operations may require sudo access"
fi

# Function to run with progress
run_step() {
    local step_name=$1
    local script=$2
    
    echo ""
    echo "🚀 Running: $step_name"
    echo "----------------------------------------"
    
    # Run the TypeScript file
    tsx "scripts/production-deployment/$script" || {
        echo "❌ $step_name failed!"
        exit 1
    }
    
    echo "✅ $step_name complete!"
    echo ""
}

# Pre-flight checks
echo "🔍 Running pre-flight checks..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+"
    exit 1
fi

# Check tsx
if ! command -v tsx &> /dev/null; then
    echo "📦 Installing tsx..."
    npm install -g tsx
fi

# Check environment file
if [ ! -f ".env.production" ]; then
    echo "⚠️  Production environment not configured"
    echo "   Running environment setup..."
    run_step "Environment Setup" "01-environment-setup.ts"
fi

echo ""
echo "🎯 DEPLOYMENT PLAN:"
echo "==================="
echo "1. ⚙️  Environment Setup"
echo "2. 🗄️  Database Migration" 
echo "3. 🌐 Infrastructure Setup"
echo "4. 🔨 Build & Deploy"
echo "5. 🚀 Turbo Optimization"
echo ""

read -p "Ready to deploy? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Start deployment timer
START_TIME=$(date +%s)

# Run deployment steps
echo ""
echo "🚀 STARTING DEPLOYMENT..."
echo "========================"

# Step 1: Environment Setup (if needed)
if [ ! -f ".env.production" ]; then
    run_step "Environment Setup" "01-environment-setup.ts"
else
    echo "✅ Environment already configured"
fi

# Step 2: Database Migration
run_step "Database Migration" "02-database-migration.ts"

# Step 3: Infrastructure Setup
run_step "Infrastructure Setup" "03-infrastructure-setup.ts"

# Step 4: Build and Deploy (or use Turbo for speed)
if [ -f "/proc/driver/nvidia/version" ]; then
    echo "🎮 GPU detected! Using TURBO deployment..."
    run_step "Turbo Deployment" "05-turbo-deployment.ts"
else
    run_step "Standard Deployment" "04-build-and-deploy.ts"
fi

# Calculate total time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo "🎉 DEPLOYMENT COMPLETE! 🎉"
echo "=========================="
echo ""
echo "📊 Deployment Statistics:"
echo "  ⏱️  Total time: ${MINUTES}m ${SECONDS}s"
echo "  🚀 Status: LIVE IN PRODUCTION"
echo "  🌐 URL: https://fantasy-ai.com"
echo "  📊 Admin: https://fantasy-ai.com/admin"
echo ""
echo "🔍 Next Steps:"
echo "  1. Monitor application health"
echo "  2. Check error logs"
echo "  3. Verify all features"
echo "  4. Enable monitoring alerts"
echo ""
echo "🏆 Fantasy AI is now LIVE! 🏆"