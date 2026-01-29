# Changelog

All notable changes to this project will be documented in this file.

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
