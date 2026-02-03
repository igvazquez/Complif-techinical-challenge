# Performance Benchmarks

This directory contains k6 load testing scripts for benchmarking the Rules Engine.

## Prerequisites

Install k6: https://k6.io/docs/getting-started/installation/

```bash
# macOS
brew install k6

# Docker (alternative)
docker pull grafana/k6
```

## Benchmark Scenarios

### 1. Transaction Throughput (`transaction-throughput.js`)

Tests sustained throughput capacity with constant arrival rate.

**Configuration:**
- Rate: 50 requests/second
- Duration: 2 minutes
- Target: p99 < 100ms, error rate < 1%

```bash
npm run benchmark
# or
k6 run benchmark/k6/scenarios/transaction-throughput.js
```

### 2. Mixed Workload (`mixed-workload.js`)

Simulates realistic API usage patterns with weighted distribution:
- 70% Transaction processing
- 15% Read operations (alerts, rules)
- 10% Health/metrics checks
- 5% List operations

```bash
npm run benchmark:mixed
# or
k6 run benchmark/k6/scenarios/mixed-workload.js
```

### 3. Stress Test (`stress-test.js`)

Finds the breaking point by gradually increasing load.

**Stages:**
1. Warm up: 10 → 30 req/s (30s)
2. Target load: 50 req/s (1m)
3. Push: 75 req/s (1m)
4. Stress: 100 req/s (1m)
5. Breaking point: 150-200 req/s (1m)
6. Recovery: 50 req/s (1m)

```bash
npm run benchmark:stress
# or
k6 run benchmark/k6/scenarios/stress-test.js
```

## Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Throughput | 50+ tx/sec | 25 tx/sec |
| p99 Latency | < 100ms | < 500ms |
| Error Rate | < 1% | < 5% |

## Running with Docker

```bash
# Basic
docker run --rm -i --network=host grafana/k6 run - < benchmark/k6/scenarios/transaction-throughput.js

# With environment variables
docker run --rm -i --network=host \
  -e BASE_URL=http://localhost:3000 \
  grafana/k6 run - < benchmark/k6/scenarios/transaction-throughput.js
```

## Custom Configuration

Override the base URL:

```bash
k6 run -e BASE_URL=http://your-server:3000 benchmark/k6/scenarios/transaction-throughput.js
```

## Results

Results are stored in `benchmark/results/`:
- `stress-test-results.json` - Stress test summary

## Viewing Results in Grafana

1. Start the full stack: `docker-compose up -d`
2. Run benchmarks while viewing the Grafana dashboard at http://localhost:3001
3. Watch real-time metrics in the "Rules Engine Overview" dashboard

## Interpreting Results

### Throughput Test
- **PASS**: Sustained 50 req/s with p99 < 100ms
- **WARN**: p99 between 100-500ms or occasional errors
- **FAIL**: p99 > 500ms or error rate > 5%

### Stress Test
- Identify the maximum sustainable throughput
- Note where latency starts degrading
- Document error rate at different load levels

## Troubleshooting

### Connection Refused
Ensure the application is running:
```bash
curl http://localhost:3000/health
```

### High Error Rates
Check application logs:
```bash
docker logs rules-engine-app
```

### Database Connection Issues
Verify database is healthy:
```bash
docker exec rules-engine-postgres pg_isready -U rules_user
```
