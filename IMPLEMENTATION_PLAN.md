# Real-Time Rules Engine - Architecture & Implementation Plan

## Executive Summary

Build a configurable rules engine for detecting suspicious transactions in real-time using NestJS, PostgreSQL, Redis, and RabbitMQ. The system evaluates transactions against dynamically defined rules and generates alerts when conditions are met.

---

## Architectural Decisions Record (ADR)

### ADR-001: Multi-Tenancy Strategy
**Decision:** Shared schema with `id_organization` column
**Rationale:**
- Simplest to implement and maintain
- Single database, all tenants share tables, filtered by organization ID
- Adequate isolation for B2B SaaS compliance platform
- Easy to add indexes for organization-scoped queries

### ADR-002: Aggregation Strategy (Time Windows)
**Decision:** PostgreSQL with optimized indexes (MVP), Redis as future enhancement
**Rationale:**
- Start simple - well-indexed queries can meet <100ms for moderate volumes
- Avoid Redis complexity: memory growth (130M+ refs for 30 days at 50 tx/sec), window change invalidation
- Document Redis upgrade path for when PostgreSQL becomes bottleneck
- Composite indexes on `(id_organization, id_account, datetime)` + table partitioning by date

**Future Redis path:** If PostgreSQL aggregations exceed 50ms p99, implement:
- Redis sorted sets for recent data (configurable retention)
- PostgreSQL fallback for windows exceeding Redis retention

### ADR-003: Maximum Time Window
**Decision:** 30 days
**Rationale:**
- Not specified in requirements, 30 days covers monthly patterns
- Manageable data volume for PostgreSQL aggregations
- Sufficient for most velocity/frequency compliance rules

### ADR-004: Transaction Evaluation Flow
**Decision:** Synchronous evaluation
**Rationale:**
- Meets <100ms requirement
- Can block transactions immediately when rules trigger
- Simpler implementation and debugging
- Queue listener (RabbitMQ) added for batch/async processing

### ADR-005: Alert Deduplication
**Decision:** Increment counter on existing alert
**Rationale:**
- First match creates alert with `hit_count: 1`
- Subsequent matches within window: increment `hit_count`, update `last_triggered_at`
- Single alert per (rule + entity + window) - reduces noise for analysts
- Full audit trail via `hit_count` and timestamps

### ADR-006: Rule Template Inheritance
**Decision:** Partial override with merge
**Rationale:**
- Organizations override specific fields, inherit rest from base template
- Base template updates propagate to non-overridden fields
- Balances customization flexibility with maintainability
- Requires tracking which fields are overridden (stored in JSON)

### ADR-007: Alert Actions
**Decision:** DB persistence only (MVP), interfaces for webhook/queue/block
**Rationale:**
- Focus on core rule engine first
- Define clean interfaces (`AlertActionHandler`) for all action types
- Implement DB persistence fully
- Other actions as stubs ready for implementation

### ADR-008: Rule Cache
**Decision:** Redis cache for compiled rules
**Rationale:**
- Challenge document recommends Redis
- Supports multiple Node.js instances (horizontal scaling)
- Cache invalidation via pub/sub when rules change
- TTL-based expiration as safety net

