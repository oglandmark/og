const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const page = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');

test('public Agent cards are replaced from the current managed directory, including an empty result', () => {
  const start = page.indexOf('function injectAgents(){');
  const end = page.indexOf('// Also patch photos of React hardcoded agents', start);
  assert.ok(start >= 0 && end > start, 'public Agent injection function should exist');
  const injector = page.slice(start, end);
  const removeStaleCards = injector.indexOf("grid.querySelectorAll('[data-og-live-agent]')");
  const emptyDirectoryGuard = injector.indexOf('if(!_agents||!_agents.length) return;');
  assert.ok(removeStaleCards >= 0, 'old injected cards should be removed on each refresh');
  assert.ok(emptyDirectoryGuard > removeStaleCards, 'an empty directory must still clear old injected cards');
});

test('public Agent directory refreshes while open and when the visitor returns', () => {
  assert.match(page, /\/agents\?approvalStatus=Approved', \{ cache: 'no-store' \}/);
  assert.match(page, /setInterval\(refreshAgentDirectory, 15_000\)/);
  assert.match(page, /document\.addEventListener\('visibilitychange'/);
});
