const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const page = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');

test('public Agent cards are replaced from the current managed directory, including an empty result', () => {
  const start = page.indexOf('function injectAgents(){');
  const end = page.indexOf('// Refresh while the page stays open', start);
  assert.ok(start >= 0 && end > start, 'public Agent injection function should exist');
  const injector = page.slice(start, end);
  const removeLegacyCards = injector.indexOf('removeReactAgentCards(grid)');
  const removeStaleCards = injector.indexOf("grid.querySelectorAll('[data-og-live-agent]')");
  const emptyDirectoryGuard = injector.indexOf('if(!_agents||!_agents.length) return;');
  assert.ok(removeLegacyCards >= 0, 'hardcoded React Agent cards should be removed');
  assert.ok(removeStaleCards > removeLegacyCards, 'old managed cards should be removed after legacy cards');
  assert.ok(emptyDirectoryGuard > removeStaleCards, 'an empty directory must still clear old injected cards');
});

test('only active, visible Admin-managed records are shown; React sample profiles are removed', () => {
  assert.match(page, /var REACT_AGENTS=\['Ahmed Property Consultants','Malik Properties','Ch\. Property Services','Baig Property Advisors','Raza Industrial & Commercial'\]/);
  assert.match(page, /function removeReactAgentCards\(grid\)/);
  assert.match(page, /_agents=Array\.isArray\(agentsData\)[\s\S]*?a\.status==='Active'&&a\.visible!==false/);
  assert.match(page, /\/agents\?approvalStatus=Approved/);
  assert.match(page, /window\.__OG_ADMIN_LARAVEL_LOCAL__[\s\S]*?\/api\/preview\/live\/mobile-agents/);
});

test('public Agent directory refreshes while open and when the visitor returns', () => {
  assert.match(page, /var directoryUrl=window\.__OG_ADMIN_LARAVEL_LOCAL__[\s\S]*?\/agents\?approvalStatus=Approved/);
  assert.match(page, /fetch\(directoryUrl, \{ cache: 'no-store' \}/);
  assert.match(page, /setInterval\(refreshAgentDirectory, 15_000\)/);
  assert.match(page, /document\.addEventListener\('visibilitychange'/);
});
