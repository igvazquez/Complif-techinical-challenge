# Claude Code Instructions

This document provides guidance for AI assistants working on this codebase.

## Project Overview

Real-time rules engine for detecting suspicious financial transactions. Built with NestJS (TypeScript), PostgreSQL, Redis, and RabbitMQ.

## Module-Specific Documentation

Complex modules have their own CLAUDE.md files with detailed patterns:

- `src/engine/CLAUDE.md` - Rule evaluation, custom operators, fact providers
- `src/alerts/CLAUDE.md` - Action handlers, deduplication, event processing
- `src/transactions/CLAUDE.md` - Ingestion flow, queue patterns

## Key Architectural Patterns

### Multi-Tenancy
- All tenant-scoped entities extend `TenantBaseEntity`
- Organization ID passed via `x-organization-id` header
- Use `@OrganizationId()` decorator to extract from request
- Apply `OrganizationGuard` to tenant-scoped controllers

### Module Structure
```
src/[module]/
├── [module].module.ts      # Module definition
├── [module].controller.ts  # REST endpoints
├── [module].service.ts     # Business logic
├── entities/
│   └── [entity].entity.ts  # TypeORM entities
├── dto/
│   ├── create-[entity].dto.ts
│   └── update-[entity].dto.ts
└── [module].service.spec.ts # Unit tests
```

### Entity Patterns
```typescript
// Base entity (no tenant)
@Entity('table_name')
export class MyEntity extends BaseEntity {
  // BaseEntity provides: id, createdAt, updatedAt
}

// Tenant-scoped entity
@Entity('table_name')
export class MyEntity extends TenantBaseEntity {
  // TenantBaseEntity adds: idOrganization
}
```

### DTO Patterns
```typescript
// Use class-validator decorators
export class CreateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
```

### Controller Patterns
```typescript
@ApiTags('module')
@Controller('module')
@UseGuards(OrganizationGuard) // For tenant-scoped
export class ModuleController {
  @Post()
  @ApiOperation({ summary: 'Create item' })
  create(
    @OrganizationId() orgId: string,
    @Body() dto: CreateDto,
  ) {}
}
```

## Testing Conventions

### Unit Tests
- Colocate with source: `module.service.spec.ts`
- Mock dependencies using Jest
- Focus on business logic

### Integration Tests
- Located in `test/` directory
- Use test database
- Test full request/response cycle

### Test Utilities
- `test/test-utils.ts` - Shared helpers
- Use factories for test data

## Database Conventions

### Migrations
- Located in `src/database/migrations/`
- Use TypeORM CLI to generate
- Never modify existing migrations in production

### Naming
- Tables: snake_case, plural (e.g., `rule_templates`)
- Columns: snake_case (e.g., `id_organization`)
- Indexes: `idx_[table]_[columns]`

### Indexes
- Always index `id_organization` for tenant tables
- Composite indexes for common query patterns
- Include indexes for foreign keys

## Error Handling

### Fail Open Policy
- Rule evaluation errors should NOT block transactions
- Log errors comprehensively
- Track failures in metrics

### HTTP Exceptions
- Use NestJS built-in exceptions
- `AllExceptionsFilter` handles formatting
- Include meaningful error messages

## Configuration

### Environment Variables
- Validated via Joi schema
- Access via `ConfigService`
- Never hardcode secrets

### Feature Flags
- Not currently implemented
- Use environment variables for toggles

## Performance

### Targets
- p99 latency: <100ms
- Throughput: 50+ tx/sec

### Optimization Points
- Rule cache in Redis (TTL: 300s)
- Database indexes for aggregations
- Connection pooling

## Common Tasks

### Adding a New Module
1. Create directory structure
2. Define entity with proper base class
3. Create DTOs with validation
4. Implement service with tests
5. Create controller with Swagger docs
6. Register in AppModule

### Adding a New Rule Type
1. Define condition schema in JSON Schema
2. Create operator if needed
3. Create fact provider if needed
4. Add tests covering the rule type
5. Update ARCHITECTURE.md

### Running Locally
```bash
docker-compose up -d postgres redis rabbitmq
npm run start:dev
```

## Code Style

- ESLint + Prettier configured
- Run `npm run lint` before committing
- TypeScript strict mode enabled
- Prefer explicit types over inference for public APIs
