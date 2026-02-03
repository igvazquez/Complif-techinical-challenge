# Changelog

All notable changes to this project will be documented in this file.

---

## [2026-02-03] Feature - MAX/MIN Aggregation Operators
**Summary:** Added MAX and MIN aggregation operators to complete the aggregation requirements for the rule engine.

**Changes:**
- Extended `TransactionHistoryParams.aggregation` type to include `'max' | 'min'`
- Added `max` and `min` cases to transaction history fact SQL queries
- Created 4 new operators: `maxGreaterThan`, `maxGreaterThanOrEqual`, `minLessThan`, `minLessThanOrEqual`
- Added comprehensive unit tests for all new operators (16 new test cases)

**Files Modified:**
- `src/engine/interfaces/fact-provider.interface.ts` - Extended aggregation type
- `src/engine/facts/transaction-history.fact.ts` - Added MAX/MIN SQL aggregation cases
- `src/engine/operators/aggregation.operator.ts` - Added 4 new operators
- `src/engine/operators/aggregation.operator.spec.ts` - Added tests for new operators
- `ARCHITECTURE.md` - Updated documentation

**Example Rule Config:**
```json
{
  "conditions": {
    "all": [
      {
        "fact": "transactionHistory",
        "params": {
          "aggregation": "max",
          "field": "amountNormalized",
          "timeWindowDays": 30
        },
        "operator": "maxGreaterThan",
        "value": 50000
      }
    ]
  }
}
```

**Test Coverage:**
- Unit tests: 33 passing (16 new for MAX/MIN operators)
- E2E tests: 145 passing

---

## [2026-02-03] Phase 8 - Observability and Final Polish
**Summary:** Complete observability infrastructure with Prometheus, Grafana dashboards, k6 performance benchmarks, and Postman collection for API testing.

**Changes:**
- Added Prometheus service (v2.50.1) with scrape configuration for metrics collection
- Added Grafana service (v10.3.3) with auto-provisioned datasources and dashboards
- Created comprehensive "Rules Engine Overview" dashboard with 7 rows and 18 panels covering KPIs, transactions, rules, cache, alerts, and system health
- Implemented k6 benchmark scripts: transaction throughput (50 req/s), mixed workload (70/15/10/5 split), stress test (ramp to 200 req/s)
- Added complete Postman collection with all API endpoints and correct DTOs
- Added health checks and resource limits to Docker Compose services

**Files Added:**
- `docker/prometheus/prometheus.yml` - Scrape configuration
- `docker/grafana/provisioning/` - Datasource and dashboard provisioning
- `docker/grafana/dashboards/rules-engine-overview.json` - Full dashboard definition (1000+ lines)
- `benchmark/k6/scenarios/transaction-throughput.js` - Throughput benchmark
- `benchmark/k6/scenarios/mixed-workload.js` - Mixed workload benchmark
- `benchmark/k6/scenarios/stress-test.js` - Stress test benchmark
- `postman/rules-engine.postman_collection.json` - API collection
- `docs/E2E_VERIFICATION.md` - Step-by-step verification checklist

**Files Modified:**
- `docker-compose.yml` - Added Prometheus, Grafana services with health checks
- `README.md` - Added Observability and Performance Benchmarks sections
- `IMPLEMENTATION_PLAN.md` - Phase 8 marked complete

**Grafana Dashboard Panels:**
- KPIs: transactions/sec, p99 latency, cache hit ratio, error rate
- Transaction Processing: throughput, by-organization breakdown
- Rule Evaluation: latency percentiles, status distribution
- Cache Performance: hit/miss rate, hit ratio gauge
- Alerts: by severity, by category, deduplication rate
- System Health: memory, HTTP latency, Node.js handles

**Benchmark Targets:**
| Benchmark | Target | Metrics |
|-----------|--------|---------|
| Throughput | 50 req/s sustained | p99 < 100ms |
| Mixed | 70% tx, 15% reads, 10% health, 5% lists | Error rate < 1% |
| Stress | Ramp to 200 req/s | Find breaking point |

---

## [2026-02-03] Phase 7 - Lists Management
**Summary:** Implemented blacklist/whitelist management module with full CRUD operations and integration with the rule engine for list-based lookups.

**Changes:**
- Created `ListEntry` entity with `ListType` (BLACKLIST/WHITELIST) and `EntityType` (ACCOUNT, IP, COUNTRY, DEVICE, EMAIL, PHONE) enums
- Implemented `ListsService` with `isInList()` method for rule engine integration
- Updated `ListLookupFact` to query actual list data instead of returning stubs
- Added unique constraint to prevent duplicate entries per organization
- Created REST API endpoints for list entry management

