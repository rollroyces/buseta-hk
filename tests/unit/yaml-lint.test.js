// @vitest-environment node
//
// Enforces structural hygiene on .github/workflows/*.yml:
//
//   - Parses as valid YAML (js-yaml v5, which uses YAML 1.2 by default).
//   - Has an `on` key (the trigger block) — NOT the boolean `true`.
//     YAML 1.1 parsers (PyYAML, libyaml < 0.13) interpret `on:` as
//     the boolean literal `true`, which silently makes the workflow
//     have no triggers. GitHub Actions handles unquoted `on:` at
//     runtime via special-casing, but the YAML 1.1 parse makes the
//     file unportable to other YAML readers. The fix is to quote it:
//     `"on":`.
//   - Has a `jobs` key with at least one job that has `runs-on` and
//     each step has a `name` or `uses`/`run` (for self-documenting
//     UI in the Actions tab).
//
// This test is intentionally narrow — it's a guardrail, not a full
// YAML linter. If you find yourself wanting to add lots of rules,
// switch to a real tool (yamllint, actionlint) instead of growing
// this file.
//
// Important: `js-yaml` v5 uses the YAML 1.2 schema by default, which
// does NOT interpret `on:` as a boolean. So a js-yaml-only check
// would not catch the YAML 1.1 regression — we also spawn Python's
// PyYAML (YAML 1.1) to verify the regression doesn't slip back in.

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { execSync } from 'node:child_process';
import { load as yamlLoad } from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workflowsDir = pathResolve(__dirname, '../../.github/workflows');

function listWorkflows() {
  const out = [];
  for (const name of readdirSync(workflowsDir).sort()) {
    const full = `${workflowsDir}/${name}`;
    if (statSync(full).isFile() && (name.endsWith('.yml') || name.endsWith('.yaml'))) {
      out.push({ name, full });
    }
  }
  return out;
}

let pyyamlAvailable = false;
try {
  execSync('python3 -c "import yaml" 2>/dev/null', { stdio: 'pipe' });
  pyyamlAvailable = true;
} catch {
  pyyamlAvailable = false;
}

describe('GitHub Actions workflows (.github/workflows/*.yml)', () => {
  const workflows = listWorkflows();

  it('at least one workflow file exists', () => {
    // Sanity check — if this fails, either the workflows directory
    // was accidentally deleted or moved.
    expect(workflows.length).toBeGreaterThan(0);
  });

  for (const { name, full } of workflows) {
    describe(name, () => {
      let doc;
      try {
        // `js-yaml` v5 default schema is YAML 1.2 (CORE_SCHEMA),
        // which treats `on:` as a string key — same as GitHub
        // Actions at runtime. Adequate for structural checks.
        doc = yamlLoad(readFileSync(full, 'utf8'));
      } catch (err) {
        it('parses as valid YAML', () => {
          throw new Error(`${name}: YAML parse error — ${err.message}`);
        });
        return;
      }

      it('parses as valid YAML', () => {
        expect(typeof doc).toBe('object');
        expect(doc).not.toBeNull();
      });

      it('has an `on` key (trigger block)', () => {
        expect(Object.keys(doc)).toContain('on');
      });

      it('has a `jobs` key', () => {
        expect(Object.keys(doc)).toContain('jobs');
        expect(typeof doc.jobs).toBe('object');
      });

      it('every job has a `runs-on`', () => {
        for (const [jobName, job] of Object.entries(doc.jobs)) {
          expect(typeof job['runs-on'], `${name}: job "${jobName}" missing runs-on`).toBe('string');
        }
      });

      it('every step has a `name` or `uses`', () => {
        // Every step should be self-documenting in the GitHub Actions
        // UI; missing `name` falls back to `uses`/`run` which is
        // unreadable for `uses: actions/checkout@v4`-style steps.
        for (const [jobName, job] of Object.entries(doc.jobs)) {
          if (!Array.isArray(job.steps)) continue;
          for (const [i, step] of job.steps.entries()) {
            if (typeof step !== 'object') continue;
            const hasName = typeof step.name === 'string' && step.name.length > 0;
            const hasAction = typeof step.uses === 'string' || typeof step.run === 'string';
            expect(
              hasName || hasAction,
              `${name}: job "${jobName}" step #${i} has no name and no uses/run`
            ).toBe(true);
          }
        }
      });
    });
  }
});

describe('YAML 1.1 regression — `on:` boolean-literal gotcha', () => {
  // js-yaml v5 (above) uses YAML 1.2 and won't catch the regression.
  // PyYAML (default in Python 3) uses YAML 1.1 and WILL: unquoted
  // `on:` parses as the boolean `True`, and the workflow has no
  // triggers.
  //
  // Run a quick Python check that loads every workflow file under
  // YAML 1.1 and asserts the top-level keys do NOT include a boolean
  // `True`. Skipped entirely if python3 + PyYAML isn't on PATH.

  if (!pyyamlAvailable) {
    it.skip('python3 + PyYAML not available — YAML 1.1 check skipped', () => {});
    return;
  }

  for (const { name, full } of listWorkflows()) {
    it(`${name}: no top-level boolean True key under YAML 1.1`, () => {
      // Under YAML 1.1, an unquoted `on:` becomes the boolean True
      // (Python's `True`). Under YAML 1.2 it stays the string
      // `'on'`. We assert the sorted top-level key list does NOT
      // contain the string `True` (capital T).
      const pythonOut = execSync(
        `python3 -c "import yaml,sys; d=yaml.safe_load(open('${full}','r',encoding='utf-8').read()); print(','.join(sorted(map(str, d.keys()))))"`,
        { stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf8' }
      ).trim();
      const keys = pythonOut.split(',');
      expect(
        keys.includes('True'),
        `${name}: top-level keys include the boolean True — ` +
          'unquoted `on:` parsed as a YAML 1.1 boolean. ' +
          'Quote it as `"on":` to make the workflow portable.'
      ).toBe(false);
    });
  }
});
