#!/usr/bin/env node
/**
 * Print Module QA Smoke Test
 * Run this against a running backend to validate the print module APIs
 *
 * Usage:
 *   cd backend
 *   node scripts/printModuleSmokeTest.js
 *
 * Requires:
 *   - Running backend
 *   - Valid auth token in localStorage or env
 */

const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5172';
const AUTH_TOKEN = process.env.SMOKE_TEST_TOKEN;

if (!AUTH_TOKEN) {
  console.error('Set SMOKE_TEST_TOKEN environment variable');
  process.exit(1);
}

const api = async (method, endpoint, body) => {
  const url = `${API_BASE_URL}/api${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {}

  return { status: res.status, data, ok: res.ok };
};

const test = async (name, fn) => {
  try {
    const result = await fn();
    if (result) {
      console.log(`✅ ${name}`);
    } else {
      console.log(`❌ ${name}`);
    }
    return result;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
};

const main = async () => {
  console.log(`Running print module smoke tests against ${API_BASE_URL}`);
  console.log('=' .repeat(60));

  // 1. Get fixtures
  await test('Fixtures endpoint returns data', async () => {
    const { ok, data } = await api('GET', '/print-tests/fixtures');
    return ok && data?.data?.length > 0;
  });

  // 2. Get a fixture
  await test('58mm receipt fixture exists', async () => {
    const { ok, data } = await api('GET', '/print-tests/fixtures/receipt/58mm_receipt');
    return ok && data?.data?.storeName;
  });

  // 3. Get print job statistics
  await test('Print job statistics endpoint works', async () => {
    const { ok, data } = await api('GET', '/print-jobs/statistics');
    return ok && data?.data;
  });

  // 4. Get print jobs list
  await test('Print jobs list endpoint works', async () => {
    const { ok, data } = await api('GET', '/print-jobs?limit=10');
    return ok && Array.isArray(data?.data);
  });

  // 5. List printer devices
  await test('Printer devices endpoint works', async () => {
    const { ok, data } = await api('GET', '/printer-devices');
    return ok && Array.isArray(data?.data);
  });

  // 6. SSRF protection (should fail)
  await test('SSRF protection blocks public IP', async () => {
    const { status } = await api('POST', '/printer-devices', {
      name: 'Bad Printer',
      device_type: 'thermal_receipt',
      connection_type: 'network',
      address: '8.8.8.8:9100',
      store_id: '00000000-0000-0000-0000-000000000000',
    });
    return status === 500; // Service throws validation error
  });

  // 7. List print templates
  await test('Print templates endpoint works', async () => {
    const { ok, data } = await api('GET', '/print-templates');
    return ok && Array.isArray(data?.data);
  });

  // 8. List duty-free profiles
  await test('Duty-free profiles endpoint works', async () => {
    const { ok, data } = await api('GET', '/duty-free-profiles');
    return ok && Array.isArray(data?.data);
  });

  console.log('=' .repeat(60));
  console.log('Smoke tests complete. Review any ❌ above before physical QA.');
};

main().catch(error => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});