**Files Added:**
- `src/lists/entities/list-entry.entity.ts` - ListEntry entity with enums
- `src/lists/dto/create-list-entry.dto.ts` - Creation DTO with validation
- `src/lists/dto/list-entry-query.dto.ts` - Query filters for listing
- `src/lists/lists.service.ts` - CRUD operations and isInList() lookup
- `src/lists/lists.service.spec.ts` - 17 unit tests
- `src/lists/lists.controller.ts` - REST endpoints
- `src/lists/lists.module.ts` - Module definition
- `src/lists/CLAUDE.md` - Module-specific documentation
- `src/database/migrations/1738627200000-CreateListEntries.ts` - Migration with indexes
- `test/lists.e2e-spec.ts` - E2E tests

**Files Modified:**
- `src/app.module.ts` - Registered ListsModule
- `src/engine/engine.module.ts` - Added ListsModule import
- `src/engine/facts/list-lookup.fact.ts` - Updated to use ListsService
- `src/engine/interfaces/fact-provider.interface.ts` - Updated ListLookupParams interface

**API Endpoints:**
| Endpoint | Guard | Description |
|----------|-------|-------------|
| `POST /api/lists` | OrganizationGuard | Create list entry |
| `GET /api/lists` | OrganizationGuard | List entries with filters |
| `GET /api/lists/:id` | OrganizationGuard | Get entry by ID |
| `DELETE /api/lists/:id` | OrganizationGuard | Delete entry |

**List Lookup Rule Example:**
```json
{
  "conditions": {
    "all": [
      {
        "fact": "listLookup",
        "params": {
          "listType": "BLACKLIST",
          "entityType": "COUNTRY",
          "value": { "fact": "transaction", "path": "$.country" }
        },
        "operator": "equal",
        "value": true
      }
    ]
  }
}
```

**Test Coverage:**
- Unit tests: 17 new tests for ListsService
- Total: 193 unit tests passing

---

## [2026-02-03] Phase 6 - Alert System
**Summary:** Implemented an event-driven alert system using RabbitMQ. When transactions trigger rules, alert events are published to a dedicated queue and processed asynchronously by the AlertsService with deduplication logic.

**Changes:**
- Created Alert entity with severity, category, status enums and deduplication fields
- Implemented AlertsService with time window-based deduplication logic
- Created action handler interface with DB, webhook, queue, and block implementations (DB full, others stubbed)
- Set up RabbitMQ consumer for alerts queue with manual acknowledgment
- Integrated alert publishing into TransactionsService after rule evaluation
- Added Prometheus metrics for alert tracking

**Files Added:**
- `src/alerts/entities/alert.entity.ts` - Alert entity with enums (AlertSeverity, AlertCategory, AlertStatus)
- `src/alerts/dto/alert-event.message.ts` - RabbitMQ message interface
- `src/alerts/dto/alert-query.dto.ts` - List filters (status, severity, category, ruleId)
- `src/alerts/dto/update-alert-status.dto.ts` - PATCH body for status updates
- `src/alerts/dto/index.ts` - Barrel exports
- `src/alerts/actions/action-handler.interface.ts` - AlertActionHandler interface
- `src/alerts/actions/db-action.handler.ts` - Full implementation (always runs)
- `src/alerts/actions/webhook-action.handler.ts` - Stub implementation
- `src/alerts/actions/queue-action.handler.ts` - Stub implementation
- `src/alerts/actions/block-action.handler.ts` - Stub implementation
- `src/alerts/actions/index.ts` - Barrel exports
- `src/alerts/alerts.service.ts` - Deduplication logic, action orchestration, metrics
- `src/alerts/alerts.service.spec.ts` - 14 unit tests
- `src/alerts/alerts.consumer.ts` - RabbitMQ message handler
- `src/alerts/alerts.controller.ts` - REST endpoints (GET list, GET by id, PATCH status)
- `src/alerts/alerts.module.ts` - Module definition with providers
- `src/database/migrations/1738540800000-CreateAlerts.ts` - Migration with indexes
- `test/alerts.e2e-spec.ts` - E2E tests

**Files Modified:**
- `src/app.module.ts` - Added AlertsModule
- `src/main.ts` - Added second microservice for 'alerts' queue
- `src/transactions/transactions.module.ts` - Added ClientsModule.registerAsync for ALERTS_SERVICE
- `src/transactions/transactions.service.ts` - Added alert publishing after rule evaluation
- `src/engine/engine.service.ts` - Added ruleConfig to event params for deduplication

