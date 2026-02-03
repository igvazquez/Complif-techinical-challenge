# Alerts Module

Event-driven alert processing with pluggable action handlers.

## Key Components

- `alerts.service.ts` - Alert lifecycle management
- `alerts.consumer.ts` - RabbitMQ event handler
- `actions/` - Pluggable action handlers (strategy pattern)

## Alert Lifecycle

1. Engine triggers alert event -> published to RabbitMQ
2. Consumer receives event -> calls `processAlertEvent()`
3. Deduplication check using `dedupKey` (org + rule + account + type)
4. If duplicate: increment `hitCount` on existing alert
5. If new: create alert and execute action handlers

## Action Handlers

Strategy pattern - each handler decides if it should run based on alert properties.

| Handler | Trigger Condition | Action |
|---------|-------------------|--------|
| `DbActionHandler` | Always | Persist alert to database |
| `WebhookActionHandler` | `event.params.webhookUrl` set | POST to webhook URL |
| `QueueActionHandler` | `event.params.queueName` set | Publish to named queue |
| `BlockActionHandler` | `event.params.blockTransaction` true | Mark transaction blocked |

### Adding a New Action Handler
1. Create class in `actions/` implementing `ActionHandler` interface
2. Implement `shouldHandle(event)` and `execute(alert, event)`
3. Add to `ACTION_HANDLERS` array in `AlertsService`

## Deduplication
- `dedupKey = hash(orgId + ruleId + accountId + alertType)`
- Only `open` and `acknowledged` alerts are considered for dedup
- Resolved alerts create new records

## Error Handling
**Fail-open policy**: Action errors are logged, message is acknowledged.
