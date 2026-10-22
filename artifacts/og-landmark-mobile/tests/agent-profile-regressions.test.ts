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

test('Home and profile screens only show Agents from the managed directory', () => {
  assert.match(
    homeScreen,
    /const visibleAgents = managedAgents;/,
  );
  assert.match(homeScreen, /\{visibleAgents\.length > 0 && <AnimatedReveal delay=\{260\}>/);
  assert.doesNotMatch(homeScreen, /SAMPLE_AGENTS/);
  assert.match(
    homeScreen,
    /onAgentPress=\{\(agentId\) => router\.push\(`\/agent\/\$\{agentId\}` as any\)\}/,
  );
  assert.doesNotMatch(agentProfileScreen, /SAMPLE_AGENTS/);
});

test('Agent details refresh managed profiles whenever the route regains focus', () => {
  assert.match(agentProfileScreen, /useFocusEffect\(useCallback\(/);
  assert.match(agentProfileScreen, /getAgents\(\)/);
  assert.match(agentProfileScreen, /setInterval\(\(\) => void refreshAgent\(\), 15_000\)/);
  assert.match(agentProfileScreen, /key=\{JSON\.stringify\(agent\.profileImage\)\}/);
  assert.match(agentProfileScreen, /onError=\{\(\) => setFailedPhotoSourceKey\(JSON\.stringify\(agent\.profileImage\)\)\}/);
  assert.match(agentProfileScreen, /agent\.profileImage && failedPhotoSourceKey !== JSON\.stringify\(agent\.profileImage\)/);
  assert.match(homeScreen, /setInterval\(\(\) => void refreshAgents\(\), 15_000\)/);
});