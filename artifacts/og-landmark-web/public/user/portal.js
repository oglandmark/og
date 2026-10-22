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

  const state = {
    properties: [], savedProperties: [], inquiries: [], appointments: [], offers: [], savedIds: [],
    notifications: [], listings: [], compareIds: [], compareProperties: [], alerts: [], messages: [],
    conversations: [], activeConversation: null, tracking: [], verificationRequests: [], account: null,
    notificationPreferences: null, failures: {}
  };
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

  function api(path, options = {}) {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
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
      return `<article class="property-card"><div class="property-image">${src ? `<img src="${safe(src)}" alt="${safe(property.title || 'Property')}" loading="lazy" onerror="this.remove()">` : ''}<span class="property-purpose">${safe(property.purpose || property.status || 'Property')}</span></div><div class="property-copy"><p class="property-location">${safe([property.type, property.city].filter(Boolean).join(' · ') || 'OG Landmark listing')}</p><h3>${safe(property.title || `Property #${propertyId}`)}</h3><p class="property-price">${money(property.price)}</p></div><div class="property-card-foot"><span>Reference ${safe(propertyId ?? '—')}</span><div><button type="button" data-property-id="${safe(propertyId)}">View</button><button type="button" data-compare-id="${safe(propertyId)}">${isCompared ? 'Remove compare' : 'Compare'}</button></div></div></article>`;
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
    const profile = state.account || user;
    const fields = [
      ['Full name', profile.name || profile.full_name || profile.username],
      ['Email address', profile.email],
      ['Mobile number', profile.phone || profile.mobile],
      ['Account type', profile.role],
      ['Username', profile.username],
      ['Account ID', profile.id]
    ];
    target.innerHTML = `<div class="profile-head"><span class="avatar">${safe(initial)}</span><div><h2>${safe(profile.name || displayName)}</h2><p>${safe(profile.email || 'OG Landmark account')}</p></div></div><div class="profile-fields">${fields.map(([label, value]) => `<div class="profile-field"><label>${safe(label)}</label><span>${safe(value || 'Not provided')}</span></div>`).join('')}</div>`;
  }
  function renderKyc() {
    const target = document.getElementById('kyc-content');
    if (state.failures.verificationRequests || state.failures.account) {
      target.innerHTML = errorMarkup(state.failures.verificationRequests ? 'verificationRequests' : 'account');
      return;
    }
    const profile = state.account || user;
    const status = profile.kycStatus || profile.verificationStatus || ((profile.isVerified || profile.verified) ? 'Verified' : 'Not submitted');
    const requests = state.verificationRequests.map((item) => `<div class="tool-row"><div><strong>${safe(item.title || item.type || item.requestType || 'Verification request')}</strong><small>Submitted ${date(item.createdAt || item.date)}</small></div>${statusBadge(item.status || 'Pending')}</div>`).join('');
    target.innerHTML = `<div class="tool-summary"><span class="tool-icon">${svg('shield')}</span><div><small>Current status</small><strong>${safe(status)}</strong><p>${state.verificationRequests.length ? `${state.verificationRequests.length} verification request(s) are linked to your account.` : 'No verification request is currently listed for your account.'}</p></div></div>${requests || ''}<div class="capability-note"><strong>Need to submit identity documents?</strong><p>KYC document submission is not available in this web portal. Contact OG Landmark support to complete verification.</p></div>`;
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
    document.getElementById('documents-content').innerHTML = `<div class="tool-summary"><span class="tool-icon">${svg('document')}</span><div><small>Documents</small><strong>No web documents workspace</strong><p>The available document manager is limited to Developer project documents. Personal user documents are not available through an account API on web.</p></div></div>`;
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
    document.getElementById('saved-grid').innerHTML = state.failures.saved ? errorMarkup('saved') : state.failures.savedDetails ? empty('Saved details are temporarily unavailable', 'Your saved properties are still in your account. Try again shortly.', '<button type="button" data-retry="saved">Try again</button>') : cards(state.savedProperties, { emptyTitle: 'No saved properties yet', emptyText: 'Browse the listings and save properties to build your shortlist.', emptyAction: '<button type="button" data-go="properties">Browse properties</button>' });
    document.getElementById('wishlist-grid').innerHTML = state.failures.saved ? errorMarkup('saved') : cards(state.savedProperties, { emptyTitle: 'Your wishlist is empty', emptyText: 'Save a property in the mobile app or browse listings here to build your wishlist.', emptyAction: '<button type="button" data-go="properties">Browse properties</button>' });
    renderTables();
    renderListings();
    renderKyc();
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
      load('listings', `/api/properties?seller_id=${encodeURIComponent(user.id)}`, propertyRows),
      load('account', '/api/account', (data) => data),
      load('verificationRequests', '/api/verification-requests', (data) => rows(data)),
      load('alerts', '/api/saved-searches', (data) => rows(data)),
      load('compareIds', '/api/comparison', (data) => Array.isArray(data) ? data.map(String) : []),
      load('tracking', '/api/visit-history', (data) => rows(data)),
      load('conversations', '/api/conversations', (data) => rows(data)),
      load('notificationPreferences', '/api/notification-preferences', (data) => data)
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
    if (pageButton || goButton || notification || closeProperty || conversationButton || compareButton || clearCompareButton || deleteAlertButton) {
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
  });
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.id === 'save-alert-form') {
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
        user = { ...user, ...state.account };
        localStorage.setItem('og_user', JSON.stringify(user));
        const updatedName = user.name || displayName;
        document.getElementById('side-name').textContent = updatedName;
        document.getElementById('top-name').textContent = updatedName;
        const updatedInitial = String(updatedName).trim().charAt(0).toUpperCase() || 'U';
        document.getElementById('side-avatar').textContent = updatedInitial;
        document.getElementById('top-avatar').textContent = updatedInitial;
        document.getElementById('welcome-name').textContent = String(updatedName).trim().split(/\s+/)[0] || 'there';
        renderProfile();
        renderKyc();
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
