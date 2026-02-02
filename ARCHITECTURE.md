# Architecture Documentation

## Overview

This rules engine is a B2B SaaS compliance platform designed to evaluate financial transactions against configurable rules in real-time. It generates alerts when suspicious activity is detected.

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client API    │────▶│  Rules Engine   │────▶│   PostgreSQL    │
│   (REST/HTTP)   │     │    (NestJS)     │     │   (Persistence) │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
            ┌───────────┐ ┌───────────┐ ┌───────────┐
            │   Redis   │ │ RabbitMQ  │ │  Metrics  │
            │  (Cache)  │ │  (Queue)  │ │(Prometheus)│
            └───────────┘ └───────────┘ └───────────┘
```

## Architectural Decisions Record (ADR)

### ADR-001: Multi-Tenancy Strategy

**Decision:** Shared schema with `id_organization` column

**Rationale:**
- Simplest to implement and maintain
- Single database, all tenants share tables, filtered by organization ID
- Adequate isolation for B2B SaaS compliance platform
- Easy to add indexes for organization-scoped queries

**Consequences:**
- All queries must include organization filter
- Indexes must be composite (organization + other columns)
- Data isolation enforced at application level

---

### ADR-002: Aggregation Strategy (Time Windows)

**Decision:** PostgreSQL with optimized indexes (MVP), Redis as future enhancement

**Rationale:**
- Start simple - well-indexed queries can meet <100ms for moderate volumes
- Avoid Redis complexity: memory growth, window change invalidation
- Composite indexes on `(id_organization, id_account, datetime)` + table partitioning by date

**Future Redis path:** If PostgreSQL aggregations exceed 50ms p99:
- Redis sorted sets for recent data
- PostgreSQL fallback for windows exceeding Redis retention

---

### ADR-003: Maximum Time Window

**Decision:** 30 days

**Rationale:**
- Covers monthly patterns
- Manageable data volume for PostgreSQL aggregations
- Sufficient for most velocity/frequency compliance rules

---

### ADR-004: Transaction Evaluation Flow

**Decision:** Synchronous evaluation

**Rationale:**
- Meets <100ms requirement
- Can block transactions immediately when rules trigger
- Simpler implementation and debugging
- Queue listener (RabbitMQ) added for batch/async processing

---

### ADR-005: Alert Deduplication

**Decision:** Increment counter on existing alert

**Rationale:**
- First match creates alert with `hit_count: 1`
- Subsequent matches within window: increment `hit_count`, update `last_triggered_at`
- Single alert per (rule + entity + window) - reduces noise for analysts
- Full audit trail via `hit_count` and timestamps

---

### ADR-006: Rule Template Inheritance

**Decision:** Partial override with merge

**Rationale:**
- Organizations override specific fields, inherit rest from base template
- Base template updates propagate to non-overridden fields
- Balances customization flexibility with maintainability
- Requires tracking which fields are overridden (stored in JSON)

---

### ADR-007: Alert Actions

**Decision:** DB persistence only (MVP), interfaces for webhook/queue/block

**Rationale:**
- Focus on core rule engine first
- Define clean interfaces (`AlertActionHandler`) for all action types
- Implement DB persistence fully
- Other actions as stubs ready for implementation

---

### ADR-008: Rule Cache

**Decision:** Redis cache for compiled rules

**Rationale:**
- Supports multiple Node.js instances (horizontal scaling)
- Cache invalidation via pub/sub when rules change
- TTL-based expiration as safety net

---

### ADR-009: Message Queue

**Decision:** RabbitMQ with abstraction layer

**Rationale:**
- 50 tx/sec requirement well within RabbitMQ capacity
- Simpler Docker Compose setup
- Excellent NestJS integration
- Abstract via `MessageConsumer` interface for future Kafka swap

---

### ADR-010: Failure Mode

**Decision:** Fail open - allow transaction, log error

**Rationale:**
- Most transactions are legitimate
- System errors blocking all transactions = major business disruption
- Comprehensive error logging enables post-incident review

---

### ADR-011: Behavior Rule Type

**Decision:** Stub with interface only

**Rationale:**
- Behavioral analysis is complex (ML territory)
- Define interface for future implementation
- Other rule types fully implemented

---

### ADR-012: Organization Deletion Strategy

**Decision:** Hard delete (physical deletion from database)

**Rationale:**
- Simpler implementation for MVP
- Organizations are root entities; no orphan concerns if cascade is set properly
- No immediate audit trail requirement for deleted organizations
- Soft delete can be added later if compliance requirements emerge (add `deleted_at` column)

**Consequences:**
- Deleted organizations cannot be recovered without database backup
- Must implement cascade delete or restrict for dependent entities (rules, alerts, etc.)
- Consider adding soft delete in future if audit trail is needed

---

### ADR-013: OrganizationGuard UUID Validation

**Decision:** Use `uuid.validate()` from uuid package, format validation only (no database existence check)

**Rationale:**
- `uuid.validate()` is cleaner and more reliable than regex
- Format validation at guard level catches malformed IDs early
- Database existence check deferred to service layer when needed
- Avoids database round-trip on every authenticated request
- Invalid org IDs naturally caught when service queries return empty results

**Consequences:**
- Requests with non-existent but valid UUID org IDs pass guard
- NotFoundException thrown at service layer when org doesn't exist
- Better performance (no extra DB query per request)

---

## Module Structure

### Implemented Modules

| Module | Purpose | Multi-tenant | Guard |
|--------|---------|--------------|-------|
| `OrganizationsModule` | Tenant management | No (root) | None |
| `RuleTemplatesModule` | System-wide rule templates | No | None |
| `TemplateOverridesModule` | Org-specific template customizations | Yes | OrganizationGuard |
| `RulesModule` | Active rules per organization | Yes | OrganizationGuard |
| `EngineModule` | Rule evaluation engine | Yes | OrganizationGuard |

### Configuration Inheritance Chain

```
RuleTemplate.config
        ↓
