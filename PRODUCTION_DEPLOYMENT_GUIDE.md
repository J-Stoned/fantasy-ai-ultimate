# 🚀 FANTASY AI PRODUCTION DEPLOYMENT GUIDE 🚀

## Overview

This guide provides step-by-step instructions for deploying the Fantasy AI platform to production with enterprise-grade security, performance, and reliability.

## 🎯 Deployment Architecture

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │      CDN        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Load Balancer  │
                    │  (Nginx/HAProxy) │
                    └────────┬────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                          │
┌───────▼────────┐  ┌───────────────┐  ┌─────────▼────────┐
│   App Server   │  │  App Server   │  │   App Server     │
│   (Node.js)    │  │   (Node.js)   │  │    (Node.js)     │
│    RTX 4060    │  │   RTX 4060    │  │     RTX 4060     │
└───────┬────────┘  └───────┬───────┘  └─────────┬────────┘
        │                    │                     │
        └────────────────────┴─────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Redis Cluster  │
                    │  (3 nodes)      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   (Primary)     │
                    └─────────────────┘
```

## 📋 Pre-Deployment Checklist

### Required Tools
- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ running
- [ ] Redis 6+ installed
- [ ] Nginx or HAProxy
- [ ] SSL certificates
- [ ] Domain configured

### API Keys Required
- [ ] DraftKings API credentials
- [ ] FanDuel API credentials
- [ ] Yahoo Fantasy API key
- [ ] ESPN API access
- [ ] Sentry DSN (monitoring)
- [ ] Datadog API key (optional)

### Hardware Requirements
- **Minimum**: 8 CPU cores, 16GB RAM, 100GB SSD
- **Recommended**: 16 CPU cores, 32GB RAM, 500GB NVMe SSD, GPU (RTX 4060+)
- **Production**: Load balanced across 3+ servers

## 🚀 Quick Deployment (One Command)

```bash
# Clone the repository
git clone https://github.com/fantasy-ai/platform.git
cd platform

# Run the deployment script
./scripts/production-deployment/deploy-now.sh
```

This will:
1. Configure environment
2. Migrate database
3. Setup infrastructure
4. Build and deploy application
5. Activate all systems

## 📘 Step-by-Step Deployment

### Step 1: Environment Setup

```bash
# Run environment setup
tsx scripts/production-deployment/01-environment-setup.ts

# This will:
# - Generate secure secrets
# - Configure SSL certificates
# - Create .env.production file
# - Validate configuration
```

**Important**: Update `.env.production` with your actual API keys before proceeding!

### Step 2: Database Migration

```bash
# Run database migration
tsx scripts/production-deployment/02-database-migration.ts

# This will:
# - Create ML views for each sport
# - Build indexes for performance
# - Setup ownership tracking tables
# - Optimize database configuration
```

### Step 3: Infrastructure Setup

```bash
# Run infrastructure setup
tsx scripts/production-deployment/03-infrastructure-setup.ts

# This will:
# - Configure Redis cluster
# - Setup load balancer
# - Configure CDN
# - Enable monitoring
```

### Step 4: Build and Deploy

For standard deployment:
```bash
tsx scripts/production-deployment/04-build-and-deploy.ts
```

For GPU-accelerated turbo deployment:
```bash
tsx scripts/production-deployment/05-turbo-deployment.ts
```

## 🔧 Configuration Details

### Environment Variables

```env
# Application
NODE_ENV=production
PORT=443
APP_URL=https://fantasy-ai.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://host:6379
REDIS_CLUSTER_NODES=redis://node1:6379,redis://node2:6379

# Authentication
JWT_SECRET=[generated]
SESSION_SECRET=[generated]

# APIs
DRAFTKINGS_API_KEY=your_key_here
FANDUEL_API_KEY=your_key_here

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx
DATADOG_API_KEY=your_key_here
```

### Nginx Configuration

The deployment creates an optimized Nginx configuration with:
- SSL/TLS encryption
- WebSocket support
- Rate limiting
- Health checks
- Static file caching

### Database Optimization

Production database is configured with:
- Materialized views for ML data
- Optimized indexes
- Connection pooling
- Automatic backups

## 📊 Post-Deployment Verification

### Health Checks

```bash
# Check application health
curl https://fantasy-ai.com/api/health

