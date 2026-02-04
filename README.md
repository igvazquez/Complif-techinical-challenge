# Rules Engine

A real-time configurable rules engine for detecting suspicious transactions built with NestJS, PostgreSQL, Redis, and RabbitMQ.

## Challenge Status

| Category | Status | Details |
|----------|--------|---------|
| Core Requirements | ✅ Complete | All rule types, templates, alerts implemented |
| Performance | ✅ Exceeds | p99=13ms (target <100ms), 50+ tx/sec |
| Tech Stack | ✅ Complete | NestJS, PostgreSQL, Redis, RabbitMQ |
| Deliverables | ✅ Complete | Source, README, CLAUDE.md, Swagger, Docker |
| Bonus: Observability | ✅ Complete | Prometheus + Grafana with 18-panel dashboard |
| Bonus: Benchmarks | ✅ Complete | 3 k6 scenarios with documentation |

See [ARCHITECTURE.md - Challenge Compliance](./ARCHITECTURE.md#challenge-compliance--future-roadmap) for detailed compliance matrix and future improvements.

## Features

- **Multi-tenant architecture** - Shared schema with organization isolation
- **Rule Templates** - Base templates with organization-specific overrides
- **Multiple Rule Types**:
  - Quantity rules (transaction count thresholds)
  - Amount rules (individual and accumulated thresholds)
  - Velocity rules (transactions per time unit)
  - Geolocation rules (IP, country, region checks)
  - List rules (blacklist/whitelist checks)
- **Real-time evaluation** - Synchronous evaluation with <100ms target latency
- **Alert deduplication** - Increment counter on duplicate alerts within window
- **Redis caching** - Rule caching with pub/sub invalidation
- **Async processing** - RabbitMQ consumer for batch processing

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (only for local development)

## Quick Start (Docker)

The fastest way to get the application running:

```bash
cd rules-engine
docker-compose up -d
```

This starts all services:
- **Application**: http://localhost:3000
- **Swagger API Docs**: http://localhost:3000/api/docs
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)
- **RabbitMQ Management**: http://localhost:15672 (rules_user/rules_password)

To start only the core services (without monitoring):

```bash
docker-compose up -d postgres redis rabbitmq app
```

## Development Setup

For local development with faster iteration:

1. **Install dependencies**

```bash
npm install
```

2. **Start infrastructure services**

```bash
docker-compose up -d postgres redis rabbitmq
```

3. **Set up environment**

```bash
cp .env.example .env
```

4. **Run database migrations**

```bash
npm run migration:run
```

5. **Start the application**

```bash
npm run start:dev
```

## API Documentation

Once the application is running, access the Swagger UI at:
- http://localhost:3000/api/docs

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Application port | 3000 |
| `NODE_ENV` | Environment (development/production/test) | development |
| `DATABASE_HOST` | PostgreSQL host | localhost |
| `DATABASE_PORT` | PostgreSQL port | 5432 |
| `DATABASE_USER` | PostgreSQL user | rules_user |
| `DATABASE_PASSWORD` | PostgreSQL password | rules_password |
| `DATABASE_NAME` | PostgreSQL database | rules_engine |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `RABBITMQ_URL` | RabbitMQ connection URL | amqp://... |
| `MAX_TIME_WINDOW_DAYS` | Maximum aggregation window | 30 |
| `RULE_CACHE_TTL_SECONDS` | Rule cache TTL | 300 |
| `LOG_LEVEL` | Logging level | debug |

## Development

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage
npm run test:cov
```

**Test Coverage:** 90.51% statement coverage (281 tests across 27 test suites)

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## Observability

### Prometheus & Grafana

The full Docker Compose stack includes Prometheus and Grafana for monitoring:

```bash
# Start full stack with monitoring
docker-compose up -d

# Access points:
# - Application: http://localhost:3000
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3001 (admin/admin)
```

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `transactions_processed_total` | Counter | Total transactions processed |
| `rule_evaluation_duration_seconds` | Histogram | Rule evaluation latency |
| `rule_evaluation_total` | Counter | Rule evaluations by status |
| `rules_evaluated_total` | Counter | Individual rules evaluated |
| `rule_cache_total` | Counter | Cache hits/misses |
| `alerts_created_total` | Counter | Alerts created by severity |
| `alerts_deduplicated_total` | Counter | Deduplicated alerts |
| `alert_action_duration_seconds` | Histogram | Alert action execution time |

### Grafana Dashboard

The "Rules Engine Overview" dashboard provides:
- KPIs: Transactions/sec, p99 latency, cache hit ratio, error rate
- Transaction processing trends
- Rule evaluation latency percentiles
- Cache performance
- Alert metrics by severity and category
- System health (memory, HTTP latency)

## Performance Benchmarks

### Running Benchmarks

Requires [k6](https://k6.io/docs/getting-started/installation/) installed:

```bash
# Install k6 (macOS)
brew install k6

# Transaction throughput test (50 req/s for 2 min)
npm run benchmark

# Mixed workload test (realistic API usage)
npm run benchmark:mixed

# Stress test (find breaking point)
npm run benchmark:stress

# Run with Docker (no local k6 needed)
npm run benchmark:docker
```

### Performance Targets

| Metric | Target | Critical |
|--------|--------|----------|
| Throughput | 50+ tx/sec | 25 tx/sec |
| p99 Latency | < 100ms | < 500ms |
| Error Rate | < 1% | < 5% |

See [benchmark/README.md](./benchmark/README.md) for detailed benchmark documentation.

## Postman Collections

Two Postman collections are included for API testing and exploration.

### API Collection

The main collection covers all API endpoints organized by resource.

**Import:**
1. Open Postman and click **Import**
2. Import both files from the `postman/` directory:
   - `rules-engine.postman_collection.json`
   - `rules-engine.postman_environment.json`
3. Select the **Rules Engine - Local** environment

**Included Requests:**
- **Health** - Health check and Prometheus metrics
- **Organizations** - CRUD operations for tenants
- **Rule Templates** - Global rule template management
- **Template Overrides** - Organization-specific template customizations
- **Rules** - Organization-scoped rule CRUD
- **Lists** - Blacklist/whitelist entry management
- **Transactions** - Transaction submission and evaluation
- **Alerts** - Alert listing and status updates
- **Engine** - Direct rule evaluation endpoints

**Auto-Generated Variables:**

The collection includes test scripts that automatically capture IDs (`organizationId`, `ruleTemplateId`, `ruleId`, `transactionId`, `alertId`), allowing you to run requests in sequence without manually copying IDs.

### Interview Demo Collection

A comprehensive demonstration collection showcasing all rule engine capabilities.

**Import:**
1. Import both files from `postman/interview_demo/`:
   - `interview-demo.postman_collection.json`
   - `interview-demo.postman_environment.json`
2. Select the **Interview Demo** environment

**Demonstrates:**
- All rule types (Amount, Quantity, Velocity, Geolocation, Lists)
- All aggregation operators (SUM, COUNT, AVG, MAX, MIN)
- All logical operators (AND, OR, Nested, NOT)

Each section includes rule creation, a test that triggers the rule, a test that does not trigger, and alert verification.

### Regenerate API Collection

To regenerate the API collection from the current OpenAPI spec:

```bash
npm run postman:generate
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation and ADRs.

## Verification

For end-to-end verification of all components, see [docs/E2E_VERIFICATION.md](./docs/E2E_VERIFICATION.md).

## License

MIT
