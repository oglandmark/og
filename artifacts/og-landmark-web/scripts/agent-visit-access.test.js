const assert = require('node:assert/strict');
const test = require('node:test');
const {
  canAccessAgentVisit,
  normalizeAgentVisitCreate,
  sanitizeAgentVisitPatch,
} = require('../agent-visit-access');

const data = {
  mobileAgents: [
    { id: 2001, authUserId: 64, email: 'agent@example.test' },
    { id: 2002, authUserId: 65, email: 'other@example.test' },
  ],
};
const agent = { id: 64, role: 'Agent', email: 'agent@example.test' };
const otherAgent = { id: 65, role: 'Agent', email: 'other@example.test' };
const buyer = { id: 30, role: 'Buyer', email: 'buyer@example.test' };

test('an agent can see visits booked against their linked mobile profile only', () => {
  const assignedVisit = { id: 'visit-1', userId: 30, agentId: 2001 };
  const otherVisit = { id: 'visit-2', userId: 30, agentId: 2002 };

  assert.equal(canAccessAgentVisit(data, assignedVisit, agent), true);
  assert.equal(canAccessAgentVisit(data, otherVisit, agent), false);
  assert.equal(canAccessAgentVisit(data, assignedVisit, otherAgent), false);
  assert.equal(canAccessAgentVisit(data, assignedVisit, buyer), true);
  assert.equal(canAccessAgentVisit(data, assignedVisit, { id: 1, role: 'Admin' }), true);
});

test('agent-created visits are owned by the signed-in agent; buyer bookings keep the assigned profile', () => {
  assert.deepEqual(
    normalizeAgentVisitCreate({ id: 'visit-3', userId: 999, agentId: 2002 }, agent),
    { id: 'visit-3', userId: 64, agentId: '64' },
  );
  assert.deepEqual(
    normalizeAgentVisitCreate({ id: 'visit-4', userId: 999, agentId: 2001 }, buyer),
    { id: 'visit-4', userId: 30, agentId: 2001 },
  );
});

test('non-admin visit updates cannot change owner or agent assignment', () => {
  assert.deepEqual(
    sanitizeAgentVisitPatch({
      id: 'visit-1',
      userId: 999,
      buyerId: 999,
      agentId: 2002,
      status: 'Confirmed',
    }, agent),
    { status: 'Confirmed' },
  );
});
