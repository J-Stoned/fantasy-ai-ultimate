# MARCUS "THE FIXER" RODRIGUEZ - LOAD TESTING SUITE

## NFL Sunday Chaos Simulator

This load testing suite simulates the absolute mayhem of NFL Sunday when 100K+ fantasy managers are all checking scores, changing lineups, and arguing about trades at the same time.

## Quick Start

### Local Load Test (Node.js/autocannon)
```bash
# Basic test - 1000 concurrent users for 5 minutes
npm run load-test

# Custom parameters
npm run load-test -- https://api.fantasy-ai.com 300 5000

# Parameters: URL duration(seconds) connections
```

### Advanced Load Test (k6)
```bash
# Install k6 first
brew install k6  # macOS
# or
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6  # Ubuntu

# Run locally
npm run load-test:k6

# Run in Docker (no install needed)
npm run load-test:docker

# Run on k6 cloud (requires account)
npm run load-test:k6:cloud
```

## Scenarios Tested

### 1. Live Score Updates (40% of traffic)
- Checking live game scores
- Real-time player stats
- Injury updates
- Game status changes

### 2. Lineup Management (25% of traffic)
- Viewing current lineups
- Making last-minute changes
- Checking lineup locks
- Optimizing for upside

### 3. Trade Proposals (15% of traffic)
- Analyzing trade fairness
- Sending panic trades
- Reviewing pending trades
- Trade calculator usage

### 4. Waiver Claims (10% of traffic)
- Browsing available players
- Placing FAAB bids
- Checking waiver priority
- Adding/dropping players

### 5. AI Assistant (10% of traffic)
- Lineup advice
- Weather impact questions
- Player comparisons
- Trade analysis

## Traffic Pattern

The test simulates realistic NFL Sunday traffic:

```
9am-12pm ET:  Gradual ramp up (1K → 5K users)
1pm ET:       Massive spike (→ 20K users)
1-4pm ET:     Sustained high load (15-18K users)
4:25pm ET:    Peak load (→ 30K users)
4:30-8pm ET:  Sustained peak (25K users)
8pm-11pm ET:  Gradual decline (→ 10K users)
```

## Success Criteria

Your system passes if:
- ✅ Error rate < 0.1%
- ✅ P95 latency < 500ms
- ✅ P99 latency < 1500ms
- ✅ Zero timeouts
- ✅ No memory leaks
- ✅ Database connections stable

## Monitoring During Tests

### Watch these metrics:
```bash
# CPU and Memory
htop

# Database connections
psql -c "SELECT count(*) FROM pg_stat_activity;"

# Redis connections
redis-cli info clients

# Application logs
tail -f logs/production.log | grep ERROR

# Response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/health
```

### curl-format.txt:
```
time_namelookup:  %{time_namelookup}s\n
time_connect:  %{time_connect}s\n
time_appconnect:  %{time_appconnect}s\n
time_pretransfer:  %{time_pretransfer}s\n
time_redirect:  %{time_redirect}s\n
time_starttransfer:  %{time_starttransfer}s\n
time_total:  %{time_total}s\n
```

## Analyzing Results

### autocannon Results
Look for:
- Requests per second (RPS)
- Latency percentiles (p50, p95, p99)
- Error count and types
- Timeout count

### k6 Results
Check:
- Custom metrics (login_time, score_update_time, etc.)
- Geographic distribution performance
- Scenario-specific bottlenecks
- Virtual user behavior patterns

## Common Issues and Fixes

### 1. High Error Rate
- Check rate limiting configuration
- Verify database connection pooling
- Look for memory leaks
- Check API timeouts

### 2. Slow Response Times
- Enable query optimization
- Add database indexes
- Implement caching
- Use connection pooling

### 3. Memory Issues
- Check for TensorFlow tensor leaks
- Verify garbage collection
- Look for large object allocations
- Monitor event listeners

### 4. Database Bottlenecks
```sql
-- Find slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Check connection count
SELECT count(*) FROM pg_stat_activity;

-- Active queries
SELECT pid, age(clock_timestamp(), query_start), usename, query 
FROM pg_stat_activity 
WHERE query != '<IDLE>' AND query NOT ILIKE '%pg_stat_activity%' 
ORDER BY query_start DESC;
```

## Production Readiness Checklist

Before NFL Sunday:
- [ ] Run 30-minute sustained load test
- [ ] Verify auto-scaling triggers
- [ ] Test database failover
- [ ] Confirm Redis persistence
- [ ] Check CDN cache headers
- [ ] Verify rate limit settings
- [ ] Test circuit breakers
- [ ] Monitor error budgets
- [ ] Prepare incident runbooks
- [ ] Schedule on-call rotation

## Advanced Testing

### Chaos Engineering
```bash
# Randomly kill pods
kubectl delete pod $(kubectl get pods -l app=fantasy-api -o name | shuf -n 1)

# Introduce network latency
tc qdisc add dev eth0 root netem delay 100ms

# Simulate database slowdown
pg_sleep(5) in random queries
```

### Geographic Distribution
```javascript
// In k6 script
export const options = {
  ext: {
    loadimpact: {
      distribution: {
        'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 40 },
        'amazon:us:portland': { loadZone: 'amazon:us:portland', percent: 30 },
        'amazon:eu:dublin': { loadZone: 'amazon:eu:dublin', percent: 20 },
        'amazon:ap:singapore': { loadZone: 'amazon:ap:singapore', percent: 10 },
      },
    },
  },
};
```

## The Marcus Guarantee

If your system survives this load test, it can handle:
- NFL Sunday traffic spikes
- March Madness bracket updates  
- NBA trade deadline chaos
- MLB opening day rush
- Fantasy playoff weeks

Remember: It's not about handling average load. It's about surviving when every fantasy manager in America is checking if CMC got injured at the exact same moment.

---

*"In production, there are no practice rounds. Test like your revenue depends on it - because it does."*

**- Marcus "The Fixer" Rodriguez**