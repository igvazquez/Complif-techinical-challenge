export interface RuleEvent {
  type: string;
  params: {
    ruleId: string;
    ruleName: string;
    severity?: string;
    category?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export interface FailedRule {
  ruleId: string;
  ruleName: string;
  error: string;
}

export interface EvaluationResult {
  success: boolean;
  events: RuleEvent[];
  failedRules: FailedRule[];
  evaluatedRulesCount: number;
  evaluationTimeMs: number;
}
