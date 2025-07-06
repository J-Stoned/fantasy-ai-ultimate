#!/bin/bash
#
# 🚀 FANTASY AI PRODUCTION DEPLOYMENT
# 
# Complete deployment script for pattern system
# Handles Docker, Kubernetes, and cloud deployment
#

set -e

echo "🚀 FANTASY AI PRODUCTION DEPLOYMENT"
echo "===================================="

# Configuration
DOCKER_REGISTRY="fantasyai"
VERSION=$(git describe --tags --always)
ENVIRONMENT=${1:-staging}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"

# Step 1: Build Docker images
echo -e "\n${YELLOW}📦 Building Docker images...${NC}"

docker build -t ${DOCKER_REGISTRY}/pattern-api:${VERSION} -f Dockerfile.pattern-api .
docker build -t ${DOCKER_REGISTRY}/pattern-stream:${VERSION} -f Dockerfile.pattern-stream .
docker build -t ${DOCKER_REGISTRY}/game-tracker:${VERSION} -f Dockerfile.game-tracker .
docker build -t ${DOCKER_REGISTRY}/trade-assistant:${VERSION} -f Dockerfile.trade-assistant .
docker build -t ${DOCKER_REGISTRY}/web-app:${VERSION} -f apps/web/Dockerfile .

# Tag as latest
docker tag ${DOCKER_REGISTRY}/pattern-api:${VERSION} ${DOCKER_REGISTRY}/pattern-api:latest
docker tag ${DOCKER_REGISTRY}/pattern-stream:${VERSION} ${DOCKER_REGISTRY}/pattern-stream:latest
docker tag ${DOCKER_REGISTRY}/game-tracker:${VERSION} ${DOCKER_REGISTRY}/game-tracker:latest
docker tag ${DOCKER_REGISTRY}/trade-assistant:${VERSION} ${DOCKER_REGISTRY}/trade-assistant:latest
docker tag ${DOCKER_REGISTRY}/web-app:${VERSION} ${DOCKER_REGISTRY}/web-app:latest

echo -e "${GREEN}✅ Docker images built successfully${NC}"

# Step 2: Run tests
echo -e "\n${YELLOW}🧪 Running production tests...${NC}"

# Test pattern API
curl -f http://localhost:3338/api/unified/stats || {
    echo -e "${RED}❌ Pattern API health check failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Tests passed${NC}"

# Step 3: Push to registry (if not local)
if [ "$ENVIRONMENT" != "local" ]; then
    echo -e "\n${YELLOW}📤 Pushing to Docker registry...${NC}"
    
    docker push ${DOCKER_REGISTRY}/pattern-api:${VERSION}
    docker push ${DOCKER_REGISTRY}/pattern-api:latest
    docker push ${DOCKER_REGISTRY}/pattern-stream:${VERSION}
    docker push ${DOCKER_REGISTRY}/pattern-stream:latest
    docker push ${DOCKER_REGISTRY}/game-tracker:${VERSION}
    docker push ${DOCKER_REGISTRY}/game-tracker:latest
    docker push ${DOCKER_REGISTRY}/trade-assistant:${VERSION}
    docker push ${DOCKER_REGISTRY}/trade-assistant:latest
    docker push ${DOCKER_REGISTRY}/web-app:${VERSION}
    docker push ${DOCKER_REGISTRY}/web-app:latest
    
    echo -e "${GREEN}✅ Images pushed to registry${NC}"
fi

# Step 4: Deploy based on environment
case $ENVIRONMENT in
    "local")
        echo -e "\n${YELLOW}🏠 Deploying locally with Docker Compose...${NC}"
        docker-compose -f docker-compose.production.yml up -d
        ;;
        
    "staging")
        echo -e "\n${YELLOW}🎪 Deploying to staging...${NC}"
        kubectl apply -f deploy/kubernetes/namespace.yaml
        kubectl apply -f deploy/kubernetes/secrets.yaml
        kubectl apply -f deploy/kubernetes/pattern-deployment.yaml
        kubectl apply -f deploy/kubernetes/ingress.yaml
        ;;
        
    "production")
        echo -e "\n${YELLOW}🚀 Deploying to production...${NC}"
        
        # Backup current deployment
        kubectl get all -n fantasy-ai -o yaml > backup-$(date +%Y%m%d-%H%M%S).yaml
        
        # Apply rolling update
        kubectl set image deployment/fantasy-ai-pattern-system \
            pattern-api=${DOCKER_REGISTRY}/pattern-api:${VERSION} \
            -n fantasy-ai
            
        # Wait for rollout
        kubectl rollout status deployment/fantasy-ai-pattern-system -n fantasy-ai
        ;;
        
    *)
        echo -e "${RED}❌ Unknown environment: $ENVIRONMENT${NC}"
        exit 1
        ;;
esac

# Step 5: Verify deployment
echo -e "\n${YELLOW}✅ Verifying deployment...${NC}"

if [ "$ENVIRONMENT" = "local" ]; then
    HEALTH_URL="http://localhost:3338/api/unified/stats"
else
    HEALTH_URL="https://api.fantasyai.com/api/unified/stats"
fi

# Wait for services to be ready
sleep 10

# Health check
curl -f $HEALTH_URL && {
    echo -e "${GREEN}✅ Deployment successful!${NC}"
} || {
    echo -e "${RED}❌ Deployment verification failed${NC}"
    exit 1
}

# Step 6: Display status
echo -e "\n${BLUE}📊 Deployment Status:${NC}"

if [ "$ENVIRONMENT" = "local" ]; then
    docker-compose -f docker-compose.production.yml ps
else
    kubectl get all -n fantasy-ai
fi

echo -e "\n${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}Services available at:${NC}"
echo "  - Pattern API: http://localhost:3338"
echo "  - Pattern Stream: ws://localhost:3340"
echo "  - Live Game Tracker: ws://localhost:3342"
echo "  - Trade Assistant: http://localhost:3343"
echo "  - Web App: http://localhost:3000"
echo "  - Grafana: http://localhost:3001 (admin/fantasy123)"

# Optional: Open browser
if command -v open &> /dev/null; then
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:3000
fi