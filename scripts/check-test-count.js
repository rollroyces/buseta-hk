#!/usr/bin/env node
/**
 * Guard against Vitest's silent false-green.
 *
 * ## The bug class this prevents
 *
 * When a test file's worker fails to start (jsdom environment
 * can't boot, the pool times out, the file throws during import),
 * Vitest reports it as an **unhandled error** rather than a test
 * failure — and the process still exits 0. The suite prints
 *
 *     Test Files  21 passed (21)
 *     Tests       322 passed (322)
 *     Errors      4 errors
 *
 * and `npm run check` goes green while quietly running fewer tests
 * than it should. We hit this three times in this repo:
 *
 *   - Node 20 + jsdom 30  → the 4 jsdom files never loaded (297/350).
 *   - Vitest 5 + jsdom 30 → same 4 files never loaded (322/376).
 *   - Vitest 5 alone      → `vitest-pool-runner: Timeout waiting
 *                            for worker to respond`.
 *
 * In every case the exit code was 0. A green CI badge was a lie.
 *
 * ## What this does
 *
 * Reads the JSON report that `npm test` writes and asserts the suite
 * actually ran the expected number of test FILES and test CASES. If a
 * file silently failed to start, the count drops and this exits 1.
 *
 * The expected counts live in `scripts/expected-test-count.json` —
 * bump them in the same commit that adds the tests.
 *
 * Usage:  node scripts/check-test-count.js [path-to-report.json]
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const REPORT = process.argv[2] || path.join(ROOT, 'vitest-report.json');
const BASELINE = path.join(__dirname, 'expected-test-count.json');

function fail(msg) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}

if (!fs.existsSync(REPORT)) {
  fail(`vitest JSON report not found at ${REPORT}`);
  console.error('    (is `npm test` still writing --outputFile? see package.json)');
  process.exit(1);
}

if (!fs.existsSync(BASELINE)) {
  fail(`expected-count baseline missing at ${BASELINE}`);
  process.exit(1);
}

let report;
let baseline;
try {
  report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
} catch (e) {
  fail(`could not parse ${REPORT}: ${e.message}`);
  process.exit(1);
}
try {
  baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
} catch (e) {
  fail(`could not parse ${BASELINE}: ${e.message}`);
  process.exit(1);
}

// `numTotalTestSuites` counts describe BLOCKS, not files — use
// `testResults.length` for the file count. A file whose worker never
// started is simply absent from `testResults`, which is exactly the
// signal we want.
const totalFiles = (report.testResults || []).length;
const totalTests = report.numTotalTests ?? 0;
const failedFiles = report.numFailedTestSuites ?? 0;
const failedTests = report.numFailedTests ?? 0;

// A file that failed to start is not in `testResults` at all, so it
// never shows up as "failed" — it just isn't there. Compare against
// the baseline to catch the gap.
const expectedFiles = baseline.testFiles;
const expectedTests = baseline.testCases;

if (totalFiles < expectedFiles) {
  const missing = expectedFiles - totalFiles;
  fail(
    `only ${totalFiles} test file(s) ran, expected ${expectedFiles} — ` +
      `${missing} file(s) silently failed to start (jsdom worker boot?). ` +
      'Vitest exits 0 on this, so without this guard CI would be green while skipping tests.'
  );
} else {
  console.log(`  ✓ test files: ${totalFiles} >= ${expectedFiles}`);
}

if (totalTests < expectedTests) {
  fail(
    `only ${totalTests} test case(s) ran, expected ${expectedTests} — ` +
      `${expectedTests - totalTests} case(s) did not execute.`
  );
} else {
  console.log(`  ✓ test cases: ${totalTests} >= ${expectedTests}`);
}

if (failedFiles > 0 || failedTests > 0) {
  fail(`${failedFiles} file(s) / ${failedTests} case(s) failed`);
} else {
  console.log('  ✓ no failed files or cases');
}

if (process.exitCode) {
  console.error('\nTest-count guard FAILED — the suite did not run in full.');
  process.exit(process.exitCode);
}
console.log('\nTest-count guard passed.');
