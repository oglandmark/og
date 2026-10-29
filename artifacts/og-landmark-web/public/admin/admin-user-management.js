(function () {
  'use strict';

  const root = document.getElementById('root');
  if (!root) return;

  const roles = [
    ['all', 'All Users'],
    ['Buyer', 'Buyers'],
    ['Seller', 'Sellers'],
    ['Agent', 'Agents'],
    ['Developer', 'Developers'],
    ['Admin', 'Admins'],
  ];
  const state = { users: [], role: 'all', query: '', loading: false, error: '' };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const asArray = (value) => Array.isArray(value) ? value : [];
  const displayRole = (role) => String(role || 'User').toLowerCase() === 'user'
    ? 'Buyer' : (role || '—');
  const matchesRole = (user, role) => {
    const actual = String(user.role || 'User').toLowerCase();
    if (role === 'all') return true;
    if (role === 'Buyer') return actual === 'user' || actual === 'buyer';
    return actual === role.toLowerCase();
  };
  const imageUrl = (user) => {
    const value = user.profilePhoto || user.profileImage || user.avatarUrl || user.photoURL;
    return typeof value === 'string' && (/^https?:\/\//i.test(value) || value.startsWith('/'))
      ? value : '';
  };
  const dateText = (value) => value ? esc(String(value).slice(0, 10)) : '—';

  async function request(url, options) {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', ...(options && options.body ? { 'Content-Type': 'application/json' } : {}) },
      cache: 'no-store',
      ...options,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`);
    return { body, response };
  }

  function filteredUsers() {
    const query = state.query.trim().toLowerCase();
    return state.users.filter((user) => matchesRole(user, state.role) && (
      !query || [user.name, user.email, user.phone, user.role, user.status, user.city]
        .some((value) => String(value || '').toLowerCase().includes(query))
    ));
  }

  function avatar(user) {
    const photo = imageUrl(user);
    return photo
      ? `<img class="og-users-avatar" src="${esc(photo)}" alt="" loading="lazy">`
      : `<span class="og-users-avatar og-users-initial">${esc((user.name || '?').trim().charAt(0).toUpperCase())}</span>`;
  }

  function renderList(host) {
    const counts = Object.fromEntries(roles.map(([key]) => [
      key,
      key === 'all' ? state.users.length : state.users.filter((user) => matchesRole(user, key)).length,
    ]));
    host.querySelectorAll('[data-user-role]').forEach((button) => {
      const selected = button.dataset.userRole === state.role;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      const count = button.querySelector('[data-count]');
      if (count) count.textContent = counts[button.dataset.userRole] ?? '0';
    });

    const list = filteredUsers();
    const target = host.querySelector('[data-user-list]');
    if (!target) return;
    if (state.loading) {
      target.innerHTML = '<div class="og-users-state">Loading accounts…</div>';
      return;
    }
    if (state.error) {
      target.innerHTML = `<div class="og-users-state og-users-error">${esc(state.error)} <button type="button" data-action="refresh">Try again</button></div>`;
      return;
    }
    if (!list.length) {
      target.innerHTML = '<div class="og-users-state">No accounts match this filter.</div>';
      return;
    }

    target.innerHTML = `<div class="og-users-table-scroll"><table class="og-users-table">
      <thead><tr><th>Account</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody>${list.map((user) => {
        const status = String(user.status || 'Active');
        const statusActions = status === 'Active'
          ? `<button type="button" data-action="status" data-id="${esc(user.id)}" data-status="Suspended">Suspend</button><button type="button" data-action="status" data-id="${esc(user.id)}" data-status="Inactive">Deactivate</button>`
          : `<button type="button" data-action="status" data-id="${esc(user.id)}" data-status="Active">Activate</button>`;
        return `<tr>
          <td><div class="og-users-person">${avatar(user)}<span>${esc(user.name || '—')}</span></div></td>
          <td>${esc(user.email || '—')}</td><td>${esc(user.phone || '—')}</td>
          <td><span class="og-users-role">${esc(displayRole(user.role))}</span></td>
          <td><span class="og-users-status ${status.toLowerCase()}">${esc(status)}</span></td>
          <td>${dateText(user.joinedDate)}</td>
          <td><div class="og-users-actions">
            <button type="button" data-action="view" data-id="${esc(user.id)}">View</button>
            <button type="button" data-action="edit" data-id="${esc(user.id)}">Edit</button>
            ${statusActions}
          </div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  async function load(host) {
    state.loading = true;
    state.error = '';
    renderList(host);
    try {
      const { body } = await request('/api/users');
      if (!Array.isArray(body)) throw new Error('The Users API returned an unexpected response.');
      state.users = body;
    } catch (error) {
      state.error = error instanceof Error ? error.message : 'Could not load accounts.';
    } finally {
      state.loading = false;
      renderList(host);
    }
  }

  function openDialog(host, title, content) {
    const layer = host.querySelector('[data-user-dialog]');
    layer.innerHTML = `<section class="og-users-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><div><h3>${esc(title)}</h3><p>Account information from OG Landmark</p></div>
      <button type="button" data-action="close-dialog" aria-label="Close">×</button></header>
      <div class="og-users-dialog-body">${content}</div></section>`;
    layer.hidden = false;
    layer.querySelector('[data-action="close-dialog"]').focus();
  }

  function closeDialog(host) {
    const layer = host.querySelector('[data-user-dialog]');
    layer.hidden = true;
    layer.innerHTML = '';
  }

  function field(label, name, value, type) {
    return `<label>${esc(label)}<input name="${esc(name)}" type="${type || 'text'}" value="${esc(value || '')}" ${name === 'name' || name === 'email' ? 'required' : ''}></label>`;
  }

  async function viewUser(host, user) {
    openDialog(host, 'Account profile', '<div class="og-users-state">Loading profile activity and linked properties…</div>');
    try {
      const [activityResult, propertyResult] = await Promise.all([
        request(`/api/admin/users/${encodeURIComponent(user.id)}/activity?limit=20&page=1`),
        request('/api/admin/properties'),
      ]);
      const activities = asArray(activityResult.body);
      const properties = asArray(propertyResult.body).filter((property) => [
        property.userId, property.ownerId, property.sellerId, property.agentId,
      ].some((id) => String(id ?? '') === String(user.id)));
      const activityRows = activities.length
        ? activities.map((item) => `<li><b>${esc(item.resource || 'Activity')}</b><span>${esc(item.title || item.propertyTitle || item.action || item.message || item.name || 'Account activity')}</span><time>${dateText(item.activityAt || item.createdAt || item.timestamp)}</time></li>`).join('')
        : '<li class="og-users-muted">No recorded activity.</li>';
      const propertyRows = properties.length
        ? properties.map((item) => `<li><b>${esc(item.title || 'Property')}</b><span>${esc(item.city || item.locality || '—')} · ${esc(item.approvalStatus || item.status || '—')}</span></li>`).join('')
        : '<li class="og-users-muted">No linked properties found.</li>';
      const photo = imageUrl(user);
      const profile = `<div class="og-users-profile">${photo ? `<img src="${esc(photo)}" alt="">` : `<span>${esc((user.name || '?').trim().charAt(0).toUpperCase())}</span>`}
        <div><strong>${esc(user.name || '—')}</strong><small>${esc(displayRole(user.role))} · ${esc(user.status || 'Active')}</small></div></div>
        <dl class="og-users-fields"><dt>Email</dt><dd>${esc(user.email || '—')}</dd><dt>Phone</dt><dd>${esc(user.phone || '—')}</dd>
        <dt>City</dt><dd>${esc(user.city || '—')}</dd><dt>Joined</dt><dd>${dateText(user.joinedDate)}</dd>
        <dt>Agency / company</dt><dd>${esc(user.agencyName || user.companyName || '—')}</dd></dl>
        <h4>Linked properties</h4><ul class="og-users-activity">${propertyRows}</ul>
        <h4>Recent activity</h4><ul class="og-users-activity">${activityRows}</ul>`;
      openDialog(host, 'Account profile', profile);
    } catch (error) {
      openDialog(host, 'Account profile', `<div class="og-users-state og-users-error">${esc(error instanceof Error ? error.message : 'Could not load profile details.')}</div>`);
    }
  }

  function editUser(host, user) {
    const roleOptions = ['User', 'Buyer', 'Seller', 'Agent', 'Developer', 'Admin']
      .map((role) => `<option value="${role}" ${String(user.role || 'User') === role ? 'selected' : ''}>${role === 'User' ? 'Buyer / User' : role}</option>`).join('');
    openDialog(host, 'Edit account', `<form data-user-edit data-id="${esc(user.id)}">
      ${field('Full name', 'name', user.name)}
      ${field('Email', 'email', user.email, 'email')}
      ${field('Phone', 'phone', user.phone)}
      ${field('City', 'city', user.city)}
      <label>Role<select name="role">${roleOptions}</select></label>
      <p class="og-users-muted">Changing role may change this account’s access.</p>
      <footer><button type="button" data-action="close-dialog">Cancel</button><button class="primary" type="submit">Save account</button></footer>
      <div class="og-users-form-error" aria-live="polite"></div></form>`);
  }

  async function saveUser(host, form) {
    const user = state.users.find((item) => String(item.id) === form.dataset.id);
    if (!user) return;
    const values = Object.fromEntries(new FormData(form));
    const button = form.querySelector('[type="submit"]');
    const errorBox = form.querySelector('.og-users-form-error');
    button.disabled = true;
    try {
      const { body } = await request(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT', body: JSON.stringify(values),
      });
      state.users = state.users.map((item) => String(item.id) === String(body.id) ? body : item);
      closeDialog(host);
      renderList(host);
    } catch (error) {
      errorBox.textContent = error instanceof Error ? error.message : 'Could not save this account.';
      button.disabled = false;
    }
  }

  async function updateStatus(host, user, status) {
    const action = status === 'Active' ? 'reactivate' : status === 'Inactive' ? 'deactivate' : 'suspend';
    if (!window.confirm(`Are you sure you want to ${action} ${user.name || user.email || 'this account'}?`)) return;
    try {
      const { body } = await request(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT', body: JSON.stringify({ status }),
      });
      state.users = state.users.map((item) => String(item.id) === String(body.id) ? body : item);
      renderList(host);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not update account status.');
    }
  }

  function mount(host) {
    if (host.dataset.ogUserManagement === 'true') return;
    host.dataset.ogUserManagement = 'true';
    host.innerHTML = `<section class="og-users-manager">
      <header class="og-users-heading"><div><h2>Users &amp; Agents</h2><p>Manage marketplace accounts, access and activity.</p></div>
        <button type="button" data-action="refresh">Refresh</button></header>
      <label class="og-users-search"><span>Search</span><input data-user-search type="search" placeholder="Name, email, phone, role or city"></label>
      <nav class="og-users-tabs" aria-label="Filter users">${roles.map(([key, label]) => `<button type="button" data-user-role="${key}" aria-pressed="${key === 'all'}">${label} <span data-count>0</span></button>`).join('')}</nav>
      <div class="og-users-table-card" data-user-list></div>
      <div data-user-dialog class="og-users-layer" hidden></div>
    </section>`;
    const style = document.createElement('style');
    style.textContent = `
      .og-users-manager{display:grid;gap:16px;color:#0b1f3a}
      .og-users-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;background:#fff;border:1px solid #e4e8ef;border-radius:14px;padding:18px}
      .og-users-heading h2{font-size:18px;font-weight:750;margin:0}.og-users-heading p{font-size:12px;color:#68758a;margin:5px 0 0}
      .og-users-manager button{font:inherit;cursor:pointer}.og-users-heading button,.og-users-actions button,.og-users-state button{border:1px solid #d7deea;border-radius:8px;background:#fff;color:#0b1f3a;padding:8px 11px;font-size:12px;font-weight:700}
      .og-users-search{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e4e8ef;border-radius:12px;padding:11px 14px;font-size:12px;font-weight:700;color:#68758a}
      .og-users-search input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-weight:400;color:#0b1f3a}
      .og-users-tabs{display:flex;flex-wrap:wrap;gap:8px}.og-users-tabs button{border:1px solid #e1e5ec;border-radius:999px;background:#fff;padding:8px 12px;color:#536176;font-size:12px;font-weight:700}
      .og-users-tabs button.selected{background:#0b1f3a;border-color:#0b1f3a;color:#e0bd72}.og-users-tabs span{opacity:.75;margin-left:4px}
      .og-users-table-card{background:#fff;border:1px solid #e4e8ef;border-radius:14px;overflow:hidden}
      .og-users-table-scroll{overflow:auto}.og-users-table{width:100%;min-width:940px;border-collapse:collapse;font-size:12px}
      .og-users-table th{text-align:left;background:#f7f8fa;color:#68758a;padding:12px 14px;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
      .og-users-table td{padding:12px 14px;border-top:1px solid #edf0f4;vertical-align:middle}.og-users-person{display:flex;align-items:center;gap:9px;min-width:150px;font-weight:700}
      .og-users-avatar{width:34px;height:34px;object-fit:cover;border-radius:50%;border:1px solid #e4e8ef}.og-users-initial{display:grid;place-items:center;background:#eef1f6;color:#43516a;font-size:14px}
      .og-users-role,.og-users-status{display:inline-block;border-radius:999px;padding:4px 8px;background:#eef1f6;font-weight:700;font-size:11px}
      .og-users-status.active{background:#e5f5ec;color:#197447}.og-users-status.suspended{background:#fff0e5;color:#aa5312}.og-users-status.inactive{background:#fce8e8;color:#a83232}
      .og-users-actions{display:flex;justify-content:flex-end;gap:5px}.og-users-actions button:last-child{color:#9a3c30}.og-users-actions button:disabled{opacity:.55}
      .og-users-state{padding:28px;text-align:center;color:#68758a;font-size:13px}.og-users-error{color:#a83232}.og-users-state button{margin-left:8px}
      .og-users-layer[hidden]{display:none}.og-users-layer{position:fixed;inset:0;z-index:10000;background:#071322aa;display:grid;place-items:center;padding:20px}
      .og-users-dialog{width:min(620px,100%);max-height:min(88vh,820px);overflow:auto;background:#fff;border-radius:16px;box-shadow:0 24px 70px #07132255}
      .og-users-dialog>header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px;border-bottom:1px solid #edf0f4}.og-users-dialog h3{margin:0;font-size:18px}.og-users-dialog header p{margin:5px 0 0;color:#68758a;font-size:12px}
      .og-users-dialog header button{border:0;background:transparent;font-size:26px;color:#68758a}.og-users-dialog-body{padding:20px}
      .og-users-dialog form{display:grid;gap:12px}.og-users-dialog form label{display:grid;gap:5px;color:#536176;font-size:11px;font-weight:700}
      .og-users-dialog input,.og-users-dialog select{min-height:40px;border:1px solid #dce2ea;border-radius:8px;padding:8px 10px;font:inherit;color:#0b1f3a;background:#fff}
      .og-users-dialog form footer{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}.og-users-dialog form button{border:1px solid #d7deea;border-radius:8px;background:#fff;padding:9px 13px;font-size:12px;font-weight:700}
      .og-users-dialog form button.primary{background:#0b1f3a;color:#e0bd72;border-color:#0b1f3a}.og-users-dialog form button:disabled{opacity:.6}
      .og-users-form-error{color:#a83232;font-size:12px}.og-users-muted{color:#68758a;font-size:12px}
      .og-users-profile{display:flex;gap:12px;align-items:center;margin-bottom:16px}.og-users-profile img,.og-users-profile>span{width:52px;height:52px;border-radius:50%;object-fit:cover;background:#edf0f4;display:grid;place-items:center}
      .og-users-profile strong,.og-users-profile small{display:block}.og-users-profile small{margin-top:4px;color:#68758a}
      .og-users-fields{display:grid;grid-template-columns:150px 1fr;gap:9px;margin:0 0 18px;font-size:12px}.og-users-fields dt{color:#68758a}.og-users-fields dd{margin:0;overflow-wrap:anywhere}
      .og-users-dialog h4{margin:18px 0 8px;font-size:13px}.og-users-activity{list-style:none;padding:0;margin:0;border-top:1px solid #edf0f4}
      .og-users-activity li{display:grid;grid-template-columns:110px 1fr auto;gap:10px;padding:10px 0;border-bottom:1px solid #edf0f4;font-size:11px}
      .og-users-activity li span{color:#536176;overflow-wrap:anywhere}.og-users-activity time{color:#68758a}.og-users-activity .og-users-muted{display:block}
      @media(max-width:700px){.og-users-heading{align-items:flex-start}.og-users-activity li{grid-template-columns:1fr}.og-users-fields{grid-template-columns:110px 1fr}}
    `;
    host.appendChild(style);
    host.querySelector('[data-user-search]').addEventListener('input', (event) => {
      state.query = event.currentTarget.value;
      renderList(host);
    });
    host.addEventListener('click', async (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.userRole) {
        state.role = button.dataset.userRole;
        renderList(host);
        return;
      }
      const action = button.dataset.action;
      if (action === 'close-dialog') return closeDialog(host);
      if (action === 'refresh') return load(host);
      const user = state.users.find((item) => String(item.id) === String(button.dataset.id));
      if (!user) return;
      if (action === 'view') return viewUser(host, user);
      if (action === 'edit') return editUser(host, user);
      if (action === 'status') return updateStatus(host, user, button.dataset.status);
    });
    host.addEventListener('submit', (event) => {
      if (!event.target.matches('[data-user-edit]')) return;
      event.preventDefault();
      saveUser(host, event.target);
    });
    void load(host);
  }

  const observer = new MutationObserver(() => {
    if (!location.pathname.replace(/\/+$/, '').endsWith('/admin/users')) return;
    const heading = Array.from(root.querySelectorAll('h2'))
      .find((item) => item.textContent.trim() === 'Users & Agents');
    const host = heading && heading.closest('div.space-y-4');
    if (host) mount(host);
  });
  observer.observe(root, { childList: true, subtree: true });
  if (location.pathname.replace(/\/+$/, '').endsWith('/admin/users')) {
    const heading = Array.from(root.querySelectorAll('h2'))
      .find((item) => item.textContent.trim() === 'Users & Agents');
    const host = heading && heading.closest('div.space-y-4');
    if (host) mount(host);
  }
})();