### ADR-009: Message Queue
**Decision:** RabbitMQ with abstraction layer
**Rationale:**
- 50 tx/sec requirement well within RabbitMQ capacity
- Simpler Docker Compose setup (single container vs Kafka's complexity)
- Excellent NestJS integration (@nestjs/microservices)
- Abstract via `MessageConsumer` interface for future Kafka swap

### ADR-010: Failure Mode
**Decision:** Fail open - allow transaction, log error
**Rationale:**
- Most transactions are legitimate (high legitimate-to-fraudulent ratio)
- System errors blocking all transactions = major business disruption
- Risk of missing few suspicious transactions during brief outage < cost of blocking legitimate business
- Comprehensive error logging enables post-incident review

### ADR-011: Behavior Rule Type
**Decision:** Stub with interface only
**Rationale:**
- Behavioral analysis is complex (ML territory)
- Define interface for future implementation
- Other rule types (Quantity, Amount, Velocity, Geolocation, Lists) fully implemented

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | NestJS + TypeScript | API and business logic |
| Database | PostgreSQL | Rules, alerts, transactions persistence |
| Cache | Redis | Rule caching, pub/sub for invalidation |
| Queue | RabbitMQ | Async transaction processing |
| ORM | TypeORM | Database access with migrations |
| Validation | class-validator, JSON Schema (ajv) | Input and rule config validation |
| Rules Engine | json-rules-engine | Base rule evaluation (extended) |
| Logging | Pino (nestjs-pino) | Structured JSON logging |
| Metrics | @willsoto/nestjs-prometheus | Prometheus metrics endpoint |
| API Docs | @nestjs/swagger | OpenAPI spec generation |
| Testing | Jest | Unit and integration tests |
| Containerization | Docker + Docker Compose | Local development stack |

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
├── common/                      # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── interfaces/
├── config/                      # Configuration module
│   ├── config.module.ts
│   ├── configuration.ts
│   └── validation.schema.ts
├── database/                    # Database configuration
│   ├── database.module.ts
│   └── migrations/
├── organizations/               # Multi-tenant organizations
│   ├── organizations.module.ts
│   ├── organizations.controller.ts
│   ├── organizations.service.ts
│   └── entities/
│       └── organization.entity.ts
├── rules/                       # Rule management
│   ├── rules.module.ts
│   ├── rules.controller.ts
│   ├── rules.service.ts
│   ├── rule-cache.service.ts
│   ├── entities/
│   │   └── rule.entity.ts
│   ├── dto/
│   │   ├── create-rule.dto.ts
│   │   └── update-rule.dto.ts
│   └── schemas/
│       └── rule-config.schema.json
├── templates/                   # Rule templates
│   ├── templates.module.ts
│   ├── templates.controller.ts
│   ├── templates.service.ts
│   ├── entities/
│   │   ├── template.entity.ts
│   │   └── template-override.entity.ts
│   └── dto/
├── engine/                      # Rule evaluation engine
│   ├── engine.module.ts
│   ├── engine.service.ts
│   ├── operators/               # Custom operators
│   │   ├── aggregation.operator.ts
│   │   ├── list.operator.ts
│   │   ├── geolocation.operator.ts
│   │   └── velocity.operator.ts
│   ├── facts/                   # Custom fact providers
│   │   ├── transaction-history.fact.ts
│   │   ├── account.fact.ts
│   │   └── blacklist.fact.ts
│   └── interfaces/
│       └── rule-context.interface.ts
├── transactions/                # Transaction processing
│   ├── transactions.module.ts
│   ├── transactions.controller.ts
│   ├── transactions.service.ts
│   ├── transaction-consumer.service.ts  # RabbitMQ consumer
│   ├── entities/
│   │   └── transaction.entity.ts
│   └── dto/
├── alerts/                      # Alert management
│   ├── alerts.module.ts
│   ├── alerts.controller.ts
│   ├── alerts.service.ts
│   ├── actions/                 # Action handlers
│   │   ├── action-handler.interface.ts
│   │   ├── db-action.handler.ts
│   │   ├── webhook-action.handler.ts  # Stub
│   │   ├── queue-action.handler.ts    # Stub
│   │   └── block-action.handler.ts    # Stub
│   ├── entities/
│   │   └── alert.entity.ts
│   └── dto/
├── lists/                       # Blacklist/Whitelist management
│   ├── lists.module.ts
│   ├── lists.controller.ts
│   ├── lists.service.ts
│   └── entities/
│       └── list-entry.entity.ts
└── health/                      # Health checks
    ├── health.module.ts
    └── health.controller.ts

test/
├── unit/
├── integration/
└── fixtures/
```

---

## Database Schema

### Core Entities

```sql
-- Organizations (multi-tenant)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Rule Templates (base templates)
CREATE TABLE rule_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    config JSONB NOT NULL,  -- Full rule configuration
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, version)
);

-- Template Overrides (org-specific customizations)
CREATE TABLE template_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_organization UUID NOT NULL REFERENCES organizations(id),
    id_template UUID NOT NULL REFERENCES rule_templates(id),
    overrides JSONB NOT NULL,  -- Only overridden fields
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(id_organization, id_template)
);

