import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';
import { BASE_URL, defaultHeaders, generateTransaction, generateOrganization, randomOrgId } from '../config.js';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    mixed_workload: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 },  // Ramp up
        { duration: '1m', target: 20 },   // Stay at 20 VUs
        { duration: '30s', target: 30 },  // Peak load
        { duration: '30s', target: 10 },  // Scale down
        { duration: '30s', target: 0 },   // Ramp down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
};

export function setup() {
  // Create organization
  const orgRes = http.post(`${BASE_URL}/api/organizations`, JSON.stringify(generateOrganization()), {
    headers: defaultHeaders,
  });

  const org = orgRes.status === 201 ? JSON.parse(orgRes.body) : { id: randomOrgId() };

  // Create a rule template
  const templateRes = http.post(`${BASE_URL}/api/rule-templates`, JSON.stringify({
    name: `Benchmark Amount Rule ${Date.now()}`,
    description: 'Rule for benchmark testing',
    config: {
      conditions: {
        all: [
          { fact: 'transaction.amount', operator: 'greaterThan', value: 5000 }
        ]
      },
      event: {
        type: 'alert',
        params: { severity: 'HIGH', category: 'FRAUD' }
      }
    },
  }), { headers: defaultHeaders });

  const template = templateRes.status === 201 ? JSON.parse(templateRes.body) : null;

  // Create a rule for the organization
  let ruleId = null;
  if (template) {
    const ruleRes = http.post(`${BASE_URL}/api/rules`, JSON.stringify({
      name: 'Benchmark Rule',
      idTemplate: template.id,
      priority: 100,
      enabled: true,
    }), {
      headers: {
        ...defaultHeaders,
        'x-organization-id': org.id,
      },
    });
    if (ruleRes.status === 201) {
      ruleId = JSON.parse(ruleRes.body).id;
    }
  }

  return {
    orgId: org.id,
    templateId: template?.id,
    ruleId: ruleId,
  };
}

export default function(data) {
  const headers = {
    ...defaultHeaders,
    'x-organization-id': data.orgId,
  };

  // Weighted distribution of operations
  const operation = Math.random();

  if (operation < 0.70) {
    // 70% - Transaction evaluation (main workload)
    group('transactions', () => {
      const transaction = generateTransaction(data.orgId);
      const res = http.post(`${BASE_URL}/api/transactions`, JSON.stringify(transaction), { headers });

      const success = check(res, {
        'transaction created': (r) => r.status === 201,
      });
      errorRate.add(!success);
    });
  } else if (operation < 0.85) {
    // 15% - Read operations (alerts, rules)
    group('read_operations', () => {
      const choice = Math.random();

      if (choice < 0.5) {
        // List alerts
        const res = http.get(`${BASE_URL}/api/alerts?limit=10`, { headers });
        const success = check(res, {
          'alerts listed': (r) => r.status === 200,
        });
        errorRate.add(!success);
      } else {
        // List rules
        const res = http.get(`${BASE_URL}/api/rules`, { headers });
        const success = check(res, {
          'rules listed': (r) => r.status === 200,
        });
        errorRate.add(!success);
      }
    });
  } else if (operation < 0.95) {
    // 10% - Health and metrics
    group('monitoring', () => {
      const choice = Math.random();

      if (choice < 0.5) {
        const res = http.get(`${BASE_URL}/health`);
        check(res, { 'health ok': (r) => r.status === 200 });
      } else {
        const res = http.get(`${BASE_URL}/metrics`);
        check(res, { 'metrics ok': (r) => r.status === 200 });
      }
    });
  } else {
    // 5% - List operations
    group('list_operations', () => {
      const res = http.get(`${BASE_URL}/api/lists?limit=10`, { headers });
      check(res, { 'lists fetched': (r) => r.status === 200 });
    });
  }

  sleep(0.1 + Math.random() * 0.2); // 100-300ms between requests
}

export function teardown(data) {
  console.log('Mixed workload benchmark completed');
  console.log(`Organization: ${data.orgId}`);
}
