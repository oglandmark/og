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
    /const visibleAgents = !agentDirectoryLoaded \|\| agentDirectoryFailed \? SAMPLE_AGENTS : managedAgents;/,
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

test('Agent details refresh managed profiles whenever the route regains focus', () => {
  assert.match(agentProfileScreen, /useFocusEffect\(useCallback\(/);
  assert.match(agentProfileScreen, /getAgents\(\)/);
  assert.match(agentProfileScreen, /setProfilePhotoFailed\(false\)/);
  assert.match(agentProfileScreen, /key=\{JSON\.stringify\(agent\.profileImage\)\}/);
  assert.match(agentProfileScreen, /onError=\{\(\) => setProfilePhotoFailed\(true\)\}/);
  assert.match(agentProfileScreen, /agent\.profileImage && !profilePhotoFailed/);
});