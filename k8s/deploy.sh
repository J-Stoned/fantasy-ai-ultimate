#!/bin/bash
# Fantasy AI Kubernetes Deployment Script

set -e

echo "🚀 Fantasy AI Kubernetes Deployment"
echo "=================================="

# Configuration
NAMESPACE="fantasy-ai"
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"docker.io/fantasyai"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}kubectl not found! Please install kubectl.${NC}"
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        echo -e "${RED}Cannot connect to Kubernetes cluster!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Prerequisites OK${NC}"
}

create_namespace() {
    echo -e "${YELLOW}Creating namespace...${NC}"
    kubectl apply -f namespace.yaml
}

create_secrets() {
    echo -e "${YELLOW}Creating secrets...${NC}"
    
    # Check if secrets already exist
    if kubectl get secret fantasy-ai-secrets -n $NAMESPACE &> /dev/null; then
        echo -e "${YELLOW}Secrets already exist. Skipping...${NC}"
    else
        echo -e "${RED}Please update secret.yaml with your actual values!${NC}"
        read -p "Have you updated secret.yaml? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kubectl apply -f secret.yaml
        else
            echo -e "${RED}Please update secret.yaml and run again.${NC}"
            exit 1
        fi
    fi
}

deploy_infrastructure() {
    echo -e "${YELLOW}Deploying infrastructure...${NC}"
    
    # Storage
    kubectl apply -f storage.yaml
    
    # ConfigMap
    kubectl apply -f configmap.yaml
    
    # Database
    kubectl apply -f postgres-deployment.yaml
    kubectl apply -f redis-deployment.yaml
    
    # Wait for database to be ready
    echo -e "${YELLOW}Waiting for databases to be ready...${NC}"
    kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=300s
}

deploy_applications() {
    echo -e "${YELLOW}Deploying applications...${NC}"
    
    # Core services
    kubectl apply -f web-deployment.yaml
    kubectl apply -f websocket-deployment.yaml
    kubectl apply -f ml-engine-deployment.yaml
    
    # Background jobs
    kubectl apply -f continuous-learning-deployment.yaml
    kubectl apply -f data-collector-deployment.yaml
}

deploy_ingress() {
    echo -e "${YELLOW}Deploying ingress...${NC}"
    kubectl apply -f ingress.yaml
}

deploy_monitoring() {
    echo -e "${YELLOW}Deploying monitoring...${NC}"
    kubectl apply -f monitoring.yaml
}

wait_for_deployments() {
    echo -e "${YELLOW}Waiting for all deployments to be ready...${NC}"
    
    kubectl wait --for=condition=available deployment/web -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment/websocket -n $NAMESPACE --timeout=300s
    kubectl wait --for=condition=available deployment/ml-engine -n $NAMESPACE --timeout=300s
    
    echo -e "${GREEN}All deployments ready!${NC}"
}

show_status() {
    echo -e "${YELLOW}Deployment Status:${NC}"
    echo "=================="
    
    kubectl get all -n $NAMESPACE
    
    echo -e "\n${YELLOW}External URLs:${NC}"
    echo "=============="
    
    # Get ingress IPs
    INGRESS_IP=$(kubectl get ingress fantasy-ai-ingress -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ -z "$INGRESS_IP" ]; then
        INGRESS_IP="<pending>"
    fi
    
    echo "API: https://api.fantasyai.com (pointing to $INGRESS_IP)"
    echo "WebSocket: wss://ws.fantasyai.com (pointing to $INGRESS_IP)"
    
    # Get WebSocket LoadBalancer IP
    WS_IP=$(kubectl get svc websocket-service -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    if [ ! -z "$WS_IP" ]; then
        echo "WebSocket Direct: ws://$WS_IP:8080"
    fi
}

# Main deployment flow
main() {
    echo -e "${GREEN}Starting Fantasy AI deployment...${NC}\n"
    
    check_prerequisites
    create_namespace
    create_secrets
    deploy_infrastructure
    deploy_applications
    deploy_ingress
    deploy_monitoring
    wait_for_deployments
    show_status
    
    echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Update DNS records to point to the load balancer IPs"
    echo "2. Monitor the deployment: kubectl logs -n $NAMESPACE -f deployment/web"
    echo "3. Check metrics: kubectl port-forward -n $NAMESPACE svc/web-service 3000:3000"
    echo "4. Scale as needed: kubectl scale deployment/web -n $NAMESPACE --replicas=5"
}

# Run main function
main