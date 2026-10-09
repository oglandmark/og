function linkedAgentIds(data, user) {
  const userId = String(user?.id ?? '');
  const email = String(user?.email ?? '').trim().toLowerCase();
  const ids = new Set(userId ? [userId] : []);

  for (const agent of data.mobileAgents || []) {
    const linkedById = String(agent.authUserId ?? '') === userId;
    const linkedByEmail = user?.role === 'Agent'
      && email !== ''
      && String(agent.email ?? '').trim().toLowerCase() === email;
    if (linkedById || linkedByEmail) ids.add(String(agent.id));
  }

  return ids;
}

function canAccessAgentVisit(data, visit, user) {
  if (!user) return false;
  if (user.role === 'Admin' || String(visit.userId ?? '') === String(user.id ?? '')) return true;
  if (user.role !== 'Agent') return false;

  const agentIds = linkedAgentIds(data, user);
  return ['agentId', 'agentUserId', 'agentProfileId']
    .some((key) => visit[key] != null && agentIds.has(String(visit[key])));
}

function normalizeAgentVisitCreate(payload, user) {
  const item = { ...payload, userId: user.id };
  if (user.role === 'Agent') item.agentId = String(user.id);
  if (user.role !== 'Admin') {
    delete item.agentUserId;
    delete item.agentProfileId;
  }
  return item;
}

function sanitizeAgentVisitPatch(payload, user) {
  const patch = { ...payload };
  if (user.role === 'Admin') return patch;

  for (const key of ['id', 'userId', 'buyerId', 'agentId', 'agentUserId', 'agentProfileId']) {
    delete patch[key];
  }
  return patch;
}

module.exports = {
  canAccessAgentVisit,
  normalizeAgentVisitCreate,
  sanitizeAgentVisitPatch,
};
