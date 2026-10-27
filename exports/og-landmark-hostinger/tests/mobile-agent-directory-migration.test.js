const test = require('node:test');
const assert = require('node:assert/strict');
const { importApprovedLegacyAgents } = require('../mobile-agent-directory-migration');

function legacyData() {
  return {
    users: [
      { id: 10, role: 'Agent', status: 'Active', approvalStatus: 'Approved', name: 'Agent One', city: 'Okara', phone: '03000000001', specialization: 'Plots, Residential', experience: '8 years' },
      { id: 11, role: 'Agent', status: 'Active', approvalStatus: 'Approved', name: 'Agent Two', city: 'Lahore' },
      { id: 12, role: 'Agent', status: 'Active', approvalStatus: 'Approved', name: 'Agent Three', city: 'Islamabad' },
      { id: 13, role: 'Agent', status: 'Pending', approvalStatus: 'Pending', name: 'Pending Agent' },
      { id: 14, role: 'Buyer', status: 'Active', approvalStatus: 'Approved', name: 'Buyer' },
      { id: 15, role: 'Agent', status: 'Active', approvalStatus: 'Approved', visible: false, name: 'Hidden Agent' },
    ],
    mobileAgents: [],
  };
}

test('imports only active, approved, visible Agent accounts once', () => {
  const data = legacyData();
  const result = importApprovedLegacyAgents(data, () => '2026-10-27T00:00:00.000Z');

  assert.deepEqual(result, { changed: true, importedCount: 3 });
  assert.deepEqual(data.mobileAgents.map((agent) => agent.authUserId), [10, 11, 12]);
  assert.equal(data.mobileAgents[0].years, 8);
  assert.deepEqual(data.mobileAgents[0].specialties, ['Plots', 'Residential']);
  assert.equal(data.mobileAgentMigrations.mobileAgentDirectoryV1.importedCount, 3);
});

test('does not re-import agents deleted after the one-time migration', () => {
  const data = legacyData();
  importApprovedLegacyAgents(data);
  data.mobileAgents = [];

  assert.deepEqual(importApprovedLegacyAgents(data), { changed: false, importedCount: 0 });
  assert.deepEqual(data.mobileAgents, []);
});

test('does not duplicate an account already linked to a managed Agent', () => {
  const data = legacyData();
  data.mobileAgents.push({ id: 2001, authUserId: 10 });

  const result = importApprovedLegacyAgents(data);

  assert.deepEqual(result, { changed: true, importedCount: 2 });
  assert.equal(data.mobileAgents.length, 3);
});