-- Rules (active rules per organization)
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_organization UUID NOT NULL REFERENCES organizations(id),
    id_template UUID REFERENCES rule_templates(id),  -- NULL if standalone
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    config JSONB NOT NULL,  -- Full rule configuration
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    INDEX idx_rules_org_enabled (id_organization, enabled)
);

-- Alerts
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_organization UUID NOT NULL REFERENCES organizations(id),
    id_rule UUID NOT NULL REFERENCES rules(id),
    id_transaction UUID NOT NULL,
    id_account UUID,
    severity VARCHAR(20) NOT NULL,  -- LOW, MEDIUM, HIGH, CRITICAL
    category VARCHAR(50) NOT NULL,  -- AML, FRAUD, COMPLIANCE, etc.
    status VARCHAR(20) DEFAULT 'OPEN',  -- OPEN, ACKNOWLEDGED, RESOLVED, FALSE_POSITIVE
    hit_count INTEGER DEFAULT 1,
    first_triggered_at TIMESTAMP DEFAULT NOW(),
    last_triggered_at TIMESTAMP DEFAULT NOW(),
    dedup_key VARCHAR(255) NOT NULL,  -- rule_id:entity_id:window_key
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_alerts_org_status (id_organization, status),
    INDEX idx_alerts_dedup (dedup_key, first_triggered_at)
);

-- Transactions (for aggregation queries)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_organization VARCHAR(50) NOT NULL,
    id_account UUID NOT NULL,
    amount DECIMAL(20, 4) NOT NULL,
    amount_normalized DECIMAL(20, 4) NOT NULL,
    currency VARCHAR(3),
    type VARCHAR(20) NOT NULL,  -- CASH_IN, CASH_OUT, DEBIT, CREDIT
    sub_type VARCHAR(50),
    datetime TIMESTAMP NOT NULL,
    date DATE NOT NULL,
    is_voided BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    origin VARCHAR(50),
    device_info JSONB,
    data JSONB,
    external_code VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_tx_org_account_datetime (id_organization, id_account, datetime),
    INDEX idx_tx_org_datetime (id_organization, datetime)
) PARTITION BY RANGE (date);

-- Monthly partitions for transactions
CREATE TABLE transactions_y2025m01 PARTITION OF transactions
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
-- ... additional partitions

