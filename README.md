# Rules Engine

A real-time configurable rules engine for detecting suspicious transactions built with NestJS, PostgreSQL, Redis, and RabbitMQ.

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

- Node.js 20+
- Docker and Docker Compose
- npm

## Quick Start

1. **Clone and install dependencies**

```bash
cd rules-engine
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
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
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

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- src/database/migrations/MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## API Endpoints

### Organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - List organizations
- `GET /api/organizations/:id` - Get organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

### Rules
- `POST /api/rules` - Create rule
- `GET /api/rules` - List rules (org-scoped)
- `GET /api/rules/:id` - Get rule
- `PUT /api/rules/:id` - Update rule
- `PATCH /api/rules/:id` - Partial update
- `DELETE /api/rules/:id` - Delete rule

### Templates
- `POST /api/templates` - Create template
- `GET /api/templates` - List templates
- `GET /api/templates/:id` - Get template
- `PUT /api/templates/:id` - Update template (creates new version)
- `GET /api/templates/:id/versions` - List template versions
- `POST /api/templates/:id/overrides` - Create org override
- `PUT /api/templates/:id/overrides` - Update org override
- `DELETE /api/templates/:id/overrides` - Remove org override

### Transactions
- `POST /api/transactions` - Evaluate transaction
- `GET /api/transactions/:id` - Get transaction

### Alerts
- `GET /api/alerts` - List alerts
- `GET /api/alerts/:id` - Get alert
- `PATCH /api/alerts/:id` - Update alert status

### Lists
- `POST /api/lists` - Add list entry
- `GET /api/lists` - List entries
- `GET /api/lists/:id` - Get entry
- `DELETE /api/lists/:id` - Remove entry

### Health & Metrics
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation and ADRs.

## License

MIT
