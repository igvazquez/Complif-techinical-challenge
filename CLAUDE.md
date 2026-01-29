# Claude Code Instructions

This document provides guidance for AI assistants working on this codebase.

## Project Overview

Real-time rules engine for detecting suspicious financial transactions. Built with NestJS (TypeScript), PostgreSQL, Redis, and RabbitMQ.

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

## Rule Engine

### json-rules-engine Integration
- Rules stored as JSON in `config` column
- Custom operators in `src/engine/operators/`
- Custom facts in `src/engine/facts/`

### Adding New Operators
1. Create operator in `src/engine/operators/`
2. Register in `EngineService`
3. Add JSON Schema validation
4. Write unit tests

### Adding New Facts
1. Create fact provider in `src/engine/facts/`
2. Register in `EngineModule`
3. Document in ARCHITECTURE.md

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

### Changelog Maintenance
After completing a feature or significant change, add an entry to `CHANGELOG.md`:

**Entry Format:**
```
## [YYYY-MM-DD HH:MM] Feature/Fix Name
**Summary:** One-line description of what was done.

**Changes:**
- Specific change 1
- Specific change 2

**Files Added:** (if any new files)
- `path/to/new/file.go`

**Files Modified:** (key files only)
- `path/to/modified/file.ts`

**Architectural Decisions:** (REQUIRED if any)
- Decision made and rationale

**Future TODOs:** (if mentioned by user)
- [ ] Planned improvement
```

**Rules:**
1. ALWAYS include "Architectural Decisions" section when:
   - New patterns or abstractions are introduced
   - Dependencies are added/removed
   - Database schema changes
   - API contract changes
   - State management approach changes
   - Infrastructure changes (deployment, caching, etc.)
2. Group related changes under the same timestamp
3. Be specific about what changed, not vague
4. Include user-mentioned TODOs in the entry where they were discussed
5. **ALWAYS add a changelog entry BEFORE creating a PR** - the changelog update should be included in the PR commit(s)
