// Shared configuration for k6 benchmarks

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const thresholds = {
  http_req_duration: ['p(99)<100'], // p99 latency < 100ms
  http_req_failed: ['rate<0.01'],   // Error rate < 1%
};

export const defaultHeaders = {
  'Content-Type': 'application/json',
};

// Generate a random organization ID (UUID format)
export function randomOrgId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate a sample transaction payload matching CreateTransactionDto
export function generateTransaction(orgId) {
  const types = ['CASH_IN', 'CASH_OUT', 'TRANSFER', 'PAYMENT'];
  const currencies = ['USD', 'EUR', 'GBP', 'BRL'];
  const countries = ['US', 'BR', 'GB', 'DE', 'FR'];

  const now = new Date();
  const amount = Math.floor(Math.random() * 10000) + 100;

  return {
    idAccount: `acc-${Math.floor(Math.random() * 500)}`,
    amount: amount,
    amountNormalized: amount, // Required field
    currency: currencies[Math.floor(Math.random() * currencies.length)],
    type: types[Math.floor(Math.random() * types.length)],
    datetime: now.toISOString(), // Required: ISO 8601
    date: now.toISOString().split('T')[0], // Required: YYYY-MM-DD
    country: countries[Math.floor(Math.random() * countries.length)],
    origin: 'BENCHMARK',
    data: {
      channel: 'api',
      benchmarkRun: Date.now(),
    },
  };
}

// Generate organization payload matching CreateOrganizationDto
export function generateOrganization() {
  return {
    name: `Benchmark Org ${Date.now()}`,
    settings: {
      benchmarkRun: true,
    },
  };
}

// Check response helper
export function checkResponse(res, checks) {
  const results = {};
  for (const [name, predicate] of Object.entries(checks)) {
    results[name] = predicate(res);
  }
  return results;
}
