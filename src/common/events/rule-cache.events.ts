export const RULE_CACHE_INVALIDATION_EVENT = 'rule.cache.invalidate';

export class RuleCacheInvalidationEvent {
  constructor(public readonly organizationId: string) {}
}
