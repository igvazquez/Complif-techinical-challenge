export interface AlertEventMessage {
  organizationId: string;
  transactionId: string;
  accountId: string | null;
  ruleId: string;
  ruleName: string;
  severity: string;
  category: string;
  eventType: string;
  eventParams: Record<string, unknown>;
  transactionDatetime: string;
  ruleConfig?: Record<string, unknown>;
}
