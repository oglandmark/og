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
  let agents = [];
  const sectionData = {};
  const mobileSections = [
    { id: 'properties', label: 'Live properties' },
    { id: 'agents', label: 'Agents' },
    { id: 'users', label: 'Users' },
    { id: 'banners', label: 'Homepage banners' },
    { id: 'notifications', label: 'Notifications' },
  ];
  const sidebarGroups = [
    { label: 'Dashboard', items: ['Dashboard Overview'] },
    { label: 'Property Management', items: ['All Properties', 'Add Property', 'Pending Approvals', 'Active Properties', 'Featured Properties', 'Expired Listings', 'Archived Properties', 'Sold Properties', 'Rented Properties', 'Property Categories', 'Property Types', 'Property Amenities', 'Property Verification'] },
    { label: 'Projects Management', items: ['All Projects', 'Add New Project', 'Project Approvals', 'Featured Projects', 'Project Categories', 'Project Status'] },
    { label: 'Users Management', items: ['All Users', 'Active Users', 'Suspended Users', 'Blocked Users', 'User Verification', 'User Activity'] },
    { label: 'Agents Management', items: ['All Agents', 'Add Agent', 'Pending Agent Approvals', 'Agent Verification', 'Agent Properties', 'Agent Performance', 'Agent Reviews'] },
    { label: 'Leads & Inquiries', items: ['All Leads', 'New Inquiries', 'Property Inquiries', 'Buyer Leads', 'Seller Leads', 'Rental Inquiries', 'Assign Leads', 'Follow-ups', 'Converted Leads', 'Lost Leads'] },
    { label: 'Locations Management', items: ['Provinces', 'Districts', 'Cities', 'Tehsils', 'Areas', 'Housing Societies', 'Blocks & Sectors'] },
    { label: 'Site Visits & Appointments', items: ['All Appointments', 'Pending Requests', 'Confirmed Visits', 'Completed Visits', 'Cancelled Appointments'] },
    { label: 'Marketing & Content', items: ['Homepage Banners', 'Featured Properties', 'Featured Projects', 'Blog & News', 'FAQs', 'Static Pages', 'SEO Settings'] },
    { label: 'Reviews & Complaints', items: ['All Reviews', 'Property Reviews', 'Agent Reviews', 'Reported Listings', 'User Complaints'] },
    { label: 'Notifications', items: ['Notifications Overview', 'Push Notification History', 'Email Notification Logs', 'SMS Notification Logs'] },
    { label: 'Support Management', items: ['Support Tickets', 'Open Tickets', 'In-Progress Tickets', 'Resolved Tickets', 'Closed Tickets'] },
    { label: 'Reports & Analytics', items: ['Dashboard Statistics', 'Property Reports', 'User Reports', 'Agent Reports', 'Lead Reports', 'City-wise Reports', 'Activity Reports', 'Export Reports'] },
    { label: 'Staff & Permissions', items: ['Admin Users', 'Staff Accounts', 'Roles Management', 'Permissions Management', 'Access Control'] },
    { label: 'System Settings', items: ['Admin Profile', 'General Settings', 'File Storage Status', 'API Status', 'Application Logs', 'Failed Jobs', 'Activity Logs'] },
  ];
  const slugify = (value) => value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existingPagePaths = {
    'Dashboard Overview': '/admin/',
    'All Properties': '/admin/properties',
    'All Users': '/admin/users',
    'All Leads': '/admin/inquiries',
    'All Agents': '/admin/mobile/agents',
    'Add Agent': '/admin/mobile/agents?create=agent',
    'Homepage Banners': '/admin/mobile/banners',
    'Notifications Overview': '/admin/mobile/notifications',
    'Push Notification History': '/admin/mobile/notifications',
    'Dashboard Statistics': '/admin/',
  };
  const sidebarPages = sidebarGroups.flatMap((group) => group.items.map((label) => ({
    group: group.label,
    label,
    slug: `${slugify(group.label)}-${slugify(label)}`,
    path: existingPagePaths[label] || `/admin/management/${slugify(group.label)}-${slugify(label)}`,
  })));
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
      .og-mm-nav-title{margin:14px 12px 6px;padding-top:13px;border-top:1px solid #ffffff24;color:#94a3b8;font:700 10px system-ui;letter-spacing:.1em;text-transform:uppercase}
      .og-mm-nav-link{display:flex;align-items:center;gap:10px;margin:2px 4px;padding:9px 10px;border-radius:8px;color:#cbd5e1;text-decoration:none;font:500 12px system-ui;transition:background .15s,color .15s}
      .og-mm-nav-link:hover,.og-mm-nav-link.active{background:#ffffff14;color:#fff}
      .og-mm-nav-link.active{box-shadow:inset 2px 0 #c8a45a}
      .og-mm-nav-details{margin:3px 4px 0;color:#cbd5e1}
      .og-mm-nav-details>summary{padding:9px 10px;border-radius:8px;cursor:pointer;list-style:none;font:600 11px system-ui}
      .og-mm-nav-details>summary::-webkit-details-marker{display:none}
      .og-mm-nav-details>summary:after{content:'⌄';float:right;color:#94a3b8}
      .og-mm-nav-details[open]>summary:after{content:'⌃'}
      .og-mm-nav-details>summary:hover{background:#ffffff10;color:#fff}
      .og-mm-nav-children{margin-left:8px;padding-left:5px;border-left:1px solid #ffffff24}
      .og-mm-page{position:fixed;inset:0 0 0 var(--og-mm-sidebar-width,240px);z-index:30;overflow:auto;background:#f0f4f8}
      .og-mm-box{min-height:100%;background:#fff;color:#0b1f3a;font:14px system-ui}
      .og-mm-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:17px 22px;background:white;border-bottom:1px solid #e2e8f0}
      .og-mm-head h2{font-size:19px;margin:0}.og-mm-head p{font-size:12px;color:#64748b;margin:4px 0 0}
      .og-mm-action{border:1px solid #dbe2ea;border-radius:8px;padding:8px 12px;background:#fff;color:#334155;font:600 12px system-ui;cursor:pointer}
      .og-mm-action.primary{background:#c8a45a;border-color:#c8a45a;color:#0b1f3a}
      .og-mm-content{padding:16px 22px 22px}.og-mm-note{padding:10px 12px;margin-bottom:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;color:#64748b;font-size:12px}
      .og-mm-table{width:100%;border-collapse:collapse}.og-mm-table th,.og-mm-table td{text-align:left;padding:11px 10px;border-bottom:1px solid #edf1f5;font-size:12px;vertical-align:top}.og-mm-table th{color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
      .og-mm-pill{display:inline-flex;padding:4px 8px;border-radius:999px;background:#dcfce7;color:#166534;font-size:10px;font-weight:700}.og-mm-pill.off{background:#f1f5f9;color:#64748b}
      .og-mm-row-actions{display:flex;gap:6px;white-space:nowrap}.og-mm-action.danger{color:#b91c1c;border-color:#fecaca}
      .og-mm-empty,.og-mm-error{padding:20px;text-align:center;color:#64748b}.og-mm-error{color:#b91c1c}
      .og-mm-form{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:16px;background:#f8fafc}
      .og-mm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .og-mm-field{display:flex;flex-direction:column;gap:5px}.og-mm-field.full{grid-column:1/-1}.og-mm-field label{font-size:11px;font-weight:700;color:#475569}
      .og-mm-field input,.og-mm-field textarea,.og-mm-field select{box-sizing:border-box;width:100%;border:1px solid #cbd5e1;border-radius:7px;padding:8px;background:#fff;color:#0f172a;font:12px system-ui}
      .og-mm-field textarea{min-height:66px;resize:vertical}.og-mm-form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}
      .og-mm-agent-photo-preview{display:flex;align-items:center;gap:10px;margin-top:8px}.og-mm-agent-photo-preview img{width:72px;height:72px;object-fit:cover;border:1px solid #cbd5e1;border-radius:50%;background:#f1f5f9}.og-mm-agent-photo-preview span{color:#64748b;font-size:11px}
      .og-mm-agent-list-photo{display:flex;align-items:center;justify-content:center;width:40px;height:40px;overflow:hidden;border:1px solid #e2e8f0;border-radius:50%;background:#f8fafc;color:#64748b;font-size:9px;text-align:center;line-height:1.15}
      .og-mm-agent-list-photo img{display:block;width:100%;height:100%;object-fit:cover}.og-mm-agent-list-photo-fallback{padding:3px}
      .og-mm-agent-photo-status{display:block;min-height:16px;margin-top:4px;color:#64748b;font-size:11px}.og-mm-agent-photo-status.error{color:#b91c1c}.og-mm-agent-photo-status.success{color:#166534}
      @media(max-width:700px){.og-mm-page{inset:0}.og-mm-grid{grid-template-columns:1fr 1fr}.og-mm-content{padding:14px}.og-mm-table th,.og-mm-table td{padding:8px 6px}}
    `;
    document.head.appendChild(style);
  }

  async function loadData() {
    const [websiteAgents, mobileAgents] = await Promise.all([
      api('/admin/city-agents'),
      api('/admin/mobile-agents'),
    ]);
    const merged = new Map();
    for (const [collection, records] of [
      ['city-agents', Array.isArray(websiteAgents) ? websiteAgents : []],
      ['mobile-agents', Array.isArray(mobileAgents) ? mobileAgents : []],
    ]) {
      for (const record of records) {
        const phone = String(record.phone || record.mobile || '').replace(/\D/g, '');
        const normalizedPhone = phone.length === 12 && phone.startsWith('92') ? `0${phone.slice(2)}`
          : phone.length === 10 && phone.startsWith('3') ? `0${phone}` : phone;
        const email = String(record.email || record.loginEmail || '').trim().toLowerCase();
        const userId = String(record.userId || record.accountId || '').trim();
        const identity = userId ? `user:${userId}` : email ? `email:${email}` : normalizedPhone ? `phone:${normalizedPhone}` : `${collection}:${record.id}`;
        const existing = merged.get(identity);
        if (existing) {
          Object.assign(existing, Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== '')));
          existing.directorySources.push({ collection, id: record.id });
        } else {
          merged.set(identity, { ...record, directorySources: [{ collection, id: record.id }] });
        }
      }
    }
    agents = Array.from(merged.values());
  }

  function openPanel(tab) {
    installStyles();
    if (modal?.dataset.section === tab) {
      if (tab === 'agents' && new URLSearchParams(window.location.search).get('create') === 'agent' && !modal.querySelector('#og-mm-agent-form')) showAgentForm();
      return;
    }
    if (modal) modal.remove();
    const activeSection = mobileSections.find((section) => section.id === tab) || sidebarPageBySlug[tab] || { label: 'Admin section' };
    const sidebarWidth = document.querySelector('aside')?.getBoundingClientRect().width || 240;
    document.documentElement.style.setProperty('--og-mm-sidebar-width', `${sidebarWidth}px`);
    modal = document.createElement('div');
    modal.className = 'og-mm-page';
    modal.dataset.section = activeSection.id;
    modal.innerHTML = `<section class="og-mm-box" aria-label="${esc(activeSection.label)}">
      <header class="og-mm-head"><div><h2>${esc(activeSection.label)}</h2><p>${mobileSections.some((section) => section.id === tab) ? 'Manage the shared Admin data used by the website and mobile app.' : 'This menu is ready; its data workflow has not been connected yet.'}</p></div></header>
      <main class="og-mm-content"><div class="og-mm-loading">Loading mobile app data…</div></main>
    </section>`;
    modal.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]');
      if (action) handleAction(action);
    });
    document.body.appendChild(modal);
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
  }

  function render(tab) {
    if (!modal) return;
    const content = modal.querySelector('.og-mm-content');
    if (tab === 'agents') return renderAgents(content);
    if (tab === 'users' || tab === 'banners' || tab === 'notifications') return renderSection(tab, content);
    if (tab === 'properties') return renderProperties(content);
    const page = sidebarPageBySlug[tab];
    const serviceAreas = page?.label === 'Cities'
      ? '<p>Service areas: Okara, Depalpur, Renala Khurd, Hujra Shah Muqeem, Basir Pur, and Haveli Lakha.</p>'
      : '';
    content.innerHTML = `<div class="og-mm-empty"><h3>${esc(page?.label || 'Page not found')}</h3><p>This navigation item does not have a connected management workflow yet.</p>${serviceAreas}</div>`;
  }

  function renderAgents(content) {
    const rows = agents.map((agent) => {
      const name = agent.displayName || agent.name || 'Unnamed agent';
      const photo = agent.photo || agent.profilePhoto;
      const photoCell = photo
        ? `<span class="og-mm-agent-list-photo"><img data-agent-list-photo src="${esc(photo)}" alt="${esc(`${name} profile photo`)}" loading="lazy" decoding="async"><span class="og-mm-agent-list-photo-fallback" data-agent-photo-fallback hidden>Photo unavailable</span></span>`
        : '<span class="og-mm-agent-list-photo og-mm-agent-list-photo-fallback">No photo</span>';
      const sourceLabel = agent.directorySources?.length > 1 ? 'Website + Mobile' : agent.directorySources?.[0]?.collection === 'city-agents' ? 'Website' : 'Mobile';
      return `<tr>
      <td>${photoCell}</td>
      <td><strong>${esc(name)}</strong><div>${esc(agent.agency || agent.specialization || 'Independent')} · ${esc(sourceLabel)}</div></td>
      <td>${esc(agent.city || '—')}<div>${esc(agent.phone || '')}</div></td>
      <td>${esc(agent.email || agent.loginEmail || '—')}</td>
      <td><span class="og-mm-pill ${agent.status === 'Suspended' || agent.visible === false ? 'off' : ''}">${esc(agent.status || 'Active')}${agent.visible === false ? ' · Hidden' : ''}</span></td>
      <td><div class="og-mm-row-actions"><button class="og-mm-action" data-action="edit-agent" data-index="${agents.indexOf(agent)}">Edit</button><button class="og-mm-action danger" data-action="delete-agent" data-index="${agents.indexOf(agent)}">Remove</button></div></td></tr>`;
    }).join('');
    content.innerHTML = `<div class="og-mm-note">Agent directory profiles shown in the mobile app. Adding or removing a profile does not create or delete its separate sign-in account.</div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="og-mm-action primary" data-action="add-agent">Add mobile Agent</button></div>
      <div id="og-mm-agent-form-wrap"></div>
      <div style="overflow:auto"><table class="og-mm-table"><thead><tr><th>Photo</th><th>Agent</th><th>City / phone</th><th>Email</th><th>Directory status</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="og-mm-empty">No Agent profiles found in either directory.</td></tr>'}</tbody></table></div>`;
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
        ['order', 'Sort order', 'number'], ['active', 'Visible in app', 'checkbox'],
      ],
      row: (item) => `<td><strong>${esc(item.title || item.eyebrow || 'Untitled')}</strong><div>${esc(item.type || 'image')}</div></td><td>${esc(item.category || '—')}</td><td>${esc(item.order ?? '—')}</td><td>${item.active === false ? 'Hidden' : 'Live'}</td>`,
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
  };

  async function renderProperties(content) { return renderSection('properties', content); }

  async function renderSection(key, content) {
    const config = sectionConfig[key];
    content.innerHTML = '<div class="og-mm-empty">Loading live production records…</div>';
    try {
      const result = await api(config.list);
      const items = Array.isArray(result) ? result : (Array.isArray(result?.items) ? result.items : []);
      sectionData[key] = items;
      const colspan = key === 'properties' || key === 'users' ? 5 : 5;
      const rows = items.map((item) => `<tr>${config.row(item)}<td><div class="og-mm-row-actions">
        ${key === 'notifications' && item.status !== 'sent' ? `<button class="og-mm-action primary" data-action="send-announcement" data-section="${key}" data-id="${esc(item.id)}">Send</button>` : ''}
        <button class="og-mm-action" data-action="edit-record" data-section="${key}" data-id="${esc(item.id)}">Edit</button>
        <button class="og-mm-action danger" data-action="delete-record" data-section="${key}" data-id="${esc(item.id)}">Delete</button>
      </div></td></tr>`).join('');
      const addButton = config.createPath ? `<button class="og-mm-action primary" data-action="add-record" data-section="${key}">Add new</button>` : '';
      const columns = key === 'properties' ? ['Property', 'City', 'Price', 'Status', 'Actions']
        : key === 'users' ? ['Account', 'Phone', 'Role', 'Status', 'Actions']
          : key === 'banners' ? ['Banner', 'Category', 'Order', 'Visibility', 'Actions']
            : ['Notification', 'Status', 'Recipients', 'Created', 'Actions'];
      content.innerHTML = `<div class="og-mm-note">${esc(config.title)} — live records loaded from the shared Admin API used by the website and mobile app.</div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">${addButton}</div><div id="og-mm-record-form"></div>
        <div style="overflow:auto"><table class="og-mm-table"><thead><tr>${columns.map((name) => `<th>${name}</th>`).join('')}</tr></thead>
        <tbody>${rows || `<tr><td colspan="${colspan}" class="og-mm-empty">No records found.</td></tr>`}</tbody></table></div>`;
    } catch (error) {
      content.innerHTML = `<div class="og-mm-error">Could not load live records: ${esc(error.message)}</div>`;
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
    wrap.innerHTML = `<form class="og-mm-form" id="og-mm-record-form-inner"><h3 style="margin:0 0 12px">${editing ? 'Edit' : 'Add'} ${esc(config.title)}</h3><div class="og-mm-grid">
      ${fields.map(([name, label, type = 'text', options = [], accept]) => {
        let value = item[name] ?? '';
        if (key === 'notifications' && name === 'audienceRole') value = item.audience?.role || 'all';
        if (key === 'notifications' && name === 'audienceCity') value = item.audience?.city || '';
        const full = type === 'textarea' ? ' full' : '';
        if (type === 'readonly') return `<div class="og-mm-field"><label>${esc(label)}</label><input disabled value="${esc(value)}"></div>`;
        if (type === 'checkbox') return `<div class="og-mm-field${full}"><label><input type="checkbox" name="${esc(name)}" ${(name === 'sendNow' ? Boolean(value) : value !== false) ? 'checked' : ''}> ${esc(label)}</label></div>`;
        if (type === 'file') {
          const bannerAccept = key === 'banners' && editing
            ? (item.type === 'video' ? '.mp4,.mov' : '.jpg,.jpeg,.png,.webp')
            : accept;
          const fileLabel = key === 'banners' && editing ? 'Replace media file (optional)' : label;
          return `<div class="og-mm-field"><label>${esc(fileLabel)}</label><input name="${esc(name)}" type="file" accept="${esc(bannerAccept || '')}"><small>Image: JPG/PNG/WebP up to 20 MiB; video: MP4/MOV up to 300 MiB.</small></div>`;
        }
        if (type === 'select') return `<div class="og-mm-field"><label>${esc(label)}</label><select name="${esc(name)}">${options.map((option) => `<option value="${esc(option)}" ${String(value).toLowerCase() === option.toLowerCase() ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></div>`;
        if (type === 'textarea') return `<div class="og-mm-field full"><label>${esc(label)}</label><textarea name="${esc(name)}" maxlength="6000">${esc(value)}</textarea></div>`;
        return `<div class="og-mm-field"><label>${esc(label)}</label><input name="${esc(name)}" type="${esc(type)}" ${type === 'number' ? 'step="any"' : ''} value="${esc(value)}"></div>`;
      }).join('')}${currentMediaPreview}
    </div><div class="og-mm-form-actions"><button type="button" class="og-mm-action" data-action="cancel-record" data-section="${key}">Cancel</button><button class="og-mm-action primary" type="submit">Save</button></div></form>`;
    wrap.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      const payload = { ...data };
      for (const [name, , type] of config.fields) {
        if (type === 'checkbox') payload[name] = form.elements[name].checked;
        if (type === 'number' && data[name] !== undefined && data[name] !== '') payload[name] = Number(data[name]);
      }
      if (key === 'notifications') {
        payload.audience = { role: payload.audienceRole || 'all', city: payload.audienceCity || '' };
        payload.sendNow = Boolean(payload.sendNow);
        delete payload.audienceRole; delete payload.audienceCity;
      }
      if (key === 'banners' && !editing) payload.active = payload.active !== false;
      if (key === 'users' && editing) delete payload.password;
      delete payload.media;
      try {
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
      <h3 style="margin:0 0 12px">${agent.id ? 'Edit mobile Agent profile' : 'Add mobile Agent profile'}</h3>
      <div class="og-mm-grid">
        <div class="og-mm-field"><label>Agent name *</label><input name="name" required maxlength="120" value="${esc(agent.displayName || agent.name || '')}"></div>
        <div class="og-mm-field"><label>Agency</label><input name="agency" maxlength="120" value="${esc(agent.agency || '')}"></div>
        <div class="og-mm-field"><label>City</label><input name="city" maxlength="120" value="${esc(agent.city || '')}"></div>
        <div class="og-mm-field"><label>Phone</label><input name="phone" maxlength="40" value="${esc(agent.phone || '')}"></div>
        <div class="og-mm-field"><label>Email</label><input name="email" type="email" maxlength="160" value="${esc(agent.email || agent.loginEmail || '')}"></div>
        <div class="og-mm-field"><label>Years of experience</label><input name="years" type="number" min="0" max="80" value="${esc(agent.years || 0)}"></div>
        <div class="og-mm-field"><label>Profile photo URL</label><input name="photo" type="url" maxlength="2000" value="${esc(agent.photo || agent.profilePhoto || '')}"><div class="og-mm-agent-photo-preview"><img data-agent-photo-preview alt="Agent profile photo preview" hidden><span data-agent-photo-empty>${agent.photo || agent.profilePhoto ? '' : 'No profile photo selected.'}</span></div><label for="og-mm-agent-photo-upload">Upload photo</label><input id="og-mm-agent-photo-upload" name="photoUpload" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"><small>JPG, PNG or WebP up to 20 MiB.</small><span class="og-mm-agent-photo-status" data-agent-photo-status aria-live="polite"></span></div>
        <div class="og-mm-field"><label>Profile status</label><select name="status"><option ${agent.status !== 'Suspended' ? 'selected' : ''}>Active</option><option ${agent.status === 'Suspended' ? 'selected' : ''}>Suspended</option></select></div>
        <div class="og-mm-field"><label>Approval</label><select name="approvalStatus"><option ${agent.approvalStatus !== 'Pending' && agent.approvalStatus !== 'Rejected' ? 'selected' : ''}>Approved</option><option ${agent.approvalStatus === 'Pending' ? 'selected' : ''}>Pending</option><option ${agent.approvalStatus === 'Rejected' ? 'selected' : ''}>Rejected</option></select></div>
        <div class="og-mm-field full"><label>Service areas (comma separated)</label><input name="areas" value="${esc((agent.areas || []).join(', '))}"></div>
        <div class="og-mm-field full"><label>Specialties (comma separated)</label><input name="specialties" value="${esc((agent.specialties || []).join(', '))}"></div>
        <div class="og-mm-field full"><label>About</label><textarea name="about" maxlength="2000">${esc(agent.about || '')}</textarea></div>
        <div class="og-mm-field"><label><input type="checkbox" name="visible" ${agent.visible !== false ? 'checked' : ''}> Visible in mobile app</label></div>
      </div><div class="og-mm-form-actions"><button type="button" class="og-mm-action" data-action="cancel-form">Cancel</button><button class="og-mm-action primary" type="submit">Save Agent</button></div>
    </form>`;
    const form = wrap.querySelector('form');
    const photoUrlInput = form.elements.photo;
    const photoUploadInput = form.elements.photoUpload;
    const photoPreview = form.querySelector('[data-agent-photo-preview]');
    const photoEmpty = form.querySelector('[data-agent-photo-empty]');
    const photoStatus = form.querySelector('[data-agent-photo-status]');
    let photoUploadInProgress = false;
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
    showPhotoPreview(photoUrlInput.value);
    photoUrlInput.addEventListener('input', () => showPhotoPreview(photoUrlInput.value.trim()));
    photoPreview.addEventListener('error', () => {
      photoPreview.hidden = true;
      photoEmpty.hidden = false;
      photoEmpty.textContent = 'Photo preview unavailable.';
    });
    photoUploadInput.addEventListener('change', async () => {
      const file = photoUploadInput.files?.[0];
      if (!file) return;
      const previousPhotoUrl = photoUrlInput.value;
      if (file.size > 20 * 1024 * 1024) {
        photoStatus.className = 'og-mm-agent-photo-status error';
        photoStatus.textContent = 'Choose an image no larger than 20 MiB.';
        photoUploadInput.value = '';
        return;
      }
      if (!/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
        photoStatus.className = 'og-mm-agent-photo-status error';
        photoStatus.textContent = 'Choose a JPG, PNG or WebP image.';
        photoUploadInput.value = '';
        return;
      }
      const localPreviewUrl = URL.createObjectURL(file);
      showPhotoPreview(localPreviewUrl);
      photoStatus.className = 'og-mm-agent-photo-status';
      photoStatus.textContent = 'Uploading photo…';
      photoUploadInProgress = true;
      photoUploadInput.disabled = true;
      form.querySelector('[type="submit"]').disabled = true;
      try {
        const formData = new FormData();
        formData.append('image', file);
        const uploaded = await api('/upload/single', { method: 'POST', body: formData });
        if (typeof uploaded?.url !== 'string' || !uploaded.url.trim()) {
          throw new Error('The server did not return an uploaded photo URL.');
        }
        photoUrlInput.value = uploaded.url.trim();
        showPhotoPreview(photoUrlInput.value);
        photoStatus.className = 'og-mm-agent-photo-status success';
        photoStatus.textContent = 'Photo uploaded. Save the profile to apply it.';
      } catch (error) {
        showPhotoPreview(previousPhotoUrl);
        photoStatus.className = 'og-mm-agent-photo-status error';
        photoStatus.textContent = error.message || 'Could not upload photo.';
        photoUploadInput.value = '';
      } finally {
        URL.revokeObjectURL(localPreviewUrl);
        photoUploadInProgress = false;
        photoUploadInput.disabled = false;
        form.querySelector('[type="submit"]').disabled = false;
      }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      if (photoUploadInProgress) {
        photoStatus.className = 'og-mm-agent-photo-status error';
        photoStatus.textContent = 'Wait for the photo upload to finish before saving.';
        return;
      }
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      const payload = {
        name: String(data.name || '').trim(), displayName: String(data.name || '').trim(),
        agency: String(data.agency || '').trim(), city: String(data.city || '').trim(),
        phone: String(data.phone || '').trim(), email: String(data.email || '').trim(),
        years: Number(data.years) || 0, photo: String(data.photo || '').trim() || null,
        profilePhoto: String(data.photo || '').trim() || null,
        areas: String(data.areas || '').split(',').map((item) => item.trim()).filter(Boolean),
        specialties: String(data.specialties || '').split(',').map((item) => item.trim()).filter(Boolean),
        about: String(data.about || '').trim(), status: data.status,
        approvalStatus: data.approvalStatus, visible: form.elements.visible.checked,
      };
      try {
        const sources = agent?.directorySources || [];
        if (sources.length) {
          await Promise.all(sources.map(({ collection, id }) => api(`/admin/${collection}/${encodeURIComponent(id)}`, {
            method: 'PUT', body: JSON.stringify(payload),
          })));
        } else {
          await api('/admin/city-agents', { method: 'POST', body: JSON.stringify(payload) });
        }
        await loadData();
        renderAgents(modal.querySelector('.og-mm-content'));
      } catch (error) {
        const message = document.createElement('div');
        message.className = 'og-mm-error'; message.textContent = error.message || 'Could not save Agent profile.';
        form.prepend(message); submit.disabled = false;
      }
    });
  }

  async function handleAction(button) {
    try {
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
      if (button.dataset.action === 'delete-record') {
        const config = sectionConfig[section];
        const item = (sectionData[section] || []).find((record) => String(record.id) === String(id));
        if (!item) return;
        const label = item.title || item.name || item.email || `record ${id}`;
        const warning = section === 'banners'
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
    nav.querySelectorAll(':scope > a').forEach((link) => { link.hidden = true; });
    if (nav.querySelector('[data-og-admin-nav]')) return;

    const group = document.createElement('div');
    group.dataset.ogAdminNav = 'true';

    const pageLink = (label, href, slug = '') => {
      const link = document.createElement('a');
      link.className = 'og-mm-nav-link';
      link.href = href;
      link.textContent = label;
      link.dataset.adminPageLink = slug;
      if (href.startsWith('/admin/mobile/') || href.startsWith('/admin/management/')) {
        link.addEventListener('click', (event) => {
          event.preventDefault();
          if (window.location.pathname + window.location.search !== link.pathname + link.search) history.pushState({}, '', link.pathname + link.search);
          syncPage();
        });
      }
      return link;
    };

    const dashboard = sidebarPages.find((page) => page.label === 'Dashboard Overview');
    group.appendChild(pageLink(dashboard.label, dashboard.path, dashboard.slug));

    for (const sidebarGroup of sidebarGroups) {
      if (sidebarGroup.label === 'Dashboard') continue;
      const details = document.createElement('details');
      details.className = 'og-mm-nav-details';
      const summary = document.createElement('summary');
      summary.textContent = sidebarGroup.label;
      details.appendChild(summary);
      const children = document.createElement('div');
      children.className = 'og-mm-nav-children';

      for (const label of sidebarGroup.items) {
        if (sidebarGroup.label === 'Dashboard' && label === 'Dashboard Overview') continue;
        const page = sidebarPages.find((item) => item.group === sidebarGroup.label && item.label === label);
        if (!page) continue;
        let href = page.path;
        let slug = page.slug;
        if (label === 'All Agents') {
          href = '/admin/mobile/agents';
          slug = 'agents';
        } else if (label === 'Add Agent') {
          href = '/admin/mobile/agents?create=agent';
          slug = 'agents';
        } else if (label === 'Homepage Banners') {
          href = '/admin/mobile/banners';
          slug = 'banners';
        } else if (label === 'Notifications Overview' || label === 'Push Notification History') {
          href = '/admin/mobile/notifications';
          slug = 'notifications';
        }
        children.appendChild(pageLink(label, href, slug));
      }
      details.appendChild(children);
      details.dataset.sidebarGroup = sidebarGroup.label;
      group.appendChild(details);
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
  attachNavigation();
  syncPage();
})();
