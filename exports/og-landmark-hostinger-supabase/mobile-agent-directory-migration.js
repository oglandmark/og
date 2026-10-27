const MIGRATION_KEY = 'mobileAgentDirectoryV1';

function asList(value) {
  return Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
}

function yearsFromExperience(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const match = String(value || '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function importApprovedLegacyAgents(data, now = () => new Date().toISOString()) {
  if (!Array.isArray(data.mobileAgents)) data.mobileAgents = [];
  if (data.mobileAgentMigrations?.[MIGRATION_KEY]) {
    return { changed: false, importedCount: 0 };
  }

  const users = Array.isArray(data.users) ? data.users : [];
  let importedCount = 0;

  for (const user of users) {
    if (
      String(user.role || '').toLowerCase() !== 'agent'
      || String(user.status || '').toLowerCase() !== 'active'
      || String(user.approvalStatus || '').toLowerCase() !== 'approved'
      || user.visible === false
      || user.id === undefined
      || user.id === null
    ) continue;

    const email = String(user.email || '').trim();
    const alreadyManaged = data.mobileAgents.some((agent) =>
      String(agent.authUserId ?? '') === String(user.id)
      || (email && String(agent.email || '').trim().toLowerCase() === email.toLowerCase())
    );
    if (alreadyManaged) continue;

    const city = String(user.city || '').trim();
    const areas = asList(user.areas).length ? asList(user.areas) : asList(city);
    const specialties = asList(user.specialties).length
      ? asList(user.specialties)
      : asList(user.specialization);

    data.mobileAgents.push({
      id: `agent-account-${user.id}`,
      authUserId: user.id,
      name: String(user.name || user.displayName || 'Property Agent').trim(),
      displayName: String(user.displayName || user.name || 'Property Agent').trim(),
      phone: user.phone || '',
      email: email || '',
      agency: user.agency || user.company || user.title || 'OG Landmark Agent',
      title: user.title || user.specialization || 'Property Consultant',
      city,
      areas,
      specialization: user.specialization || specialties.join(', '),
      specialties,
      experience: user.experience || '',
      years: yearsFromExperience(user.experience),
      rating: Number(user.rating || 0),
      reviewCount: Number(user.reviewCount || 0),
      listings: Number(user.listings || 0),
      about: user.bio || user.about || '',
      photo: user.profilePhoto || user.photo || null,
      coverPhoto: user.coverPhoto || null,
      verified: true,
      status: 'Active',
      approvalStatus: 'Approved',
      visible: true,
      createdAt: user.joinedDate || now(),
      updatedAt: now(),
    });
    importedCount += 1;
  }

  data.mobileAgentMigrations = {
    ...(data.mobileAgentMigrations || {}),
    [MIGRATION_KEY]: {
      completedAt: now(),
      importedCount,
    },
  };

  return { changed: true, importedCount };
}

module.exports = { importApprovedLegacyAgents };