**Pre-existing Error Fixes:**
- Fixed TypeScript errors in transactions service (DeepPartial typing, null vs undefined)
- Fixed lint errors across multiple files (unused imports, unsafe assignments, floating promises)
- Added eslint-disable comments for test files with dynamic typing patterns

**API Endpoints:**
| Endpoint | Guard | Description |
|----------|-------|-------------|
| `GET /api/alerts` | OrganizationGuard | List alerts with filters & pagination |
| `GET /api/alerts/:id` | OrganizationGuard | Get alert details |
| `PATCH /api/alerts/:id` | OrganizationGuard | Update alert status |

**Prometheus Metrics:**
| Metric | Type | Description |
|--------|------|-------------|
| `alerts_created_total` | Counter | New alerts created (by org, severity, category) |
| `alerts_deduplicated_total` | Counter | Deduplicated alerts (hit_count incremented) |
| `alert_action_duration_seconds` | Histogram | Action handler execution time |

**Deduplication Logic:**
- Parse rule's timeWindow from config (e.g., "24h", "7d")
- Calculate window bucket based on transaction datetime
- Build dedup_key: `{ruleId}:{accountId}:{windowKey}`
- Find existing OPEN/ACKNOWLEDGED alert with same dedup_key
- If exists: increment hit_count, update last_triggered_at
- If not: create new alert

**Test Coverage:**
- Unit tests: 14 new tests for AlertsService
- Total: 176 unit tests passing
- Lint: 0 errors

---

## [2026-02-02] Phase 5 - Transaction Processing
**Summary:** Implemented the Transactions module with storage, rule evaluation, RabbitMQ async processing, and replaced the TransactionHistoryFact stub with actual database queries.

**Changes:**
- Created Transaction entity with comprehensive fields (amounts, parties, metadata, location)
- Implemented dual ingestion paths: REST API (sync) and RabbitMQ consumer (async)
- Replaced `TransactionHistoryFact` stub with actual SQL aggregation queries
- Added fail-open policy: evaluation errors don't block transaction storage
- Created optimized database indexes for aggregation queries
- Added Prometheus metrics for transaction processing

**Files Added:**
- `src/transactions/entities/transaction.entity.ts` - Transaction entity with all fields
- `src/transactions/dto/create-transaction.dto.ts` - Validation DTOs with nested objects
- `src/transactions/dto/transaction-response.dto.ts` - Response DTO
- `src/transactions/transactions.service.ts` - CRUD and evaluation orchestration
- `src/transactions/transactions.service.spec.ts` - Unit tests
- `src/transactions/transactions.consumer.ts` - RabbitMQ message handler
- `src/transactions/transactions.controller.ts` - REST endpoints
- `src/transactions/transactions.module.ts` - Module definition
- `src/database/migrations/1769900000000-CreateTransactions.ts` - Migration with indexes
- `test/transactions.e2e-spec.ts` - 14 E2E tests

**Files Modified:**
- `src/app.module.ts` - Registered TransactionsModule
- `src/main.ts` - Added RabbitMQ microservice for transactions queue
- `src/engine/facts/transaction-history.fact.ts` - Replaced stub with SQL queries
- `src/engine/facts/transaction-history.fact.spec.ts` - Updated tests
- `ARCHITECTURE.md` - Added Transactions module documentation

**API Endpoints:**
| Endpoint | Guard | Description |
|----------|-------|-------------|
| `POST /api/transactions` | OrganizationGuard | Store and evaluate transaction |
| `GET /api/transactions/:id` | OrganizationGuard | Get transaction by ID |
| `GET /api/transactions` | OrganizationGuard | List transactions (paginated) |

**Database Indexes:**
- `idx_tx_org_account_datetime` - Primary aggregation queries
- `idx_tx_org_datetime` - Organization-wide queries
- `idx_tx_org_account_type_datetime` - Type-filtered aggregations

**Prometheus Metrics:**
| Metric | Type | Description |
|--------|------|-------------|
| `transactions_processed_total` | Counter | Transactions processed (by org, source, status) |

**Transaction History Aggregations:**
The fact provider now supports real database queries:
```json
{
  "fact": "transactionHistory",
  "params": {
    "aggregation": "sum",
    "field": "amountNormalized",
    "timeWindowDays": 30,
    "transactionType": "WITHDRAWAL"
  }
}
```

