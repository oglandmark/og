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

  async function api(path, options = {}) {
    const response = await fetch(`${base()}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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
      .og-mm-tabs{display:flex;gap:8px;padding:14px 22px 0}.og-mm-tab,.og-mm-action{border:1px solid #dbe2ea;border-radius:8px;padding:8px 12px;background:#fff;color:#334155;font:600 12px system-ui;cursor:pointer}
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
      <header class="og-mm-head"><div><h2>Mobile app management</h2><p>Demo fallback listings and mobile Agent directory</p></div><button class="og-mm-close" aria-label="Close">&times;</button></header>
      <nav class="og-mm-tabs"><button class="og-mm-tab active" data-tab="demos">Demo properties</button><button class="og-mm-tab" data-tab="agents">Mobile Agents</button></nav>
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
        <div class="og-mm-field"><label>Profile photo URL</label><input name="photo" type="url" maxlength="2000" value="${esc(agent.photo || agent.profilePhoto || '')}"></div>
        <div class="og-mm-field"><label>Profile status</label><select name="status"><option ${agent.status !== 'Suspended' ? 'selected' : ''}>Active</option><option ${agent.status === 'Suspended' ? 'selected' : ''}>Suspended</option></select></div>
        <div class="og-mm-field"><label>Approval</label><select name="approvalStatus"><option ${agent.approvalStatus !== 'Pending' && agent.approvalStatus !== 'Rejected' ? 'selected' : ''}>Approved</option><option ${agent.approvalStatus === 'Pending' ? 'selected' : ''}>Pending</option><option ${agent.approvalStatus === 'Rejected' ? 'selected' : ''}>Rejected</option></select></div>
        <div class="og-mm-field full"><label>Service areas (comma separated)</label><input name="areas" value="${esc((agent.areas || []).join(', '))}"></div>
        <div class="og-mm-field full"><label>Specialties (comma separated)</label><input name="specialties" value="${esc((agent.specialties || []).join(', '))}"></div>
        <div class="og-mm-field full"><label>About</label><textarea name="about" maxlength="2000">${esc(agent.about || '')}</textarea></div>
        <div class="og-mm-field"><label><input type="checkbox" name="visible" ${agent.visible !== false ? 'checked' : ''}> Visible in mobile app</label></div>
      </div><div class="og-mm-form-actions"><button type="button" class="og-mm-action" data-action="cancel-form">Cancel</button><button class="og-mm-action primary" type="submit">Save Agent</button></div>
    </form>`;
    const form = wrap.querySelector('form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
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
    button.textContent = 'Mobile app data';
    button.addEventListener('click', openPanel);
    row.appendChild(button);
  }

  const observer = new MutationObserver(attachButton);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  attachButton();
})();
