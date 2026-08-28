#!/usr/bin/env node

/**
 * Regression tests for snowstorm-mcp-server structuredContent responses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (haystack.includes(needle)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    console.log(`  Missing: ${needle}`);
    failedTests++;
  }
}

function assertFileExists(relPath, testName) {
  totalTests++;
  const fullPath = path.join(SERVER_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`${GREEN}✓${RESET} ${testName}`);
    passedTests++;
    return fs.readFileSync(fullPath, 'utf-8');
  } else {
    console.log(`${RED}✗${RESET} ${testName}`);
    failedTests++;
    return '';
  }
}

// Verify core server files exist
const index = assertFileExists('src/index.ts', 'index.ts exists');
const doFile = assertFileExists('src/do.ts', 'do.ts exists');
const catalog = assertFileExists('src/spec/catalog.ts', 'catalog.ts exists');
const adapter = assertFileExists('src/lib/api-adapter.ts', 'api-adapter.ts exists');
const http = assertFileExists('src/lib/http.ts', 'http.ts exists');
const codeMode = assertFileExists('src/tools/code-mode.ts', 'code-mode.ts exists');
const queryData = assertFileExists('src/tools/query-data.ts', 'query-data.ts exists');
const getSchema = assertFileExists('src/tools/get-schema.ts', 'get-schema.ts exists');

// Verify key patterns in source
if (index) {
  assertContains('src/index.ts', index, 'SnowstormDataDO', 'index exports SnowstormDataDO');
  assertContains('src/index.ts', index, 'MyMCP', 'index exports MyMCP');
  assertContains('src/index.ts', index, '/health', 'index has health endpoint');
  assertContains('src/index.ts', index, '/mcp', 'index has mcp endpoint');
}

if (doFile) {
  assertContains('src/do.ts', doFile, 'RestStagingDO', 'DO extends RestStagingDO');
}

function assertNotContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (!haystack.includes(needle)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    console.log(`  Must not contain: ${needle}`);
    failedTests++;
  }
}

if (catalog) {
  assertContains('src/spec/catalog.ts', catalog, 'ApiCatalog', 'catalog exports ApiCatalog');
  // SNOMED International edge-blocks our egress; the catalog must not send the
  // model back to a host that answers every request with an HTML 405 page.
  assertNotContains('src/spec/catalog.ts', catalog, 'browser.ihtsdotools.org', 'catalog does not point at the blocked IHTSDO host');
  assertContains('src/spec/catalog.ts', catalog, '/CodeSystem/$lookup', 'catalog documents the FHIR concept-read operation');
  assertContains('src/spec/catalog.ts', catalog, '/ValueSet/$expand', 'catalog documents the FHIR ECL search operation');
  // These three Snowstorm paths have no honest FHIR equivalent (verified against
  // tx.fhir.org AND Ontoserver). Leaving them in the catalog would send the model
  // at endpoints that can only 404.
  assertNotContains('src/spec/catalog.ts', catalog, '/MAIN/descriptions', 'catalog drops description-level search (no FHIR equivalent)');
  assertNotContains('src/spec/catalog.ts', catalog, '/concepts/{conceptId}/members', 'catalog drops reverse refset membership (no FHIR equivalent)');
}

if (http) {
  assertContains('src/lib/http.ts', http, 'setSnomedTxBase', 'http exposes a real base-URL setter');
  assertNotContains('src/lib/http.ts', http, 'https://browser.ihtsdotools.org', 'http default base is not the blocked IHTSDO host');
  assertContains('src/lib/http.ts', http, 'application/fhir+json', 'http negotiates FHIR JSON');
  // The base must be operable from config. It was documented as an override for
  // months while actually being a module constant no env var could reach.
  // Assert the CALL, not the identifiers: declaring SNOMED_TX_BASE on the env
  // interface and importing the setter both pass a loose grep while the var is
  // still ignored at runtime — which is precisely the state this file replaced.
  assertContains('src/index.ts', index, 'setSnomedTxBase(env.SNOMED_TX_BASE)', 'index applies SNOMED_TX_BASE at init');
}

if (adapter) {
  // ECL lives in the POST body while count/offset/filter stay in the query
  // string; dropping request.params here silently unpaginates every search.
  assertContains('src/lib/api-adapter.ts', adapter, 'request.params,', 'adapter forwards query params on POST');
}

if (codeMode) {
  assertContains('src/tools/code-mode.ts', codeMode, 'snowstorm_search', 'code-mode registers snowstorm_search');
  assertContains('src/tools/code-mode.ts', codeMode, 'snowstorm_execute', 'code-mode registers snowstorm_execute');
}

if (queryData) {
  assertContains('src/tools/query-data.ts', queryData, 'snowstorm_query_data', 'registers snowstorm_query_data');
}

if (getSchema) {
  assertContains('src/tools/get-schema.ts', getSchema, 'snowstorm_get_schema', 'registers snowstorm_get_schema');
}

// Summary
console.log(`\n${passedTests}/${totalTests} tests passed`);
if (failedTests > 0) {
  console.log(`${RED}${failedTests} tests FAILED${RESET}`);
  process.exit(1);
}
