(function () {
  if (window.__ogPropertyManagementMounted) return;
  window.__ogPropertyManagementMounted = true;

  const originalFetch = window.fetch.bind(window);
  let properties = [];
  let agents = [];
  let filter = 'all';
  let observer;
  let enhancementQueued = false;
  let modal;
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const statusOf = (property) => normalize(property.approvalStatus || property.listingStatus || 'pending');
  const apiBase = () => String(window.__OG_API_BASE__ || '/api').replace(/\/+$/, '');
  const authHeaders = () => {
    const headers = { Accept: 'application/json' };
    const token = window.localStorage?.getItem('og_token');
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    try {
      const requestUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      const url = new URL(requestUrl, window.location.href);
      if (/\/admin\/properties\/?$/.test(url.pathname) && response.ok) {
        const payload = await response.clone().json();
        if (Array.isArray(payload)) {
          properties = payload;
          queueEnhancement();
        }
      }
    } catch {}
    return response;
  };

  function queueEnhancement() {
    if (enhancementQueued) return;
    enhancementQueued = true;
    requestAnimationFrame(() => {
      enhancementQueued = false;
      enhance();
    });
  }

  function findRoot() {
    const heading = [...document.querySelectorAll('h2')].find((node) => node.textContent.trim() === 'All Properties');
    return heading?.closest('.space-y-4') || null;
  }

  function rowProperty(row, used) {
    const cells = [...row.cells].map((cell) => normalize(cell.innerText));
    const title = normalize(row.querySelector('td .font-medium')?.textContent || row.cells[0]?.innerText?.split('\n')[0]);
    if (!title) return null;
    let best = null;
    let bestScore = -1;
    for (const property of properties) {
      if (used.has(String(property.id)) || normalize(property.title) !== title) continue;
      let score = 1;
      const city = normalize(property.city);
      const seller = normalize(property.sellerName);
      const price = property.price == null ? '' : normalize(`PKR ${Number(property.price).toLocaleString()}`);
      if (city && cells.some((cell) => cell === city)) score += 3;
      if (seller && cells.some((cell) => cell === seller)) score += 2;
      if (price && cells.some((cell) => cell.includes(price))) score += 1;
      if (score > bestScore) { best = property; bestScore = score; }
    }
    if (best) used.add(String(best.id));
    return best;
  }

  function ensureStyles() {
    if (document.getElementById('og-property-management-style')) return;
    const style = document.createElement('style');
    style.id = 'og-property-management-style';
    style.textContent = `
      .og-pm-filters{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#fff}
      .og-pm-filter{border:1px solid #dbe2ea;border-radius:999px;background:#fff;color:#334155;padding:7px 12px;font:600 12px/1.2 system-ui;cursor:pointer}
      .og-pm-filter.is-active{background:#0B1F3A;color:#fff;border-color:#0B1F3A}
      .og-pm-manage{border:1px solid #c8a45a;border-radius:7px;background:#fff;color:#0B1F3A;padding:6px 9px;font:600 12px system-ui;white-space:nowrap;cursor:pointer}
      .og-pm-manage:hover{background:#fbf7ed}
      .og-pm-backdrop{position:fixed;inset:0;z-index:11000;display:flex;align-items:center;justify-content:center;padding:16px;background:#071526b8}
      .og-pm-dialog{width:min(850px,100%);max-height:92vh;overflow:auto;border-radius:16px;background:#fff;color:#0B1F3A;box-shadow:0 24px 70px #0004;font:14px system-ui}
      .og-pm-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;gap:16px;padding:18px 22px;background:#fff;border-bottom:1px solid #e2e8f0}
      .og-pm-head h2{margin:0;font-size:19px}.og-pm-head p{margin:4px 0 0;color:#64748b;font-size:12px}
      .og-pm-close{border:1px solid #e2e8f0;border-radius:8px;background:white;width:34px;height:34px;font-size:20px;cursor:pointer}
      .og-pm-form{padding:20px 22px}.og-pm-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
      .og-pm-field{display:flex;flex-direction:column;gap:5px}.og-pm-field.full{grid-column:1/-1}
      .og-pm-field label{font-size:12px;font-weight:700;color:#334155}
      .og-pm-field input,.og-pm-field textarea,.og-pm-field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:9px 10px;background:#fff;color:#0f172a;font:13px system-ui}
      .og-pm-field textarea{min-height:84px;resize:vertical}
      .og-pm-section{grid-column:1/-1;margin:7px 0 -4px;padding-bottom:7px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700}
      .og-pm-note{color:#64748b;font-size:11px}.og-pm-error{margin:12px 0;color:#b91c1c;font-size:13px}
      .og-pm-footer{display:flex;justify-content:space-between;gap:10px;margin-top:18px}
      .og-pm-actions{display:flex;gap:8px}.og-pm-button{border:0;border-radius:8px;padding:9px 13px;background:#0B1F3A;color:white;font:600 13px system-ui;cursor:pointer}
      .og-pm-button:disabled{opacity:.55;cursor:wait}.og-pm-button.secondary{background:#eef2f7;color:#334155}
      .og-pm-button.danger{background:#b91c1c}
      @media(max-width:600px){.og-pm-grid{grid-template-columns:1fr}.og-pm-field.full,.og-pm-section{grid-column:auto}.og-pm-form{padding:16px}.og-pm-footer{flex-direction:column-reverse}.og-pm-actions{justify-content:flex-end}}
    `;
    document.head.appendChild(style);
  }

  function openModal(property) {
    ensureStyles();
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.className = 'og-pm-backdrop';
    const assigned = property.assignedAgent || {};
    const media = Array.isArray(property.images)
      ? property.images.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean)
      : Array.isArray(property.media?.images)
        ? property.media.images.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean)
        : [];
    modal.innerHTML = `
      <section class="og-pm-dialog" role="dialog" aria-modal="true" aria-labelledby="og-pm-title">
        <header class="og-pm-head"><div><h2 id="og-pm-title"></h2><p></p></div><button class="og-pm-close" type="button" aria-label="Close">&times;</button></header>
        <form class="og-pm-form">
          <div class="og-pm-grid">
            <div class="og-pm-section">Listing details</div>
            <div class="og-pm-field"><label>Title</label><input name="title" required maxlength="180"></div>
            <div class="og-pm-field"><label>Property type</label><input name="type" maxlength="80"></div>
            <div class="og-pm-field"><label>Purpose</label><select name="purpose"><option>For Sale</option><option>For Rent</option></select></div>
            <div class="og-pm-field"><label>City</label><input name="city" required maxlength="120"></div>
            <div class="og-pm-field"><label>Address</label><input name="address" maxlength="240"></div>
            <div class="og-pm-field"><label>Price (PKR)</label><input name="price" type="number" min="0" step="any"></div>
            <div class="og-pm-field"><label>Area</label><input name="area" maxlength="80"></div>
            <div class="og-pm-field"><label>Bedrooms</label><input name="bedrooms" type="number" min="0" max="50"></div>
            <div class="og-pm-field"><label>Bathrooms</label><input name="bathrooms" type="number" min="0" max="50"></div>
            <div class="og-pm-field full"><label>Description</label><textarea name="description" maxlength="5000"></textarea></div>
            <div class="og-pm-field full"><label>Listing photo URLs</label><textarea name="images"></textarea><span class="og-pm-note">One URL per line. Existing photos stay unchanged unless you edit this list.</span></div>
            <div class="og-pm-section">Agent referral</div>
            <div class="og-pm-field full"><label>Choose an agent profile</label><select name="agentProfile"><option value="">Manual referral contact / no profile</option></select></div>
            <div class="og-pm-field"><label>Referral contact name</label><input name="agentName" maxlength="120"></div>
            <div class="og-pm-field"><label>Referral phone</label><input name="agentPhone" maxlength="40"></div>
            <div class="og-pm-field full"><span class="og-pm-note">This assigns a referral contact to this listing. It does not change the listing review status.</span></div>
          </div>
          <div class="og-pm-error" role="alert" hidden></div>
          <div class="og-pm-footer"><button class="og-pm-button danger" type="button" data-delete>Delete listing</button><div class="og-pm-actions"><button class="og-pm-button secondary" type="button" data-cancel>Cancel</button><button class="og-pm-button" type="submit">Save listing</button></div></div>
        </form>
      </section>`;
    const form = modal.querySelector('form');
    const set = (key, value) => { const input = form.elements[key]; if (input) input.value = value ?? ''; };
    modal.querySelector('h2').textContent = property.title || 'Manage listing';
    modal.querySelector('.og-pm-head p').textContent = `ID ${property.id} · ${property.approvalStatus || property.listingStatus || 'Pending review'}`;
    set('title', property.title); set('type', property.type); set('purpose', property.purpose || 'For Sale');
    set('city', property.city); set('address', property.address); set('price', property.price);
    set('area', property.area); set('bedrooms', property.bedrooms); set('bathrooms', property.bathrooms);
    set('description', property.description); set('images', media.join('\n'));
    set('agentName', assigned.name || property.assignedAgentName);
    set('agentPhone', assigned.phone || property.assignedAgentPhone);
    const select = form.elements.agentProfile;
    for (const agent of agents) {
      const option = document.createElement('option');
      option.value = `${agent.kind}:${agent.id}`;
      option.textContent = `${agent.name || 'Agent'}${agent.phone ? ` · ${agent.phone}` : ''}`;
      option.dataset.name = agent.name || '';
      option.dataset.phone = agent.phone || '';
      select.appendChild(option);
    }
    const selectedAgentId = String(assigned.id || property.assignedAgentId || '');
    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
    if (selectedAgent) select.value = `${selectedAgent.kind}:${selectedAgent.id}`;
    select.addEventListener('change', () => {
      const option = select.selectedOptions[0];
      if (select.value) { set('agentName', option.dataset.name); set('agentPhone', option.dataset.phone); }
    });
    modal.querySelectorAll('[data-cancel],.og-pm-close').forEach((button) => button.addEventListener('click', closeModal));
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    document.addEventListener('keydown', escapeClose, { once: true });
    modal.querySelector('[data-delete]').addEventListener('click', () => deleteProperty(property, modal));
    form.addEventListener('submit', (event) => saveProperty(event, property, modal));
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    form.elements.title.focus();
  }

  function escapeClose(event) { if (event.key === 'Escape') closeModal(); }
  function closeModal() { modal?.remove(); modal = null; document.body.style.overflow = ''; }
  function showError(container, message) { const error = container.querySelector('.og-pm-error'); error.textContent = message; error.hidden = false; }

  async function request(path, options = {}) {
    const response = await originalFetch(`${apiBase()}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    return payload;
  }

  async function saveProperty(event, property, container) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      const profile = agents.find((agent) => `${agent.kind}:${agent.id}` === values.agentProfile);
      const name = String(values.agentName || '').trim();
      const phone = String(values.agentPhone || '').trim();
      const payload = {
        title: values.title.trim(), type: values.type.trim(), purpose: values.purpose,
        city: values.city.trim(), address: values.address.trim(),
        price: values.price === '' ? null : Number(values.price), area: values.area.trim(),
        bedrooms: values.bedrooms === '' ? null : Number(values.bedrooms),
        bathrooms: values.bathrooms === '' ? null : Number(values.bathrooms),
        description: values.description.trim(),
        images: values.images.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        assignedAgent: name || phone || profile ? {
          id: profile?.id || null, name, phone, profileType: profile?.kind || 'manual',
        } : null,
      };
      payload.coverImage = payload.images[0] || null;
      await request(`/admin/properties/${encodeURIComponent(property.id)}`, { method: 'PATCH', body: JSON.stringify(payload) });
      closeModal();
      window.location.reload();
    } catch (error) {
      showError(container, error.message || 'Could not save this listing.');
      button.disabled = false;
    }
  }

  async function deleteProperty(property, container) {
    if (!window.confirm(`Permanently delete “${property.title || 'this listing'}”? This removes it from the public listing and admin records.`)) return;
    const button = container.querySelector('[data-delete]');
    button.disabled = true;
    try {
      await request(`/admin/properties/${encodeURIComponent(property.id)}`, { method: 'DELETE' });
      closeModal();
      window.location.reload();
    } catch (error) {
      showError(container, error.message || 'Could not delete this listing.');
      button.disabled = false;
    }
  }

  async function loadAgents() {
    if (agents.length) return;
    const [profiles, users] = await Promise.all([
      request('/admin/mobile-agents').catch(() => []),
      request('/admin/users?role=agent').catch(() => []),
    ]);
    const seen = new Set();
    agents = [
      ...(Array.isArray(profiles) ? profiles.map((item) => ({ ...item, kind: 'profile' })) : []),
      ...(Array.isArray(users) ? users.map((item) => ({ ...item, kind: 'account' })) : []),
    ].filter((agent) => {
      const id = String(agent.id ?? agent.userId ?? '');
      if (!id || seen.has(`${agent.kind}:${id}`)) return false;
      seen.add(`${agent.kind}:${id}`);
      agent.id = id;
      agent.name = agent.name || agent.fullName || agent.agentName || 'Agent';
      return true;
    });
  }

  function addFilters(root) {
    const table = root.querySelector('table');
    if (!table || root.querySelector('.og-pm-filters')) return;
    const filters = document.createElement('div');
    filters.className = 'og-pm-filters';
    const options = [
      ['all', 'All listings'],
      ['pending', 'Pending review'],
      ['active', 'Active'],
      ['changes requested', 'Changes requested'],
      ['rejected', 'Rejected'],
    ];
    for (const [value, label] of options) {
      const button = document.createElement('button');
      button.className = 'og-pm-filter';
      button.type = 'button';
      button.dataset.filter = value;
      button.addEventListener('click', () => { filter = value; queueEnhancement(); });
      filters.appendChild(button);
    }
    table.closest('.bg-white')?.prepend(filters);
  }

  function enhance() {
    const root = findRoot();
    if (!root) return;
    const table = root.querySelector('table');
    if (!table) return;
    addFilters(root);
    const headers = table.querySelector('thead tr');
    if (headers && !headers.querySelector('[data-og-pm-header]')) {
      const th = document.createElement('th');
      th.dataset.ogPmHeader = 'true'; th.className = 'text-left px-4 py-3 font-semibold'; th.textContent = 'Manage';
      headers.appendChild(th);
    }
    const used = new Set();
    const rows = [...table.querySelectorAll('tbody tr')].filter((row) => !row.querySelector('[colspan]'));
    for (const row of rows) {
      const property = rowProperty(row, used);
      if (!property) continue;
      row.dataset.ogPropertyStatus = statusOf(property);
      let cell = row.querySelector('[data-og-pm-cell]');
      if (!cell) {
        cell = document.createElement('td'); cell.dataset.ogPmCell = 'true'; cell.className = 'px-4 py-3';
        row.appendChild(cell);
      }
      let button = cell.querySelector('button');
      if (!button) {
        button = document.createElement('button'); button.className = 'og-pm-manage'; button.type = 'button';
        button.addEventListener('click', async () => {
          const current = properties.find((item) => String(item.id) === button.dataset.propertyId);
          if (!current) return;
          button.disabled = true;
          try { await loadAgents(); openModal(current); }
          catch (error) { window.alert(error.message || 'Could not load agent profiles.'); }
          finally { button.disabled = false; }
        });
        cell.appendChild(button);
      }
      if (button.textContent !== 'Edit / assign') button.textContent = 'Edit / assign';
      button.dataset.propertyId = String(property.id);
      const rowStatus = row.dataset.ogPropertyStatus;
      row.hidden = filter !== 'all' && rowStatus !== filter;
    }
    const chips = root.querySelectorAll('.og-pm-filter');
    chips.forEach((button) => {
      const value = button.dataset.filter;
      const count = value === 'all' ? properties.length : properties.filter((item) => statusOf(item) === value).length;
      const label = `${value === 'all' ? 'All listings' : value === 'pending' ? 'Pending review' : value[0].toUpperCase() + value.slice(1)} · ${count}`;
      if (button.textContent !== label) button.textContent = label;
      button.classList.toggle('is-active', filter === value);
      button.setAttribute('aria-pressed', String(filter === value));
    });
  }

  observer = new MutationObserver(queueEnhancement);
  const start = () => {
    ensureStyles();
    observer.observe(document.body, { childList: true, subtree: true });
    queueEnhancement();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