-- Blacklists/Whitelists
CREATE TABLE list_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_organization UUID NOT NULL REFERENCES organizations(id),
    list_type VARCHAR(20) NOT NULL,  -- BLACKLIST, WHITELIST
    entity_type VARCHAR(50) NOT NULL,  -- ACCOUNT, IP, COUNTRY, etc.
    entity_value VARCHAR(255) NOT NULL,
    reason TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by UUID,
    INDEX idx_list_org_type (id_organization, list_type, entity_type)
);
```

---

## Rule Types Implementation

### 1. Quantity Rules
Count transactions in time window.

```json
{
  "fact": "transaction.count",
  "operator": "greaterThan",
  "value": 10,
  "params": {
    "timeWindow": "24h",
    "groupBy": "account"
  }
}
```

### 2. Amount Rules
Individual or accumulated amount thresholds.

```json
{
  "any": [
    {
      "fact": "transaction.amount",
      "operator": "greaterThan",
      "value": 10000
    },
    {
      "fact": "transaction.sum",
      "operator": "greaterThan",
      "value": 50000,
      "params": {
        "timeWindow": "7d",
        "groupBy": "account"
      }
    }
  ]
}
```

### 3. Velocity Rules
Transactions per time unit.

```json
{
  "fact": "transaction.velocity",
  "operator": "greaterThan",
  "value": 5,
  "params": {
    "timeWindow": "1h",
    "groupBy": "account"
  }
}
```

### 4. Geolocation Rules
IP, country, region checks.

```json
{
  "any": [
    {
      "fact": "transaction.country",
      "operator": "notIn",
      "value": ["AR", "UY", "CL"]
    },
    {
      "fact": "device.ip_country",
      "operator": "in",
      "value": ["$HIGH_RISK_COUNTRIES"]  // Reference to list
    }
  ]
}
```

### 5. List Rules
Blacklist/Whitelist checks.

```json
{
  "fact": "account.id",
  "operator": "inBlacklist",
  "params": {
    "listType": "BLACKLIST",
    "entityType": "ACCOUNT"
  }
}
```

### 6. Behavior Rules (Stub)
Interface defined, implementation deferred.

```typescript
interface BehaviorFactProvider {
  getDeviationFromHistorical(
    accountId: string,
    metric: 'amount' | 'frequency',
    timeWindow: string
  ): Promise<number>;
}
```

---

## API Endpoints

### Rules Management
```
POST   /api/rules                       Create rule
GET    /api/rules                       List rules (org-scoped)
GET    /api/rules/:id                   Get rule by ID
PUT    /api/rules/:id                   Update rule (full replace)
PATCH  /api/rules/:id                   Partial update (enabled, priority, etc.)
DELETE /api/rules/:id                   Delete rule
```

### Templates Management
```
POST   /api/templates                   Create template
GET    /api/templates                   List templates
GET    /api/templates/:id               Get template
PUT    /api/templates/:id               Update template (creates new version)
GET    /api/templates/:id/versions      List template versions
POST   /api/templates/:id/overrides     Create org override
PUT    /api/templates/:id/overrides     Update org override
DELETE /api/templates/:id/overrides     Remove org override
```

### Transaction Evaluation
```
POST   /api/transactions                Evaluate transaction against rules
GET    /api/transactions/:id            Get transaction by ID
```

### Alerts
```
GET    /api/alerts                      List alerts (filterable)
GET    /api/alerts/:id                  Get alert details
PATCH  /api/alerts/:id                  Update alert (status, notes, etc.)
```

### Lists (Blacklist/Whitelist)
```
POST   /api/lists                       Add entry to list
GET    /api/lists                       List entries (filterable)
GET    /api/lists/:id                   Get entry by ID
DELETE /api/lists/:id                   Remove entry
```

### Health & Metrics
```
GET    /health                          Health check
GET    /metrics                         Prometheus metrics
```

---

## Implementation Phases

> **Testing Policy:** Every service, controller, and non-trivial module must have its corresponding test file created alongside it. Tests are written as part of each phase, not as a separate phase. Target: >80% coverage throughout.

> **Documentation Policy:** Documentation grows incrementally with each phase. README.md, ARCHITECTURE.md, and CLAUDE.md are created in Phase 1 and updated as features are added. OpenAPI docs auto-generate from code decorators.

### Phase 1: Project Setup & Core Infrastructure ✅ COMPLETED
1. ✅ Initialize NestJS project with TypeScript
2. ✅ Configure ESLint + Prettier
3. ✅ Set up Docker Compose (PostgreSQL, Redis, RabbitMQ)
4. ✅ Configure TypeORM with migrations
5. ✅ Set up Pino logging
6. ✅ Set up Prometheus metrics
7. ✅ Configure environment variables and validation
8. ✅ Create health check endpoint
9. ✅ **Docs:** Create initial README.md, ARCHITECTURE.md, CLAUDE.md

**Tests:** ✅ Health endpoint unit test, config validation

### Phase 2: Core Entities & Multi-Tenancy ✅ COMPLETED
1. ✅ Implement Organization module (CRUD)
2. ✅ Create base entity with id_organization (TenantBaseEntity)
3. ✅ Implement organization-scoped guards/interceptors (OrganizationGuard, @OrganizationId())
4. ✅ Set up database indexes

**Tests:** ✅ Organization service unit tests (14 tests), controller integration tests (22 tests)
**Docs:** ✅ Updated README, CLAUDE.md, ARCHITECTURE.md, CHANGELOG.md

### Phase 3: Rule Templates & Rules ✅ COMPLETED
1. ✅ Implement Rule Template module
   - ✅ CRUD operations
   - ⏸️ Version management (DEFERRED)
   - ✅ Template override logic (partial merge)
2. ✅ Implement Rules module
   - ✅ CRUD operations
   - ⏸️ JSON Schema validation for rule config (DEFERRED)
   - ✅ Rule priority ordering

**Deferred Items:**
- Version management: Can be added when template versioning requirements are clearer
- JSON Schema validation: Can be added when rule config schemas are finalized

**Tests:** ✅ Template service tests (override merge), rule validation tests
- Unit tests: 48 tests across RuleTemplates, TemplateOverrides, Rules services
- E2E tests: 53 tests across 3 e2e spec files
**Docs:** ✅ Rule configuration examples added to ARCHITECTURE.md, CLAUDE.md updated

### Phase 4: Rule Engine Core ✅ COMPLETED
1. ✅ Integrate json-rules-engine v7.3.1
2. ✅ Implement custom operators:
   - ✅ Aggregation: sumGreaterThan, countGreaterThan, avgGreaterThan
   - ✅ List operators: inBlacklist, inWhitelist, containsValue
   - ✅ Geolocation operators: inCountry, notInCountry, isHighRiskCountry
3. ✅ Implement custom fact providers (stubbed for Phase 5/7):
   - ✅ Transaction history (returns 0 - stub)
   - ✅ Account data (returns mock data - stub)
   - ✅ List lookups (returns false - stub)
4. ✅ Implement rule caching (Redis)
5. ✅ Implement cache invalidation (EventEmitter + Redis pub/sub)
6. ✅ Add Prometheus metrics (evaluation duration, cache hits/misses)
7. ✅ Add evaluation REST endpoints

**Tests:** ✅ Unit tests for operators, fact providers, cache, engine service
- Unit tests: 84 new tests (operators, facts, cache, engine service)
- E2E tests: 16 tests for engine evaluation flow
**Docs:** ✅ Custom operators and facts documented in ARCHITECTURE.md

### Phase 5: Transaction Processing ✅ COMPLETED
1. ✅ Implement Transaction entity and storage
   - Full entity with amounts, dates, geo data, device info
   - Migration with 6 optimized indexes
2. ✅ Create evaluation endpoint (POST /api/transactions)
   - Returns transaction + evaluation result
   - Full Swagger documentation
3. ✅ Implement synchronous evaluation flow
   - Transaction saved before evaluation (supports history-based rules)
   - Integrated with EngineService
4. ✅ Set up RabbitMQ consumer for async processing
   - Listens on 'transactions' queue
   - Manual acknowledgment with durable queue
5. ✅ Implement fail-open error handling
   - Service and consumer level error handling
   - Errors logged, transactions not blocked
6. ✅ Add evaluation metrics (latency, throughput)
   - `transactions_processed_total` counter
   - `rule_evaluation_duration_seconds` histogram
   - `rule_evaluation_total` counter
   - `rules_evaluated_total` counter

**Tests:** ✅ Unit tests (10+ cases), E2E tests (11+ scenarios)
**Docs:** ✅ Transaction handling documented

### Phase 6: Alert System ✅ COMPLETED
1. ✅ Implement Alert entity
   - AlertSeverity enum (LOW, MEDIUM, HIGH, CRITICAL)
   - AlertCategory enum (AML, FRAUD, COMPLIANCE, UNKNOWN)
   - AlertStatus enum (OPEN, ACKNOWLEDGED, RESOLVED, FALSE_POSITIVE)
   - Full entity with hit_count, dedup_key, timestamps, metadata
2. ✅ Create alert service with deduplication logic
   - Time window parsing (24h, 7d, etc.)
   - Window bucket calculation for dedup_key
   - Upsert logic (create or increment hit_count)
3. ✅ Implement action handler interface
   - AlertActionHandler interface with execute() and getType()
4. ✅ Implement DB action handler
   - Full implementation that persists alerts
5. ✅ Create stub handlers for webhook/queue/block
   - WebhookActionHandler (stub with logging)
   - QueueActionHandler (stub with logging)
   - BlockActionHandler (stub with logging)
6. ✅ Add alert management endpoints
   - GET /api/alerts (list with filters & pagination)
   - GET /api/alerts/:id (get alert details)
   - PATCH /api/alerts/:id (update status)
7. ✅ Event-driven integration via RabbitMQ
   - AlertsConsumer listens on 'alerts' queue
   - TransactionsService publishes alert events after rule evaluation
8. ✅ Prometheus metrics
   - alerts_created_total (by organization, severity, category)
   - alerts_deduplicated_total (by organization)
   - alert_action_duration_seconds (by action_type, status)

**Tests:** ✅ Unit tests (14 tests), E2E tests ready
**Docs:** ✅ Alert configuration and deduplication behavior documented

### Phase 7: Lists Management ✅ COMPLETED
1. ✅ Implement list entries entity
   - ListEntry entity with ListType (BLACKLIST/WHITELIST) enum
   - EntityType enum (ACCOUNT, IP, COUNTRY, DEVICE, EMAIL, PHONE)
   - Unique constraint on (org + listType + entityType + entityValue)
   - Soft expiration support (expiresAt field)
2. ✅ Create CRUD endpoints
   - POST /api/lists - Create entry (409 on duplicate)
   - GET /api/lists - List with filters (listType, entityType, entityValue)
   - GET /api/lists/:id - Get by ID
   - DELETE /api/lists/:id - Remove entry
   - No update endpoint (immutable entries by design)
3. ✅ Integrate with rule engine (list operators)
   - Updated ListLookupFact to use ListsService.isInList()
   - Updated ListLookupParams interface with listType and entityType
   - Expiration check in isInList() (expired entries return false)

**Tests:** ✅ Unit tests (17 tests), E2E tests (all endpoints)
**Docs:** ✅ ARCHITECTURE.md, CLAUDE.md, src/lists/CLAUDE.md, src/engine/CLAUDE.md updated

### Phase 8: Observability & Final Polish
1. Configure Grafana dashboards (JSON exports)
2. Run performance benchmarks, document results
3. Final Docker Compose refinements
4. End-to-end verification
5. Generate Postman collection from OpenAPI spec

**Tests:** Performance benchmark suite
**Docs:** Finalize all documentation, add benchmark results

---

## Key Metrics to Track

```typescript
// Prometheus metrics
const metrics = {
  rule_evaluation_duration_seconds: Histogram,    // p50, p95, p99
  rule_evaluation_total: Counter,                 // by result (pass/fail)
  alerts_generated_total: Counter,                // by severity, category
  transactions_processed_total: Counter,          // by source (api/queue)
  active_rules_count: Gauge,                      // by organization
  cache_hit_ratio: Gauge,                         // rule cache effectiveness
};
```

---

## Verification Plan

### Functional Testing
1. Create organization
2. Create rule template
3. Create rule from template with override
4. Submit transaction via API
5. Verify rule evaluation (pass/fail)
6. Verify alert creation with deduplication
7. Verify metrics endpoint

### Performance Testing
1. Load test: 50+ transactions/second
2. Measure p99 latency (target: <100ms)
3. Test rule cache effectiveness
4. Test aggregation query performance

### Integration Testing
1. Full Docker Compose stack
2. PostgreSQL migrations
3. Redis connectivity
4. RabbitMQ consumer

---

## Files to Create/Modify

### New Files (Core)
Each module includes its test files colocated:
- `src/app.module.ts`
- `src/main.ts`
- `src/config/*`
- `src/database/*`
- `src/organizations/` (+ `*.spec.ts` files)
- `src/rules/` (+ `*.spec.ts` files)
- `src/templates/` (+ `*.spec.ts` files)
- `src/engine/` (+ `*.spec.ts` files)
- `src/transactions/` (+ `*.spec.ts` files)
- `src/alerts/` (+ `*.spec.ts` files)
- `src/lists/` (+ `*.spec.ts` files)
- `src/health/` (+ `*.spec.ts` files)

### Test Infrastructure
- `test/jest-e2e.json` - E2E test config
- `test/test-utils.ts` - Shared test utilities (test DB setup, fixtures)

### Configuration Files
- `docker-compose.yml`
- `Dockerfile`
- `.env.example`
- `tsconfig.json`
- `.eslintrc.js`
- `.prettierrc`
- `jest.config.js`
- `package.json`

### Documentation (Created in Phase 1, Updated Throughout)
- `README.md` - Setup and usage instructions
- `ARCHITECTURE.md` - ADRs and technical decisions
- `CLAUDE.md` - AI agent instructions for Claude Code
- `IMPLEMENTATION_PLAN.md` - This file
