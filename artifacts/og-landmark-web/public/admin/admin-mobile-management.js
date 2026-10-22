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
  let demos = [];
  let agents = [];
  let hiddenDemos = [];
  const sectionData = {};

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
      .og-mm-launch{margin-left:auto;border:1px solid #c8a45a;border-radius:8px;background:#0b1f3a;color:#fff;padding:9px 13px;font:600 12px system-ui;cursor:pointer}
      .og-mm-shade{position:fixed;inset:0;z-index:12000;background:#071526bb;display:flex;align-items:center;justify-content:center;padding:18px}
      .og-mm-box{width:min(1100px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:16px;color:#0b1f3a;box-shadow:0 24px 70px #0004;font:14px system-ui}
      .og-mm-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:17px 22px;background:white;border-bottom:1px solid #e2e8f0}
      .og-mm-head h2{font-size:19px;margin:0}.og-mm-head p{font-size:12px;color:#64748b;margin:4px 0 0}
      .og-mm-close{width:34px;height:34px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:20px;cursor:pointer}
      .og-mm-tabs{display:flex;gap:8px;padding:14px 22px 0;overflow-x:auto;white-space:nowrap}.og-mm-tab,.og-mm-action{border:1px solid #dbe2ea;border-radius:8px;padding:8px 12px;background:#fff;color:#334155;font:600 12px system-ui;cursor:pointer}
      .og-mm-tab.active{background:#0b1f3a;border-color:#0b1f3a;color:white}.og-mm-action.primary{background:#c8a45a;border-color:#c8a45a;color:#0b1f3a}
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
      .og-mm-agent-photo-status{display:block;min-height:16px;margin-top:4px;color:#64748b;font-size:11px}.og-mm-agent-photo-status.error{color:#b91c1c}.og-mm-agent-photo-status.success{color:#166534}
      @media(max-width:700px){.og-mm-grid{grid-template-columns:1fr 1fr}.og-mm-content{padding:14px}.og-mm-table th,.og-mm-table td{padding:8px 6px}.og-mm-box{max-height:96vh}}
    `;
    document.head.appendChild(style);
  }

  async function loadData() {
    const [demoData, settings, agentData] = await Promise.all([
      fetch('/admin/demo-properties.json?v=mobile-demo-catalog-20261022').then((response) => {
        if (!response.ok) throw new Error('Mobile demo catalog could not be loaded.');
        return response.json();
      }),
      api('/mobile/settings'),
      api('/admin/mobile-agents'),
    ]);
    demos = Array.isArray(demoData) ? demoData : [];
    hiddenDemos = Array.isArray(settings?.hiddenDemoPropertyIds) ? settings.hiddenDemoPropertyIds.map(Number) : [];
    agents = Array.isArray(agentData) ? agentData : [];
  }

  function openPanel() {
    installStyles();
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.className = 'og-mm-shade';
    modal.innerHTML = `<section class="og-mm-box" role="dialog" aria-modal="true" aria-label="Mobile app management">
      <header class="og-mm-head"><div><h2>Mobile app management</h2><p>Live properties, Agent profiles, user accounts, banners and notifications</p></div><button class="og-mm-close" aria-label="Close">&times;</button></header>
      <nav class="og-mm-tabs"><button class="og-mm-tab active" data-tab="demos">Demo properties</button><button class="og-mm-tab" data-tab="properties">Live properties</button><button class="og-mm-tab" data-tab="agents">Agents</button><button class="og-mm-tab" data-tab="users">Users</button><button class="og-mm-tab" data-tab="banners">Homepage banners</button><button class="og-mm-tab" data-tab="notifications">Notifications</button></nav>
      <main class="og-mm-content"><div class="og-mm-loading">Loading mobile app data…</div></main>
    </section>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('.og-mm-close')) close();
      const tab = event.target.closest('[data-tab]');
      if (tab) {
        modal.querySelectorAll('.og-mm-tab').forEach((item) => item.classList.toggle('active', item === tab));
        render(tab.dataset.tab);
      }
      const action = event.target.closest('[data-action]');
      if (action) handleAction(action);
    });
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    loadData().then(() => render('demos')).catch((error) => {
      modal.querySelector('.og-mm-content').innerHTML = `<div class="og-mm-error">${esc(error.message)}</div>`;
    });
  }

  function close() {
    modal?.remove();
    modal = null;
    document.body.style.overflow = '';
  }

  function render(tab) {
    if (!modal) return;
    const content = modal.querySelector('.og-mm-content');
    if (tab === 'agents') return renderAgents(content);
    if (tab === 'users' || tab === 'banners' || tab === 'notifications') return renderSection(tab, content);
    if (tab === 'properties') return renderProperties(content);
    renderDemos(content);
  }

  function renderDemos(content) {
    const rows = demos.map((demo) => {
      const hidden = hiddenDemos.includes(Number(demo.id));
      return `<tr><td><strong>${esc(demo.title)}</strong><div class="og-mm-muted">Demo #${demo.id} · ${esc(demo.type)}</div></td>
        <td>${esc(demo.city)}<div>${esc(demo.address)}</div></td><td>${money(demo.price)}<div>${demo.area} ${esc(demo.areaUnit)}</div></td>
        <td>${esc(demo.agent)}${demo.phone ? `<div>${esc(demo.phone)}</div>` : ''}</td>
        <td><span class="og-mm-pill ${hidden ? 'off' : ''}">${hidden ? 'Hidden in app fallback' : 'Offline fallback'}</span></td>
        <td><button class="og-mm-action ${hidden ? 'primary' : 'danger'}" data-action="demo" data-id="${demo.id}">${hidden ? 'Restore' : 'Hide'}</button></td></tr>`;
    }).join('');
    content.innerHTML = `<div class="og-mm-note"><strong>${demos.length} bundled demo listings.</strong> These are mobile offline-fallback examples, not customer listings. Hide/restore uses the same visibility setting as the mobile Admin Demos tab; demo content itself stays bundled in the app.</div>
      <div style="overflow:auto"><table class="og-mm-table"><thead><tr><th>Property</th><th>Location</th><th>Price / area</th><th>Demo agent</th><th>Mobile visibility</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderAgents(content) {
    const rows = agents.map((agent) => `<tr>
      <td><strong>${esc(agent.displayName || agent.name || 'Unnamed agent')}</strong><div>${esc(agent.agency || agent.specialization || 'Independent')}</div></td>
      <td>${esc(agent.city || '—')}<div>${esc(agent.phone || '')}</div></td>
      <td>${esc(agent.email || agent.loginEmail || '—')}</td>
      <td><span class="og-mm-pill ${agent.status === 'Suspended' || agent.visible === false ? 'off' : ''}">${esc(agent.status || 'Active')}${agent.visible === false ? ' · Hidden' : ''}</span></td>
      <td><div class="og-mm-row-actions"><button class="og-mm-action" data-action="edit-agent" data-id="${esc(agent.id)}">Edit</button><button class="og-mm-action danger" data-action="delete-agent" data-id="${esc(agent.id)}">Remove</button></div></td></tr>`).join('');
    content.innerHTML = `<div class="og-mm-note">Agent directory profiles shown in the mobile app. Adding or removing a profile does not create or delete its separate sign-in account.</div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="og-mm-action primary" data-action="add-agent">Add mobile Agent</button></div>
      <div id="og-mm-agent-form-wrap"></div>
      <div style="overflow:auto"><table class="og-mm-table"><thead><tr><th>Agent</th><th>City / phone</th><th>Email</th><th>App status</th><th>Actions</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="og-mm-empty">No mobile Agent profiles yet.</td></tr>'}</tbody></table></div>`;
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
      content.innerHTML = `<div class="og-mm-note">${esc(config.title)} — live records loaded from the production API. Changes take effect in the mobile app.</div>
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
      && !(type === 'file' && key === 'banners' && editing)
    ));
    wrap.innerHTML = `<form class="og-mm-form" id="og-mm-record-form-inner"><h3 style="margin:0 0 12px">${editing ? 'Edit' : 'Add'} ${esc(config.title)}</h3><div class="og-mm-grid">
      ${fields.map(([name, label, type = 'text', options = [], accept]) => {
        let value = item[name] ?? '';
        if (key === 'notifications' && name === 'audienceRole') value = item.audience?.role || 'all';
        if (key === 'notifications' && name === 'audienceCity') value = item.audience?.city || '';
        const full = type === 'textarea' ? ' full' : '';
        if (type === 'readonly') return `<div class="og-mm-field"><label>${esc(label)}</label><input disabled value="${esc(value)}"></div>`;
        if (type === 'checkbox') return `<div class="og-mm-field${full}"><label><input type="checkbox" name="${esc(name)}" ${(name === 'sendNow' ? Boolean(value) : value !== false) ? 'checked' : ''}> ${esc(label)}</label></div>`;
        if (type === 'file') return `<div class="og-mm-field"><label>${esc(label)}</label><input name="${esc(name)}" type="file" accept="${esc(accept || '')}"><small>Image: JPG/PNG/WebP up to 20 MiB; video: MP4/MOV up to 300 MiB.</small></div>`;
        if (type === 'select') return `<div class="og-mm-field"><label>${esc(label)}</label><select name="${esc(name)}">${options.map((option) => `<option value="${esc(option)}" ${String(value).toLowerCase() === option.toLowerCase() ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></div>`;
        if (type === 'textarea') return `<div class="og-mm-field full"><label>${esc(label)}</label><textarea name="${esc(name)}" maxlength="6000">${esc(value)}</textarea></div>`;
        return `<div class="og-mm-field"><label>${esc(label)}</label><input name="${esc(name)}" type="${esc(type)}" ${type === 'number' ? 'step="any"' : ''} value="${esc(value)}"></div>`;
      }).join('')}
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
            await api(`${config.createPath || config.list}/${encodeURIComponent(item.id)}`, { method: key === 'properties' ? 'PATCH' : 'PUT', body });
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
        await api(agent.id ? `/admin/mobile-agents/${encodeURIComponent(agent.id)}` : '/admin/mobile-agents', {
          method: agent.id ? 'PUT' : 'POST', body: JSON.stringify(payload),
        });
        agents = await api('/admin/mobile-agents');
        renderAgents(modal.querySelector('.og-mm-content'));
      } catch (error) {
        const message = document.createElement('div');
        message.className = 'og-mm-error'; message.textContent = error.message || 'Could not save Agent profile.';
        form.prepend(message); submit.disabled = false;
      }
    });
  }

  async function handleAction(button) {
    const id = button.dataset.id;
    try {
      if (button.dataset.action === 'demo') {
        const hide = !hiddenDemos.includes(Number(id));
        if (!window.confirm(`${hide ? 'Hide' : 'Restore'} this demo property in the mobile offline fallback? Customer listings will not be affected.`)) return;
        const result = await api('/admin/demo-properties', { method: 'PATCH', body: JSON.stringify({ ids: [Number(id)], hidden: hide }) });
        hiddenDemos = result.hiddenDemoPropertyIds || [];
        renderDemos(modal.querySelector('.og-mm-content'));
      }
      if (button.dataset.action === 'add-agent') showAgentForm();
      if (button.dataset.action === 'edit-agent') {
        const agent = agents.find((item) => String(item.id) === String(id));
        if (agent) showAgentForm(agent);
      }
      if (button.dataset.action === 'cancel-form') renderAgents(modal.querySelector('.og-mm-content'));
      if (button.dataset.action === 'delete-agent') {
        const agent = agents.find((item) => String(item.id) === String(id));
        if (!agent || !window.confirm(`Remove “${agent.displayName || agent.name || 'this Agent'}” from the mobile app directory? Its separate login account will remain.`)) return;
        await api(`/admin/mobile-agents/${encodeURIComponent(id)}`, { method: 'DELETE' });
        agents = await api('/admin/mobile-agents');
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
        const warning = section === 'users'
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

  function attachButton() {
    const heading = [...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'Property review queue');
    const row = heading?.parentElement;
    if (!row || row.querySelector('.og-mm-launch')) return;
    const button = document.createElement('button');
    button.className = 'og-mm-launch';
    button.type = 'button';
    button.textContent = 'Manage mobile app';
    button.addEventListener('click', openPanel);
    row.appendChild(button);
  }

  const observer = new MutationObserver(attachButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  attachButton();
})();
