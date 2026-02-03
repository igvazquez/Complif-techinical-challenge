# Lists Module

Blacklist/whitelist management for rule engine lookups.

## Key Components

- `lists.service.ts` - CRUD operations + `isInList()` lookup
- `lists.controller.ts` - REST API endpoints
- `entities/list-entry.entity.ts` - Entity with `ListType` and `EntityType` enums

## Data Model

### ListEntry Entity

| Column | Type | Description |
|--------|------|-------------|
| `listType` | enum | `BLACKLIST` or `WHITELIST` |
| `entityType` | enum | `ACCOUNT`, `IP`, `COUNTRY`, `DEVICE`, `EMAIL`, `PHONE` |
| `entityValue` | string | The value being listed (max 255 chars) |
| `reason` | text | Optional reason for listing |
| `expiresAt` | timestamp | Optional expiration (soft expiry) |
| `createdBy` | uuid | Optional user who created entry |

### Unique Constraint

Entries are unique per `(idOrganization, listType, entityType, entityValue)`.
Creating a duplicate throws `ConflictException` (409).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/lists` | Create list entry |
| `GET` | `/api/lists` | List entries (paginated, filterable) |
| `GET` | `/api/lists/:id` | Get entry by ID |
| `DELETE` | `/api/lists/:id` | Delete entry |

### Query Parameters (GET /api/lists)

- `listType` - Filter by BLACKLIST or WHITELIST
- `entityType` - Filter by entity type
- `entityValue` - Filter by exact value
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)

## Engine Integration

The `ListLookupFact` in the engine module uses `ListsService.isInList()` to check list membership during rule evaluation.

### isInList() Behavior

- Returns `true` if entry exists AND is not expired
- Returns `false` if entry doesn't exist OR is expired
- Expired entries are NOT automatically deleted (soft expiry)

### Example Rule Condition

```json
{
  "fact": "listLookup",
  "operator": "equal",
  "value": true,
  "params": {
    "listType": "BLACKLIST",
    "entityType": "COUNTRY",
    "value": "IR"
  }
}
```

## Design Decisions

### Immutable Entries

Entries cannot be updated. To change an entry, delete and recreate it.
This simplifies audit trails and avoids partial update issues.

### Soft Expiration

Expired entries remain in the database but `isInList()` returns `false`.
Use `removeExpired()` for cleanup (candidate for scheduled task).

### No Update Endpoint

By design, there's no PATCH/PUT endpoint. This enforces immutability.

## Adding New Entity Types

1. Add value to `EntityType` enum in `list-entry.entity.ts`
2. Create migration to add new enum value
3. Update `ListLookupParams` interface in engine module
4. Update documentation
