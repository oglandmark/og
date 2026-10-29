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
const findAgentScreen = readFileSync(
  resolve(mobileRoot, 'app', 'agent', 'find.tsx'),
  'utf8',
);
const agentData = readFileSync(
  resolve(mobileRoot, 'lib', 'agentsData.ts'),
  'utf8',
);
const mobileApi = readFileSync(
  resolve(mobileRoot, 'lib', 'api.ts'),
  'utf8',
);
const mobileApiBase = readFileSync(
  resolve(mobileRoot, 'lib', 'apiBase.ts'),
  'utf8',
);

test('Home and profile screens only show Agents from the managed directory', () => {
  assert.match(
    homeScreen,
    /const visibleAgents = managedAgents;/,
  );
  assert.match(homeScreen, /<AnimatedReveal delay=\{260\}>[\s\S]*?VERIFIED PROFESSIONALS/);
  assert.match(homeScreen, /No Agents are available right now\./);
  assert.doesNotMatch(homeScreen, /\{visibleAgents\.length > 0 && <AnimatedReveal/);
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
  assert.match(homeScreen, /AppState\.addEventListener\('change', \(nextState\) => \{\s*if \(nextState === 'active'\) void refreshAgents\(\);/);
  assert.match(homeScreen, /appStateSubscription\.remove\(\)/);
});

test('Find Agents refreshes after Admin changes while open or when the app resumes', () => {
  assert.match(findAgentScreen, /useFocusEffect\(useCallback\(/);
  assert.match(findAgentScreen, /setInterval\(\(\) => void loadAgents\(false\), 15_000\)/);
  assert.match(findAgentScreen, /AppState\.addEventListener\('change', \(nextState\) => \{\s*if \(nextState === 'active'\) void loadAgents\(false\);/);
  assert.match(findAgentScreen, /appStateSubscription\.remove\(\)/);
});

test('Find Agents loads the public Admin-managed directory and maps records to mobile cards', () => {
  assert.match(mobileApi, /`\/api\/mobile-agents/);
  assert.match(mobileApi, /propertyFeedFetch<ApiAgent\[\]>/);
  assert.match(mobileApiBase, /pathname === '\/api\/mobile-agents'\) return `\/api\/preview\/live\/mobile-agents\$\{query\}`/);
  assert.match(findAgentScreen, /const records = await getAgents\(\);\s*setAgents\(records\.map\(apiAgentToSample\)\)/);
  assert.match(agentData, /const displayName = agent\.displayName \|\| agent\.name \|\| 'Property Agent'/);
  assert.match(agentData, /agency: agent\.agency \|\| agent\.title \|\| agent\.specialization/);
});

test('Mobile profiles retain Admin-edited profile details without changing official contact actions', () => {
  assert.match(agentData, /profilePhone: agent\.phone \|\| undefined/);
  assert.match(agentData, /email: agent\.email \|\| undefined/);
  assert.match(agentData, /city,/);
  assert.match(agentData, /coverPhoto: agent\.coverPhoto \|\| undefined/);
  assert.match(agentData, /phone: PUBLIC_CONTACT_PHONE/);
  assert.match(agentProfileScreen, /Profile details/);
  assert.match(agentProfileScreen, /agent\.profilePhone/);
  assert.match(agentProfileScreen, /agent\.email/);
});