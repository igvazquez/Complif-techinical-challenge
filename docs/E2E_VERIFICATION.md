# End-to-End Verification Checklist

This document provides a comprehensive checklist to verify all components of the Rules Engine are working correctly.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ installed
- k6 installed (for benchmarks)
- curl or similar HTTP client

## 1. Start Full Stack

```bash
# Start all services
docker-compose up -d

# Verify all containers are running
docker-compose ps
```

**Expected**: 6 services healthy (postgres, redis, rabbitmq, app, prometheus, grafana)

```bash
# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Expected output**:
| Container | Status |
|-----------|--------|
| rules-engine-postgres | Up (healthy) |
| rules-engine-redis | Up (healthy) |
| rules-engine-rabbitmq | Up (healthy) |
| rules-engine-app | Up (healthy) |
| rules-engine-prometheus | Up (healthy) |
| rules-engine-grafana | Up (healthy) |

## 2. Database Verification

```bash
# Connect to database
docker exec -it rules-engine-postgres psql -U rules_user -d rules_engine

# List tables
\dt
```

**Expected tables**:
- organizations
- rule_templates
- template_versions
- template_overrides
- rules
- transactions
- alerts
- list_entries

```sql
-- Check indexes
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
```

**Expected**: Indexes on `id_organization` columns and foreign keys.

## 3. API Functional Tests

### 3.1 Health Check

```bash
curl http://localhost:3000/health
```

**Expected**: `{"status":"ok","info":{...}}`

### 3.2 Create Organization

```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Org","code":"TEST001","settings":{}}'
```

**Expected**: HTTP 201 with organization ID

```bash
# Save organization ID
export ORG_ID=<returned-id>
```

### 3.3 Create Rule Template

```bash
curl -X POST http://localhost:3000/api/templates \
  -H "Content-Type: application/json" \
  -d '{
    "name":"High Amount Rule",
    "description":"Triggers on high amounts",
    "ruleType":"amount",
    "category":"fraud",
    "severity":"high",
    "defaultConditions":{"all":[{"fact":"amount","operator":"greaterThan","value":10000}]},
    "defaultActions":[{"type":"createAlert","params":{"message":"High amount detected"}}]
  }'
```

**Expected**: HTTP 201 with template ID

```bash
export TEMPLATE_ID=<returned-id>
```

### 3.4 Create Rule

```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -H "x-organization-id: $ORG_ID" \
  -d "{
    \"name\":\"Org High Amount Rule\",
    \"templateId\":\"$TEMPLATE_ID\",
    \"priority\":100,
    \"isEnabled\":true
  }"
```

**Expected**: HTTP 201 with rule ID

### 3.5 Evaluate Transaction (Should Trigger Alert)

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -H "x-organization-id: $ORG_ID" \
  -d '{
    "externalId":"tx-test-001",
    "type":"transfer",
    "amount":15000,
    "currency":"USD",
    "customerId":"cust-123",
    "accountId":"acc-456",
    "metadata":{"country":"US"}
  }'
```

**Expected**: HTTP 201 with transaction data and `triggeredRules` containing the rule

### 3.6 Verify Alert Created

```bash
curl http://localhost:3000/api/alerts \
  -H "x-organization-id: $ORG_ID"
```

**Expected**: HTTP 200 with at least one alert

### 3.7 Evaluate Transaction (Should NOT Trigger)

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -H "x-organization-id: $ORG_ID" \
  -d '{
    "externalId":"tx-test-002",
    "type":"deposit",
    "amount":500,
    "currency":"USD",
    "customerId":"cust-123",
    "accountId":"acc-456",
    "metadata":{}
  }'
