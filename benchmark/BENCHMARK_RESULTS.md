# Benchmark Results

## Overview

Performance benchmark results for the Rules Engine, executed on **2026-02-03**.

## Test Environment

- **Application**: NestJS Rules Engine
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **Message Queue**: RabbitMQ 3
- **Load Testing Tool**: k6 (Grafana)

## Benchmark Scenarios

### 1. Transaction Throughput Test

**Configuration:**
- Executor: `constant-arrival-rate`
- Rate: 50 requests/second
- Duration: 2 minutes
- Pre-allocated VUs: 50
- Max VUs: 100

**Results:**

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total Requests | 6,001 | - | - |
| Request Rate | 50.00 req/s | 50 req/s | PASS |
| p99 Latency | 11.96ms | < 100ms | PASS |
| p95 Latency | 9.84ms | - | - |
| p90 Latency | 9.10ms | - | - |
| Median Latency | 7.54ms | - | - |
| Average Latency | 7.21ms | - | - |
| Max Latency | 41.8ms | - | - |
| Error Rate | 0.00% | < 1% | PASS |
| Transaction Errors | 0.00% | < 1% | PASS |

**Checks:**
- `status is 201`: 100% passed (6,001/6,001)
- `response has transaction id`: 100% passed (6,001/6,001)

### 2. Mixed Workload Test

**Configuration:**
- Executor: `ramping-vus`
- Stages: Ramp 1→10→20→30→10→0 VUs
- Duration: ~3 minutes
- Operation distribution:
  - 70% Transaction evaluation
  - 15% Read operations (alerts, rules)
  - 10% Health/metrics checks
  - 5% List operations

**Thresholds:**
- p95 latency < 200ms
- p99 latency < 500ms
- Error rate < 5%

### 3. Stress Test

**Configuration:**
- Executor: `ramping-arrival-rate`
- Start rate: 10 req/s
- Peak rate: 200 req/s
- Duration: ~6 minutes
- Stages: Warm up → Target → Stress → Breaking point → Recovery

**Thresholds:**
- p95 latency < 500ms (under stress)
- Error rate < 10% (under stress)

## Grafana Dashboard Metrics

The following metrics are visualized in the Grafana dashboard:

### KPIs
- **Transactions/sec**: Real-time transaction throughput
- **p99 Evaluation Latency**: 99th percentile rule evaluation time
- **Cache Hit Ratio**: Redis cache effectiveness (achieved 100%)
- **Error Rate**: Transaction processing failures

### Transaction Processing
- **Transaction Throughput**: Time series of transactions processed
- **Transactions by Organization**: Breakdown by tenant

### Rule Evaluation
- **Rule Evaluation Latency**: Histogram showing p50, p90, p99
  - p50: 5.00ms
  - p90: 9.00ms
  - p99: 9.90ms
- **Evaluation Status Distribution**: Success vs failure breakdown

### Cache Performance
- **Cache Hit/Miss Rate**: Time series of cache operations
- **Cache Hit Ratio**: Gauge showing overall cache effectiveness

## Screenshots

Screenshots captured from Grafana and Prometheus:

| Screenshot | Description |
|------------|-------------|
| `grafana-dashboard-viewport.png` | Main dashboard view with KPIs |
| `grafana-dashboard-full.png` | Full dashboard (all panels) |
| `grafana-kpis.png` | KPI stat panels |
| `grafana-transactions.png` | Transaction processing panels |
| `grafana-rules.png` | Rule evaluation panels |
| `grafana-cache.png` | Cache performance panels |
| `grafana-alerts.png` | Alert monitoring panels |
| `prometheus-targets.png` | Prometheus scrape targets |

## Performance Summary

The Rules Engine meets and exceeds all performance targets:

| Target | Required | Achieved | Margin |
|--------|----------|----------|--------|
| Throughput | 50 tx/sec | 50 tx/sec | Met |
| p99 Latency | < 100ms | 11.96ms | 88ms headroom |
| Error Rate | < 1% | 0.00% | Perfect |

### Key Observations

1. **Consistent Performance**: Latency remained stable throughout the 2-minute test
2. **Zero Errors**: All 6,001 transactions processed successfully
3. **Efficient Caching**: 100% cache hit ratio indicates effective rule caching
4. **Low Latency**: p99 of 11.96ms is 8x better than the 100ms target

## Running Benchmarks

```bash
# Transaction throughput test
npm run benchmark

# Mixed workload test
npm run benchmark:mixed

# Stress test
npm run benchmark:stress
```

## Observability Stack

Access the monitoring tools:

- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Application Metrics**: http://localhost:3000/metrics

## Conclusion

The Rules Engine demonstrates excellent performance characteristics:
- Handles sustained 50 tx/sec load without degradation
- Sub-12ms p99 latency provides significant headroom
- Zero error rate ensures reliability
- Effective caching reduces database load
