# Transactions Module

Transaction ingestion and rule evaluation orchestration.

## Key Components

- `transactions.service.ts` - Create and evaluate transactions
- `transactions.consumer.ts` - RabbitMQ queue handler

## Processing Flow

```
[REST API / RabbitMQ] -> create() -> evaluate() -> [Alert Events]
```

1. **Ingestion**: Via REST (`POST /transactions`) or queue (`transactions_queue`)
2. **Persistence**: Transaction saved to database
3. **Evaluation**: Engine evaluates rules with transaction context
4. **Alerts**: Rule violations published to `alerts_queue`

## Dual Ingestion Paths

| Path | Method | Use Case |
|------|--------|----------|
| REST API | `create()` | Sync evaluation, immediate response |
| RabbitMQ | `createAndEvaluate()` | Async batch processing |

## Engine Context Construction

The service builds evaluation context with:
- `transaction`: Current transaction data
- `organizationId`: Tenant context for rule filtering
- Facts auto-resolve: `transactionHistory`, `account`, `listLookup`

## Queue Patterns
- **Consumes**: `transactions_queue` (MessagePattern)
- **Publishes to**: `alerts_queue` (when rules fire)

## Error Handling
**Fail-open policy**: Evaluation errors logged, transaction still processed.
