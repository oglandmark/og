import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const mobileRoot = resolve(import.meta.dirname, '..');
const homeScreen = readFileSync(
  resolve(mobileRoot, 'app', '(tabs)', 'index.tsx'),
  'utf8',
);
const agentProfileScreen = readFileSync(
  resolve(mobileRoot, 'app', 'agent', '[id].tsx'),
  'utf8',
);

test('Home sample-agent cards resolve to their sample profiles', () => {
  assert.match(
    homeScreen,
    /const visibleAgents = managedAgents\.length > 0 \? managedAgents : SAMPLE_AGENTS;/,
  );
  assert.match(
    homeScreen,
    /onAgentPress=\{\(agentId\) => router\.push\(`\/agent\/\$\{agentId\}` as any\)\}/,
  );
  assert.match(
    agentProfileScreen,
    /const sampleAgent = SAMPLE_AGENTS\.find\(\(item\) => String\(item\.id\) === String\(id\)\);/,
  );
  assert.match(
    agentProfileScreen,
    /:\s*sampleAgent\s*\?\s*toProfile\(sampleAgent,\s*true\)/,
  );
});