```

**Expected**: HTTP 201 with empty `triggeredRules` array

## 4. Metrics Verification

### 4.1 Application Metrics

```bash
curl http://localhost:3000/metrics
```

**Expected metrics present**:
- `transactions_processed_total`
- `rule_evaluation_duration_seconds`
- `rule_evaluation_total`
- `rules_evaluated_total`
- `rule_cache_total`
- `alerts_created_total`
- `alerts_deduplicated_total`
- `alert_action_duration_seconds`

### 4.2 Prometheus Targets

```bash
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'
```

**Expected**:
```json
{"job": "prometheus", "health": "up"}
{"job": "rules-engine", "health": "up"}
```

### 4.3 Prometheus Query Test

```bash
# Check transaction counter
curl -s "http://localhost:9090/api/v1/query?query=transactions_processed_total" | jq '.data.result'
```

**Expected**: Non-empty result with counter value

## 5. Grafana Dashboard Verification

1. Open http://localhost:3001
2. Login with admin/admin
3. Navigate to Dashboards → Rules Engine Overview

**Verify panels load**:
- [ ] Transactions/sec stat
- [ ] p99 Evaluation Latency stat
- [ ] Cache Hit Ratio stat
- [ ] Error Rate stat
- [ ] Transaction Throughput graph
- [ ] Rule Evaluation Latency graph
- [ ] Cache Hit/Miss Rate graph
- [ ] Alerts by Severity graph

## 6. Performance Benchmark

### 6.1 Transaction Throughput Test

```bash
npm run benchmark
```

**Expected results**:
- ✓ Throughput: 50+ requests/second
- ✓ p99 latency: < 100ms
- ✓ Error rate: < 1%

### 6.2 Mixed Workload Test

```bash
npm run benchmark:mixed
```

**Expected**: No threshold violations

### 6.3 Stress Test (Optional)

```bash
npm run benchmark:stress
```

**Document findings**:
- Maximum sustainable throughput: ___ req/s
- Breaking point: ___ req/s
- Recovery behavior: ___

## 7. Queue Processing Verification

### 7.1 RabbitMQ Management UI

1. Open http://localhost:15672
2. Login with rules_user/rules_password
3. Check Queues tab

**Expected queues**:
- transactions (ready for async processing if enabled)

### 7.2 Message Flow Test

Send multiple transactions and verify:
- Messages are published
- Messages are consumed
- No messages stuck in queue

## 8. Cache Verification

### 8.1 Check Redis Keys

```bash
docker exec rules-engine-redis redis-cli KEYS "*"
```

**Expected**: Rule cache keys present after rule evaluation

### 8.2 Cache Hit Test

```bash
# Send same transaction type twice
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -H "x-organization-id: $ORG_ID" \
  -d '{"externalId":"tx-cache-test","type":"transfer","amount":100,"currency":"USD","customerId":"cust-1","accountId":"acc-1","metadata":{}}'

# Check metrics for cache hit
curl -s http://localhost:3000/metrics | grep rule_cache_total
```

**Expected**: `rule_cache_total{result="hit"}` counter incremented

## 9. Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes (optional, destroys data)
docker-compose down -v
```

## Verification Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Docker Stack | ☐ | All 6 services healthy |
| Database | ☐ | Tables and indexes present |
| Organizations API | ☐ | CRUD operations work |
| Templates API | ☐ | Create and version |
| Rules API | ☐ | Create, enable/disable |
| Transactions API | ☐ | Evaluation with rule triggers |
| Alerts API | ☐ | Created on rule trigger |
| Lists API | ☐ | Blacklist/whitelist entries |
| Prometheus | ☐ | Scraping app metrics |
| Grafana | ☐ | Dashboard loads with data |
| Benchmarks | ☐ | Meets performance targets |
| Cache | ☐ | Redis caching active |
| Queue | ☐ | RabbitMQ processing |

## Troubleshooting

### App not starting
```bash
docker logs rules-engine-app
```

### Database connection issues
```bash
docker exec rules-engine-postgres pg_isready -U rules_user
```

### Redis connection issues
```bash
docker exec rules-engine-redis redis-cli ping
```

### RabbitMQ connection issues
```bash
docker exec rules-engine-rabbitmq rabbitmq-diagnostics ping
```

### Prometheus not scraping
Check prometheus.yml configuration and network connectivity.

### Grafana no data
1. Verify Prometheus datasource is connected
2. Check time range selector
3. Verify metrics exist in Prometheus
