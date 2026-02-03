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

// Generate a sample transaction payload
export function generateTransaction(orgId) {
  const types = ['deposit', 'withdrawal', 'transfer', 'payment'];
  const currencies = ['USD', 'EUR', 'GBP', 'BRL'];
  const countries = ['US', 'BR', 'GB', 'DE', 'FR'];

  return {
    externalId: `tx-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    type: types[Math.floor(Math.random() * types.length)],
    amount: Math.floor(Math.random() * 10000) + 100,
    currency: currencies[Math.floor(Math.random() * currencies.length)],
    customerId: `cust-${Math.floor(Math.random() * 1000)}`,
    accountId: `acc-${Math.floor(Math.random() * 500)}`,
    metadata: {
      ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      country: countries[Math.floor(Math.random() * countries.length)],
      channel: 'web',
      timestamp: new Date().toISOString(),
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