TemplateOverride.overrides (deep merge)
        ↓
Rule.config (deep merge)
        ↓
Effective Config (used for evaluation)
```

The `getEffectiveConfig()` method in RulesService performs this merge chain:
1. Start with template's base config
2. Apply organization's override (if enabled)
3. Apply rule's own config overrides
4. Return final merged configuration

---

## Data Model

### Entity Relationships

```
Organization (1) ──────< (N) Rule
     │
     └──────< (N) TemplateOverride
                    │
RuleTemplate (1) ───┘

Rule (1) ──────< (N) Alert
     │
Transaction (1) ───┘

Organization (1) ──────< (N) ListEntry
```

### Key Tables

| Table | Purpose | Multi-tenant |
|-------|---------|--------------|
| organizations | Tenant metadata | No (root) |
| rule_templates | Base rule configurations | No |
| template_overrides | Org-specific customizations | Yes |
| rules | Active rules per org | Yes |
| alerts | Generated alerts | Yes |
| transactions | Transaction history | Yes |
| list_entries | Blacklist/whitelist | Yes |

---

## Rule Types

### 1. Quantity Rules
Count transactions in time window.
```json
{
  "fact": "transaction.count",
  "operator": "greaterThan",
  "value": 10,
  "params": { "timeWindow": "24h", "groupBy": "account" }
}
```

### 2. Amount Rules
Individual or accumulated amount thresholds.
```json
{
  "any": [
    { "fact": "transaction.amount", "operator": "greaterThan", "value": 10000 },
    { "fact": "transaction.sum", "operator": "greaterThan", "value": 50000, "params": { "timeWindow": "7d" }}
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
  "params": { "timeWindow": "1h" }
}
```

### 4. Geolocation Rules
IP, country, region checks.
```json
{
  "fact": "transaction.country",
  "operator": "notIn",
  "value": ["AR", "UY", "CL"]
}
```

### 5. List Rules
Blacklist/Whitelist checks.
```json
{
  "fact": "account.id",
  "operator": "inBlacklist",
  "params": { "listType": "BLACKLIST", "entityType": "ACCOUNT" }
}
```

---

## Rule Engine

### Custom Operators

The engine extends json-rules-engine with custom operators for compliance-specific evaluations.

#### Aggregation Operators (`src/engine/operators/aggregation.operator.ts`)

| Operator | Description | Usage |
|----------|-------------|-------|
| `sumGreaterThan` | Check if sum exceeds threshold | `{ operator: "sumGreaterThan", value: 10000 }` |
| `countGreaterThan` | Check if count exceeds threshold | `{ operator: "countGreaterThan", value: 5 }` |
| `avgGreaterThan` | Check if average exceeds threshold | `{ operator: "avgGreaterThan", value: 1000 }` |

#### List Operators (`src/engine/operators/list.operator.ts`)

| Operator | Description | Usage |
|----------|-------------|-------|
| `inBlacklist` | Check if value is in blacklist | `{ operator: "inBlacklist", value: ["blocked-id"] }` |
| `inWhitelist` | Check if value is in whitelist | `{ operator: "inWhitelist", value: ["allowed-id"] }` |
| `containsValue` | Check if array contains value | `{ operator: "containsValue", value: "target" }` |

#### Geolocation Operators (`src/engine/operators/geolocation.operator.ts`)

| Operator | Description | Usage |
|----------|-------------|-------|
| `inCountry` | Check if country is in allowed list | `{ operator: "inCountry", value: ["AR", "BR"] }` |
| `notInCountry` | Check if country is not in blocked list | `{ operator: "notInCountry", value: ["KP", "IR"] }` |
| `isHighRiskCountry` | Check against high-risk country list | `{ operator: "isHighRiskCountry", value: true }` |

### Fact Providers

Fact providers supply dynamic data to rules during evaluation.

#### Transaction History (`src/engine/facts/transaction-history.fact.ts`)
- **Fact ID:** `transactionHistory`
- **Purpose:** Aggregates transaction data over time windows
- **Status:** Stubbed (returns 0) - will integrate with Transactions module in Phase 5
- **Params:** `{ accountId, timeWindow, aggregationType }`

#### Account Data (`src/engine/facts/account.fact.ts`)
- **Fact ID:** `accountData`
- **Purpose:** Retrieves account information for evaluation
- **Status:** Stubbed (returns mock data) - will integrate with external account service
- **Params:** `{ accountId, field }`

#### List Lookup (`src/engine/facts/list-lookup.fact.ts`)
- **Fact ID:** `listLookup`
- **Purpose:** Checks if entity exists in blacklist/whitelist
- **Status:** Stubbed (returns false) - will integrate with Lists module in Phase 7
- **Params:** `{ listType, entityType, entityValue }`

### Rule Caching

Rules are cached in Redis to avoid database queries on every evaluation.

**Cache key pattern:** `rules:engine:{organizationId}`
**TTL:** 300 seconds (configurable)

#### Cache Invalidation
Cache is invalidated via NestJS EventEmitter when:
- A rule is created, updated, or deleted
- A template override is created, updated, or deleted

The `RuleCacheService` subscribes to `rule.cache.invalidate` events and clears the cache for the affected organization.

### Prometheus Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `rule_evaluation_duration_seconds` | Histogram | `organization_id` | Time taken to evaluate rules |
| `rule_cache_hits_total` | Counter | - | Number of cache hits |
| `rule_cache_misses_total` | Counter | - | Number of cache misses |

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Evaluation latency (p99) | <100ms | Prometheus histogram |
| Throughput | 50+ tx/sec | Prometheus counter |
| Rule cache hit ratio | >95% | Prometheus gauge |
| Aggregation query time | <50ms | Prometheus histogram |

---

## Scaling Considerations

### Horizontal Scaling
- Stateless NestJS instances behind load balancer
- Redis for shared rule cache
- PostgreSQL read replicas for aggregation queries

### Vertical Scaling
- PostgreSQL partitioning by date
- Index optimization for common query patterns
- Connection pooling

### Future Enhancements
- Redis sorted sets for real-time aggregations
- Kafka for higher throughput event streaming
- Elasticsearch for alert search and analytics