**Test Coverage:**
- Unit tests: 162 passing
- E2E tests: 14 new tests for transactions module

---

## [2026-02-01] Phase 4 - Rule Engine Core
**Summary:** Implemented the core rule evaluation engine using json-rules-engine with custom operators, fact providers, Redis caching, and Prometheus metrics.

**Changes:**
- Integrated json-rules-engine v7.3.1 for rule evaluation
- Created custom operators: aggregation (sumGreaterThan, countGreaterThan, avgGreaterThan), list (inBlacklist, inWhitelist, containsValue), geolocation (inCountry, notInCountry, isHighRiskCountry)
- Created stubbed fact providers for transaction history, account data, and list lookups (to be implemented in Phase 5/7)
- Implemented Redis caching for compiled rules with TTL and pub/sub invalidation
- Added Prometheus metrics for evaluation duration and cache hit/miss tracking
- Implemented fail-open error handling per ADR-010
- Added cache invalidation events to RulesService and TemplateOverridesService
- Created REST endpoints for transaction evaluation

**Files Added:**
- `src/engine/engine.module.ts` - Engine module importing RulesModule and providing all engine services
- `src/engine/engine.service.ts` - Core evaluation service with Prometheus metrics
- `src/engine/engine.service.spec.ts` - 21 unit tests
- `src/engine/engine.controller.ts` - REST endpoints for evaluation
- `src/engine/rule-cache.service.ts` - Redis caching with pub/sub invalidation
- `src/engine/rule-cache.service.spec.ts` - 15 unit tests
- `src/engine/interfaces/` - evaluation-context, evaluation-result, fact-provider interfaces
- `src/engine/operators/aggregation.operator.ts` - sumGreaterThan, countGreaterThan, avgGreaterThan
- `src/engine/operators/aggregation.operator.spec.ts` - 12 unit tests
- `src/engine/operators/list.operator.ts` - inBlacklist, inWhitelist, containsValue
- `src/engine/operators/list.operator.spec.ts` - 15 unit tests
- `src/engine/operators/geolocation.operator.ts` - inCountry, notInCountry, isHighRiskCountry
- `src/engine/operators/geolocation.operator.spec.ts` - 15 unit tests
- `src/engine/facts/transaction-history.fact.ts` - Stubbed fact provider (returns 0)
- `src/engine/facts/transaction-history.fact.spec.ts` - 3 unit tests
- `src/engine/facts/account.fact.ts` - Stubbed fact provider (returns mock data)
- `src/engine/facts/account.fact.spec.ts` - 3 unit tests
- `src/engine/facts/list-lookup.fact.ts` - Stubbed fact provider (returns false)
- `src/engine/dto/evaluate-transaction.dto.ts` - Validation DTOs with @ValidateNested
- `src/common/events/rule-cache.events.ts` - Cache invalidation event class
- `test/engine.e2e-spec.ts` - 16 e2e tests for engine evaluation flow

**Files Modified:**
- `src/app.module.ts` - Added EngineModule and EventEmitterModule
- `src/rules/rules.service.ts` - Added EventEmitter2 injection and cache invalidation events
- `src/rules/rules.service.spec.ts` - Added mock EventEmitter2
- `src/template-overrides/template-overrides.service.ts` - Added cache invalidation events
- `src/template-overrides/template-overrides.service.spec.ts` - Added mock EventEmitter2
- `test/rules.e2e-spec.ts` - Added EventEmitterModule.forRoot()
- `test/template-overrides.e2e-spec.ts` - Added EventEmitterModule.forRoot()

**API Endpoints:**
| Endpoint | Guard | Description |
|----------|-------|-------------|
| `POST /api/engine/evaluate` | OrganizationGuard | Evaluate transaction against all enabled rules |
| `POST /api/engine/evaluate/:ruleId` | OrganizationGuard | Evaluate transaction against a specific rule |

**Prometheus Metrics:**
| Metric | Type | Description |
|--------|------|-------------|
| `rule_evaluation_duration_seconds` | Histogram | Time taken to evaluate rules |
| `rule_cache_hits_total` | Counter | Number of cache hits |
| `rule_cache_misses_total` | Counter | Number of cache misses |

**Test Coverage:**
- Unit tests: 84 new tests across engine module (operators, facts, cache, service)
- E2E tests: 16 new tests for engine evaluation flow
- Total: 149 unit tests passing, 91 e2e tests passing

