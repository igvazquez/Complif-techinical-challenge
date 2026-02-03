# Engine Module

Core rules evaluation using json-rules-engine with multi-tenant support.

## Key Components

- `engine.service.ts` - Rule evaluation orchestration
- `rule-cache.service.ts` - Redis caching (TTL: 300s)
- `operators/` - Custom rule operators
- `facts/` - Dynamic fact providers

## Custom Operators

| Operator | Purpose | Example Use |
|----------|---------|-------------|
| `aggregationComparison` | Compare aggregated values (sum, count, avg) | "sum > 10000" |
| `geoDistance` | Location-based radius checks | "distance < 100km" |
| `listContains` | Blocklist/whitelist membership | "account in blocklist" |

### Adding a New Operator
1. Create file in `operators/` implementing the operator function
2. Register in `EngineService.registerOperators()`
3. Add tests in `engine.service.spec.ts`

## Fact Providers

Facts are resolved dynamically during rule evaluation via the Almanac.

| Fact | Data Provided |
|------|---------------|
| `transactionHistory` | Historical aggregations (sum, count, avg over time window) |
| `account` | Account context (balance, status, risk score) |
| `listLookup` | Check membership in named lists |

### Adding a New Fact
1. Create provider in `facts/` implementing `FactProvider` interface
2. Register in `EngineModule` providers
3. Document the fact parameters

## Caching Strategy
- Rules cached in Redis with 300s TTL
- Cache invalidated via `RuleCacheInvalidationEvent` when rules change
- Cache key: `rules:{organizationId}`

## Error Handling
**Fail-open policy**: Evaluation errors are logged but do NOT block transactions.
