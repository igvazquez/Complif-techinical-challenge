import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, defaultHeaders, generateTransaction, randomOrgId } from '../config.js';

// Custom metrics
const transactionErrors = new Rate('transaction_errors');
const transactionDuration = new Trend('transaction_duration');

export const options = {
  scenarios: {
    constant_throughput: {
      executor: 'constant-arrival-rate',
      rate: 50, // 50 requests per second
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<100'], // p99 < 100ms
    http_req_failed: ['rate<0.01'],   // Error rate < 1%
    transaction_errors: ['rate<0.01'],
  },
};

// Setup: Create an organization for testing
export function setup() {
  const orgPayload = JSON.stringify({
    name: `Benchmark Org ${Date.now()}`,
    code: `BENCH${Date.now()}`,
    settings: {},
  });

  const res = http.post(`${BASE_URL}/api/organizations`, orgPayload, {
    headers: defaultHeaders,
  });

  if (res.status !== 201) {
    console.error(`Failed to create organization: ${res.status} ${res.body}`);
    return { orgId: randomOrgId() };
  }

  const org = JSON.parse(res.body);
  console.log(`Created organization: ${org.id}`);
  return { orgId: org.id };
}

export default function(data) {
  const transaction = generateTransaction(data.orgId);

  const res = http.post(`${BASE_URL}/api/transactions`, JSON.stringify(transaction), {
    headers: {
      ...defaultHeaders,
      'x-organization-id': data.orgId,
    },
  });

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'response has id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.id !== undefined;
      } catch {
        return false;
      }
    },
  });

  transactionErrors.add(!success);
  transactionDuration.add(res.timings.duration);

  // Small sleep to prevent overwhelming the connection pool
  sleep(0.01);
}

export function teardown(data) {
  console.log(`Benchmark completed for organization: ${data.orgId}`);
}