# Check database health
curl https://fantasy-ai.com/api/health/db

# Check WebSocket connection
wscat -c wss://fantasy-ai.com/ws
```

### Performance Monitoring

1. **Application Metrics**: https://fantasy-ai.com/admin/metrics
2. **ML Model Performance**: https://fantasy-ai.com/admin/ml-training
3. **DFS Trading Analytics**: https://fantasy-ai.com/admin/dfs-training

### Security Verification

```bash
# Run security audit
npm run test:admin:security

# Check SSL configuration
ssl-checker fantasy-ai.com

# Verify headers
curl -I https://fantasy-ai.com
```

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"
```

**Redis Connection Failed**
```bash
# Check Redis status
redis-cli ping

# Test cluster
redis-cli -c cluster info
```

**Build Failures**
```bash
# Clear cache and rebuild
rm -rf .next node_modules/.cache
npm ci
npm run build
```

**SSL Certificate Issues**
```bash
# Verify certificates
openssl x509 -in cert.pem -text -noout

# Test HTTPS
openssl s_client -connect fantasy-ai.com:443
```

## 🔄 Rollback Procedure

If deployment fails:

```bash
# Automatic rollback (if enabled)
# The deployment script handles this automatically

# Manual rollback
cd /var/www/fantasy-ai
ln -sfn releases/previous current
pm2 reload fantasy-ai
```

## 📈 Scaling Guidelines

### Horizontal Scaling
- Add more app servers behind load balancer
- Expand Redis cluster nodes
- Use read replicas for database

### Vertical Scaling
- Upgrade to larger instances
- Add more CPU cores
- Increase memory allocation
- Add GPU for ML acceleration

### Auto-Scaling Rules
- CPU > 80%: Add 2 instances
- Memory > 85%: Add 1 instance
- Request queue > 100: Add 3 instances

## 🛡️ Security Best Practices

1. **Regular Updates**
   ```bash
   # Weekly security updates
   npm audit fix
   apt-get update && apt-get upgrade
   ```

2. **Backup Strategy**
   - Database: Daily at 2 AM
   - Redis: Hourly snapshots
   - Application: Weekly full backup

3. **Monitoring**
   - Set up alerts for errors
   - Monitor resource usage
   - Track user activity
   - Review security logs

## 🎯 Performance Optimization

### Caching Strategy
- Static assets: 1 year
- API responses: 5-60 minutes
- ML predictions: 1 hour
- Player data: 30 minutes

### Database Optimization
- Refresh materialized views hourly
- VACUUM ANALYZE weekly
- Monitor slow queries
- Optimize based on usage

### CDN Configuration
- Cache everything except /api
- Use Brotli compression
- Enable HTTP/3
- Implement edge workers

## 📞 Support

### Monitoring Dashboards
- **Application**: https://monitor.fantasy-ai.com
- **Infrastructure**: https://grafana.fantasy-ai.com
- **Logs**: https://logs.fantasy-ai.com

### Alert Channels
- **Critical**: PagerDuty
- **High**: Email + Slack
- **Medium**: Slack
- **Low**: Daily digest

### Maintenance Windows
- **Scheduled**: Sunday 2-4 AM EST
- **Emergency**: As needed with notification

## 🏆 Success Metrics

After deployment, verify:
- [ ] All health checks passing
- [ ] Load time < 3 seconds
- [ ] ML accuracy > 90%
- [ ] Zero critical errors
- [ ] SSL rating A+
- [ ] All tests passing

---

## 🚀 Quick Commands Reference

```bash
# Deploy everything
./scripts/production-deployment/deploy-now.sh

# Individual steps
tsx scripts/production-deployment/01-environment-setup.ts
tsx scripts/production-deployment/02-database-migration.ts
tsx scripts/production-deployment/03-infrastructure-setup.ts
tsx scripts/production-deployment/04-build-and-deploy.ts
tsx scripts/production-deployment/05-turbo-deployment.ts

# Verification
npm run test:admin:production
curl https://fantasy-ai.com/api/health

# Monitoring
pm2 status
pm2 logs fantasy-ai
```

---

**🎉 Congratulations! Fantasy AI is now live in production!**

Visit: https://fantasy-ai.com to see your platform in action!