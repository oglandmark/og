(() => {
  const root = document.getElementById('public-portal');
  if (!root || !document.documentElement.classList.contains('public-account')) return;
  const token = localStorage.getItem('og_token');
  let user;
  try { user = JSON.parse(localStorage.getItem('og_user') || '{}') || {}; } catch { user = {}; }
  if (!token || !user.id) {
    window.location.replace('/auth?mode=login');
    return;
  }

  const state = { properties: [], savedProperties: [], inquiries: [], appointments: [], offers: [], savedIds: [], notifications: [], listings: [], failures: {} };
  const iconPaths = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    offer: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    building: '<path d="M3 21h18M5 21V5l7-2 7 2v16M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    'arrow-right': '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    logout: '<path d="M10 17l5-5-5-5m5 5H3m9-5V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    compare: '<path d="M5 7h14M5 12h14M5 17h14"/><path d="M3 7h.01M3 12h.01M3 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`;
  document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = svg(node.dataset.icon); });

  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initial = (user.name || user.full_name || user.username || user.email || 'U').trim().charAt(0).toUpperCase();
  const displayName = user.name || user.full_name || user.username || 'there';
  const firstName = String(displayName).trim().split(/\s+/)[0] || 'there';
  const roleText = user.role || 'User';
  document.getElementById('side-avatar').textContent = initial;
  document.getElementById('top-avatar').textContent = initial;
  document.getElementById('side-name').textContent = displayName;
  document.getElementById('side-role').textContent = roleText;
  document.getElementById('top-name').textContent = displayName;
  document.getElementById('welcome-name').textContent = firstName;
  renderProfile();

  function api(path) {
    return fetch(path, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }).then(async (response) => {
      if (response.status === 401) {
        localStorage.removeItem('og_token');
        localStorage.removeItem('og_user');
        window.location.replace('/auth?mode=login');
        throw new Error('Your session has expired. Sign in again.');
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Could not load data (${response.status}).`);
      }
      return response.json();
    });
  }
  function rows(value, keys = []) {
    if (Array.isArray(value)) return value;
    for (const key of keys) if (Array.isArray(value?.[key])) return value[key];
    if (Array.isArray(value?.data)) return value.data;
    if (Array.isArray(value?.results)) return value.results;
    return [];
  }
  function propertyRows(value) { return rows(value, ['properties', 'listings']); }
  function money(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return value ? safe(value) : 'Price on request';
    return `PKR ${new Intl.NumberFormat('en-PK', { maximumFractionDigits: 0 }).format(number)}`;
  }
  function date(value) {
    if (!value) return 'Date not provided';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? safe(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(parsed);
  }
  function imageOf(property) {
    const images = property?.images;
    if (Array.isArray(images)) return typeof images[0] === 'string' ? images[0] : images[0]?.url || images[0]?.path || '';
    return typeof images === 'string' ? images.split(',')[0].trim() : '';
  }
  function statusBadge(value) { return `<span class="status-pill ${safe(String(value || '').toLowerCase().replace(/\s+/g, '-'))}">${safe(value || 'Pending')}</span>`; }
  function empty(title, detail, action) {
    return `<div class="empty-state">${svg('building')}<strong>${safe(title)}</strong><p>${safe(detail)}</p>${action || ''}</div>`;
  }
  function errorMarkup(resource) {
    return `<div class="error-state"><strong>We couldn't load this section.</strong><p>${safe(state.failures[resource] || 'Please try again in a moment.')}</p><button type="button" data-retry="${safe(resource)}">Try again</button></div>`;
  }
  function cards(items, options = {}) {
    if (!items.length) return empty(options.emptyTitle || 'No properties to show', options.emptyText || 'When properties are available, they will appear here.', options.emptyAction || '');
    return items.map((property) => {
      const src = imageOf(property);
      const propertyId = property.id;
      return `<article class="property-card"><div class="property-image">${src ? `<img src="${safe(src)}" alt="${safe(property.title || 'Property')}" loading="lazy" onerror="this.remove()">` : ''}<span class="property-purpose">${safe(property.purpose || property.status || 'Property')}</span></div><div class="property-copy"><p class="property-location">${safe([property.type, property.city].filter(Boolean).join(' · ') || 'OG Landmark listing')}</p><h3>${safe(property.title || `Property #${propertyId}`)}</h3><p class="property-price">${money(property.price)}</p></div><div class="property-card-foot"><span>Reference ${safe(propertyId ?? '—')}</span><button type="button" data-property-id="${safe(propertyId)}">View property</button></div></article>`;
    }).join('');
  }
  function updateCounts() {
    const pending = state.offers.filter((offer) => /pending|submitted|review/i.test(offer.status || '')).length;
    const upcoming = state.appointments.filter((appointment) => !/cancel|complete|reject/i.test(appointment.status || '')).length;
    const unread = state.notifications.filter((notification) => !(notification.read || notification.isRead)).length;
    setMetric('metric-saved', state.savedIds.length, state.failures.saved);
    setMetric('metric-appointments', upcoming, state.failures.appointments);
    setMetric('metric-offers', pending, state.failures.offers);
    setMetric('metric-notifications', state.notifications.length, state.failures.notifications);
    document.getElementById('saved-count').textContent = state.failures.saved ? '!' : (state.savedIds.length || '');
    document.getElementById('notification-count').textContent = state.failures.notifications ? '!' : (unread || '');
    document.getElementById('top-notification-dot').classList.toggle('show', unread > 0);
  }
  function setMetric(id, value, failed) {
    const element = document.getElementById(id);
    element.textContent = failed ? '—' : String(value);
    element.classList.remove('is-loading');
  }
  function activityMarkup() {
    const entries = [
      ...state.appointments.map((item) => ({ kind: 'appointment', title: `Visit ${item.status || 'scheduled'}: ${item.propertyTitle || 'Property'}`, detail: [date(item.date), item.time].filter(Boolean).join(' · '), date: item.date, icon: 'calendar' })),
      ...state.inquiries.map((item) => ({ kind: 'inquiry', title: `Inquiry: ${item.propertyTitle || 'Property'}`, detail: item.reply || `Status: ${item.status || 'Received'}`, date: item.date, icon: 'message' })),
      ...state.offers.map((item) => ({ kind: 'offer', title: `Offer ${item.status || 'submitted'}: ${item.propertyTitle || 'Property'}`, detail: money(item.offerPrice), date: item.date, icon: 'offer' }))
    ].sort((a, b) => (new Date(b.date || 0)) - (new Date(a.date || 0))).slice(0, 5);
    if (state.failures.appointments && state.failures.inquiries && state.failures.offers) return errorMarkup('activity');
    if (!entries.length) return empty('Your activity will appear here', 'Explore properties or contact our team to get started.', '<button type="button" data-go="properties">Browse properties</button>');
    return entries.map((entry) => `<div class="activity-entry"><span class="activity-dot">${svg(entry.icon)}</span><div><strong>${safe(entry.title)}</strong><p>${safe(entry.detail || 'Update from your account')}</p><time>${date(entry.date)}</time></div></div>`).join('');
  }
  function savedPreviewMarkup() {
    const list = state.savedProperties.slice(0, 3);
    if (state.failures.saved) return errorMarkup('saved');
    if (!list.length) return empty('No saved properties yet', 'Browse homes and save the ones you would like to revisit.', '<button type="button" data-go="properties">Browse properties</button>');
    return list.map((property) => `<div class="preview-property">${imageOf(property) ? `<img src="${safe(imageOf(property))}" alt="" loading="lazy">` : '<div class="preview-placeholder"></div>'}<div><strong>${safe(property.title || `Property #${property.id}`)}</strong><span>${money(property.price)}</span><small>${safe([property.type, property.city].filter(Boolean).join(' · '))}</small></div></div>`).join('');
  }
  function renderTables() {
    const appointmentRows = state.appointments.map((item) => `<div class="data-row"><div><strong>${safe(item.propertyTitle || 'Property visit')}</strong><small>${safe(item.type || 'Property appointment')}</small></div><div class="data-cell">${date(item.date)}${item.time ? `<small>${safe(item.time)}</small>` : ''}</div><div class="data-cell data-extra">${statusBadge(item.status)}</div></div>`).join('');
    document.getElementById('appointments-content').innerHTML = state.failures.appointments ? errorMarkup('appointments') : appointmentRows || empty('No appointments yet', 'Scheduled visits will appear here.');
    const offerRows = state.offers.map((item) => `<div class="data-row"><div><strong>${safe(item.propertyTitle || 'Property offer')}</strong><small>Submitted ${date(item.date)}</small></div><div class="data-cell">${money(item.offerPrice)}</div><div class="data-cell data-extra">${statusBadge(item.status)}</div></div>`).join('');
    document.getElementById('offers-content').innerHTML = state.failures.offers ? errorMarkup('offers') : offerRows || empty('No offers yet', 'Offers you submit will be listed here.');
    const inquiryRows = state.inquiries.map((item) => `<div class="data-row"><div><strong>${safe(item.propertyTitle || 'Property inquiry')}</strong><small>${item.reply ? `Reply: ${safe(item.reply)}` : 'No reply has been added yet.'}</small></div><div class="data-cell">${date(item.date)}</div><div class="data-cell data-extra">${statusBadge(item.status)}</div></div>`).join('');
    document.getElementById('inquiries-content').innerHTML = state.failures.inquiries ? errorMarkup('inquiries') : inquiryRows || empty('No inquiries yet', 'Your property conversations will appear here.');
    const notificationRows = state.notifications.map((item, index) => `<article class="notification-item ${item.read || item.isRead ? '' : 'unread'}" data-notification-index="${index}" role="button" tabindex="0"><span class="notification-icon">${svg('bell')}</span><div><strong>${safe(item.title || 'Account update')}</strong><p>${safe(item.message || '')}</p><time>${date(item.createdAt || item.timestamp)}</time></div></article>`).join('');
    document.getElementById('notifications-content').innerHTML = state.failures.notifications ? errorMarkup('notifications') : notificationRows || empty('You are all caught up', 'New account updates will appear here.');
  }
  function renderListings() {
    const target = document.getElementById('listing-grid');
    if (state.failures.listings) { target.innerHTML = errorMarkup('listings'); return; }
    target.innerHTML = state.listings.length ? cards(state.listings, { emptyTitle: 'No listings yet' }) : empty('No properties listed yet', 'Ready to sell or rent? Start with the OG Landmark listing workflow.', '<a class="button button-gold" href="/portal/seller-dashboard.html?workflow=listings&amp;mode=add">Post a property</a>');
  }
  function renderProfile() {
    const target = document.getElementById('profile-panel');
    if (!target) return;
    const fields = [
      ['Full name', user.name || user.full_name || user.username],
      ['Email address', user.email],
      ['Mobile number', user.phone || user.mobile],
      ['Account type', user.role],
      ['Username', user.username],
      ['Account ID', user.id]
    ];
    target.innerHTML = `<div class="profile-head"><span class="avatar">${safe(initial)}</span><div><h2>${safe(displayName)}</h2><p>${safe(user.email || 'OG Landmark account')}</p></div></div><div class="profile-fields">${fields.map(([label, value]) => `<div class="profile-field"><label>${safe(label)}</label><span>${safe(value || 'Not provided')}</span></div>`).join('')}</div>`;
  }
  function renderAll() {
    updateCounts();
    document.getElementById('activity-list').innerHTML = state.failures.activity ? errorMarkup('activity') : activityMarkup();
    document.getElementById('saved-preview').innerHTML = savedPreviewMarkup();
    document.getElementById('property-grid').innerHTML = state.failures.properties ? errorMarkup('properties') : cards(filteredProperties(), { emptyTitle: 'No properties found', emptyText: 'Try a different search or check back later.' });
    document.getElementById('saved-grid').innerHTML = state.failures.saved ? errorMarkup('saved') : state.failures.savedDetails ? empty('Saved details are temporarily unavailable', 'Your saved properties are still in your account. Try again shortly.', '<button type="button" data-retry="saved">Try again</button>') : cards(state.savedProperties, { emptyTitle: 'No saved properties yet', emptyText: 'Browse the listings and save properties to build your shortlist.', emptyAction: '<button type="button" data-go="properties">Browse properties</button>' });
    renderTables();
    renderListings();
  }
  function filteredProperties() {
    const query = (document.getElementById('property-filter')?.value || document.getElementById('hero-search-input')?.value || '').trim().toLowerCase();
    const purpose = document.getElementById('purpose-filter')?.value || '';
    return state.properties.filter((property) => {
      const searchable = [property.title, property.city, property.type, property.id].join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && (!purpose || String(property.purpose || '').toLowerCase() === purpose.toLowerCase());
    });
  }
  async function load(resource, path, transform) {
    try {
      const response = await api(path);
      state[resource] = transform(response);
      delete state.failures[resource];
    } catch (error) {
      state.failures[resource] = error.message;
    }
  }
  async function loadAll() {
    state.failures = {};
    state.savedProperties = [];
    await Promise.all([
      load('properties', '/api/properties', propertyRows),
      load('inquiries', `/api/inquiries?buyer_id=${encodeURIComponent(user.id)}`, (data) => rows(data, ['inquiries'])),
      load('appointments', `/api/appointments?buyer_id=${encodeURIComponent(user.id)}`, (data) => rows(data, ['appointments'])),
      load('offers', `/api/offers?buyer_id=${encodeURIComponent(user.id)}`, (data) => rows(data, ['offers'])),
      load('savedIds', `/api/saved/${encodeURIComponent(user.id)}`, (data) => {
        const values = Array.isArray(data) ? data : data?.property_ids || data?.saved || data?.ids || data?.data || [];
        return Array.isArray(values) ? values.map((entry) => String(typeof entry === 'object' ? entry.property_id ?? entry.id : entry)) : [];
      }),
      load('notifications', '/api/notifications', (data) => rows(data, ['notifications', 'items'])),
      load('listings', `/api/properties?seller_id=${encodeURIComponent(user.id)}`, propertyRows)
    ]);
    if (!state.failures.saved) {
      const catalog = new Map(state.properties.map((property) => [String(property.id), property]));
      const detailResults = await Promise.all(state.savedIds.map(async (id) => {
        if (catalog.has(String(id))) return catalog.get(String(id));
        try { return await api(`/api/properties/${encodeURIComponent(id)}`); }
        catch { return null; }
      }));
      state.savedProperties = detailResults.filter(Boolean);
      if (state.savedIds.length && !state.savedProperties.length) state.failures.savedDetails = true;
    }
    if (state.failures.appointments && state.failures.inquiries && state.failures.offers) state.failures.activity = state.failures.inquiries;
    renderAll();
  }
  function go(page) {
    const section = document.getElementById(`page-${page}`);
    if (!section) return;
    document.querySelectorAll('.page-view').forEach((node) => node.classList.toggle('is-current', node === section));
    document.querySelectorAll('.nav-item').forEach((node) => node.classList.toggle('is-active', node.dataset.page === page));
    document.getElementById('page-heading').textContent = section.dataset.title;
    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('mobile-shade').classList.remove('is-open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'properties') document.getElementById('property-grid').innerHTML = state.failures.properties ? errorMarkup('properties') : cards(filteredProperties());
  }
  function detailMarkup(property) {
    const image = imageOf(property);
    const facts = [
      ['Type', property.type],
      ['Location', [property.city, property.address].filter(Boolean).join(', ')],
      ['Bedrooms', property.bedrooms],
      ['Bathrooms', property.bathrooms],
      ['Area', [property.area, property.areaUnit].filter(Boolean).join(' ')],
      ['Status', property.purpose || property.status || property.approvalStatus]
    ].filter(([, value]) => value !== undefined && value !== null && value !== '');
    return `<div class="property-detail-image">${image ? `<img src="${safe(image)}" alt="${safe(property.title || 'Property')}" onerror="this.remove()">` : ''}</div><div class="property-detail-body"><p class="eyebrow">PROPERTY DETAILS</p><h2 id="property-detail-title">${safe(property.title || `Property #${property.id}`)}</h2><p class="property-detail-price">${money(property.price)}</p><div class="property-detail-meta"><span>Reference ${safe(property.id)}</span>${property.city ? `<span>${safe(property.city)}</span>` : ''}</div><div class="property-detail-facts">${facts.map(([label, value]) => `<div class="property-detail-fact"><small>${safe(label)}</small><strong>${safe(value)}</strong></div>`).join('')}</div><p class="property-detail-description">${safe(property.description || 'No further description is available.')}</p></div>`;
  }
  async function openPropertyDetail(id) {
    const modal = document.getElementById('property-modal');
    const content = document.getElementById('property-detail-content');
    modal.hidden = false;
    content.innerHTML = '<div class="empty-state"><strong>Loading property details…</strong></div>';
    const cached = [...state.properties, ...state.savedProperties, ...state.listings].find((property) => String(property.id) === String(id));
    try {
      const property = await api(`/api/properties/${encodeURIComponent(id)}`);
      content.innerHTML = detailMarkup(property);
    } catch (error) {
      if (cached) content.innerHTML = detailMarkup(cached);
      else content.innerHTML = `<div class="error-state"><strong>Property details unavailable</strong><p>${safe(error.message)}</p></div>`;
    }
  }
  function closePropertyDetail() { document.getElementById('property-modal').hidden = true; }
  function notificationDestination(item) {
    const isPropertyNotification = /property|listing/i.test(`${item.type || ''} ${item.category || ''}`);
    const path = String(item.link || '').split('?')[0].toLowerCase();
    const routePropertyId = path.match(/\/properties\/(\d+)(?:\/|$)/)?.[1];
    const propertyId = item.propertyId || item.data?.propertyId || routePropertyId || (isPropertyNotification ? item.entityId : null);
    if (propertyId) return { propertyId };
    if (path.includes('appointment')) return { page: 'appointments' };
    if (path.includes('offer')) return { page: 'offers' };
    if (path.includes('message') || path.includes('inquir')) return { page: 'inquiries' };
    if (path.includes('notif')) return { page: 'notifications' };
    if (path.includes('propert')) return { page: 'properties' };
    return null;
  }
  async function handleNotification(item) {
    if (!item) return;
    const destination = notificationDestination(item);
    if (destination?.propertyId) await openPropertyDetail(destination.propertyId);
    else if (destination?.page) go(destination.page);
    const id = item.notificationId || item.id;
    if (id && !(item.read || item.isRead)) {
      try {
        await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        });
        item.read = true;
        item.isRead = true;
        renderTables();
        updateCounts();
      } catch {}
    }
  }
  document.addEventListener('click', (event) => {
    const pageButton = event.target.closest('[data-page]');
    const goButton = event.target.closest('[data-go]');
    const retryButton = event.target.closest('[data-retry]');
    const propertyButton = event.target.closest('[data-property-id]');
    const notification = event.target.closest('[data-notification-index]');
    const closeProperty = event.target.closest('[data-close-property]');
    if (pageButton || goButton || notification || closeProperty) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (pageButton) go(pageButton.dataset.page);
    if (goButton) go(goButton.dataset.go);
    if (retryButton) loadAll();
    if (notification) handleNotification(state.notifications[Number(notification.dataset.notificationIndex)]);
    if (closeProperty) closePropertyDetail();
    if (propertyButton && propertyButton.dataset.propertyId) openPropertyDetail(propertyButton.dataset.propertyId);
  });
  document.addEventListener('keydown', (event) => {
    const notification = event.target.closest?.('[data-notification-index]');
    if (notification && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      handleNotification(state.notifications[Number(notification.dataset.notificationIndex)]);
    }
    if (event.key === 'Escape') closePropertyDetail();
  });
  document.getElementById('hero-search').addEventListener('submit', (event) => {
    event.preventDefault();
    document.getElementById('property-filter').value = document.getElementById('hero-search-input').value;
    go('properties');
    document.getElementById('property-grid').innerHTML = cards(filteredProperties(), { emptyTitle: 'No matching properties', emptyText: 'Try another title, city, or property ID.' });
  });
  document.getElementById('property-filter').addEventListener('input', () => { document.getElementById('property-grid').innerHTML = cards(filteredProperties()); });
  document.getElementById('purpose-filter').addEventListener('change', () => { document.getElementById('property-grid').innerHTML = cards(filteredProperties()); });
  document.getElementById('mobile-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('is-open');
    document.getElementById('mobile-shade').classList.add('is-open');
  });
  document.getElementById('mobile-shade').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('mobile-shade').classList.remove('is-open');
  });
  document.getElementById('logout').addEventListener('click', () => {
    localStorage.removeItem('og_token');
    localStorage.removeItem('og_user');
    window.location.replace('/auth?mode=login');
  });
  loadAll();
})();
