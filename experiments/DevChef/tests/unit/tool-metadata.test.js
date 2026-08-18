import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_MATURITY,
  ALLOWED_TEST_COVERAGE,
  normalizeToolIndexEntry,
  validateToolMetadataIndex
} from '../../core/tool-metadata.js';

const rootDir = process.cwd();
const toolsDir = path.join(rootDir, 'tools');

function loadToolIndex() {
  return JSON.parse(fs.readFileSync(path.join(toolsDir, 'index.json'), 'utf8'));
}

function loadManifests(entries) {
  const manifests = new Map();

  entries.forEach(entry => {
    const metadata = normalizeToolIndexEntry(entry);
    const html = fs.readFileSync(path.join(toolsDir, metadata.file), 'utf8');
    const match = html.match(/<script type="devchef-manifest">([\s\S]*?)<\/script>/);
    expect(match, `${metadata.file} should include a devchef-manifest script`).toBeTruthy();
    manifests.set(metadata.file, JSON.parse(match[1]));
  });

  return manifests;
}

describe('tool metadata registry', () => {
  it('uses allowed maturity and coverage values', () => {
    expect(ALLOWED_MATURITY).toEqual(['experimental', 'beta', 'stable', 'deprecated']);
    expect(ALLOWED_TEST_COVERAGE).toEqual(['unknown', 'none', 'manual-smoke', 'unit', 'e2e', 'automated']);
  });

  it('passes the metadata quality gate for every tool', () => {
    const entries = loadToolIndex();
    const validation = validateToolMetadataIndex(entries, {
      manifestsByFile: loadManifests(entries),
      now: new Date('2026-04-23T00:00:00Z')
    });

    expect(formatIssues(validation)).toEqual([]);
    expect(validation.ok).toBe(true);
    expect(validation.totals.entries).toBeGreaterThan(0);
  });
});

function formatIssues(validation) {
  return Object.entries(validation.issuesByFile)
    .flatMap(([file, issues]) => {
      return issues
        .filter(issue => issue.severity === 'error')
        .map(issue => `${file}: ${issue.field}: ${issue.message}`);
    });
}
