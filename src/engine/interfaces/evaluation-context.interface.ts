export interface TransactionData {
  id: string;
  idAccount: string;
  amount: number;
  amountNormalized: number;
  currency: string;
  type: string;
  datetime: Date | string;
  date: string;
  country?: string;
  counterpartyId?: string;
  counterpartyCountry?: string;
  data?: Record<string, unknown>;
}

export interface EvaluationContext {
  transaction: TransactionData;
  account?: {
    id: string;
    type?: string;
    status?: string;
    country?: string;
    riskScore?: number;
    data?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}
