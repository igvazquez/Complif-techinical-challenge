import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { BASE_URL, defaultHeaders, generateTransaction, generateOrganization, randomOrgId } from '../config.js';

// Custom metrics
const errorRate = new Rate('error_rate');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const transactionLatency = new Trend('transaction_latency', true);

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 30 },   // Warm up
        { duration: '1m', target: 50 },    // Target load
        { duration: '1m', target: 75 },    // Push harder
        { duration: '1m', target: 100 },   // Stress load
        { duration: '30s', target: 150 },  // Breaking point search
        { duration: '30s', target: 200 },  // Maximum stress
        { duration: '1m', target: 50 },    // Recovery
        { duration: '30s', target: 0 },    // Cool down
      ],
    },
  },
  thresholds: {
    // More lenient thresholds for stress testing
    http_req_duration: ['p(95)<500'],      // p95 < 500ms under stress
    http_req_failed: ['rate<0.10'],         // Allow up to 10% errors under stress
  },
};

export function setup() {
  const orgRes = http.post(`${BASE_URL}/api/organizations`, JSON.stringify(generateOrganization()), {
    headers: defaultHeaders,
  });

  const org = orgRes.status === 201 ? JSON.parse(orgRes.body) : { id: randomOrgId() };

  // Create multiple rules for more realistic load
  const ruleTypes = ['amount', 'velocity', 'quantity'];

  for (const ruleType of ruleTypes) {
    // Create template
    const templateRes = http.post(`${BASE_URL}/api/rule-templates`, JSON.stringify({
      name: `Stress Test ${ruleType} Rule ${Date.now()}`,
      description: `${ruleType} rule for stress testing`,
      config: {
        conditions: {
          all: [
            { fact: 'transaction.amount', operator: 'greaterThan', value: 1000 }
          ]
        },
        event: {
          type: 'alert',
          params: { severity: 'MEDIUM', category: 'FRAUD' }
        }
      },
    }), { headers: defaultHeaders });

    if (templateRes.status === 201) {
      const template = JSON.parse(templateRes.body);

      // Create rule
      http.post(`${BASE_URL}/api/rules`, JSON.stringify({
        name: `Stress ${ruleType} Rule`,
        idTemplate: template.id,
        priority: 100,
        enabled: true,
      }), {
        headers: {
          ...defaultHeaders,
          'x-organization-id': org.id,
        },
      });
    }
  }

  console.log(`Stress test setup complete for org: ${org.id}`);
  return { orgId: org.id };
}

export default function(data) {
  const transaction = generateTransaction(data.orgId);
  const startTime = Date.now();

  const res = http.post(`${BASE_URL}/api/transactions`, JSON.stringify(transaction), {
    headers: {
      ...defaultHeaders,
      'x-organization-id': data.orgId,
    },
    timeout: '30s',
  });

  const duration = Date.now() - startTime;
  transactionLatency.add(duration);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 1s': (r) => r.timings.duration < 1000,
  });

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
    if (res.status !== 201) {
      console.log(`Error: ${res.status} - ${res.body}`);
    }
  }

  errorRate.add(!success);

  // Minimal sleep to maximize throughput
  sleep(0.01);
}

export function teardown(data) {
  console.log('=== Stress Test Results ===');
  console.log(`Organization: ${data.orgId}`);
  console.log('Check k6 output for detailed metrics');
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    metrics: {
      requests: {
        total: data.metrics.http_reqs?.values?.count || 0,
        rate: data.metrics.http_reqs?.values?.rate || 0,
      },
      latency: {
        avg: data.metrics.http_req_duration?.values?.avg || 0,
        p50: data.metrics.http_req_duration?.values?.['p(50)'] || 0,
        p90: data.metrics.http_req_duration?.values?.['p(90)'] || 0,
        p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
        p99: data.metrics.http_req_duration?.values?.['p(99)'] || 0,
        max: data.metrics.http_req_duration?.values?.max || 0,
      },
      errors: {
        rate: data.metrics.http_req_failed?.values?.rate || 0,
      },
    },
    thresholds: {
      passed: Object.values(data.root_group?.checks || {}).every(c => c.passes === c.fails + c.passes),
    },
  };

  return {
    'benchmark/results/stress-test-results.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '  ';
  let output = '\n=== Stress Test Summary ===\n\n';

  const metrics = data.metrics;

  output += `${indent}Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  output += `${indent}Request Rate: ${(metrics.http_reqs?.values?.rate || 0).toFixed(2)} req/s\n`;
  output += `${indent}Error Rate: ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%\n\n`;

  output += `${indent}Latency:\n`;
  output += `${indent}${indent}avg: ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
  output += `${indent}${indent}p50: ${(metrics.http_req_duration?.values?.['p(50)'] || 0).toFixed(2)}ms\n`;
  output += `${indent}${indent}p90: ${(metrics.http_req_duration?.values?.['p(90)'] || 0).toFixed(2)}ms\n`;
  output += `${indent}${indent}p95: ${(metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
  output += `${indent}${indent}p99: ${(metrics.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms\n`;
  output += `${indent}${indent}max: ${(metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n`;

  return output;
}
