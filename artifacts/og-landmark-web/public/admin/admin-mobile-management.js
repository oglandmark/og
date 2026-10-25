(function () {
  if (window.__ogMobileManagementMounted) return;
  window.__ogMobileManagementMounted = true;

  const base = () => String(window.__OG_API_BASE__ || '/api').replace(/\/+$/, '');
  const token = () => window.localStorage?.getItem('og_token') || '';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const money = (value) => `PKR ${Number(value || 0).toLocaleString('en-PK')}`;
  let modal;
  let pageHost;
  let originalPageTitle = null;
  let hiddenMainChildren = [];
  let agents = [];
  let agentLoadWarnings = [];
  const sectionData = {};

  const serviceAreas = ['Okara', 'Depalpur', 'Renala Khurd', 'Hujra Shah Muqeem', 'Basir Pur', 'Haveli Lakha'];
  const mobileSections = [
    { id: 'properties', label: 'Live properties' },
    { id: 'agents', label: 'Agents' },
    { id: 'users', label: 'Users' },
    { id: 'banners', label: 'Homepage banners' },
    { id: 'notifications', label: 'Notifications' },
  ];
  const sidebarItems = [
    { label: 'Main', path: '/admin/' },
    { label: 'Property listed', path: '/admin/properties?propertyView=inbox' },
    { label: 'Pending approvals', path: '/admin/properties?propertyView=pending' },
    { label: 'Approved properties', path: '/admin/properties?propertyView=approved' },
    { label: 'Rejected properties', path: '/admin/properties?propertyView=rejected' },
    { label: 'Featured', path: '/admin/properties?propertyView=featured' },
    { label: 'Recommended', path: '/admin/properties?propertyView=recommended' },
    { label: 'Projects', path: '/admin/properties?propertyView=projects' },
    { label: 'Agriculture Land', path: '/admin/properties?propertyView=agriculture' },
    { label: 'User management', path: '/admin/users' },
    { label: 'Agent Management', path: '/admin/mobile/agents' },
    { label: 'App banners management', path: '/admin/mobile/banners' },
    { label: 'App notifications management', path: '/admin/mobile/notifications' },
  ];
  const existingPagePaths = {
    ...Object.fromEntries(sidebarItems.map((item) => [item.label, item.path])),
    'Dashboard Statistics': '/admin/management/reports-and-analytics-dashboard-statistics',
  };
  const managementPages = [
    {
      label: 'Dashboard Statistics',
      group: 'Reports & Analytics',
      slug: 'reports-and-analytics-dashboard-statistics',
      path: existingPagePaths['Dashboard Statistics'],
    },
    {
      label: 'Staff & Permissions',
      group: 'Staff & Permissions',
      slug: 'staff-and-permissions',
      path: '/admin/management/staff-and-permissions',
    },
    {
      label: 'System Settings',
      group: 'System Settings',
      slug: 'system-settings',
      path: '/admin/management/system-settings',
    },
    { label: 'Developer Projects', slug: 'developer-projects', section: 'projects', path: '/admin/management/developer-projects' },
    { label: 'Locations', slug: 'locations', section: 'locations', path: '/admin/management/locations' },
    { label: 'Appointments', slug: 'appointments', section: 'appointments', path: '/admin/management/appointments' },
    { label: 'Support', slug: 'support', section: 'support', path: '/admin/management/support' },
    { label: 'Reviews', slug: 'reviews', section: 'reviews', path: '/admin/management/reviews' },
  ];
  const sidebarPages = [
    ...sidebarItems.map((item) => ({
      label: item.label,
      slug: item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      path: existingPagePaths[item.label],
    })),
    ...managementPages,
  ];
  const sidebarPageBySlug = Object.fromEntries(sidebarPages.map((page) => [page.slug, page]));

  async function api(path, options = {}) {
    const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await fetch(`${base()}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(options.body && !multipart ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    return payload;
  }

  function installStyles() {
    if (document.getElementById('og-mobile-management-css')) return;
    const style = document.createElement('style');
    style.id = 'og-mobile-management-css';
    style.textContent = `
      [data-og-admin-nav]{display:grid;gap:5px;padding:8px 2px}
      .og-mm-nav-link{position:relative;display:flex;align-items:center;gap:12px;min-height:44px;margin:0 3px;padding:9px 12px;border:1px solid transparent;border-radius:11px;background:rgba(255,255,255,.025);color:#d2dbe7;text-decoration:none;font:600 12px/1.3 "DM Sans",system-ui,sans-serif;transition:background .16s,border-color .16s,color .16s,transform .16s,box-shadow .16s}
      .og-mm-nav-link:hover{transform:translateX(2px);border-color:#ffffff20;background:#ffffff10;color:#fff}
      .og-mm-nav-link.active{border-color:#c8a45a55;background:linear-gradient(100deg,#c8a45a28,#ffffff0b);box-shadow:inset 3px 0 #d8b76c,0 5px 14px #06142620;color:#fff}
      .og-mm-nav-link:focus-visible{outline:3px solid #e2c77e;outline-offset:2px}
      .og-mm-nav-icon{display:grid;flex:0 0 30px;width:30px;height:30px;place-items:center;border:1px solid #ffffff14;border-radius:9px;background:#ffffff09;color:#c8a45a;transition:background .16s,border-color .16s,color .16s}
      .og-mm-nav-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
      .og-mm-nav-link.active .og-mm-nav-icon{border-color:#c8a45a55;background:#c8a45a20;color:#f0d28a}
      .og-mm-nav-label{flex:1;min-width:0}
      .og-mm-nav-chevron{color:#8290a2;font-size:18px;line-height:1;opacity:.55;transition:opacity .16s,transform .16s}
      .og-mm-nav-link:hover .og-mm-nav-chevron,.og-mm-nav-link.active .og-mm-nav-chevron{transform:translateX(2px);color:#e4c77f;opacity:1}
      .og-mm-nav-details{margin:3px 4px 0;color:#cbd5e1}
      .og-mm-nav-details>summary{padding:9px 10px;border-radius:8px;cursor:pointer;list-style:none;font:600 11px system-ui}
      .og-mm-nav-details>summary::-webkit-details-marker{display:none}
      .og-mm-nav-details>summary:after{content:'⌄';float:right;color:#94a3b8}
      .og-mm-nav-details[open]>summary:after{content:'⌃'}
      .og-mm-nav-details>summary:hover{background:#ffffff10;color:#fff}
      .og-mm-nav-children{margin-left:8px;padding-left:5px;border-left:1px solid #ffffff24}
      .og-mm-page{width:100%;min-height:calc(100vh - 150px);background:transparent}
      .og-mm-box{min-height:100%;background:transparent;color:#0b1f3a;font:14px system-ui}
      .og-mm-action{border:1px solid #dbe2ea;border-radius:8px;padding:8px 12px;background:#fff;color:#334155;font:600 12px system-ui;cursor:pointer}
      .og-mm-action.primary{background:#c8a45a;border-color:#c8a45a;color:#0b1f3a}
      .og-mm-content{padding:0 0 22px}.og-mm-note{padding:10px 12px;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#64748b;font-size:12px}
      .og-mm-table{width:100%;border-collapse:collapse}.og-mm-table th,.og-mm-table td{text-align:left;padding:11px 10px;border-bottom:1px solid #edf1f5;font-size:12px;vertical-align:top}.og-mm-table th{color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      .og-mm-pill{display:inline-flex;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-size:10px;font-weight:700}.og-mm-pill.off{background:#f1f5f9;color:#64748b}
      .og-mm-row-actions{display:flex;gap:6px;white-space:nowrap}.og-mm-action.danger{color:#b91c1c;border-color:#fecaca}
      .og-mm-empty,.og-mm-error{padding:20px;text-align:center;color:#64748b}.og-mm-error{color:#b91c1c}
      .og-mm-form{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;background:#f8fafc}
      .og-mm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .og-mm-field{display:flex;flex-direction:column;gap:5px}.og-mm-field.full{grid-column:1/-1}.og-mm-field label{font-size:11px;font-weight:700;color:#475569}
      .og-mm-form-section{grid-column:1/-1;margin:8px 0 0;padding:0 0 8px;border-bottom:1px solid #dbe2ea;color:#0b1f3a;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
      .og-mm-field input,.og-mm-field textarea,.og-mm-field select{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:8px;background:#fff;color:#0f172a;font:12px system-ui}
      .og-mm-field textarea{min-height:66px;resize:vertical}.og-mm-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
      .og-mm-agent-photo-preview{display:flex;align-items:center;gap:10px;margin-top:8px}.og-mm-agent-photo-preview img{width:72px;height:72px;object-fit:cover;border:1px solid #cbd5e1;border-radius:50%;background:#f1f5f9}.og-mm-agent-photo-preview span{color:#64748b;font-size:11px}
      .og-mm-agent-list-photo{display:flex;align-items:center;justify-content:center;width:40px;height:40px;overflow:hidden;border:1px solid #e2e8f0;border-radius:50%;background:#f8fafc;color:#64748b;font-size:9px;text-align:center;line-height:1.15}
      .og-mm-agent-list-photo img{display:block;width:100%;height:100%;object-fit:cover}.og-mm-agent-list-photo-fallback{padding:3px}
      .og-mm-agent-photo-status{display:block;min-height:16px;margin-top:4px;color:#64748b;font-size:11px}.og-mm-agent-photo-status.error{color:#b91c1c}.og-mm-agent-photo-status.success{color:#166534}
      .og-mm-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:12px 0 16px}
      .og-mm-stat{padding:13px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}.og-mm-stat span{display:block;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.og-mm-stat strong{display:block;margin-top:5px;font-size:21px}
      .og-mm-toolbar{display:flex;align-items:end;flex-wrap:wrap;gap:9px;margin-bottom:12px}.og-mm-toolbar .og-mm-field{min-width:130px}.og-mm-status{padding:9px 11px;border-radius:8px;background:#f8fafc;color:#475569;font-size:12px}.og-mm-status.ok{background:#dcfce7;color:#166534}.og-mm-status.degraded{background:#fee2e2;color:#991b1b}
      .og-mm-permissions{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:5px 12px;margin:9px 0}.og-mm-permissions label{font-size:11px;color:#475569}.og-mm-system-card{padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
      @media(max-width:700px){.og-mm-grid{grid-template-columns:1fr 1fr}.og-mm-table th,.og-mm-table td{padding:8px 6px}}
    `;
    document.head.appendChild(style);
  }

  async function loadData() {
    agentLoadWarnings = [];
    const readAgentSource = async (path, label) => {
      try {
        const records = await api(path);
        if (!Array.isArray(records)) throw new Error('The response was not a list.');
        return records;
      } catch (error) {
        agentLoadWarnings.push(`${label}: ${error.message || 'Could not load.'}`);
        return [];
      }
    };
    const [websiteAgents, mobileAgents, agentAccounts] = await Promise.all([
      readAgentSource('/admin/city-agents', 'Website directory'),
      readAgentSource('/admin/mobile-agents', 'Mobile directory'),
      readAgentSource('/admin/users?role=agent', 'Agent accounts'),
    ]);
    const merged = new Map();
    const sources = [
      ['city-agents', Array.isArray(websiteAgents) ? websiteAgents : []],
      ['mobile-agents', Array.isArray(mobileAgents) ? mobileAgents : []],
      ['agent-accounts', Array.isArray(agentAccounts) ? agentAccounts.filter((record) => String(record.role || '').toLowerCase() === 'agent') : []],
    ];
    const phoneCounts = new Map();
    const normalizedPhoneFor = (record) => {
      const phone = String(record.phone || record.mobile || '').replace(/\D/g, '');
      return phone.length === 12 && phone.startsWith('92') ? `0${phone.slice(2)}`
        : phone.length === 10 && phone.startsWith('3') ? `0${phone}` : phone;
    };
    for (const [collection, records] of sources) {
      for (const record of records) {
        const phone = normalizedPhoneFor(record);
        if (phone) {
          const key = `${collection}:${phone}`;
          phoneCounts.set(key, (phoneCounts.get(key) || 0) + 1);
        }
      }
    }
    for (const [collection, records] of sources) {
      for (const record of records) {
        if (!record || typeof record !== 'object') continue;
        const normalizedPhone = normalizedPhoneFor(record);
        const email = String(record.email || record.loginEmail || '').trim().toLowerCase();
        const userId = String(record.userId || record.accountId || record.authUserId || record.agentUserId
          || (collection === 'agent-accounts' ? record.id : '')).trim();
        const nameKey = String(record.displayName || record.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const sharedPhone = normalizedPhone && ['city-agents', 'mobile-agents', 'agent-accounts'].some((source) =>
          (phoneCounts.get(`${source}:${normalizedPhone}`) || 0) > 1);
        const phoneIdentity = sharedPhone ? `phone-name:${normalizedPhone}:${nameKey}` : `phone:${normalizedPhone}`;
        const identity = userId ? `user:${userId}` : email ? `email:${email}` : normalizedPhone ? phoneIdentity : `${collection}:${record.id}`;
        const existing = merged.get(identity);
        if (collection === 'agent-accounts' && !existing) continue;
        if (existing) {
          for (const [key, value] of Object.entries(record)) {
            if (value !== null && value !== '' && (existing[key] === undefined || existing[key] === null || existing[key] === '')) {
              existing[key] = value;
            }
          }
          if (collection === 'agent-accounts') existing.accountId ||= String(record.id);
          else if (!existing.directorySources.some((source) => source.collection === collection && String(source.id) === String(record.id))) {
            existing.directorySources.push({ collection, id: record.id });
          }
        } else {
          merged.set(identity, {
            ...record,
            accountId: collection === 'agent-accounts' ? String(record.id) : '',
            accountOnly: collection === 'agent-accounts',
            directorySources: collection === 'agent-accounts' ? [] : [{ collection, id: record.id }],
          });
        }
      }
    }
    agents = Array.from(merged.values());
  }

  function setAdminPageTitle(title) {
    const root = document.querySelector('#root');
    const heading = root?.querySelector('header h1');
    if (!root || !heading) return;
    if (originalPageTitle === null) originalPageTitle = heading.textContent.trim();
    if (heading.textContent.trim() !== title) heading.textContent = title;
    root.classList.add('og-admin-content-page');
  }

  function openPanel(tab) {
    installStyles();
    const activeSection = mobileSections.find((section) => section.id === tab) || sidebarPageBySlug[tab] || { label: 'Admin section' };
    if (modal?.dataset.section === tab) {
      setAdminPageTitle(activeSection.label);
      if (tab === 'agents' && new URLSearchParams(window.location.search).get('create') === 'agent' && !modal.querySelector('#og-mm-agent-form')) showAgentForm();
      return;
    }
    if (modal) close();

    pageHost = document.querySelector('#root main');
    if (!pageHost) return;
    modal = document.createElement('div');
    modal.className = 'og-mm-page';
    modal.dataset.section = tab;
    modal.innerHTML = `<section class="og-mm-box" aria-label="${esc(activeSection.label)}">
      <div class="og-mm-content"><div class="og-mm-loading">Loading live records…</div></div>
    </section>`;
    modal.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (action) handleAction(action);
    });
    pageHost.appendChild(modal);
    hiddenMainChildren = Array.from(pageHost.children)
      .filter((child) => child !== modal)
      .map((node) => ({ node, wasHidden: node.hidden }));
    hiddenMainChildren.forEach(({ node }) => { node.hidden = true; });
    setAdminPageTitle(activeSection.label);

    const page = modal;
    if (mobileSections.some((section) => section.id === tab)) {
      loadData().then(() => {
        if (modal === page) {
          render(activeSection.id);
          if (activeSection.id === 'agents' && new URLSearchParams(window.location.search).get('create') === 'agent') showAgentForm();
        }
      }).catch((error) => {
        if (modal === page) page.querySelector('.og-mm-content').innerHTML = `<div class="og-mm-error">${esc(error.message)}</div>`;
      });
    } else {
      render(tab);
    }
  }

  function close() {
    modal?.remove();
    modal = null;
    hiddenMainChildren.forEach(({ node, wasHidden }) => {
      if (node.isConnected) node.hidden = wasHidden;
    });
    hiddenMainChildren = [];
    pageHost = null;
    const root = document.querySelector('#root');
    root?.classList.remove('og-admin-content-page');
    if (originalPageTitle !== null) {
      const heading = root?.querySelector('header h1');
      if (heading) heading.textContent = originalPageTitle;
      originalPageTitle = null;
    }
  }

  function render(tab) {
    if (!modal) return;
    const content = modal.querySelector('.og-mm-content');
    if (tab === 'agents') return renderAgents(content);
    if (tab === 'users' || tab === 'banners' || tab === 'notifications') return renderSection(tab, content);
    if (tab === 'properties') return renderProperties(content);
    const page = sidebarPageBySlug[tab];
    if (page?.group === 'Reports & Analytics') return renderReports(content, page.label);
    if (page?.group === 'Staff & Permissions') return renderStaff(content);
    if (page?.group === 'System Settings') return renderSystem(content, page.label);
    if (page?.section === 'reviews') return renderReviews(content);
    if (page?.section && sectionConfig[page.section]) return renderSection(page.section, content);
    content.innerHTML = `<div class="og-mm-empty"><h3>${esc(page?.label || 'Page not found')}</h3><p>This navigation item does not have a connected management workflow yet.</p></div>`;
  }

  const reportColumns = {
    properties: ['id', 'title', 'city', 'price', 'approvalStatus', 'listingStatus', 'views', 'createdAt'],
    users: ['id', 'name', 'email', 'phone', 'role', 'status', 'city', 'joinedDate'],
    agents: ['id', 'name', 'email', 'phone', 'status', 'city', 'joinedDate'],
    leads: ['id', 'name', 'buyerName', 'propertyTitle', 'email', 'phone', 'status', 'city', 'createdAt'],
    appointments: ['id', 'name', 'propertyTitle', 'city', 'status', 'date', 'createdAt'],
    activity: ['timestamp', 'actorName', 'action', 'entity', 'details'],
  };
  function renderAgents(content) {
    const rows = agents.map((agent) => {
      const name = agent.displayName || agent.name || 'Unnamed agent';
      const photo = agent.photo || agent.profilePhoto;
      const photoCell = photo
        ? `<span class="og-mm-agent-list-photo"><img data-agent-list-photo src="${esc(photo)}" alt="${esc(`${name} profile photo`)}" loading="lazy" decoding="async"><span class="og-mm-agent-list-photo-fallback" data-agent-photo-fallback hidden>Photo unavailable</span></span>`
        : '<span class="og-mm-agent-list-photo og-mm-agent-list-photo-fallback">No photo</span>';
      const sources = new Set((agent.directorySources || []).map(({ collection }) =>
        collection === 'city-agents' ? 'Website' : collection === 'mobile-agents' ? 'Mobile app' : ''));
      if (agent.accountId) sources.add('Agent account');
      const sourceLabel = [...sources].filter(Boolean).join(' + ') || 'Agent account';
      const actions = agent.directorySources?.length
        ? `<button class="og-mm-action" data-action="edit-agent" data-index="${agents.indexOf(agent)}">Edit</button><button class="og-mm-action danger" data-action="delete-agent" data-index="${agents.indexOf(agent)}">Remove</button>`
        : '<a class="og-mm-action" href="/admin/users?role=agent">Manage in Users</a>';
      return `<tr>
      <td>${photoCell}</td>
      <td><strong>${esc(name)}</strong><div>${esc(agent.agency || agent.specialization || 'Independent')} · ${esc(sourceLabel)}</div></td>
      <td>${esc(agent.city || '—')}<div>${esc(agent.phone || '')}</div></td>
      <td>${esc(agent.email || agent.loginEmail || '—')}</td>
      <td><span class="og-mm-pill ${agent.status === 'Suspended' || agent.visible === false ? 'off' : ''}">${esc(agent.status || 'Active')}${agent.visible === false ? ' · Hidden' : ''}</span></td>
      <td><div class="og-mm-row-actions">${actions}</div></td></tr>`;
    }).join('');
    const warning = agentLoadWarnings.length
      ? `<div class="og-mm-error">Some Agent sources could not be loaded: ${esc(agentLoadWarnings.join(' · '))}</div>`
      : '';
    content.innerHTML = `${warning}<div class="og-mm-note">Showing ${agents.length} unique Agents from the website and mobile directories. Matching profiles are combined; new Agents are added to the mobile directory and also appear on the website.</div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="og-mm-action primary" data-action="add-agent">Add mobile Agent</button></div>
      <div id="og-mm-agent-form-wrap"></div>
      <div style="overflow:auto"><table class="og-mm-table"><thead><tr><th>Photo</th><th>Agent</th><th>City / phone</th><th>Email</th><th>Directory status</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="og-mm-empty">No Agent profiles or Agent accounts found.</td></tr>'}</tbody></table></div>`;
    content.querySelectorAll('[data-agent-list-photo]').forEach((image) => {
      image.addEventListener('error', () => {
        image.hidden = true;
        const fallback = image.parentElement.querySelector('[data-agent-photo-fallback]');
        if (fallback) fallback.hidden = false;
      }, { once: true });
    });
  }

  const sectionConfig = {
    properties: {
      title: 'Live mobile properties', list: '/admin/properties', deletePath: (item) => `/admin/properties/${encodeURIComponent(item.id)}`,
      fields: [
        ['title', 'Title'], ['type', 'Type'], ['city', 'City'], ['address', 'Address'],
        ['price', 'Price (PKR)', 'number'], ['area', 'Area', 'number'],
        ['status', 'Listing purpose'], ['approvalStatus', 'Approval status'],
        ['description', 'Description', 'textarea'],
      ],
      row: (item) => `<td><strong>${esc(item.title)}</strong><div>${esc(item.type || '')}</div></td><td>${esc(item.city || '—')}</td><td>${money(item.price)}</td><td>${esc(item.approvalStatus || item.listingStatus || item.status || '—')}</td>`,
    },
    users: {
      title: 'Mobile app accounts', list: '/users', deletePath: (item) => `/admin/users/${encodeURIComponent(item.id)}`,
      fields: [
        ['name', 'Full name'], ['email', 'Email', 'email'], ['phone', 'Phone'], ['city', 'City'],
        ['role', 'Role', 'select', ['User', 'Agent', 'Developer', 'Admin']],
        ['status', 'Account status', 'select', ['Active', 'Suspended']],
        ['password', 'Initial password (new accounts only)', 'password'],
      ],
      row: (item) => `<td><strong>${esc(item.name)}</strong><div>${esc(item.email || '')}</div></td><td>${esc(item.phone || '—')}</td><td>${esc(item.role || 'User')}</td><td>${esc(item.status || 'Active')}</td>`,
    },
    banners: {
      title: 'Mobile homepage banners', list: '/mobile/banners/all', createPath: '/mobile/banners',
      deletePath: (item) => `/mobile/banners/${encodeURIComponent(item.id)}`,
      fields: [
        ['type', 'Media type', 'select', ['image', 'video']], ['title', 'Title'], ['subtitle', 'Subtitle'], ['category', 'Category', 'select', ['homes', 'commercial', 'agriculture', 'plots', 'projects', 'video']],
        ['imageUrl', 'Image URL'], ['videoUrl', 'Video URL'], ['media', 'Upload image/video', 'file', [], '.jpg,.jpeg,.png,.webp,.mp4,.mov'], ['route', 'App route'], ['cta', 'Button text'],
        ['startDate', 'Campaign start date (optional)', 'date'], ['endDate', 'Campaign end date (optional)', 'date'],
        ['order', 'Sort order', 'number'], ['active', 'Visible in app', 'checkbox'],
      ],
      row: (item) => {
        const date = new Date();
        const today = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
        const status = item.active === false
          ? 'Hidden'
          : item.startDate && item.startDate > today
            ? 'Upcoming'
            : item.endDate && item.endDate < today
              ? 'Expired'
              : 'Live';
        return `<td><strong>${esc(item.title || item.eyebrow || 'Untitled')}</strong><div>${esc(item.type || 'image')}</div></td><td>${esc(item.category || '—')}</td><td>${esc(item.order ?? '—')}</td><td>${esc(item.startDate || 'No start')} – ${esc(item.endDate || 'No end')}</td><td>${status}</td>`;
      },
    },
    notifications: {
      title: 'Mobile notifications', list: '/admin/announcements', createPath: '/admin/announcements',
      deletePath: (item) => `/admin/announcements/${encodeURIComponent(item.id)}`,
      fields: [
        ['title', 'Notification title'], ['message', 'Message', 'textarea'],
        ['audienceRole', 'Audience role', 'select', ['all', 'user', 'agent', 'developer']],
        ['audienceCity', 'City (optional)'], ['status', 'Delivery status', 'readonly'],
        ['sendNow', 'Send to matching users now', 'checkbox'],
      ],
      row: (item) => `<td><strong>${esc(item.title || '—')}</strong><div>${esc(item.message || '')}</div></td><td>${esc(item.status || 'draft')}</td><td>${esc(item.recipientCount ?? 0)}</td><td>${esc(item.createdAt || '—').slice(0, 10)}</td>`,
    },
    projects: {
      title: 'Developer projects', list: '/admin/developer-projects', createPath: '/admin/developer-projects',
      addLabel: 'Add project',
      note: 'Manage the project details shown in the mobile app. Set status to Live or Approved to publish. Archive removes it from live lists while preserving linked blocks, units, and inventory.',
      deletePath: (item) => `/admin/developer-projects/${encodeURIComponent(item.id)}`,
      fields: [
        ['', 'Basic project details', 'section'],
        ['name', 'Project name *'], ['developerName', 'Developer / company'],
        ['developerId', 'Developer account ID (optional)'],
        ['type', 'Project type', 'select', ['Housing Society', 'Residential', 'Apartments', 'Commercial', 'Plaza', 'Mixed Use', 'Industrial', 'Farmhouse', 'Other']],
        ['tagline', 'Tagline'], ['shortDescription', 'Short description', 'textarea'],
        ['fullDescription', 'Full project description', 'textarea'],
        ['highlights', 'Key highlights (one per line)', 'textarea'],
        ['', 'Location & contact', 'section'],
        ['district', 'District'], ['city', 'City', 'city'], ['tehsil', 'Tehsil'],
        ['area', 'Area / locality'], ['address', 'Street address'], ['nearbyLandmark', 'Nearby landmark'],
        ['googleMapsLink', 'Google Maps link', 'url'], ['latitude', 'Latitude', 'number'],
        ['longitude', 'Longitude', 'number'], ['projectOfficePhone', 'Project office phone'],
        ['', 'Pricing & inventory', 'section'],
        ['startingPrice', 'Starting price (PKR)', 'number'], ['maxPrice', 'Maximum price (PKR)', 'number'],
        ['totalUnits', 'Total units', 'number'], ['availableUnits', 'Available units', 'number'],
        ['reservedUnits', 'Reserved units', 'number'], ['soldUnits', 'Sold units', 'number'],
        ['plotSizes', 'Plot / unit sizes (one per line)', 'textarea'],
        ['paymentPlanAvailable', 'Payment plan available', 'checkbox'],
        ['downPaymentPct', 'Down payment (%)', 'number'], ['installmentMonths', 'Installment duration (months)', 'number'],
        ['totalArea', 'Total project area'], ['totalBlocks', 'Number of blocks', 'number'],
        ['', 'Progress, approvals & media', 'section'],
        ['developmentStatus', 'Development progress', 'select', ['Pre-Launch', 'Under Construction', 'Construction Ongoing', 'Near Completion', 'Ready for Possession', 'Completed']],
        ['launchDate', 'Launch date', 'date'], ['expectedCompletion', 'Expected completion', 'date'],
        ['possessionStatus', 'Possession status', 'select', ['Ready', 'Partial', 'Not Ready']],
        ['nocStatus', 'NOC status', 'select', ['Not Applied', 'Applied', 'Pending', 'Approved']],
        ['approvedBy', 'Approved by (one per line)', 'textarea'], ['registrationNumber', 'Registration number'],
        ['status', 'Project status', 'select', ['Draft', 'Pending Review', 'Approved', 'Live', 'Coming Soon', 'Under Development', 'Completed', 'Paused']],
        ['verificationStatus', 'Verification status', 'select', ['Unverified', 'Pending', 'Under Review', 'Verified']],
        ['coverImageUri', 'Cover image URL', 'url'],
        ['coverUpload', 'Upload cover image', 'file', [], '.jpg,.jpeg,.png,.webp'],
        ['photos', 'Gallery image URLs (one per line)', 'textarea'],
        ['photoUploads', 'Upload gallery images', 'file', [], '.jpg,.jpeg,.png,.webp'],
        ['videoLinks', 'Video links (one per line)', 'textarea'],
        ['videoUploads', 'Upload project videos', 'file', [], '.mp4,.mov,.m4v,.webm'],
        ['amenities', 'Amenities (one per line)', 'textarea'],
        ['', 'Online presence', 'section'],
        ['facebookPage', 'Facebook page URL', 'url'], ['website', 'Website URL', 'url'],
        ['youtubeChannel', 'YouTube channel URL', 'url'],
      ],
      row: (item) => `<td><strong>${esc(item.name || item.title || 'Untitled project')}</strong><div>${esc(item.developerName || item.developer || 'Developer')}</div></td><td>${esc(item.city || item.location?.city || item.location || '—')}</td><td>${esc(item.expectedCompletion || item.completionDate || '—')}</td><td><span class="og-mm-pill ${/draft|pending|paused/i.test(item.status || '') ? 'off' : ''}">${esc(item.status || item.approvalStatus || 'Draft')}</span><div>PKR ${money(item.startingPrice).replace(/^PKR /, '')}</div></td>`,
    },
    locations: {
      title: 'Service locations', list: '/admin/locations', createPath: '/admin/locations',
      deletePath: (item) => `/admin/locations/${encodeURIComponent(item.id)}`,
      fields: [
        ['name', 'Location', 'location'], ['status', 'Service status', 'select', ['Active', 'Inactive']],
      ],
      row: (item) => `<td><strong>${esc(item.name || 'Unnamed location')}</strong></td><td>${esc(item.status || 'Active')}</td><td>${esc(item.updatedAt || item.createdAt || '—').slice(0, 10) || '—'}</td>`,
    },
    appointments: {
      title: 'Appointments', list: '/appointments', createPath: '/appointments',
      deletePath: (item) => `/appointments/${encodeURIComponent(item.id)}`,
      fields: [
        ['buyerName', 'Buyer name'], ['propertyTitle', 'Property'], ['propertyAddress', 'Property address'],
        ['city', 'City', 'city'], ['date', 'Appointment date', 'date'], ['time', 'Appointment time'],
        ['type', 'Visit type', 'select', ['Site Visit', 'Meeting', 'Call']],
        ['status', 'Appointment status', 'select', ['Upcoming', 'Confirmed', 'Completed', 'Cancelled']],
        ['notes', 'Notes', 'textarea'],
      ],
      row: (item) => `<td><strong>${esc(item.buyerName || item.name || 'Buyer')}</strong><div>${esc(item.type || 'Appointment')}</div></td><td><strong>${esc(item.propertyTitle || 'Property')}</strong><div>${esc(item.propertyAddress || '')}</div></td><td>${esc(item.city || item.location || '—')}</td><td>${esc([item.date, item.time].filter(Boolean).join(' ') || item.createdAt || '—')}</td><td>${esc(item.status || '—')}</td>`,
    },
    support: {
      title: 'Support reports', list: '/admin/reports', createPath: '/admin/reports',
      deletePath: (item) => `/admin/reports/${encodeURIComponent(item.id)}`,
      fields: [
        ['propertyId', 'Related property ID'], ['reason', 'Issue'], ['description', 'Details', 'textarea'],
        ['city', 'City', 'city'],
        ['status', 'Status', 'select', ['Pending', 'In Review', 'Resolved', 'Dismissed']],
        ['adminNote', 'Admin note', 'textarea'],
      ],
      row: (item) => `<td><strong>${esc(item.reason || item.title || 'Support report')}</strong><div>${esc(item.reporterName || item.name || '—')}</div></td><td>${esc(item.propertyId || '—')}</td><td>${esc(item.description || item.message || '—')}</td><td>${esc(item.status || 'Pending')}</td>`,
    },
  };

  async function renderProperties(content) { return renderSection('properties', content); }

  async function renderSection(key, content) {
    const config = sectionConfig[key];
    content.innerHTML = '<div class="og-mm-empty">Loading live production records…</div>';
    try {
      const result = await api(config.list);
      const items = Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : []);
      sectionData[key] = items;
      const columnsBySection = {
        properties: ['Property', 'City', 'Price', 'Status', 'Actions'],
        users: ['Account', 'Phone', 'Role', 'Status', 'Actions'],
        banners: ['Banner', 'Category', 'Order', 'Campaign dates', 'Visibility', 'Actions'],
        notifications: ['Notification', 'Status', 'Recipients', 'Created', 'Actions'],
        projects: ['Project', 'City', 'Completion', 'Status', 'Actions'],
        locations: ['Location', 'Status', 'Updated', 'Actions'],
        appointments: ['Buyer', 'Property', 'City', 'Date / time', 'Status', 'Actions'],
        support: ['Report', 'Property', 'Details', 'Status', 'Actions'],
      };
      const columns = columnsBySection[key] || ['Record', 'Status', 'Actions'];
      const colspan = columns.length;
      const rows = items.map((item) => `<tr>${config.row(item)}<td><div class="og-mm-row-actions">
        ${key === 'notifications' && item.status !== 'sent' ? `<button class="og-mm-action primary" data-action="send-announcement" data-section="${key}" data-id="${esc(item.id)}">Send</button>` : ''}
        <button class="og-mm-action" data-action="edit-record" data-section="${key}" data-id="${esc(item.id)}">Edit</button>
        <button class="og-mm-action danger" data-action="delete-record" data-section="${key}" data-id="${esc(item.id)}">${key === 'projects' ? 'Archive' : 'Delete'}</button>
      </div></td></tr>`).join('');
      const addButton = config.createPath ? `<button class="og-mm-action primary" data-action="add-record" data-section="${key}">${esc(config.addLabel || 'Add new')}</button>` : '';
      content.innerHTML = `<div class="og-mm-note">${esc(config.note || `${config.title} — live records loaded from the shared Admin API used by the website and mobile app.`)}</div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">${addButton}</div><div id="og-mm-record-form"></div>
        <div style="overflow:auto"><table class="og-mm-table"><thead><tr>${columns.map((name) => `<th>${esc(name)}</th>`).join('')}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${colspan}" class="og-mm-empty">No records found.</td></tr>`}</tbody></table></div>`;
    } catch (error) {
      content.innerHTML = `<div class="og-mm-error">Could not load live records: ${esc(error.message)}</div>`;
    }
  }

  async function renderReviews(content) {
    content.innerHTML = '<div class="og-mm-empty">Loading live property review records…</div>';
    try {
      const records = await api('/admin/properties');
      const items = Array.isArray(records) ? records : [];
      sectionData.reviews = items;
      const rows = items.map((item) => {
        const history = Array.isArray(item.reviewHistory) ? item.reviewHistory : [];
        const status = item.approvalStatus || item.listingStatus || 'Pending';
        const audit = history.map((entry) => `<li><strong>${esc(entry.action || 'Review')}</strong> · ${esc(entry.fromStatus || '—')} → ${esc(entry.toStatus || '—')} · ${esc(entry.createdAt || '—')}${entry.reason ? `<div>${esc(entry.reason)}</div>` : ''}</li>`).join('');
        return `<tr>
          <td><strong>${esc(item.title || 'Untitled property')}</strong><div>${esc(item.city || '—')} · ID ${esc(item.id)}</div></td>
          <td>${esc(item.sellerName || item.ownerName || '—')}</td>
          <td><span class="og-mm-pill ${/pending|changes requested|rejected/i.test(status) ? 'off' : ''}">${esc(status)}</span><div>${esc(item.reviewedAt || 'Not reviewed')}</div></td>
          <td><details><summary>${history.length} review ${history.length === 1 ? 'action' : 'actions'}</summary><ul>${audit || '<li>No review actions yet.</li>'}</ul></details></td>
          <td><div class="og-mm-row-actions">
            <button class="og-mm-action primary" data-action="review-property" data-operation="approve" data-id="${esc(item.id)}">Approve</button>
            <button class="og-mm-action" data-action="review-property" data-operation="request-changes" data-id="${esc(item.id)}">Request changes</button>
            <button class="og-mm-action danger" data-action="review-property" data-operation="reject" data-id="${esc(item.id)}">Reject</button>
          </div></td>
        </tr>`;
      }).join('');
      content.innerHTML = `<div class="og-mm-note">Property moderation decisions and review history use the existing Laravel property-review workflow. Changes notify listing owners through the established API flow.</div>
        <div style="overflow:auto"><table class="og-mm-table"><thead><tr><th>Property</th><th>Owner</th><th>Status</th><th>Review history</th><th>Actions</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5" class="og-mm-empty">No property records found.</td></tr>'}</tbody></table></div>`;
    } catch (error) {
      content.innerHTML = `<div class="og-mm-error">Could not load property reviews: ${esc(error.message)}</div>`;
    }
  }
  function showRecordForm(key, item = {}) {
    const config = sectionConfig[key];
    const wrap = modal.querySelector('#og-mm-record-form');
    if (!wrap) return;
    const editing = item.id !== undefined && item.id !== null;
    const fields = config.fields.filter(([name, , type]) => (
      !(name === 'status' && key === 'notifications' && editing)
      && !(name === 'sendNow' && key === 'notifications' && editing)
      && !(name === 'type' && key === 'banners' && editing)
    ));
    const currentMediaUrl = item.type === 'video' ? item.videoUrl : item.imageUrl;
    const currentMediaPreview = key === 'banners' && editing && currentMediaUrl
      ? `<div class="og-mm-note"><strong>Current ${item.type === 'video' ? 'video' : 'image'}</strong><div style="margin-top:8px">${item.type === 'video'
        ? `<video src="${esc(currentMediaUrl)}" controls preload="metadata" style="display:block;width:min(100%,420px);max-height:220px;border-radius:8px;background:#0b1f3a"></video>`
        : `<img src="${esc(currentMediaUrl)}" alt="${esc(item.title || 'Current banner')}" style="display:block;width:min(100%,420px);max-height:220px;object-fit:cover;border-radius:8px">`
      }</div><small>Choose a replacement file to change the media, or leave it empty to keep the current one.</small></div>`
      : '';
    const projectPhotoUrls = (Array.isArray(item.photos) ? item.photos : String(item.photos || '').split(/\r?\n/))
      .map((photo) => typeof photo === 'string' ? photo : photo?.url)
      .filter(Boolean);
    const projectVideoUrls = (Array.isArray(item.videoLinks) ? item.videoLinks : String(item.videoLinks || '').split(/\r?\n/))
      .map((video) => typeof video === 'string' ? video : video?.url)
      .filter(Boolean);
    const projectMediaPreview = key === 'projects' && editing
      ? `<div class="og-mm-note full"><strong>Current project media</strong><div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px">
        ${item.coverImageUri ? `<img src="${esc(item.coverImageUri)}" alt="Project cover" style="width:150px;height:96px;object-fit:cover;border-radius:8px">` : ''}
        ${projectPhotoUrls.map((url) => `<img src="${esc(url)}" alt="Project gallery image" style="width:150px;height:96px;object-fit:cover;border-radius:8px">`).join('')}
        ${projectVideoUrls.map((url) => `<video src="${esc(url)}" controls preload="metadata" style="width:220px;height:124px;border-radius:8px;background:#0b1f3a"></video>`).join('')}
        ${item.coverImageUri || projectPhotoUrls.length || projectVideoUrls.length ? '' : '<span>No project media saved yet.</span>'}
      </div></div>`
      : '';
    const formTitle = key === 'projects' ? `${editing ? 'Edit' : 'Add'} project` : `${editing ? 'Edit' : 'Add'} ${config.title}`;
    wrap.innerHTML = `<form class="og-mm-form" id="og-mm-record-form-inner"><h3 style="margin:0 0 12px">${esc(formTitle)}</h3><div class="og-mm-grid">
      ${fields.map(([name, label, type = 'text', options = [], accept]) => {
        let value = item[name] ?? '';
        if (type === 'section') return `<div class="og-mm-form-section">${esc(label)}</div>`;
        if (key === 'projects' && name === 'name' && !value) value = item.title || '';
        if (key === 'projects' && name === 'developerName' && !value) value = item.developer || '';
        if (key === 'projects' && name === 'city' && !value) {
          value = typeof item.location === 'object' ? item.location?.city || '' : item.location || '';
        }
        if (key === 'projects' && ['highlights', 'plotSizes', 'approvedBy', 'photos', 'videoLinks', 'amenities'].includes(name) && Array.isArray(value)) {
          value = value.join('\n');
        }
        if (key === 'notifications' && name === 'audienceRole') value = item.audience?.role || 'all';
        if (key === 'notifications' && name === 'audienceCity') value = item.audience?.city || '';
        const full = type === 'textarea' ? ' full' : '';
        if (type === 'readonly') return `<div class="og-mm-field"><label>${esc(label)}</label><input disabled value="${esc(value)}"></div>`;
        if (type === 'checkbox') return `<div class="og-mm-field${full}"><label><input type="checkbox" name="${esc(name)}" ${(name === 'sendNow' || key === 'projects' ? Boolean(value) : value !== false) ? 'checked' : ''}> ${esc(label)}</label></div>`;
        if (type === 'file') {
          const bannerAccept = key === 'banners' && editing
            ? (item.type === 'video' ? '.mp4,.mov' : '.jpg,.jpeg,.png,.webp')
            : accept;
          const fileLabel = key === 'banners' && editing ? 'Replace media file (optional)' : label;
          const multiple = key === 'projects' && ['photoUploads', 'videoUploads'].includes(name) ? 'multiple' : '';
          const preview = key === 'projects' ? `<div data-project-upload-preview="${esc(name)}" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>` : '';
          const bannerPreview = key === 'banners' ? '<div data-banner-upload-preview style="margin-top:8px"></div>' : '';
          return `<div class="og-mm-field"><label>${esc(fileLabel)}</label><input name="${esc(name)}" type="file" accept="${esc(bannerAccept || '')}" ${multiple}><small>${key === 'projects' ? 'Images: JPG, PNG or WebP up to 20 MiB each. Videos: MP4, MOV, M4V or WebM up to 300 MiB each.' : 'Image: JPG/PNG/WebP up to 20 MiB; video: MP4/MOV up to 300 MiB.'}</small>${preview}${bannerPreview}</div>`;
        }
        if (type === 'city') {
          const cityOptions = [...new Set([...serviceAreas, ...(value && !serviceAreas.includes(value) ? [value] : [])])];
          return `<div class="og-mm-field"><label>${esc(label)}</label><select name="${esc(name)}"><option value="">Choose a location</option>${cityOptions.map((option) => `<option value="${esc(option)}" ${value === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></div>`;
        }
        if (type === 'location') {
          const locationOptions = [...new Set([...serviceAreas, ...(sectionData.locations || []).map((location) => location.name), ...(value ? [value] : [])])];
          return `<div class="og-mm-field"><label>${esc(label)}</label><input name="${esc(name)}" list="og-mm-location-options" maxlength="120" required value="${esc(value)}"><datalist id="og-mm-location-options">${locationOptions.map((option) => `<option value="${esc(option)}"></option>`).join('')}</datalist></div>`;
        }
        if (type === 'select') {
          const selectOptions = [...new Set([...options, ...(value && !options.includes(value) ? [value] : [])])];
          return `<div class="og-mm-field"><label>${esc(label)}</label><select name="${esc(name)}">${selectOptions.map((option) => `<option value="${esc(option)}" ${String(value).toLowerCase() === option.toLowerCase() ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></div>`;
        }
        if (type === 'textarea') return `<div class="og-mm-field full"><label>${esc(label)}</label><textarea name="${esc(name)}" maxlength="6000">${esc(value)}</textarea></div>`;
        const required = key === 'projects' && name === 'name' ? 'required maxlength="180"' : '';
        return `<div class="og-mm-field"><label>${esc(label)}</label><input name="${esc(name)}" type="${esc(type)}" ${type === 'number' ? 'step="any"' : ''} ${required} value="${esc(value)}"></div>`;
      }).join('')}${currentMediaPreview}${projectMediaPreview}
    </div><div class="og-mm-form-actions"><button type="button" class="og-mm-action" data-action="cancel-record" data-section="${key}">Cancel</button><button class="og-mm-action primary" type="submit">${key === 'projects' ? 'Save project' : 'Save'}</button></div></form>`;
    if (key === 'projects') {
      wrap.querySelectorAll('input[type="file"]').forEach((input) => {
        input.addEventListener('change', () => {
          const preview = wrap.querySelector(`[data-project-upload-preview="${input.name}"]`);
          if (!preview) return;
          for (const url of input.__ogPreviewUrls || []) URL.revokeObjectURL(url);
          input.__ogPreviewUrls = [];
          preview.replaceChildren();
          for (const file of Array.from(input.files || [])) {
            const url = URL.createObjectURL(file);
            input.__ogPreviewUrls.push(url);
            const item = document.createElement('div');
            item.style.cssText = 'width:120px;font-size:11px;color:#5f6b79';
            const media = document.createElement(input.name === 'videoUploads' ? 'video' : 'img');
            media.src = url;
            if (media instanceof HTMLVideoElement) {
              media.controls = true;
              media.preload = 'metadata';
            }
            media.style.cssText = 'display:block;width:120px;height:76px;object-fit:cover;border-radius:7px;background:#0b1f3a';
            const filename = document.createElement('span');
            filename.textContent = file.name;
            item.append(media, filename);
            preview.appendChild(item);
          }
        });
      });
    }
    if (key === 'banners') {
      const input = wrap.querySelector('input[name="media"]');
      const preview = wrap.querySelector('[data-banner-upload-preview]');
      input?.addEventListener('change', () => {
        if (!preview) return;
        if (input.__ogPreviewUrl) URL.revokeObjectURL(input.__ogPreviewUrl);
        preview.replaceChildren();
        const file = input.files?.[0];
        if (!file) return;
        input.__ogPreviewUrl = URL.createObjectURL(file);
        const video = (editing ? item.type : wrap.querySelector('select[name="type"]')?.value) === 'video';
        const media = document.createElement(video ? 'video' : 'img');
        media.src = input.__ogPreviewUrl;
        if (video) {
          media.controls = true;
          media.preload = 'metadata';
        }
        media.style.cssText = 'display:block;width:min(100%,420px);max-height:220px;object-fit:cover;border-radius:8px;background:#0b1f3a';
        const label = document.createElement('small');
        label.textContent = `Selected file: ${file.name}`;
        preview.append(media, label);
      });
    }
    wrap.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      if (key === 'banners') {
        const startDate = form.elements.startDate.value;
        const endDate = form.elements.endDate.value;
        if (startDate && endDate && startDate > endDate) {
          const message = document.createElement('div');
          message.className = 'og-mm-error';
          message.textContent = 'End date must be the same as or later than the start date.';
          form.prepend(message);
          return;
        }
      }
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      const payload = { ...data };
      for (const [name, , type] of config.fields) {
        if (type === 'checkbox') payload[name] = form.elements[name].checked;
        if (type === 'number' && data[name] !== undefined && data[name] !== '') payload[name] = Number(data[name]);
      }
      if (key === 'projects') {
        const splitLines = (value) => String(value || '').split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean);
        for (const name of ['highlights', 'plotSizes', 'approvedBy', 'photos', 'videoLinks', 'amenities']) {
          payload[name] = splitLines(payload[name]);
        }
        payload.name = String(payload.name || '').trim();
        payload.title = payload.name;
        payload.developerName = String(payload.developerName || '').trim();
        payload.developer = payload.developerName;
        if (!payload.developerId) delete payload.developerId;
      }
      if (key === 'notifications') {
        payload.audience = { role: payload.audienceRole || 'all', city: payload.audienceCity || '' };
        payload.sendNow = Boolean(payload.sendNow);
        delete payload.audienceRole; delete payload.audienceCity;
      }
      if (key === 'banners' && !editing) payload.active = payload.active !== false;
      if (key === 'users' && editing) delete payload.password;
      delete payload.media;
      delete payload.coverUpload;
      delete payload.photoUploads;
      delete payload.videoUploads;
      try {
        if (key === 'projects') {
          const coverFile = form.elements.coverUpload?.files?.[0];
          if (coverFile) {
            const uploadForm = new FormData();
            uploadForm.append('image', coverFile);
            uploadForm.append('context', 'project');
            const uploaded = await api('/upload/single', { method: 'POST', body: uploadForm });
            if (typeof uploaded?.url !== 'string' || !uploaded.url.trim()) throw new Error('The cover image upload did not return a media URL.');
            payload.coverImageUri = uploaded.url.trim();
          }
          const photoFiles = Array.from(form.elements.photoUploads?.files || []);
          if (photoFiles.length) {
            const uploadForm = new FormData();
            photoFiles.forEach((file) => uploadForm.append('images[]', file));
            uploadForm.append('context', 'project');
            const uploaded = await api('/upload/multiple', { method: 'POST', body: uploadForm });
            const urls = Array.isArray(uploaded?.urls) ? uploaded.urls : (uploaded?.url ? [uploaded.url] : []);
            if (urls.length !== photoFiles.length) throw new Error('One or more project images could not be uploaded.');
            payload.photos = [...(Array.isArray(payload.photos) ? payload.photos : []), ...urls];
          }
          const videoFiles = Array.from(form.elements.videoUploads?.files || []);
          if (videoFiles.length) {
            const uploadForm = new FormData();
            videoFiles.forEach((file) => uploadForm.append('video', file));
            uploadForm.append('context', 'project');
            const uploaded = await api('/upload/video', { method: 'POST', body: uploadForm });
            const urls = Array.isArray(uploaded?.urls) ? uploaded.urls : (uploaded?.url ? [uploaded.url] : []);
            if (urls.length !== videoFiles.length) throw new Error('One or more project videos could not be uploaded.');
            payload.videoLinks = [...(Array.isArray(payload.videoLinks) ? payload.videoLinks : []), ...urls];
          }
        }
        if (key === 'notifications' && payload.sendNow && !window.confirm('Send this notification to the selected live users now? This cannot be recalled.')) {
          submit.disabled = false;
          return;
        }
        const bannerFile = key === 'banners' ? form.elements.media?.files?.[0] : null;
        const body = bannerFile
          ? (() => {
              const formData = new FormData();
              Object.entries(payload).forEach(([name, value]) => {
                if (value !== undefined && value !== null) formData.append(name, String(value));
              });
              formData.append('media', bannerFile);
              if (editing && key === 'banners') formData.append('_method', 'PUT');
              return formData;
            })()
          : JSON.stringify(payload);
        if (editing) {
          if (key === 'users') {
            const previous = item.role || 'User';
            const nextRole = payload.role;
            delete payload.role;
            await api(`/users/${encodeURIComponent(item.id)}`, { method: 'PUT', body: JSON.stringify(payload) });
            if (nextRole !== previous) await api(`/admin/users/${encodeURIComponent(item.id)}/role`, { method: 'PATCH', body: JSON.stringify({ role: nextRole }) });
          } else {
            await api(`${config.createPath || config.list}/${encodeURIComponent(item.id)}`, {
              method: key === 'properties' ? 'PATCH' : key === 'banners' && bannerFile ? 'POST' : 'PUT',
              body,
            });
          }
        } else {
          await api(config.createPath, { method: 'POST', body });
        }
        await renderSection(key, modal.querySelector('.og-mm-content'));
      } catch (error) {
        const message = document.createElement('div'); message.className = 'og-mm-error'; message.textContent = error.message || 'Could not save record.';
        form.prepend(message); submit.disabled = false;
      }
    });
  }

  function showAgentForm(agent = {}) {
    const wrap = modal.querySelector('#og-mm-agent-form-wrap');
    wrap.innerHTML = `<form class="og-mm-form" id="og-mm-agent-form">
      <h3 style="margin:0 0 12px">${agent.id ? 'Edit Agent profile' : 'Add Agent profile'}</h3>
      <div class="og-mm-grid">
        <div class="og-mm-field"><label>Agent name *</label><input name="name" required maxlength="120" value="${esc(agent.displayName || agent.name || '')}"></div>
        <div class="og-mm-field"><label>Agency</label><input name="agency" maxlength="120" value="${esc(agent.agency || '')}"></div>
        <div class="og-mm-field"><label>City</label><input name="city" maxlength="120" value="${esc(agent.city || '')}"></div>
        <div class="og-mm-field"><label>Phone</label><input name="phone" maxlength="40" value="${esc(agent.phone || '')}"></div>
        <div class="og-mm-field"><label>Email</label><input name="email" type="email" maxlength="160" value="${esc(agent.email || agent.loginEmail || '')}"></div>
        <div class="og-mm-field"><label>Years of experience</label><input name="years" type="number" min="0" max="80" value="${esc(agent.years || 0)}"></div>
        <div class="og-mm-field"><label>Rating</label><input name="rating" type="number" min="0" max="5" step="0.1" value="${esc(agent.rating || 0)}"></div>
        <div class="og-mm-field"><label>Reviews</label><input name="reviewCount" type="number" min="0" value="${esc(agent.reviewCount || 0)}"></div>
        <div class="og-mm-field"><label>Listings</label><input name="listings" type="number" min="0" value="${esc(agent.listings || 0)}"></div>
        <div class="og-mm-field"><label>Brand color</label><input name="color" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(agent.color || '') ? agent.color : '#0b1f3a')}"></div>
        <div class="og-mm-field full"><label>Agent photo</label><div class="og-mm-agent-photo-preview"><img data-agent-photo-preview alt="Agent profile photo preview" hidden><span data-agent-photo-empty>${agent.photo || agent.profilePhoto ? '' : 'No profile photo selected.'}</span></div><label for="og-mm-agent-photo-upload">Upload profile photo</label><input id="og-mm-agent-photo-upload" name="photoUpload" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"><button type="button" class="og-mm-action danger" data-remove-agent-photo>Remove current photo</button><small>JPG, PNG or WebP up to 20 MiB.</small><span class="og-mm-agent-photo-status" data-agent-photo-status aria-live="polite"></span></div>
        <div class="og-mm-field full"><label>Profile cover photo URL</label><input name="coverPhoto" maxlength="500" value="${esc(agent.coverPhoto || '')}" placeholder="https://example.com/agent-cover.jpg"></div>
        <div class="og-mm-field"><label>Profile status</label><select name="status"><option ${agent.status !== 'Suspended' ? 'selected' : ''}>Active</option><option ${agent.status === 'Suspended' ? 'selected' : ''}>Suspended</option></select></div>
        <div class="og-mm-field"><label>Approval</label><select name="approvalStatus"><option ${agent.approvalStatus !== 'Pending' && agent.approvalStatus !== 'Rejected' ? 'selected' : ''}>Approved</option><option ${agent.approvalStatus === 'Pending' ? 'selected' : ''}>Pending</option><option ${agent.approvalStatus === 'Rejected' ? 'selected' : ''}>Rejected</option></select></div>
        <div class="og-mm-field full"><label>Service areas (comma separated)</label><input name="areas" value="${esc((agent.areas || []).join(', '))}"></div>
        <div class="og-mm-field full"><label>Specialties (comma separated)</label><input name="specialties" value="${esc((agent.specialties || []).join(', '))}"></div>
        <div class="og-mm-field full"><label>About</label><textarea name="about" maxlength="2000">${esc(agent.about || '')}</textarea></div>
        <div class="og-mm-field"><label><input type="checkbox" name="visible" ${agent.visible !== false ? 'checked' : ''}> Visible in mobile app</label><label><input type="checkbox" name="verified" ${agent.verified !== false ? 'checked' : ''}> Verified Agent</label></div>
      </div><div class="og-mm-form-actions"><button type="button" class="og-mm-action" data-action="cancel-form">Cancel</button><button class="og-mm-action primary" type="submit">Save Agent</button></div>
    </form>`;
    const form = wrap.querySelector('form');
    const photoUploadInput = form.elements.photoUpload;
    const photoPreview = form.querySelector('[data-agent-photo-preview]');
    const photoEmpty = form.querySelector('[data-agent-photo-empty]');
    const photoStatus = form.querySelector('[data-agent-photo-status]');
    let photoUrl = String(agent.photo || agent.profilePhoto || '').trim();
    let selectedPhotoFile = null;
    let localPreviewUrl = '';
    const revokeLocalPreview = () => {
      if (!localPreviewUrl) return;
      URL.revokeObjectURL(localPreviewUrl);
      localPreviewUrl = '';
    };
    const showPhotoPreview = (url) => {
      if (url) {
        photoPreview.src = url;
        photoPreview.hidden = false;
        photoEmpty.hidden = true;
      } else {
        photoPreview.removeAttribute('src');
        photoPreview.hidden = true;
        photoEmpty.hidden = false;
        photoEmpty.textContent = 'No profile photo selected.';
      }
    };
    showPhotoPreview(photoUrl);
    form.querySelector('[data-remove-agent-photo]').addEventListener('click', () => {
      photoUrl = '';
      selectedPhotoFile = null;
      revokeLocalPreview();
      photoUploadInput.value = '';
      showPhotoPreview('');
      photoStatus.className = 'og-mm-agent-photo-status';
      photoStatus.textContent = 'Photo will be removed when you save.';
    });
    photoPreview.addEventListener('error', () => {
      photoPreview.hidden = true;
      photoEmpty.hidden = false;
      photoEmpty.textContent = 'Photo preview unavailable.';
    });
    photoUploadInput.addEventListener('change', () => {
      const file = photoUploadInput.files?.[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        selectedPhotoFile = null;
        revokeLocalPreview();
        showPhotoPreview(photoUrl);
        photoStatus.className = 'og-mm-agent-photo-status error';
        photoStatus.textContent = 'Choose an image no larger than 20 MiB.';
        photoUploadInput.value = '';
        return;
      }
      if (!/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
        selectedPhotoFile = null;
        revokeLocalPreview();
        showPhotoPreview(photoUrl);
        photoStatus.className = 'og-mm-agent-photo-status error';
        photoStatus.textContent = 'Choose a JPG, PNG or WebP image.';
        photoUploadInput.value = '';
        return;
      }
      selectedPhotoFile = file;
      revokeLocalPreview();
      localPreviewUrl = URL.createObjectURL(file);
      showPhotoPreview(localPreviewUrl);
      photoStatus.className = 'og-mm-agent-photo-status';
      photoStatus.textContent = 'Photo selected. Save Agent to upload and apply it.';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      photoUploadInput.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      try {
        if (selectedPhotoFile) {
          photoStatus.className = 'og-mm-agent-photo-status';
          photoStatus.textContent = 'Uploading photo and saving profile…';
          const formData = new FormData();
          formData.append('image', selectedPhotoFile);
          const uploaded = await api('/upload/single', { method: 'POST', body: formData });
          if (typeof uploaded?.url !== 'string' || !uploaded.url.trim()) {
            throw new Error('The server did not return an uploaded photo URL.');
          }
          photoUrl = uploaded.url.trim();
          selectedPhotoFile = null;
          photoUploadInput.value = '';
          revokeLocalPreview();
          showPhotoPreview(photoUrl);
        }
        const payload = {
          name: String(data.name || '').trim(), displayName: String(data.name || '').trim(),
          agency: String(data.agency || '').trim(), city: String(data.city || '').trim(),
          phone: String(data.phone || '').trim(), email: String(data.email || '').trim(),
          years: Number(data.years) || 0, rating: Number(data.rating) || 0,
          reviewCount: Number(data.reviewCount) || 0, listings: Number(data.listings) || 0,
          color: String(data.color || '#0b1f3a'), verified: form.elements.verified.checked,
          coverPhoto: String(data.coverPhoto || '').trim() || null,
          photo: photoUrl || null,
          profilePhoto: photoUrl || null,
          areas: String(data.areas || '').split(',').map((item) => item.trim()).filter(Boolean),
          specialties: String(data.specialties || '').split(',').map((item) => item.trim()).filter(Boolean),
          about: String(data.about || '').trim(), status: data.status,
          approvalStatus: data.approvalStatus, visible: form.elements.visible.checked,
        };
        const sources = agent?.directorySources || [];
        if (sources.length) {
          await Promise.all(sources.map(({ collection, id }) => api(`/admin/${collection}/${encodeURIComponent(id)}`, {
            method: 'PUT', body: JSON.stringify(payload),
          })));
        } else {
          await api('/admin/mobile-agents', { method: 'POST', body: JSON.stringify(payload) });
        }
        await loadData();
        renderAgents(modal.querySelector('.og-mm-content'));
      } catch (error) {
        const message = document.createElement('div');
        message.className = 'og-mm-error'; message.textContent = error.message || 'Could not save Agent profile.';
        form.prepend(message);
        submit.disabled = false;
        photoUploadInput.disabled = false;
      }
    });
  }

  async function handleAction(button) {
    try {
      const id = button.dataset.id;
      if (button.dataset.action === 'add-agent') showAgentForm();
      if (button.dataset.action === 'edit-agent') {
        const agent = agents[Number(button.dataset.index)];
        if (agent) showAgentForm(agent);
      }
      if (button.dataset.action === 'cancel-form') renderAgents(modal.querySelector('.og-mm-content'));
      if (button.dataset.action === 'delete-agent') {
        const agent = agents[Number(button.dataset.index)];
        if (!agent || !window.confirm(`Remove “${agent.displayName || agent.name || 'this Agent'}” from the website and mobile Agent directory? Its login account will remain.`)) return;
        await Promise.all((agent.directorySources || []).map(({ collection, id }) =>
          api(`/admin/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        ));
        await loadData();
        renderAgents(modal.querySelector('.og-mm-content'));
      }
      const section = button.dataset.section;
      if (button.dataset.action === 'add-record') showRecordForm(section);
      if (button.dataset.action === 'edit-record') {
        const item = (sectionData[section] || []).find((record) => String(record.id) === String(id));
        if (item) showRecordForm(section, item);
      }
      if (button.dataset.action === 'cancel-record') renderSection(section, modal.querySelector('.og-mm-content'));
      if (button.dataset.action === 'review-property') {
        const operation = button.dataset.operation;
        if (operation === 'approve') {
          const property = (sectionData.reviews || []).find((item) => String(item.id) === String(id));
          const title = property?.title || `listing ${id}`;
          if (!window.confirm(`Approve “${title}” and make it publicly visible under the current listing rules?`)) return;
        }
        const reason = ['reject', 'request-changes'].includes(operation)
          ? window.prompt(operation === 'reject' ? 'Why is this listing being rejected?' : 'What changes are needed?')
          : '';
        if (['reject', 'request-changes'].includes(operation) && reason === null) return;
        await api(`/admin/properties/${encodeURIComponent(id)}/${operation}`, {
          method: 'PATCH',
          body: JSON.stringify({ reason: reason || '' }),
        });
        await renderReviews(modal.querySelector('.og-mm-content'));
      }
      if (button.dataset.action === 'delete-record') {
        const config = sectionConfig[section];
        const item = (sectionData[section] || []).find((record) => String(record.id) === String(id));
        if (!item) return;
        const label = item.title || item.name || item.email || `record ${id}`;
        const warning = section === 'projects'
          ? `Archive project “${label}”? It will no longer appear in the live project list, but its project and inventory records will be preserved.`
          : section === 'banners'
          ? `Permanently delete the ${item.type === 'video' ? 'video' : 'image'} banner “${label}” from the mobile app?`
          : section === 'users'
          ? `Permanently delete account ${label}? This removes mobile app access. Review linked records first; the action cannot be undone.`
          : `Permanently delete ${label} from the live mobile app?`;
        if (!window.confirm(warning)) return;
        await api(config.deletePath(item), { method: 'DELETE' });
        await renderSection(section, modal.querySelector('.og-mm-content'));
      }
      if (button.dataset.action === 'send-announcement') {
        const item = (sectionData.notifications || []).find((record) => String(record.id) === String(id));
        if (!item || !window.confirm(`Send “${item.title || 'this notification'}” to its selected audience now? This cannot be recalled.`)) return;
        await api(`/admin/announcements/${encodeURIComponent(id)}/send`, { method: 'POST' });
        await renderSection('notifications', modal.querySelector('.og-mm-content'));
      }
      if (button.dataset.action === 'save-staff') {
        const row = button.closest('[data-staff-row]');
        const role = row.querySelector('[data-staff-role]').value;
        const permissions = Array.from(row.querySelectorAll('[data-custom-permission]:checked')).map((input) => input.value);
        button.disabled = true;
        await api(`/admin/staff/${encodeURIComponent(id)}/permissions`, {
          method: 'PATCH',
          body: JSON.stringify({ role, permissions }),
        });
        await renderStaff(modal.querySelector('.og-mm-content'));
      }
      if (button.dataset.action === 'report-page' && lastReport) {
        await loadReport(
          modal.querySelector('.og-mm-content'),
          lastReport.type,
          lastReport.filters || {},
          Number(button.dataset.offset || 0),
        );
      }
      if (button.dataset.action === 'export-report') await exportReport();
    } catch (error) {
      window.alert(error.message || 'Could not update mobile app data.');
    }
  }

  function sectionFromPath() {
    const pathname = window.location.pathname;
    const mobileMatch = pathname.match(/\/admin\/mobile\/([^/]+)\/?$/);
    if (mobileSections.some((section) => section.id === mobileMatch?.[1])) return mobileMatch[1];
    const pageMatch = pathname.match(/\/admin\/management\/([^/]+)\/?$/);
    return sidebarPageBySlug[pageMatch?.[1]] ? pageMatch[1] : null;
  }

  function syncPage() {
    const section = sectionFromPath();
    const currentUrl = window.location.pathname + window.location.search;
    document.querySelectorAll('[data-admin-page-link]').forEach((link) => {
      const active = link.pathname + link.search === currentUrl
        || (link.dataset.adminPageLink === section && !link.search);
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      if (active) {
        const details = link.closest('details');
        if (details) details.open = true;
      }
    });
    if (section) openPanel(section);
    else if (modal) close();
  }

  function attachNavigation() {
    const nav = document.querySelector('aside nav');
    if (!nav) return;
    installStyles();
    nav.querySelectorAll(':scope > a').forEach((link) => { link.hidden = true; });
    if (nav.querySelector('[data-og-admin-nav]')) return;

    const group = document.createElement('div');
    group.dataset.ogAdminNav = 'true';

    const iconPaths = {
      main: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="14" width="6.5" height="6.5" rx="1.5"/>',
      listed: '<circle cx="12" cy="12" r="8.5"/><path d="m8 12 2.5 2.5L16.5 9"/>',
      users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M17 4.7a3.5 3.5 0 0 1 0 6.6M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35"/>',
      agent: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1.5a7 7 0 0 1 14 0V20z"/><path d="m17 5 1 1 2-2"/>',
      banner: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
      notifications: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    };
    const pageLink = (label, href, slug = '') => {
      const link = document.createElement('a');
      link.className = 'og-mm-nav-link';
      link.href = href;
      link.dataset.adminPageLink = slug;
      link.title = label;
      const iconKey = slug === 'main' ? 'main'
        : slug === 'property-listed' ? 'listed'
          : slug === 'users' ? 'users'
            : slug === 'agents' ? 'agent'
              : slug === 'banners' ? 'banner' : 'notifications';
      const icon = document.createElement('span');
      icon.className = 'og-mm-nav-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `<svg viewBox="0 0 24 24">${iconPaths[iconKey]}</svg>`;
      const caption = document.createElement('span');
      caption.className = 'og-mm-nav-label';
      caption.textContent = label;
      const chevron = document.createElement('span');
      chevron.className = 'og-mm-nav-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      link.append(icon, caption, chevron);
      if (href.startsWith('/admin/mobile/') || href.startsWith('/admin/management/')) {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          if (window.location.pathname + window.location.search !== link.pathname + link.search) history.pushState({}, '', link.pathname + link.search);
          syncPage();
        });
      }
      return link;
    };

    for (const item of sidebarItems) {
      const slug = item.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const section = mobileSections.find((page) => page.id === item.path.split('/').pop());
      group.appendChild(pageLink(item.label, item.path, section?.id || slug));
    }

    nav.appendChild(group);
    syncPage();
  }

  const observer = new MutationObserver(() => {
    attachNavigation();
    syncPage();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', syncPage);
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (link && !link.hasAttribute('data-mobile-section')) setTimeout(syncPage, 0);
  });

  async function renderReports(content, label) {
    const type = reportTypeForLabel(label);
    content.innerHTML = '<div class="og-mm-empty">Loading live report data…</div>';
    try {
      await loadReport(content, type);
    } catch (error) {
      content.innerHTML = `<div class="og-mm-error">Could not load report: ${esc(error.message)}</div>`;
    }
  }

  async function exportReport() {
    if (!lastReport || !Array.isArray(lastReport.records)) {
      window.alert('Load a report before exporting it.');
      return;
    }
    const columns = reportColumns[lastReport.type] || Object.keys(lastReport.records[0] || {});
    const csvValue = (value) => {
      let text = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
      if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const records = [];
    const filters = lastReport.filters || {};
    const total = Number(lastReport.summary?.total || 0);
    for (let offset = 0; offset < total; offset += 5000) {
      const query = new URLSearchParams({
        type: lastReport.type,
        offset: String(offset),
        limit: '5000',
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => Boolean(value))),
      });
      const page = await api(`/admin/analytics?${query}`);
      records.push(...(Array.isArray(page.records) ? page.records : []));
      if (!page.records?.length) break;
    }
    if (records.length !== total) throw new Error(`Export stopped after ${records.length} of ${total} records. Retry the export.`);
    const csv = [columns, ...records.map((record) => columns.map((key) => record[key]))]
      .map((row) => row.map(csvValue).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `og-landmark-${lastReport.type}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function renderStaff(content) {
    content.innerHTML = '<div class="og-mm-empty">Loading staff accounts and permissions…</div>';
    try {
      const payload = await api('/admin/staff');
      const staff = Array.isArray(payload.staff) ? payload.staff : [];
      const roles = payload.roles || {};
      const permissionLabels = Object.fromEntries(Object.keys(roles).flatMap((role) =>
        (roles[role].permissions || []).map((permission) => [permission, permission.replaceAll('.', ' · ')])
      ));
      const roleOptions = Object.entries(roles).map(([key, role]) => `<option value="${esc(key)}">${esc(role.label)}</option>`).join('');
      const permissionOptions = Object.entries(permissionLabels).map(([key, label]) => `<label><input type="checkbox" data-custom-permission value="${esc(key)}"> ${esc(label)}</label>`).join('');
      const rows = staff.map((member) => `<tr data-staff-row="${esc(member.id)}">
        <td><strong>${esc(member.name)}</strong><div>${esc(member.email)}</div></td>
        <td>${esc(member.status || 'Active')}</td>
        <td><select data-staff-role>${roleOptions}</select><div class="og-mm-permissions" data-custom-permissions hidden>${permissionOptions}</div></td>
        <td><div class="og-mm-row-actions"><button class="og-mm-action primary" data-action="save-staff" data-id="${esc(member.id)}">Save access</button></div></td>
      </tr>`).join('');
      content.innerHTML = `<div class="og-mm-note">Permissions are checked by the API on every protected request. Older admin accounts keep Owner access until you assign a role. Keep at least one staff account with staff-management access.</div>
        <div style="overflow:auto"><table class="og-mm-table"><thead><tr><th>Admin account</th><th>Status</th><th>Staff role and permissions</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="og-mm-empty">No admin staff accounts were returned.</td></tr>'}</tbody></table></div>`;
      for (const row of content.querySelectorAll('[data-staff-row]')) {
        const member = staff.find((item) => String(item.id) === row.dataset.staffRow);
        const selector = row.querySelector('[data-staff-role]');
        const custom = row.querySelector('[data-custom-permissions]');
        selector.value = member.staffRole || 'owner';
        custom.hidden = selector.value !== 'custom';
        row.querySelectorAll('[data-custom-permission]').forEach((checkbox) => {
          checkbox.checked = (member.permissions || []).includes(checkbox.value);
        });
        selector.addEventListener('change', () => { custom.hidden = selector.value !== 'custom'; });
      }
    } catch (error) {
      content.innerHTML = `<div class="og-mm-error">Could not load staff access: ${esc(error.message)}</div>`;
    }
  }

  const reportTypeForLabel = (label) => ({
    'User Reports': 'users',
    'Agent Reports': 'agents',
    'Lead Reports': 'leads',
    'City-wise Reports': 'properties',
    'Activity Reports': 'activity',
  })[label] || 'properties';

  async function renderSystem(content, label) {
    content.innerHTML = '<div class="og-mm-empty">Checking live service status and operational records…</div>';
    try {
      const [settings, status, logs] = await Promise.all([
        api('/admin/system/settings'),
        api('/admin/system/status'),
        api('/admin/system/logs?limit=100'),
      ]);
      const focus = ({
        'Application Logs': 'applicationLogs',
        'Activity Logs': 'activityLogs',
        'Failed Jobs': 'failedJobs',
      })[label] || 'applicationLogs';
      const values = Object.entries(status).filter(([key]) => key !== 'mediaStorage')
        .map(([key, value]) => `<div class="og-mm-system-card"><strong>${esc(key.replaceAll(/([A-Z])/g, ' $1'))}</strong><div>${esc(value)}</div></div>`).join('');
      const settingFields = [
        ['maintenanceMode', 'Maintenance mode', 'checkbox'],
        ['pushNotificationsEnabled', 'Push notifications enabled', 'checkbox'],
        ['verificationBadgeEnabled', 'Verification badges enabled', 'checkbox'],
        ['darkModeEnabled', 'Dark mode enabled', 'checkbox'],
        ['appVersion', 'Current app version', 'text'],
        ['minAppVersion', 'Minimum app version', 'text'],
        ['maintenanceMessage', 'Maintenance message', 'textarea'],
      ];
      const settingsForm = settingFields.map(([key, title, type]) => {
        if (type === 'checkbox') return `<div class="og-mm-field"><label><input type="checkbox" name="${key}" ${settings[key] ? 'checked' : ''}> ${title}</label></div>`;
        if (type === 'textarea') return `<div class="og-mm-field full"><label>${title}</label><textarea name="${key}" maxlength="500">${esc(settings[key] || '')}</textarea></div>`;
        return `<div class="og-mm-field"><label>${title}</label><input name="${key}" value="${esc(settings[key] || '')}" maxlength="40"></div>`;
      }).join('');
      const entries = Array.isArray(logs[focus]) ? logs[focus] : [];
      const columns = focus === 'applicationLogs' ? ['timestamp', 'level', 'message']
        : focus === 'activityLogs' ? ['timestamp', 'actorName', 'action', 'entity', 'details']
          : ['id', 'connection', 'queue', 'failedAt'];
      const logRows = entries.map((entry) => `<tr>${columns.map((key) => {
        const value = entry[key];
        return `<td>${esc(value && typeof value === 'object' ? JSON.stringify(value) : value ?? '—')}</td>`;
      }).join('')}</tr>`).join('');
      const failedNote = focus === 'failedJobs' && entries.length === 0
        ? '<p class="og-mm-note">No failed jobs are currently recorded. This list is backed by Laravel’s failed_jobs table when queue failure tracking is configured.</p>'
        : '';
      content.innerHTML = `<div class="og-mm-note">System health and logs are read from the running Laravel service. Secret values and full stack traces are not shown.</div>
        <h3>Live service health</h3><div class="og-mm-status ${status.status === 'ok' ? 'ok' : 'degraded'}">${esc(status.status || 'unknown')} · checked ${esc(status.checkedAt || 'just now')}</div>
        <div class="og-mm-cards">${values}<div class="og-mm-system-card"><strong>Media storage</strong><div>${esc(status.mediaStorage?.status || 'unknown')} · ${esc(status.mediaStorage?.provider || 'provider not reported')}</div></div></div>
        <form class="og-mm-form" id="og-mm-system-settings"><h3 style="margin:0 0 12px">Mobile app settings</h3><div class="og-mm-grid">${settingsForm}</div><div class="og-mm-form-actions"><button class="og-mm-action primary" type="submit">Save settings</button></div></form>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap"><h3>Operational logs</h3><select id="og-mm-log-source"><option value="applicationLogs">Application logs (${(logs.applicationLogs || []).length})</option><option value="activityLogs">Admin activity (${(logs.activityLogs || []).length})</option><option value="failedJobs">Failed jobs (${logs.failedJobs === null ? 'not configured' : (logs.failedJobs || []).length})</option></select></div>
        ${failedNote}<div style="overflow:auto"><table class="og-mm-table"><thead><tr>${columns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${logRows || `<tr><td colspan="${columns.length}" class="og-mm-empty">No records are available for this log source.</td></tr>`}</tbody></table></div>`;
      const sourceSelector = content.querySelector('#og-mm-log-source');
      sourceSelector.value = focus;
      sourceSelector.addEventListener('change', () => renderSystem(content, ({
        applicationLogs: 'API Status',
        activityLogs: 'Activity Logs',
        failedJobs: 'Failed Jobs',
      })[sourceSelector.value]));
      content.querySelector('#og-mm-system-settings').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const submit = form.querySelector('[type="submit"]');
        const payload = Object.fromEntries(new FormData(form));
        for (const field of ['maintenanceMode', 'pushNotificationsEnabled', 'verificationBadgeEnabled', 'darkModeEnabled']) {
          payload[field] = form.elements[field].checked;
        }
        submit.disabled = true;
        try {
          await api('/admin/system/settings', { method: 'PUT', body: JSON.stringify(payload) });
          await renderSystem(content, label);
        } catch (error) {
          const message = document.createElement('div');
          message.className = 'og-mm-error';
          message.textContent = error.message;
          form.prepend(message);
          submit.disabled = false;
        }
      });
    } catch (error) {
      content.innerHTML = `<div class="og-mm-error">Could not load system status or settings: ${esc(error.message)}</div>`;
    }
  }

  let lastReport = null;

  async function loadReport(content, type, filters = {}, offset = 0) {
    const query = new URLSearchParams({ type, ...filters, offset: String(offset), limit: '100' });
    const payload = await api(`/admin/analytics?${query}`);
    lastReport = payload;
    const summary = payload.summary || {};
    const records = Array.isArray(payload.records) ? payload.records : [];
    const columns = reportColumns[type] || Object.keys(records[0] || {});
    const rows = records.map((record) => `<tr>${columns.map((key) => {
      const value = record[key];
      return `<td>${esc(value && typeof value === 'object' ? JSON.stringify(value) : value ?? '—')}</td>`;
    }).join('')}</tr>`).join('');
    const startRecord = records.length ? Number(payload.offset || 0) + 1 : 0;
    const endRecord = Number(payload.offset || 0) + records.length;
    content.innerHTML = `<div class="og-mm-note">This report is generated from current API records at ${esc(payload.generatedAt || 'now')} and includes all matching records across pages.</div>
      <form class="og-mm-toolbar" id="og-mm-report-filter">
        <div class="og-mm-field"><label>Report</label><select name="type">
          ${Object.entries({ properties: 'Properties', users: 'Users', agents: 'Agents', leads: 'Leads', appointments: 'Appointments', activity: 'Admin activity' }).map(([value, label]) => `<option value="${value}" ${type === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select></div>
        <div class="og-mm-field"><label>From</label><input type="date" name="dateFrom" value="${esc(filters.dateFrom || '')}"></div>
        <div class="og-mm-field"><label>To</label><input type="date" name="dateTo" value="${esc(filters.dateTo || '')}"></div>
        <div class="og-mm-field"><label>City</label><input name="city" placeholder="Any city" value="${esc(filters.city || '')}"></div>
        <div class="og-mm-field"><label>Status</label><input name="status" placeholder="Any status" value="${esc(filters.status || '')}"></div>
        <button class="og-mm-action primary" type="submit">Apply filters</button>
        <button class="og-mm-action" type="button" data-action="export-report">Export CSV</button>
      </form>
      <div class="og-mm-cards">
        <div class="og-mm-stat"><span>Matching records</span><strong>${Number(summary.total || 0).toLocaleString()}</strong></div>
        <div class="og-mm-stat"><span>Active</span><strong>${Number(summary.active || 0).toLocaleString()}</strong></div>
        <div class="og-mm-stat"><span>Pending</span><strong>${Number(summary.pending || 0).toLocaleString()}</strong></div>
        <div class="og-mm-stat"><span>Cities represented</span><strong>${Number(summary.cities || 0).toLocaleString()}</strong></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px;color:#64748b;font-size:11px"><span>Showing ${startRecord.toLocaleString()}–${endRecord.toLocaleString()} of ${Number(summary.total || 0).toLocaleString()}</span><div class="og-mm-row-actions"><button class="og-mm-action" data-action="report-page" data-offset="${Math.max(0, Number(payload.offset || 0) - 100)}" ${Number(payload.offset || 0) <= 0 ? 'disabled' : ''}>Previous</button><button class="og-mm-action" data-action="report-page" data-offset="${Number(payload.offset || 0) + 100}" ${!payload.hasMore ? 'disabled' : ''}>Next</button></div></div>
      <div style="overflow:auto"><table class="og-mm-table"><thead><tr>${columns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${Math.max(columns.length, 1)}" class="og-mm-empty">No live records match these filters.</td></tr>`}</tbody></table></div>`;
    content.querySelector('#og-mm-report-filter').addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const nextType = values.type;
      delete values.type;
      Object.keys(values).forEach((key) => { if (!values[key]) delete values[key]; });
      content.innerHTML = '<div class="og-mm-empty">Refreshing report from live records…</div>';
      try {
        await loadReport(content, nextType, values, 0);
      } catch (error) {
        content.innerHTML = `<div class="og-mm-error">Could not load report: ${esc(error.message)}</div>`;
      }
    });
  }

  attachNavigation();
  syncPage();
})();
