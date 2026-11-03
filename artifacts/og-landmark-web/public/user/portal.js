(() => {
  const root = document.getElementById('public-portal');
  if (!root || !document.documentElement.classList.contains('public-account')) return;
  let token = localStorage.getItem('og_token');
  let user;
  try { user = JSON.parse(localStorage.getItem('og_user') || '{}') || {}; } catch { user = {}; }
  if (!token || !user.id) {
    window.location.replace('/auth?mode=login');
    return;
  }

  const state = {
    properties: [], agents: [], savedProperties: [], inquiries: [], appointments: [], offers: [], savedIds: [],
    notifications: [], listings: [], compareIds: [], compareProperties: [], alerts: [], messages: [],
    conversations: [], activeConversation: null, tracking: [], documents: [], account: null,
    notificationPreferences: null, failures: {}
  };
  let loadInProgress = false;
  let activeListingFilter = 'All';
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
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/>',
    document: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15.4 21 16.7l-1.6 2.8-1.9-.7a8 8 0 0 1-1.8 1l-.3 2h-3.2l-.3-2a8 8 0 0 1-1.8-1l-1.9.7-1.6-2.8 1.6-1.3a8 8 0 0 1 0-2L5.6 12l1.6-2.8 1.9.7a8 8 0 0 1 1.8-1l.3-2h3.2l.3 2a8 8 0 0 1 1.8 1l1.9-.7L20 12l-1.6 1.4a8 8 0 0 1 0 2z"/>'
  };
  const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.info}</svg>`;
  document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = svg(node.dataset.icon); });

  const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  let displayName = user.name || user.full_name || user.username || 'there';
  function syncIdentity(profile) {
    user = { ...user, ...profile };
    displayName = user.name || user.full_name || user.username || user.email || 'there';
    const nameInitial = String(displayName).trim().charAt(0).toUpperCase() || 'U';
    document.getElementById('side-avatar').textContent = nameInitial;
    document.getElementById('top-avatar').textContent = nameInitial;
    document.getElementById('side-name').textContent = displayName;
    document.getElementById('side-role').textContent = user.role || 'User';
    document.getElementById('top-name').textContent = displayName;
    document.getElementById('welcome-name').textContent = String(displayName).trim().split(/\s+/)[0] || 'there';
    localStorage.setItem('og_user', JSON.stringify(user));
  }
  syncIdentity(user);
  renderProfile();

  function api(path, options = {}) {
    const isMultipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(options.headers || {}) };
    if (options.body && !isMultipart && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    return fetch(path, { ...options, headers }).then(async (response) => {
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
      if (response.status === 204) return null;
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
      const isCompared = state.compareIds.map(String).includes(String(propertyId));
      return `<article class="property-card"><div class="property-image">${src ? `<img src="${safe(src)}" alt="${safe(property.title || 'Property')}" loading="lazy" onerror="this.remove()">` : ''}<span class="property-purpose">${safe(property.purpose || property.status || 'Property')}</span></div><div class="property-copy"><p class="property-location">${safe([property.type, property.city].filter(Boolean).join(' · ') || 'OG Landmark listing')}</p><h3>${safe(property.title || `Property #${propertyId}`)}</h3><p class="property-price">${money(property.price)}</p></div><div class="property-card-foot"><span>Reference ${safe(propertyId ?? '—')}</span><div><a href="/properties/${encodeURIComponent(propertyId)}" aria-label="View ${safe(property.title || `property ${propertyId}`)}">View</a><button type="button" data-compare-id="${safe(propertyId)}">${isCompared ? 'Remove compare' : 'Compare'}</button></div></div></article>`;
    }).join('');
  }
  function agentAreas(agent) {
    const areas = Array.isArray(agent.areas) ? agent.areas : [];
    return [...new Set([...areas, agent.city].filter(Boolean).map((area) => String(area).trim()).filter(Boolean))];
  }
  function agentSpecialties(agent) {
    if (Array.isArray(agent.specialties)) return agent.specialties.map(String);
    return String(agent.specialization || '').split(',').map((item) => item.trim()).filter(Boolean);
  }
  function agentYears(agent) {
    const direct = Number(agent.years);
    if (Number.isFinite(direct) && direct >= 0) return direct;
    const parsed = Number.parseInt(String(agent.experience || ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
  function filteredAgents() {
    const query = document.getElementById('agent-search').value.trim().toLowerCase();
    const specialty = document.getElementById('agent-specialty').value;
    const area = document.getElementById('agent-area').value;
    const experience = document.getElementById('agent-experience').value;
    const verifiedOnly = document.getElementById('agent-verified').checked;
    return state.agents.filter((agent) => {
      const specialties = agentSpecialties(agent);
      const areas = agentAreas(agent);
      const years = agentYears(agent);
      if (verifiedOnly && agent.verified === false) return false;
      if (specialty && !specialties.some((value) => value.toLowerCase() === specialty.toLowerCase())) return false;
      if (area && !areas.some((value) => value.toLowerCase() === area.toLowerCase())) return false;
      if (experience === 'under5' && years >= 5) return false;
      if (experience === '5to10' && (years < 5 || years > 10)) return false;
      if (experience === 'over10' && years <= 10) return false;
      const searchable = [agent.displayName, agent.name, agent.agency, agent.title, agent.city, ...areas, ...specialties].join(' ').toLowerCase();
      return !query || query.split(/\s+/).every((token) => searchable.includes(token));
    });
  }
  function renderAgents() {
    const target = document.getElementById('agent-grid');
    const areaSelect = document.getElementById('agent-area');
    if (!target || !areaSelect) return;
    const selectedArea = areaSelect.value;
    const areas = [...new Set(state.agents.flatMap(agentAreas))].sort((left, right) => left.localeCompare(right));
    areaSelect.innerHTML = `<option value="">All areas</option>${areas.map((area) => `<option value="${safe(area)}">${safe(area)}</option>`).join('')}`;
    if (areas.includes(selectedArea)) areaSelect.value = selectedArea;
    const filtered = filteredAgents();
    document.getElementById('agent-result-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'Agent' : 'Agents'} found`;
    if (state.failures.agents) {
      target.innerHTML = errorMarkup('agents');
      return;
    }
    if (!filtered.length) {
      target.innerHTML = empty('No Agents match these filters', 'Try another area or specialty, or check back later.');
      return;
    }
    target.innerHTML = filtered.map((agent) => {
      const name = agent.displayName || agent.name || 'Property Agent';
      const image = agent.profilePhoto || agent.photo || '';
      const imageUrl = image && !/^(https?:|data:|\/)/i.test(image) ? `/${image}` : image;
      const agentAreasList = agentAreas(agent);
      const specialties = agentSpecialties(agent);
      const years = agentYears(agent);
      const agency = agent.agency || agent.agencyName || agent.title || 'OG Landmark Agent';
      const rating = Number(agent.rating || 0);
      const whatsappText = encodeURIComponent(`Assalam-o-Alaikum, I would like to speak with ${name} about a property.`);
      return `<article class="agent-card">
        <div class="agent-card-head">${imageUrl ? `<img src="${safe(imageUrl)}" alt="${safe(name)}" loading="lazy" onerror="this.remove()">` : `<span class="agent-avatar">${safe(String(name).split(/\s+/).map((part) => part[0] || '').join('').slice(0, 2).toUpperCase() || 'AG')}</span>`}
          <div class="agent-card-identity"><h2>${safe(name)}</h2><p>${safe(agency)}</p><span class="agent-verified">${agent.verified === false ? 'Agent' : '✓ Verified Agent'}</span></div>
        </div>
        <div class="agent-card-meta"><span>${years} ${years === 1 ? 'year' : 'years'} experience</span>${Number.isFinite(rating) && rating > 0 ? `<span>★ ${safe(rating.toFixed(1))}${agent.reviewCount ? ` · ${safe(agent.reviewCount)} reviews` : ''}</span>` : ''}${Number(agent.propertiesCount ?? agent.listings ?? 0) > 0 ? `<span>${safe(agent.propertiesCount ?? agent.listings)} listings</span>` : ''}</div>
        ${agent.about ? `<p class="agent-about">${safe(agent.about)}</p>` : ''}
        ${specialties.length ? `<div class="agent-tags">${specialties.map((item) => `<span>${safe(item)}</span>`).join('')}</div>` : ''}
        ${agentAreasList.length ? `<p class="agent-areas"><strong>Areas served:</strong> ${safe(agentAreasList.join(', '))}</p>` : ''}
        <div class="agent-card-actions"><a href="tel:+923272569000">Call Agent</a><a href="https://wa.me/923272569000?text=${whatsappText}" target="_blank" rel="noopener noreferrer">WhatsApp</a></div>
      </article>`;
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
    const appointmentRows = state.appointments.map((item) => `<div class="data-row"><div><strong>${safe(item.propertyTitle || 'Property visit')}</strong><small>${safe(item.type || 'Property appointment')}</small></div><div class="data-cell">${date(item.date)}${item.time ? `<small>${safe(item.time)}</small>` : ''}</div><div class="data-cell data-extra">${statusBadge(item.status)}</div><div class="data-cell">${/cancel|complete|reject/i.test(item.status || '') ? '' : `<button type="button" class="row-action" data-cancel-appointment="${safe(item.id)}">Cancel</button>`}</div></div>`).join('');
    document.getElementById('appointments-content').innerHTML = state.failures.appointments ? errorMarkup('appointments') : appointmentRows || empty('No appointments yet', 'Scheduled visits will appear here.');
    const propertySelect = document.getElementById('appointment-property');
    const selectedProperty = propertySelect.value;
    propertySelect.innerHTML = `<option value="">Choose a property</option>${state.properties.map(item => `<option value="${safe(item.id)}">${safe(item.title || `Property #${item.id}`)}${item.city ? ` — ${safe(item.city)}` : ''}</option>`).join('')}`;
    propertySelect.value = selectedProperty;
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
    const statuses = ['All', 'Active', 'Pending', 'Draft', 'Paused', 'Sold', 'Rented'];
    const statusOf = (listing) => {
      if (statuses.includes(listing.listingStatus)) return listing.listingStatus;
      if (listing.approvalStatus === 'Active') return 'Active';
      if (listing.approvalStatus === 'Draft') return 'Draft';
      if (listing.approvalStatus === 'Rejected') return 'Paused';
      return 'Pending';
    };
    document.getElementById('listing-status-tabs').innerHTML = statuses.map((status) => {
      const count = status === 'All' ? state.listings.length : state.listings.filter((listing) => statusOf(listing) === status).length;
      return `<button type="button" class="listing-status-tab ${activeListingFilter === status ? 'is-active' : ''}" data-listing-filter="${status}">${status}<span>${count}</span></button>`;
    }).join('');
    const items = activeListingFilter === 'All' ? state.listings : state.listings.filter((listing) => statusOf(listing) === activeListingFilter);
    if (!items.length) {
      target.innerHTML = empty(state.listings.length ? `No ${activeListingFilter.toLowerCase()} listings` : 'No properties listed yet', 'Your listing activity and review status will appear here.', '<a class="button button-gold" href="/portal/seller-dashboard.html?workflow=listings&amp;mode=add">Post a property</a>');
      return;
    }
    target.innerHTML = items.map((listing) => {
      const id = listing.id;
      const status = statusOf(listing);
      const image = imageOf(listing);
      const actions = [];
      if (status === 'Active') {
        actions.push(`<button type="button" data-listing-status="Paused" data-listing-id="${safe(id)}">Pause</button>`);
        actions.push(`<button type="button" data-listing-status="Sold" data-listing-id="${safe(id)}">Mark sold</button>`);
        actions.push(`<button type="button" data-listing-status="Rented" data-listing-id="${safe(id)}">Mark rented</button>`);
      } else if (status === 'Paused' && listing.approvalStatus !== 'Rejected') {
        actions.push(`<button type="button" data-listing-status="Active" data-listing-id="${safe(id)}">Activate</button>`);
      } else if (status === 'Draft') {
        actions.push(`<button type="button" data-resubmit-listing="${safe(id)}">Submit for review</button>`);
      }
      if (['Rejected', 'Changes Requested'].includes(listing.approvalStatus)) {
        actions.push(`<button type="button" data-resubmit-listing="${safe(id)}">Resubmit</button>`);
      }
      actions.push(`<a href="/portal/seller-dashboard.html?workflow=listings&amp;mode=manage">Edit</a>`);
      const shareText = encodeURIComponent(`${listing.title || `Property #${id}`}\n${listing.city || ''}\n${money(listing.price)}\n\nPosted on OG Landmark — oglandmark.com`);
      actions.push(`<a href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener noreferrer">Share</a>`);
      actions.push(`<button type="button" class="listing-delete" data-delete-listing="${safe(id)}">Delete</button>`);
      return `<article class="user-listing-card">
        <div class="user-listing-media">${image ? `<img src="${safe(image)}" alt="${safe(listing.title || 'Property')}" loading="lazy" onerror="this.remove()">` : '<span>OG</span>'}<span class="status-pill ${safe(status.toLowerCase())}">${safe(status)}</span></div>
        <div class="user-listing-copy"><p>${safe([listing.type, listing.city].filter(Boolean).join(' · '))}</p><h2>${safe(listing.title || `Property #${id}`)}</h2><strong>${money(listing.price)}</strong><small>${safe(listing.approvalStatus || status)}${listing.rejectionReason || listing.changeRequest ? ` · ${safe(listing.rejectionReason || listing.changeRequest)}` : ''}</small></div>
        <div class="user-listing-actions">${actions.join('')}</div>
      </article>`;
    }).join('');
  }
  function renderProfile() {
    const target = document.getElementById('profile-panel');
    if (!target) return;
    const profile = state.account || user;
    target.innerHTML = `<form class="profile-edit-form" id="profile-edit-form">
      <div class="profile-head"><span class="avatar">${safe(String(profile.name || displayName).trim().charAt(0).toUpperCase() || 'U')}</span><div><h2>${safe(profile.name || displayName)}</h2><p>${safe(profile.email || 'OG Landmark account')}</p></div></div>
      <div class="profile-fields">
        <label class="profile-field"><span>Full name</span><input name="name" value="${safe(profile.name || profile.full_name || '')}" maxlength="120" required></label>
        <div class="profile-field"><label>Email address</label><span>${safe(profile.email || 'Not provided')}</span></div>
        <label class="profile-field"><span>Mobile number</span><input name="phone" value="${safe(profile.phone || profile.mobile || '')}" maxlength="40"></label>
        <label class="profile-field"><span>City</span><input name="city" value="${safe(profile.city || '')}" maxlength="100"></label>
        <div class="profile-field"><label>Account type</label><span>${safe(profile.role || 'User')}</span></div>
        <div class="profile-field"><label>Member since</label><span>${safe(profile.joinedDate || '—')}</span></div>
      </div>
      <div class="profile-form-actions"><p class="form-message" id="profile-message" aria-live="polite"></p><button class="button button-gold" type="submit">Save profile</button></div>
    </form>`;
  }
  function renderCompare() {
    const target = document.getElementById('compare-content');
    if (state.failures.compareIds) { target.innerHTML = errorMarkup('compareIds'); return; }
    if (!state.compareProperties.length) {
      target.innerHTML = empty('No properties selected', 'Use Compare on any property card to add up to three homes.', '<button type="button" data-go="properties">Browse properties</button>');
      return;
    }
    const properties = state.compareProperties;
    const facts = [['Price', (item) => money(item.price)], ['Location', (item) => [item.city, item.address].filter(Boolean).join(', ') || '—'], ['Type', (item) => item.type || '—'], ['Purpose', (item) => item.purpose || '—'], ['Bedrooms', (item) => item.bedrooms ?? '—'], ['Bathrooms', (item) => item.bathrooms ?? '—'], ['Area', (item) => [item.area, item.areaUnit].filter(Boolean).join(' ') || '—']];
    target.innerHTML = `<div class="compare-toolbar"><span>${properties.length} of 3 properties</span><button type="button" data-clear-compare>Clear comparison</button></div><div class="compare-table" style="grid-template-columns:minmax(100px,.6fr) repeat(${properties.length},minmax(130px,1fr))"><div class="compare-label"></div>${properties.map((item) => `<div class="compare-property"><strong>${safe(item.title || `Property #${item.id}`)}</strong><button type="button" data-compare-id="${safe(item.id)}">Remove</button><button class="text-link" type="button" data-property-id="${safe(item.id)}">View details</button></div>`).join('')}${facts.map(([label, value]) => `<div class="compare-label">${safe(label)}</div>${properties.map((item) => `<div>${safe(value(item))}</div>`).join('')}`).join('')}</div>`;
  }
  function renderAlerts() {
    const target = document.getElementById('alerts-content');
    if (state.failures.alerts) { target.innerHTML = errorMarkup('alerts'); return; }
    const items = state.alerts.map((item) => {
      const filters = item.filters || {};
      const details = [filters.location, filters.type || filters.category, filters.minPrice && `From ${money(filters.minPrice)}`, filters.maxPrice && `Up to ${money(filters.maxPrice)}`].filter(Boolean).join(' · ');
      return `<div class="tool-row"><div><strong>${safe(item.label || item.query || 'Property search')}</strong><small>${safe(details || item.query || 'Saved property search')}</small><small>Saved ${date(item.savedAt || item.createdAt)}</small></div><button type="button" data-delete-alert="${safe(item.id)}">Remove</button></div>`;
    }).join('');
    target.innerHTML = `<form class="save-alert-form" id="save-alert-form"><label>Search alert name<input name="label" maxlength="80" placeholder="e.g. Apartments in Lahore" required></label><button class="button button-gold" type="submit">Save current search as alert</button><small>Uses the filters from Browse properties.</small></form>${items || empty('No property alerts yet', 'Save a search to keep its filters with your account.')}`;
  }
  function renderTracking() {
    const target = document.getElementById('tracking-content');
    if (state.failures.tracking) { target.innerHTML = errorMarkup('tracking'); return; }
    const items = state.tracking.map((item) => `<div class="tool-row"><div><strong>${safe(item.propertyTitle || `Property #${item.propertyId}`)}</strong><small>${safe([item.propertyType, item.propertyCity].filter(Boolean).join(' · ') || 'Recently viewed')}</small><small>${money(item.propertyPrice)} · Viewed ${date(item.viewedAt || item.createdAt)}</small></div>${item.propertyId ? `<button type="button" data-property-id="${safe(item.propertyId)}">View</button>` : ''}</div>`).join('');
    target.innerHTML = items || empty('No tracked properties yet', 'Properties you view in the mobile app will appear here.');
  }
  function renderDocuments() {
    document.getElementById('documents-content').innerHTML = `<div class="tool-summary"><span class="tool-icon">${svg('document')}</span><div><small>Private account files</small><strong>Document storage is not available on this website yet</strong><p>No sample documents are shown. This section will display your files once private account storage is connected.</p></div></div>`;
  }
  const CALC_MARLA_SQFT = 272.25;
  const CALC_KANAL_SQFT = 5445;
  const CALC_ACRE_SQFT = 43560;
  const CALC_SQM_SQFT = 10.763910416709722;
  function formatCalc(value, digits = 2) {
    return new Intl.NumberFormat('en-PK', { maximumFractionDigits: digits }).format(value);
  }
  function renderPlotFields() {
    const corners = Number(document.getElementById('plot-corners').value);
    const mode = document.getElementById('plot-mode').value;
    const sides = Array.from({ length: corners }, (_, index) => {
      const letter = String.fromCharCode(65 + index);
      const next = String.fromCharCode(65 + ((index + 1) % corners));
      return { key: letter, label: `Side ${letter}–${next}` };
    });
    const diagonals = mode === 'accurate'
      ? Array.from({ length: Math.max(0, corners - 3) }, (_, index) => {
          const target = String.fromCharCode(67 + index);
          return { key: `A${target}`, label: `Diagonal A–${target}` };
        })
      : [];
    const fields = [...sides, ...diagonals];
    document.getElementById('plot-fields').innerHTML = fields.map((field) =>
      `<label>${safe(field.label)}<input name="measurement-${safe(field.key)}" data-measurement="${safe(field.key)}" type="number" min="0" step="any" required placeholder="Enter measurement"></label>`
    ).join('');
    document.getElementById('plot-result').innerHTML = '';
  }
  function triangleArea(a, b, c) {
    const [longest, middle, shortest] = [a, b, c].sort((left, right) => right - left);
    const term = shortest - (longest - middle);
    if (!Number.isFinite(term) || term <= 0) return null;
    const product = (longest + (middle + shortest)) * term
      * (shortest + (longest - middle)) * (longest + (middle - shortest));
    return Number.isFinite(product) && product > 0 ? Math.sqrt(product) / 4 : null;
  }
  function estimatedTriangleArea(a, b, c) {
    const [base, sideA, sideB] = [a, b, c].sort((left, right) => right - left);
    return (base * (sideA + sideB)) / 4;
  }
  function plotAreaResult(corners, raw, unit, mode) {
    const factor = unit === 'in' ? 1 / 12 : unit === 'm' ? 3.280839895 : 1;
    const keys = Array.from({ length: corners }, (_, index) => String.fromCharCode(65 + index));
    const required = mode === 'accurate' && corners > 3
      ? [...keys, ...Array.from({ length: corners - 3 }, (_, index) => `A${String.fromCharCode(67 + index)}`)]
      : keys;
    for (const key of required) {
      const input = raw[key];
      if (!input || !Number.isFinite(Number(input)) || Number(input) <= 0) {
        return { error: `Enter a measurement greater than zero for ${key}.` };
      }
    }
    const value = (key) => Number(raw[key]) * factor;
    let sqft = 0;
    let estimate = false;
    if (corners === 3) {
      const exact = triangleArea(value('A'), value('B'), value('C'));
      sqft = exact ?? estimatedTriangleArea(value('A'), value('B'), value('C'));
      estimate = exact === null;
    } else if (mode === 'basic') {
      if (corners !== 4) return { error: 'Side lengths alone cannot determine an irregular plot. Use accurate mode and enter the diagonals.' };
      sqft = ((value('A') + value('C')) / 2) * ((value('B') + value('D')) / 2);
      estimate = true;
    } else {
      const diagonalKeys = Array.from({ length: corners - 3 }, (_, index) => `A${String.fromCharCode(67 + index)}`);
      const addTriangle = (a, b, c) => {
        const exact = triangleArea(a, b, c);
        sqft += exact ?? estimatedTriangleArea(a, b, c);
        estimate ||= exact === null;
      };
      addTriangle(value('A'), value('B'), value(diagonalKeys[0]));
      for (let index = 1; index < diagonalKeys.length; index += 1) {
        addTriangle(value(diagonalKeys[index - 1]), value(keys[index + 1]), value(diagonalKeys[index]));
      }
      const lastDiagonal = diagonalKeys[diagonalKeys.length - 1];
      addTriangle(value(lastDiagonal), value(keys[corners - 2]), value(keys[corners - 1]));
    }
    return { sqft, estimate };
  }
  function renderUnitConversion() {
    const unit = document.getElementById('converter-unit').value;
    const input = Number(document.getElementById('converter-value').value);
    const output = document.getElementById('converter-results');
    if (!Number.isFinite(input) || input <= 0) { output.innerHTML = ''; return; }
    const toSqft = { marla: CALC_MARLA_SQFT, kanal: CALC_KANAL_SQFT, acre: CALC_ACRE_SQFT, sqft: 1, sqm: CALC_SQM_SQFT };
    const sqft = input * toSqft[unit];
    const conversions = [
      ['Square feet', sqft, 'sqft'],
      ['Square metres', sqft / CALC_SQM_SQFT, 'sqm'],
      ['Marla', sqft / CALC_MARLA_SQFT, 'marla'],
      ['Kanal', sqft / CALC_KANAL_SQFT, 'kanal'],
      ['Acre', sqft / CALC_ACRE_SQFT, 'acre'],
    ].filter(([, , key]) => key !== unit);
    output.innerHTML = conversions.map(([label, value]) => `<div class="tool-row"><strong>${label}</strong><span>${formatCalc(value, 5)}</span></div>`).join('');
  }
  function renderPlotResult(result) {
    const target = document.getElementById('plot-result');
    if (result.error) {
      target.innerHTML = `<div class="capability-note" role="alert"><strong>Check measurements</strong><p>${safe(result.error)}</p></div>`;
      return;
    }
    const { sqft, estimate } = result;
    const values = [
      ['Square feet', sqft, 2],
      ['Square yards', sqft / 9, 2],
      ['Square metres', sqft / CALC_SQM_SQFT, 3],
      ['Marla', sqft / CALC_MARLA_SQFT, 4],
      ['Kanal', sqft / CALC_KANAL_SQFT, 4],
      ['Acre', sqft / CALC_ACRE_SQFT, 5],
    ];
    target.innerHTML = `<div class="tool-summary"><span class="tool-icon">${svg('compare')}</span><div><small>${estimate ? 'Approximate estimate' : 'Accurate from entered measurements'}</small><strong>${formatCalc(sqft, 2)} sq ft</strong><p>${estimate ? 'This result is an estimate. Enter valid diagonals for exact irregular-plot triangulation.' : 'Area is triangulated from the entered boundary measurements.'}</p></div></div>${values.map(([label, value, digits]) => `<div class="tool-row"><strong>${label}</strong><span>${formatCalc(value, digits)}</span></div>`).join('')}`;
  }
  const preferenceLabels = { properties: 'Property updates', projects: 'Project updates', announcements: 'Announcements', promotional: 'Promotional messages', account: 'Account updates', system: 'System updates' };
  function renderSettings() {
    const accountForm = document.getElementById('account-settings-form');
    const preferencesForm = document.getElementById('notification-settings-form');
    if (state.failures.account) accountForm.innerHTML = errorMarkup('account');
    else {
      const profile = state.account || user;
      accountForm.innerHTML = `<h2>Contact details</h2><p>Updates are saved to your OG Landmark account.</p><label>Full name<input name="name" value="${safe(profile.name || profile.full_name || '')}" maxlength="120" required></label><label>Phone<input name="phone" value="${safe(profile.phone || profile.mobile || '')}" maxlength="40"></label><label>City<input name="city" value="${safe(profile.city || '')}" maxlength="100"></label><button class="button button-gold" type="submit">Save contact details</button><p class="form-message" id="account-settings-message" aria-live="polite"></p>`;
    }
    if (state.failures.notificationPreferences) preferencesForm.innerHTML = errorMarkup('notificationPreferences');
    else {
      const prefs = state.notificationPreferences || {};
      preferencesForm.innerHTML = `<h2>Notification preferences</h2><p>Choose which account updates you receive.</p>${Object.entries(preferenceLabels).map(([key, label]) => `<label class="preference-toggle"><span>${label}</span><input type="checkbox" name="${key}" ${prefs[key] !== false ? 'checked' : ''}></label>`).join('')}<label>Delivery frequency<select name="frequency"><option value="immediate" ${prefs.frequency === 'immediate' ? 'selected' : ''}>Immediately</option><option value="daily" ${prefs.frequency === 'daily' ? 'selected' : ''}>Daily</option><option value="weekly" ${prefs.frequency === 'weekly' ? 'selected' : ''}>Weekly</option></select></label><button class="button button-gold" type="submit">Save notification preferences</button><p class="form-message" id="notification-settings-message" aria-live="polite"></p>`;
    }
  }
  function renderMessages() {
    const list = document.getElementById('conversations-content');
    const thread = document.getElementById('messages-content');
    if (state.failures.conversations) list.innerHTML = errorMarkup('conversations');
    else if (!state.conversations.length) list.innerHTML = empty('No messages yet', 'Conversations started from a property inquiry will appear here.');
    else list.innerHTML = state.conversations.map((item) => `<button class="conversation-item ${String(item.id) === String(state.activeConversation?.id) ? 'is-active' : ''}" type="button" data-conversation-id="${safe(item.id)}"><strong>${safe(item.otherUserName || item.propertyTitle || `Conversation #${item.id}`)}</strong><small>${safe(item.propertyTitle || item.lastMessage || 'Open conversation')}</small><time>${date(item.lastMessageAt || item.createdAt)}</time></button>`).join('');
    if (!state.activeConversation) {
      thread.innerHTML = empty('Choose a conversation', 'Select a conversation to read and reply to messages.');
      return;
    }
    if (state.failures.messages) { thread.innerHTML = errorMarkup('messages'); return; }
    const items = state.messages.map((item) => `<div class="chat-message ${String(item.senderId) === String(user.id) ? 'from-me' : ''}"><p>${safe(item.text || '')}</p><time>${date(item.createdAt)}</time></div>`).join('');
    thread.innerHTML = `<div class="thread-heading"><strong>${safe(state.activeConversation.otherUserName || state.activeConversation.propertyTitle || 'Conversation')}</strong><small>${safe(state.activeConversation.propertyTitle || '')}</small></div><div class="thread-messages">${items || '<p class="thread-empty">No messages in this conversation yet.</p>'}</div><form class="send-message-form" id="send-message-form"><input name="text" maxlength="2000" placeholder="Write a message…" required><button class="button button-gold" type="submit">Send</button></form>`;
  }
  function renderAll() {
    updateCounts();
    renderProfile();
    document.getElementById('activity-list').innerHTML = state.failures.activity ? errorMarkup('activity') : activityMarkup();
    document.getElementById('saved-preview').innerHTML = savedPreviewMarkup();
    document.getElementById('property-grid').innerHTML = state.failures.properties ? errorMarkup('properties') : cards(filteredProperties(), { emptyTitle: 'No properties found', emptyText: 'Try a different search or check back later.' });
    renderAgents();
    document.getElementById('saved-grid').innerHTML = state.failures.saved ? errorMarkup('saved') : state.failures.savedDetails ? empty('Saved details are temporarily unavailable', 'Your saved properties are still in your account. Try again shortly.', '<button type="button" data-retry="saved">Try again</button>') : cards(state.savedProperties, { emptyTitle: 'No saved properties yet', emptyText: 'Browse the listings and save properties to build your shortlist.', emptyAction: '<button type="button" data-go="properties">Browse properties</button>' });
    document.getElementById('wishlist-grid').innerHTML = state.failures.saved ? errorMarkup('saved') : cards(state.savedProperties, { emptyTitle: 'Your wishlist is empty', emptyText: 'Save a property in the mobile app or browse listings here to build your wishlist.', emptyAction: '<button type="button" data-go="properties">Browse properties</button>' });
    renderTables();
    renderListings();
    renderCompare();
    renderAlerts();
    renderTracking();
    renderDocuments();
    renderMessages();
    renderSettings();
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
    if (loadInProgress) return;
    loadInProgress = true;
    state.failures = {};
    state.savedProperties = [];
    await Promise.all([
      load('properties', '/api/properties', propertyRows),
      load('agents', '/api/mobile-agents', (data) => rows(data).filter((agent) =>
        String(agent.status || '').toLowerCase() === 'active'
        && String(agent.approvalStatus || '').toLowerCase() === 'approved'
        && agent.visible !== false
      )),
      load('inquiries', `/api/inquiries?buyer_id=${encodeURIComponent(user.id)}`, (data) => rows(data, ['inquiries'])),
      load('appointments', `/api/appointments?buyer_id=${encodeURIComponent(user.id)}`, (data) => rows(data, ['appointments'])),
      load('offers', `/api/offers?buyer_id=${encodeURIComponent(user.id)}`, (data) => rows(data, ['offers'])),
      load('savedIds', `/api/saved/${encodeURIComponent(user.id)}`, (data) => {
        const values = Array.isArray(data) ? data : data?.property_ids || data?.saved || data?.ids || data?.data || [];
        return Array.isArray(values) ? values.map((entry) => String(typeof entry === 'object' ? entry.property_id ?? entry.propertyId ?? entry.id : entry)) : [];
      }),
      load('notifications', '/api/notifications', (data) => rows(data, ['notifications', 'items'])),
      load('listings', '/api/my-properties', propertyRows),
      load('account', '/api/account', (data) => data),
      load('alerts', '/api/saved-searches', (data) => rows(data)),
      load('compareIds', '/api/comparison', (data) => Array.isArray(data) ? data.map(String) : []),
      load('tracking', '/api/visit-history', (data) => rows(data)),
      load('conversations', '/api/conversations', (data) => rows(data)),
      load('notificationPreferences', '/api/notification-preferences', (data) => data)
    ]);
    if (!state.failures.account && state.account) syncIdentity(state.account);
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
    if (!state.failures.compareIds) {
      const catalog = new Map([...state.properties, ...state.savedProperties].map((property) => [String(property.id), property]));
      const details = await Promise.all(state.compareIds.map(async (id) => {
        if (catalog.has(id)) return catalog.get(id);
        try { return await api(`/api/properties/${encodeURIComponent(id)}`); } catch { return null; }
      }));
      state.compareProperties = details.filter(Boolean);
    }
    if (state.conversations.length) {
      const active = state.conversations.find((item) => String(item.id) === String(state.activeConversation?.id)) || state.conversations[0];
      await loadConversationMessages(active);
    } else {
      state.activeConversation = null;
      state.messages = [];
    }
    renderAll();
    loadInProgress = false;
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
  async function loadConversationMessages(conversation) {
    state.activeConversation = conversation;
    try {
      state.messages = rows(await api(`/api/conversations/${encodeURIComponent(conversation.id)}/messages`));
      delete state.failures.messages;
    } catch (error) {
      state.messages = [];
      state.failures.messages = error.message;
    }
    renderMessages();
  }
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2600);
  }
  async function toggleCompare(id) {
    const key = String(id);
    const next = state.compareIds.includes(key)
      ? state.compareIds.filter((item) => item !== key)
      : [...state.compareIds, key];
    if (next.length > 3) {
      showToast('You can compare up to three properties.');
      return;
    }
    try {
      const result = await api('/api/comparison', { method: 'PUT', body: JSON.stringify({ propertyIds: next.map(Number) }) });
      state.compareIds = Array.isArray(result) ? result.map(String) : next;
      const catalog = new Map([...state.properties, ...state.savedProperties].map((property) => [String(property.id), property]));
      state.compareProperties = (await Promise.all(state.compareIds.map(async (propertyId) => {
        if (catalog.has(propertyId)) return catalog.get(propertyId);
        try { return await api(`/api/properties/${encodeURIComponent(propertyId)}`); } catch { return null; }
      }))).filter(Boolean);
      renderAll();
    } catch (error) { showToast(error.message); }
  }
  async function updateMyListingStatus(id, listingStatus) {
    if (['Paused', 'Sold', 'Rented'].includes(listingStatus) && !window.confirm(`Change this listing to ${listingStatus.toLowerCase()}?`)) return;
    try {
      await api(`/api/properties/${encodeURIComponent(id)}/listing-status`, {
        method: 'PATCH',
        body: JSON.stringify({ listingStatus })
      });
      await loadAll();
      showToast(`Listing updated to ${listingStatus}.`);
    } catch (error) {
      showToast(error.message);
    }
  }
  async function deleteMyListing(id) {
    if (!window.confirm('Delete this listing permanently?')) return;
    try {
      await api(`/api/properties/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadAll();
      showToast('Listing deleted.');
    } catch (error) {
      showToast(error.message);
    }
  }
  async function resubmitMyListing(id) {
    try {
      await api(`/api/properties/${encodeURIComponent(id)}/resubmit`, { method: 'PATCH' });
      await loadAll();
      showToast('Listing submitted for review.');
    } catch (error) {
      showToast(error.message);
    }
  }
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
    const conversationButton = event.target.closest('[data-conversation-id]');
    const compareButton = event.target.closest('[data-compare-id]');
    const clearCompareButton = event.target.closest('[data-clear-compare]');
    const deleteAlertButton = event.target.closest('[data-delete-alert]');
    const listingFilter = event.target.closest('[data-listing-filter]');
    const listingStatus = event.target.closest('[data-listing-status]');
    const deleteListing = event.target.closest('[data-delete-listing]');
    const resubmitListing = event.target.closest('[data-resubmit-listing]');
    const cancelAppointment = event.target.closest('[data-cancel-appointment]');
    if (pageButton || goButton || notification || closeProperty || conversationButton || compareButton || clearCompareButton || deleteAlertButton || listingFilter || listingStatus || deleteListing || resubmitListing || cancelAppointment) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (pageButton) go(pageButton.dataset.page);
    if (goButton) go(goButton.dataset.go);
    if (retryButton) loadAll();
    if (notification) handleNotification(state.notifications[Number(notification.dataset.notificationIndex)]);
    if (closeProperty) closePropertyDetail();
    if (propertyButton && propertyButton.dataset.propertyId) openPropertyDetail(propertyButton.dataset.propertyId);
    if (conversationButton) loadConversationMessages(state.conversations.find((item) => String(item.id) === conversationButton.dataset.conversationId));
    if (compareButton) toggleCompare(compareButton.dataset.compareId);
    if (clearCompareButton) api('/api/comparison', { method: 'DELETE' }).then(() => {
      state.compareIds = [];
      state.compareProperties = [];
      renderAll();
    }).catch((error) => showToast(error.message));
    if (deleteAlertButton) api(`/api/saved-searches/${encodeURIComponent(deleteAlertButton.dataset.deleteAlert)}`, { method: 'DELETE' }).then(() => {
      state.alerts = state.alerts.filter((item) => String(item.id) !== deleteAlertButton.dataset.deleteAlert);
      renderAlerts();
      showToast('Property alert removed.');
    }).catch((error) => showToast(error.message));
    if (listingFilter) {
      activeListingFilter = listingFilter.dataset.listingFilter;
      renderListings();
    }
    if (listingStatus) updateMyListingStatus(listingStatus.dataset.listingId, listingStatus.dataset.listingStatus);
    if (deleteListing) deleteMyListing(deleteListing.dataset.deleteListing);
    if (resubmitListing) resubmitMyListing(resubmitListing.dataset.resubmitListing);
    if (cancelAppointment) {
      api(`/api/appointments/${encodeURIComponent(cancelAppointment.dataset.cancelAppointment)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Cancelled' })
      }).then(async () => {
        await loadAll();
        showToast('Appointment cancelled.');
      }).catch(error => showToast(error.message));
    }
  });
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'unit-converter-form') {
      event.preventDefault();
      renderUnitConversion();
    } else if (form.id === 'plot-calculator-form') {
      event.preventDefault();
      const raw = Object.fromEntries(
        [...form.querySelectorAll('[data-measurement]')].map((input) => [input.dataset.measurement, input.value]),
      );
      renderPlotResult(plotAreaResult(
        Number(document.getElementById('plot-corners').value),
        raw,
        document.getElementById('plot-unit').value,
        document.getElementById('plot-mode').value,
      ));
    } else if (form.id === 'save-alert-form') {
      event.preventDefault();
      const values = new FormData(form);
      const query = document.getElementById('property-filter').value.trim();
      const purpose = document.getElementById('purpose-filter').value;
      const label = String(values.get('label') || '').trim();
      try {
        const alert = await api('/api/saved-searches', {
          method: 'POST',
          body: JSON.stringify({ label, query, filters: { location: query, transaction: purpose } })
        });
        state.alerts.unshift(alert);
        renderAlerts();
        showToast('Property alert saved to your account.');
      } catch (error) { showToast(error.message); }
    } else if (form.id === 'appointment-request-form') {
      event.preventDefault();
      const values = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      const message = document.getElementById('appointment-message');
      button.disabled = true;
      message.textContent = '';
      try {
        await api('/api/appointments', {
          method: 'POST',
          body: JSON.stringify({
            propertyId: Number(values.get('propertyId')),
            date: String(values.get('date') || ''),
            time: String(values.get('time') || ''),
            type: String(values.get('type') || 'Site Visit')
          })
        });
        form.reset();
        button.disabled = false;
        await loadAll();
        showToast('Appointment request submitted.');
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    } else if (form.id === 'profile-edit-form') {
      event.preventDefault();
      const values = new FormData(form);
      const button = form.querySelector('button[type="submit"]');
      const message = document.getElementById('profile-message');
      button.disabled = true;
      try {
        state.account = await api('/api/account', {
          method: 'PUT',
          body: JSON.stringify({
            name: String(values.get('name') || '').trim(),
            phone: String(values.get('phone') || '').trim(),
            city: String(values.get('city') || '').trim()
          })
        });
        syncIdentity(state.account);
        renderProfile();
        showToast('Profile updated.');
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    } else if (form.id === 'send-message-form') {
      event.preventDefault();
      const text = String(new FormData(form).get('text') || '').trim();
      if (!text || !state.activeConversation) return;
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const sent = await api(`/api/conversations/${encodeURIComponent(state.activeConversation.id)}/messages`, {
          method: 'POST',
          body: JSON.stringify({ senderId: user.id, text })
        });
        state.messages.push(sent);
        const conversation = state.conversations.find((item) => String(item.id) === String(state.activeConversation.id));
        if (conversation) {
          conversation.lastMessage = sent.text;
          conversation.lastMessageAt = sent.createdAt;
        }
        renderMessages();
      } catch (error) {
        showToast(error.message);
        button.disabled = false;
      }
    } else if (form.id === 'account-settings-form') {
      event.preventDefault();
      const values = new FormData(form);
      const submit = form.querySelector('button[type="submit"]');
      const message = document.getElementById('account-settings-message');
      submit.disabled = true;
      try {
        state.account = await api('/api/account', {
          method: 'PUT',
          body: JSON.stringify({
            name: String(values.get('name') || '').trim(),
            phone: String(values.get('phone') || '').trim(),
            city: String(values.get('city') || '').trim()
          })
        });
        syncIdentity(state.account);
        const updatedName = user.name || displayName;
        document.getElementById('side-name').textContent = updatedName;
        document.getElementById('top-name').textContent = updatedName;
        const updatedInitial = String(updatedName).trim().charAt(0).toUpperCase() || 'U';
        document.getElementById('side-avatar').textContent = updatedInitial;
        document.getElementById('top-avatar').textContent = updatedInitial;
        document.getElementById('welcome-name').textContent = String(updatedName).trim().split(/\s+/)[0] || 'there';
        renderProfile();
        renderSettings();
        document.getElementById('account-settings-message').textContent = 'Contact details saved.';
      } catch (error) {
        message.textContent = error.message;
        submit.disabled = false;
      }
    } else if (form.id === 'notification-settings-form') {
      event.preventDefault();
      const values = new FormData(form);
      const preferences = Object.fromEntries(Object.keys(preferenceLabels).map((key) => [key, values.has(key)]));
      preferences.frequency = String(values.get('frequency') || 'immediate');
      const submit = form.querySelector('button[type="submit"]');
      const message = document.getElementById('notification-settings-message');
      submit.disabled = true;
      try {
        state.notificationPreferences = await api('/api/notification-preferences', {
          method: 'PUT',
          body: JSON.stringify(preferences)
        });
        renderSettings();
        document.getElementById('notification-settings-message').textContent = 'Notification preferences saved.';
      } catch (error) {
        message.textContent = error.message;
        submit.disabled = false;
      }
    }
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
  document.getElementById('agent-search').addEventListener('input', renderAgents);
  ['agent-specialty', 'agent-area', 'agent-experience', 'agent-verified'].forEach((id) => {
    document.getElementById(id).addEventListener('change', renderAgents);
  });
  document.getElementById('agent-clear-filters').addEventListener('click', () => {
    document.getElementById('agent-search').value = '';
    document.getElementById('agent-specialty').value = '';
    document.getElementById('agent-area').value = '';
    document.getElementById('agent-experience').value = '';
    document.getElementById('agent-verified').checked = true;
    renderAgents();
  });
  document.getElementById('converter-unit').addEventListener('change', renderUnitConversion);
  document.getElementById('converter-value').addEventListener('input', renderUnitConversion);
  document.getElementById('plot-corners').addEventListener('change', renderPlotFields);
  document.getElementById('plot-mode').addEventListener('change', renderPlotFields);
  renderPlotFields();
  document.getElementById('mobile-menu').addEventListener('click', () => {
    document.getElementById('sidebar').classList.add('is-open');
    document.getElementById('mobile-shade').classList.add('is-open');
  });
  document.getElementById('mobile-shade').addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('is-open');
    document.getElementById('mobile-shade').classList.remove('is-open');
  });
  document.getElementById('logout').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Signing out…';
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      });
    } catch {
      // A network failure must not leave the account open in this browser.
    } finally {
      localStorage.removeItem('og_token');
      localStorage.removeItem('og_user');
      window.location.replace('/auth?mode=login');
    }
  });
  const refreshIfIdle = () => {
    const active = document.activeElement;
    if (document.visibilityState === 'visible' && !active?.closest?.('form')) void loadAll();
  };
  window.addEventListener('focus', refreshIfIdle);
  window.setInterval(refreshIfIdle, 15_000);
  loadAll();
})();