**Deferred from Phase 3:**
- Version management for rule templates
- JSON Schema validation for rule configs

---

## [2026-01-31] Phase 3 - Rule Templates, Template Overrides & Rules Modules
**Summary:** Implemented the core rules infrastructure with three interconnected modules for managing rule templates, organization-specific overrides, and active rules.

**Changes:**
- Created RuleTemplate entity (system-wide, extends BaseEntity) with unique name constraint
- Created TemplateOverride entity (tenant-scoped, extends TenantBaseEntity) for organization customizations
- Created Rule entity (tenant-scoped, extends TenantBaseEntity) with optional template linking
- Implemented deep merge logic for effective config calculation (template → override → rule)
- Added specialized endpoints: `GET /defaults`, `GET /merged-config`, `GET /enabled`, `GET /effective-config`
- Fixed Jest e2e config for uuid ESM module compatibility
- Added CASCADE truncation in e2e tests to handle foreign key constraints

**Files Added:**
- `src/rule-templates/` - Complete module with entity, DTOs, service, controller, unit tests
- `src/template-overrides/` - Complete module with entity, DTOs, service, controller, unit tests
- `src/rules/` - Complete module with entity, DTOs, service, controller, unit tests
- `src/database/migrations/1769882048834-CreateRuleTemplates.ts`
- `src/database/migrations/1769882137084-CreateTemplateOverrides.ts`
- `src/database/migrations/1769882246824-CreateRules.ts`
- `test/rule-templates.e2e-spec.ts` - 18 e2e tests
- `test/template-overrides.e2e-spec.ts` - 16 e2e tests
- `test/rules.e2e-spec.ts` - 19 e2e tests

**Files Modified:**
- `src/app.module.ts` - Registered RuleTemplatesModule, TemplateOverridesModule, RulesModule
- `test/jest-e2e.json` - Added transformIgnorePatterns for uuid, maxWorkers: 1 for sequential execution
- `test/test-utils.ts` - Added createMockRuleTemplate() and createMockTemplateOverride() factories

**API Endpoints:**
| Module | Endpoint | Guard | Description |
|--------|----------|-------|-------------|
| Templates | `POST/GET/PATCH/DELETE /api/rule-templates` | None | CRUD for system-wide templates |
| Templates | `GET /api/rule-templates/defaults` | None | Get default templates |
| Overrides | `POST/GET/PATCH/DELETE /api/template-overrides` | OrganizationGuard | CRUD for org overrides |
| Overrides | `GET /api/template-overrides/template/:id/merged-config` | OrganizationGuard | Get merged template+override config |
| Rules | `POST/GET/PATCH/DELETE /api/rules` | OrganizationGuard | CRUD for org rules |
| Rules | `GET /api/rules/enabled` | OrganizationGuard | Get enabled rules by priority |
| Rules | `GET /api/rules/:id/effective-config` | OrganizationGuard | Get fully merged config |

**Database Schema:**
- `rule_templates`: id, name (UNIQUE), description, config (JSONB), is_default, created_at, updated_at
- `template_overrides`: id, id_organization, id_template (FK), overrides (JSONB), enabled, created_at, updated_at
  - UNIQUE constraint on (id_organization, id_template)
  - FK to rule_templates with CASCADE delete
- `rules`: id, id_organization, id_template (nullable FK), name, description, enabled, priority, config (JSONB), created_by, created_at, updated_at
  - FK to rule_templates with SET NULL on delete
  - Indexes on id_organization, (id_organization, priority), (id_organization, enabled)

**Test Coverage:**
- Unit tests: 30 new tests across 3 service spec files
- E2E tests: 53 new tests across 3 e2e spec files

---

## [2026-01-29 12:30] Phase 2 - Core Entities & Multi-Tenancy (Organizations Module)
**Summary:** Implemented Organizations module with full CRUD operations, establishing the foundation for multi-tenancy.

**Changes:**
- Created Organization entity extending BaseEntity with name and settings (JSONB) fields
- Implemented full CRUD service with paginated listing using PaginationQuery/PaginatedResult interfaces
- Created REST controller with Swagger documentation for all endpoints
- Added `exists()` method on service for future guard enhancements
- Generated and ran TypeORM migration for organizations table with name index
- Updated OrganizationGuard to use `uuid.validate()` instead of regex for cleaner UUID validation
- Added transformIgnorePatterns to Jest config to handle uuid ESM module

**Files Added:**
- `src/organizations/entities/organization.entity.ts` - Organization entity with name and settings fields
- `src/organizations/dto/create-organization.dto.ts` - DTO with validation decorators
- `src/organizations/dto/update-organization.dto.ts` - Partial update DTO
- `src/organizations/dto/index.ts` - Barrel export for DTOs
- `src/organizations/organizations.service.ts` - CRUD service with pagination
- `src/organizations/organizations.controller.ts` - REST endpoints with Swagger docs
- `src/organizations/organizations.module.ts` - Module definition
- `src/organizations/organizations.service.spec.ts` - Unit tests (14 tests)
- `src/organizations/index.ts` - Barrel export for module
- `src/database/migrations/1769720994153-CreateOrganizations.ts` - Migration with name index
- `src/common/dto/pagination-query.dto.ts` - Reusable pagination query DTO with validation
- `src/common/dto/index.ts` - Barrel export for common DTOs

**Files Modified:**
- `src/app.module.ts` - Registered OrganizationsModule
- `src/common/guards/organization.guard.ts` - Replaced regex with uuid.validate()
- `package.json` - Added transformIgnorePatterns for Jest/uuid ESM compatibility
- `ARCHITECTURE.md` - Added ADR-012 (hard delete) and ADR-013 (guard validation)

**Architectural Decisions:**
- **Hard delete for organizations (ADR-012)**: Physical deletion for simplicity; soft delete can be added later if audit trail is needed
- **OrganizationGuard validates format only (ADR-013)**: Uses uuid.validate() for format check, database existence deferred to service layer for better performance
- **Minimal schema**: Only name and settings fields per implementation plan; additional config stored in settings JSONB
- **Organizations not tenant-scoped**: Controller has no OrganizationGuard since organizations define tenants themselves

**Future TODOs:**
- [ ] Consider adding soft delete if audit requirements emerge
- [ ] Consider database existence check in guard if security requirements change

---

## [2026-01-28 18:49] Phase 1 - Project Setup and Core Infrastructure
**Summary:** Initial project setup with NestJS, Docker infrastructure, and core multi-tenancy patterns.

**Changes:**
- Initialized NestJS project with TypeScript strict mode
- Configured Docker Compose with PostgreSQL, Redis, and RabbitMQ services
- Set up TypeORM with migration support and data source configuration
- Added Pino structured logging with pretty print for development
- Configured Prometheus metrics endpoint at `/metrics`
- Added environment validation with Joi schema
- Created health check endpoint with database ping at `/health`
- Set up Swagger API documentation at `/api`
- Added base entities (`BaseEntity`, `TenantBaseEntity`) for multi-tenancy support
- Created organization guard and `@OrganizationId()` decorator for tenant isolation
- Added global exception filter for consistent error responses
- Created initial documentation (README, ARCHITECTURE, CLAUDE.md)
- Added comprehensive implementation plan with all phases documented

**Files Added:**
- `.env.example` - Environment variables template
- `docker-compose.yml` - PostgreSQL, Redis, RabbitMQ services
- `Dockerfile` - Production container build
- `src/app.module.ts` - Root application module
- `src/main.ts` - Application bootstrap with Swagger, logging, validation
- `src/common/entities/base.entity.ts` - Base entity with id, createdAt, updatedAt
- `src/common/entities/tenant-base.entity.ts` - Adds idOrganization for multi-tenancy
- `src/common/decorators/organization.decorator.ts` - Extract org ID from request header
- `src/common/guards/organization.guard.ts` - Validate x-organization-id header
- `src/common/filters/http-exception.filter.ts` - Global exception handling
- `src/config/` - Configuration module with Joi validation
- `src/database/` - TypeORM database module and data source
- `src/health/` - Health check controller with DB ping
- `test/test-utils.ts` - Shared test utilities and helpers
- `ARCHITECTURE.md` - System architecture documentation
- `IMPLEMENTATION_PLAN.md` - Phased implementation roadmap
- `README.md` - Project overview and setup instructions
- `CLAUDE.md` - AI assistant coding guidelines

**Architectural Decisions:**
- **Multi-tenancy via header**: Organization ID passed via `x-organization-id` header rather than URL path for cleaner API design
- **TenantBaseEntity pattern**: All tenant-scoped entities extend `TenantBaseEntity` which automatically includes `idOrganization` column
- **Fail-open policy**: Rule evaluation errors will not block transactions (to be implemented in rule engine)
- **Structured logging**: Using Pino for JSON logging in production, pretty print in development
- **Config validation**: All environment variables validated at startup via Joi schema to fail fast on misconfiguration

---
