(function () {
  if (window.__ogPropertyManagementMounted) return;
  window.__ogPropertyManagementMounted = true;

  const originalFetch = window.fetch.bind(window);
  let properties = [];
  let agents = [];
  const propertyViews = new Set(['listed', 'in-progress', 'closed']);
  const requestedView = new URLSearchParams(window.location.search).get('propertyView');
  let filter = propertyViews.has(requestedView) ? requestedView : 'all';
  let observer;
  let enhancementQueued = false;
  let modal;
  let propertyMap;
  let leafletPromise;
  let agentsLoaded = false;
  let agentDirectoryMessage = '';
  let propertyLoadError = '';
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const statusOf = (property) => normalize(property.approvalStatus || property.listingStatus || 'pending');
  const statusesOf = (property) => [
    normalize(property.approvalStatus),
    normalize(property.listingStatus),
    normalize(property.status),
  ].filter(Boolean);
  const matchesFilter = (property, value) => {
    if (value === 'all') return true;
    const statuses = statusesOf(property);
    if (value === 'listed') {
      const approval = normalize(property.approvalStatus || 'active');
      const listing = normalize(property.listingStatus || property.status || 'active');
      return ['active', 'approved', 'listed'].includes(approval)
        && ['active', 'approved', 'listed'].includes(listing);
    }
    if (value === 'in-progress') {
      return statuses.some((status) => ['pending', 'changes requested', 'in progress', 'under review'].includes(status));
    }
    if (value === 'closed') {
      return statuses.some((status) => ['closed', 'sold', 'rented', 'expired', 'archived', 'rejected', 'inactive'].includes(status));
    }
    return statusOf(property) === value;
  };
  const apiBase = () => String(window.__OG_API_BASE__ || '/api').replace(/\/+$/, '');
  const propertyList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.properties)) return payload.properties;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };
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
        const list = propertyList(payload);
        if (list.length || Array.isArray(payload) || Array.isArray(payload?.properties) || Array.isArray(payload?.data)) {
          properties = list;
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
    const heading = [...document.querySelectorAll('h2')].find((node) => ['All Properties', 'Property review queue'].includes(node.textContent.trim()));
    return heading?.closest('.space-y-4') || null;
  }

  function rowProperty(row, used) {
    const cells = [...row.cells].map((cell) => normalize(cell.innerText));
    const rowText = normalize(row.innerText);
    const title = normalize(row.querySelector('td .font-medium')?.textContent || '');
    if (!rowText) return null;
    let best = null;
    let bestScore = -1;
    for (const property of properties) {
      const propertyTitle = normalize(property.title);
      if (used.has(String(property.id)) || !propertyTitle || !rowText.includes(propertyTitle)) continue;
      let score = title === propertyTitle ? 100 : 50;
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
      .og-pm-map-toolbar{display:flex;justify-content:flex-end;gap:6px;margin:5px 0 8px}
      .og-pm-map-mode{padding:7px 11px;border:1px solid #dbe2ea;border-radius:8px;background:#fff;color:#334155;font:600 11px system-ui;cursor:pointer}
      .og-pm-map-mode[aria-pressed="true"]{border-color:#c8a45a;background:#fbf7ed;color:#805b12}
      .og-pm-map{height:290px;overflow:hidden;border:1px solid #dbe2ea;border-radius:10px;background:#eaf0f5}
      .og-pm-map-status{margin:6px 0 0;color:#64748b;font-size:11px}
      .og-pm-map-status.error{color:#b91c1c}
      .og-pm-section{grid-column:1/-1;margin:7px 0 -4px;padding-bottom:7px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700}
      .og-pm-note{color:#64748b;font-size:11px}.og-pm-error{margin:12px 0;color:#b91c1c;font-size:13px}
      .og-pm-footer{display:flex;justify-content:space-between;gap:10px;margin-top:18px}
      .og-pm-actions{display:flex;gap:8px}.og-pm-button{border:0;border-radius:8px;padding:9px 13px;background:#0B1F3A;color:white;font:600 13px system-ui;cursor:pointer}
      .og-pm-button:disabled{opacity:.55;cursor:wait}.og-pm-button.secondary{background:#eef2f7;color:#334155}
      .og-pm-button.danger{background:#b91c1c}
      .og-pm-review-overview{padding:18px 22px 0}
      .og-pm-review-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
      .og-pm-status{display:inline-flex;align-items:center;border-radius:999px;padding:5px 10px;background:#fff7e5;color:#805b12;font-size:11px;font-weight:800}
      .og-pm-source{color:#64748b;font-size:11px}
      .og-pm-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0}
      .og-pm-fact{min-width:0;border:1px solid #e7edf4;border-radius:10px;padding:10px 12px;background:#f8fafc}
      .og-pm-fact dt{margin-bottom:4px;color:#64748b;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
      .og-pm-fact dd{margin:0;color:#0f172a;font-size:12px;font-weight:600;overflow-wrap:anywhere}
      .og-pm-media{display:flex;gap:8px;overflow-x:auto;padding:2px 0 12px}
      .og-pm-media img{width:104px;height:76px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0}
      .og-pm-media-item{display:grid;gap:4px;flex:none}.og-pm-media-item button{border:0;border-radius:6px;background:#fee2e2;color:#991b1b;padding:5px 7px;font:600 10px system-ui;cursor:pointer}
      .og-pm-review-overview details{margin:8px 0 0;border-top:1px solid #e2e8f0;padding:10px 0;color:#334155}
      .og-pm-review-overview summary{cursor:pointer;font-size:12px;font-weight:700}
      .og-pm-all-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 18px;margin-top:10px}
      .og-pm-all-fields div{min-width:0;font-size:11px;overflow-wrap:anywhere}
      .og-pm-all-fields strong{display:block;color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.05em}
      .og-pm-audit{margin:10px 0 0;padding:0;list-style:none}
      .og-pm-audit li{padding:7px 0;border-top:1px solid #edf1f5;font-size:11px}
      .og-pm-agent-search{margin-bottom:7px}
      .og-pm-manage{border:1px solid #c8a45a;border-radius:7px;background:#fff;color:#0B1F3A;padding:6px 9px;font:600 12px system-ui;white-space:nowrap;cursor:pointer}
      @media(max-width:600px){.og-pm-grid{grid-template-columns:1fr}.og-pm-field.full,.og-pm-section{grid-column:auto}.og-pm-form{padding:16px}.og-pm-review-overview{padding:14px 16px 0}.og-pm-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.og-pm-all-fields{grid-template-columns:1fr}.og-pm-footer{flex-direction:column-reverse}.og-pm-actions{justify-content:flex-end}}
    `;
    document.head.appendChild(style);
  }

  function openModal(property, review = {}) {
    ensureStyles();
    if (modal) {
      propertyMap?.remove();
      propertyMap = null;
      modal.remove();
    }
    modal = document.createElement('div');
    modal.className = 'og-pm-backdrop';
    const assigned = property.assignedAgent || {};
    const listedImages = Array.isArray(property.images)
      ? property.images.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean)
      : [];
    const media = listedImages.length ? listedImages : Array.isArray(property.media?.images)
      ? property.media.images.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean)
      : [];
    modal.innerHTML = `
      <section class="og-pm-dialog" role="dialog" aria-modal="true" aria-labelledby="og-pm-title">
        <header class="og-pm-head"><div><h2 id="og-pm-title"></h2><p></p></div><button class="og-pm-close" type="button" aria-label="Close">&times;</button></header>
        <div class="og-pm-review-overview"></div>
        <form class="og-pm-form">
          <div class="og-pm-grid">
            <div class="og-pm-section">Listing details</div>
            <div class="og-pm-field"><label>Title</label><input name="title" required maxlength="180"></div>
            <div class="og-pm-field"><label>Property type</label><input name="type" maxlength="80"></div>
            <div class="og-pm-field"><label>Purpose</label><select name="purpose"><option>For Sale</option><option>For Rent</option></select></div>
            <div class="og-pm-field"><label>City</label><input name="city" required maxlength="120"></div>
            <div class="og-pm-field"><label>District</label><input name="district" maxlength="120"></div>
            <div class="og-pm-field"><label>Tehsil</label><input name="tehsil" maxlength="120"></div>
            <div class="og-pm-field"><label>Locality</label><input name="locality" maxlength="120"></div>
            <div class="og-pm-field"><label>Society / project</label><input name="society" maxlength="160"></div>
            <div class="og-pm-field"><label>Address</label><input name="address" maxlength="240"></div>
            <div class="og-pm-section">Map location</div>
            <div class="og-pm-field"><label>Latitude</label><input name="lat" type="number" min="-90" max="90" step="any" placeholder="Click or drag the map pin"></div>
            <div class="og-pm-field"><label>Longitude</label><input name="lng" type="number" min="-180" max="180" step="any" placeholder="Click or drag the map pin"></div>
            <div class="og-pm-field full"><div class="og-pm-map-toolbar" role="group" aria-label="Map style">
              <button class="og-pm-map-mode" type="button" data-map-mode="map" aria-pressed="true">Map</button>
              <button class="og-pm-map-mode" type="button" data-map-mode="satellite" aria-pressed="false">Satellite</button>
            </div><div class="og-pm-map" data-property-map aria-label="Property location map"></div><p class="og-pm-map-status" data-map-status>Choose a pin location on the map, or drag the marker.</p></div>
            <div class="og-pm-field"><label>Price (PKR)</label><input name="price" type="number" min="0" step="any"></div>
            <div class="og-pm-field"><label>Area</label><input name="area" maxlength="80"></div>
            <div class="og-pm-field"><label>Area unit</label><input name="areaUnit" maxlength="40"></div>
            <div class="og-pm-field"><label>Bedrooms</label><input name="bedrooms" type="number" min="0" max="50"></div>
            <div class="og-pm-field"><label>Bathrooms</label><input name="bathrooms" type="number" min="0" max="50"></div>
            <div class="og-pm-field"><label>Year built</label><input name="yearBuilt" type="number" min="0" max="3000"></div>
            <div class="og-pm-field"><label>Furnishing</label><input name="furnishing" maxlength="80"></div>
            <div class="og-pm-field"><label>Availability</label><input name="availability" maxlength="80"></div>
            <div class="og-pm-field full"><label>Description</label><textarea name="description" maxlength="5000"></textarea></div>
            <div class="og-pm-field full"><label>Amenities (one per line)</label><textarea name="amenities"></textarea></div>
            <div class="og-pm-field full"><label>Listing photos</label><div class="og-pm-media" data-edit-images></div><textarea name="images"></textarea><input name="photoUploads" type="file" accept=".jpg,.jpeg,.png,.webp" multiple><span class="og-pm-note">Remove photos individually above, or upload additional JPG/PNG/WebP photos (up to 30 total).</span></div>
            <div class="og-pm-field full"><label>Property video URL</label><input name="videoUrl" type="url" maxlength="2000"><video data-current-video hidden controls preload="metadata" style="display:block;width:min(100%,420px);max-height:220px;border-radius:8px;background:#0b1f3a"></video><label><input name="removeVideo" type="checkbox"> Remove current video</label><input name="videoUpload" type="file" accept=".mp4,.mov,.m4v,.3gp,.webm,.avi"><span class="og-pm-note">Upload a video to replace the current one, or clear the URL / select Remove current video to delete it.</span></div>
            <div class="og-pm-section">Agent referral</div>
            <div class="og-pm-field full"><label>Find an agent in any city</label><input class="og-pm-agent-search" name="agentSearch" type="search" placeholder="Search agent name, city or phone"><select name="agentProfile"><option value="">Manual referral contact / no profile</option></select></div>
            <div class="og-pm-field"><label>Referral contact name</label><input name="agentName" maxlength="120"></div>
            <div class="og-pm-field"><label>Referral phone</label><input name="agentPhone" maxlength="40"></div>
            <div class="og-pm-field full"><span class="og-pm-note" data-agent-directory-note></span></div>
          </div>
          <div class="og-pm-error" role="alert" hidden></div>
          <div class="og-pm-footer"><button class="og-pm-button danger" type="button" data-delete>Delete property</button><div class="og-pm-actions"><button class="og-pm-button secondary" type="button" data-cancel>Cancel</button><button class="og-pm-button" type="submit">Save listing</button></div></div>
        </form>
      </section>`;
    const form = modal.querySelector('form');
    const set = (key, value) => { const input = form.elements[key]; if (input) input.value = value ?? ''; };
    modal.querySelector('h2').textContent = property.title || 'Manage listing';
    modal.querySelector('.og-pm-head p').textContent = `ID ${property.id} · ${property.approvalStatus || property.listingStatus || 'Pending review'}`;
    set('title', property.title); set('type', property.type); set('purpose', property.purpose || 'For Sale');
    set('city', property.city); set('district', property.district); set('tehsil', property.tehsil);
    set('locality', property.locality); set('society', property.society); set('address', property.address);
    set('lat', property.lat ?? property.latitude ?? property.location?.latitude);
    set('lng', property.lng ?? property.longitude ?? property.location?.longitude);
    set('price', property.price); set('area', property.area); set('areaUnit', property.areaUnit);
    set('bedrooms', property.bedrooms); set('bathrooms', property.bathrooms);
    set('yearBuilt', property.yearBuilt); set('furnishing', property.furnishing); set('availability', property.availability);
    set('description', property.description); set('amenities', Array.isArray(property.amenities) ? property.amenities.join('\n') : property.amenities);
    set('images', media.join('\n')); set('videoUrl', property.videoUrl);
    const imagesField = form.elements.images;
    const editableImages = form.querySelector('[data-edit-images]');
    const renderEditableImages = () => {
      const urls = imagesField.value.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
      editableImages.replaceChildren();
      urls.forEach((source, index) => {
        let url;
        try { url = new URL(source, window.location.href); } catch { return; }
        if (!['http:', 'https:'].includes(url.protocol)) return;
        const item = document.createElement('div');
        item.className = 'og-pm-media-item';
        const image = document.createElement('img');
        image.src = url.href;
        image.alt = `Listing photo ${index + 1}`;
        image.loading = 'lazy';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Remove';
        remove.setAttribute('aria-label', `Remove listing photo ${index + 1}`);
        remove.addEventListener('click', () => {
          const lines = imagesField.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          lines.splice(index, 1);
          imagesField.value = lines.join('\n');
          renderEditableImages();
        });
        item.append(image, remove);
        editableImages.appendChild(item);
      });
    };
    imagesField.addEventListener('input', renderEditableImages);
    renderEditableImages();
    const currentVideo = form.querySelector('[data-current-video]');
    const removeVideoLabel = form.elements.removeVideo?.closest('label');
    if (property.videoUrl) {
      try {
        currentVideo.src = new URL(property.videoUrl, window.location.href).href;
        currentVideo.hidden = false;
      } catch {}
    }
    if (removeVideoLabel) removeVideoLabel.hidden = !property.videoUrl;
    renderReviewOverview(modal.querySelector('.og-pm-review-overview'), property, review);
    set('agentName', assigned.name || property.assignedAgentName);
    set('agentPhone', assigned.phone || property.assignedAgentPhone);
    const select = form.elements.agentProfile;
    for (const agent of agents) {
      const option = document.createElement('option');
      option.value = `${agent.kind}:${agent.id}`;
      const city = agent.city || agent.cityName || agent.location?.city || agent.officeCity || '';
      option.textContent = `${agent.name || 'Agent'}${city ? ` · ${city}` : ''}${agent.phone ? ` · ${agent.phone}` : ''}${agent.userId ? '' : ' · contact only'}`;
      option.disabled = !agent.userId;
      option.dataset.name = agent.name || '';
      option.dataset.phone = agent.phone || '';
      option.dataset.userId = agent.userId || '';
      select.appendChild(option);
    }
    const directoryNote = form.querySelector('[data-agent-directory-note]');
    directoryNote.textContent = agentDirectoryMessage || 'Agent accounts from all cities are available. A referral appears in the Agent portal and does not change listing status; unlinked contacts are shown as contact-only.';
    const selectedAgentId = String(assigned.id || property.assignedAgentId || '');
    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId && (!assigned.profileType || agent.kind === assigned.profileType));
    if (selectedAgent) select.value = `${selectedAgent.kind}:${selectedAgent.id}`;
    const agentSearch = form.elements.agentSearch;
    agentSearch.addEventListener('input', () => {
      const query = normalize(agentSearch.value);
      for (const option of select.options) {
        if (!option.value) continue;
        option.hidden = Boolean(query) && !normalize(option.textContent).includes(query);
      }
    });
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
    initializePropertyMap(form, modal);
    form.elements.title.focus();
  }

  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    if (!document.getElementById('og-pm-leaflet-css')) {
      const stylesheet = document.createElement('link');
      stylesheet.id = 'og-pm-leaflet-css';
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(stylesheet);
    }
    leafletPromise = new Promise((resolve, reject) => {
      const loadScript = (src, fallback) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => window.L ? resolve(window.L) : reject(new Error('Map library did not initialize.'));
        script.onerror = () => {
          script.remove();
          if (fallback) loadScript('https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', false);
          else reject(new Error('Map tiles could not be loaded.'));
        };
        document.head.appendChild(script);
      };
      loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', true);
    }).catch((error) => {
      leafletPromise = null;
      throw error;
    });
    return leafletPromise;
  }

  function initializePropertyMap(form, activeModal) {
    const mapContainer = form.querySelector('[data-property-map]');
    const status = form.querySelector('[data-map-status]');
    const latitudeInput = form.elements.lat;
    const longitudeInput = form.elements.lng;
    const parseCoordinate = (value, min, max) => {
      if (String(value).trim() === '') return null;
      const number = Number(value);
      return Number.isFinite(number) && number >= min && number <= max ? number : null;
    };

    loadLeaflet().then((L) => {
      if (modal !== activeModal || !mapContainer?.isConnected) return;
      const latitude = parseCoordinate(latitudeInput.value, -90, 90);
      const longitude = parseCoordinate(longitudeInput.value, -180, 180);
      const hasLocation = latitude !== null && longitude !== null;
      const center = hasLocation ? [latitude, longitude] : [33.6844, 73.0479];
      const map = L.map(mapContainer, { scrollWheelZoom: false, attributionControl: true })
        .setView(center, hasLocation ? 15 : 11);
      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      });
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Tiles © Esri',
      });
      let activeLayer = streetLayer;
      streetLayer.addTo(map);
      const marker = L.marker(center, { draggable: true }).addTo(map);
      propertyMap = map;

      const setPin = (point, recenter = false) => {
        const lat = Number(point.lat);
        const lng = Number(point.lng);
        latitudeInput.value = lat.toFixed(6);
        longitudeInput.value = lng.toFixed(6);
        marker.setLatLng([lat, lng]);
        if (recenter) map.panTo([lat, lng]);
      };
      map.on('click', (event) => setPin(event.latlng));
      marker.on('dragend', () => setPin(marker.getLatLng()));
      const updateFromInputs = () => {
        const lat = parseCoordinate(latitudeInput.value, -90, 90);
        const lng = parseCoordinate(longitudeInput.value, -180, 180);
        if (lat !== null && lng !== null) setPin({ lat, lng }, true);
      };
      latitudeInput.addEventListener('change', updateFromInputs);
      longitudeInput.addEventListener('change', updateFromInputs);

      form.querySelectorAll('[data-map-mode]').forEach((button) => {
        button.addEventListener('click', () => {
          const layer = button.dataset.mapMode === 'satellite' ? satelliteLayer : streetLayer;
          if (layer !== activeLayer) {
            map.removeLayer(activeLayer);
            activeLayer = layer;
            activeLayer.addTo(map);
          }
          form.querySelectorAll('[data-map-mode]').forEach((option) => {
            option.setAttribute('aria-pressed', String(option === button));
          });
          requestAnimationFrame(() => map.invalidateSize());
        });
      });
      if (status) status.textContent = hasLocation
        ? 'Drag the pin or click the map to adjust the property location.'
        : 'Map starts near Islamabad. Click the property location or drag the pin before saving.';
      requestAnimationFrame(() => map.invalidateSize());
    }).catch(() => {
      if (modal !== activeModal || !status) return;
      status.classList.add('error');
      status.textContent = 'Map could not load. You can still enter latitude and longitude above.';
    });
  }

  function escapeClose(event) { if (event.key === 'Escape') closeModal(); }
  function closeModal() {
    propertyMap?.remove();
    propertyMap = null;
    modal?.remove();
    modal = null;
    document.body.style.overflow = '';
  }
  function showError(container, message) { const error = container.querySelector('.og-pm-error'); error.textContent = message; error.hidden = false; }

  function renderReviewOverview(target, property, review) {
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = String(text);
      return node;
    };
    const seller = review?.seller || {};
    const location = property.location || {};
    const listedImages = Array.isArray(property.images)
      ? property.images.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean)
      : [];
    const images = listedImages.length ? listedImages : Array.isArray(property.media?.images)
      ? property.media.images.map((item) => typeof item === 'string' ? item : item?.url).filter(Boolean)
      : [];
    const status = property.approvalStatus || property.listingStatus || 'Pending';
    const latitude = property.lat ?? location.latitude ?? location.lat;
    const longitude = property.lng ?? location.longitude ?? location.lng;
    const format = (value) => {
      if (value === null || value === undefined || value === '') return '—';
      if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    };
    const facts = [
      ['Seller', seller.name || property.sellerName || property.ownerName],
      ['Seller phone', seller.phone || property.sellerPhone || property.ownerPhone || property.phone],
      ['Seller email', seller.email || property.sellerEmail || property.ownerEmail],
      ['Location', [property.address, property.society, property.locality, property.tehsil, property.district, property.city].filter(Boolean).join(', ')],
      ['Map pin', latitude != null && longitude != null ? `${latitude}, ${longitude}` : null],
      ['Submitted', property.createdAt ? new Date(property.createdAt).toLocaleString() : null],
      ['Source', property.source || property.submissionSource || property.createdFrom || property.platform],
      ['Assigned agent', property.assignedAgent?.name || property.assignedAgentName],
      ['Agent phone', property.assignedAgent?.phone || property.assignedAgentPhone],
    ];

    target.replaceChildren();
    const top = make('div', 'og-pm-review-top');
    top.append(
      make('span', 'og-pm-status', `Review status: ${status}`),
      make('span', 'og-pm-source', `Submission source: ${format(facts[6][1] || 'Not specified')}`),
    );
    target.appendChild(top);

    const factGrid = make('dl', 'og-pm-facts');
    for (const [label, value] of facts) {
      const item = make('div', 'og-pm-fact');
      item.append(make('dt', '', label), make('dd', '', format(value)));
      factGrid.appendChild(item);
    }
    target.appendChild(factGrid);

    if (images.length) {
      const gallery = make('div', 'og-pm-media');
      for (const source of images) {
        let url;
        try { url = new URL(source, window.location.href); } catch { continue; }
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        const image = make('img');
        image.src = url.href;
        image.alt = property.title ? `${property.title} photo` : 'Property photo';
        image.loading = 'lazy';
        gallery.appendChild(image);
      }
      if (gallery.childElementCount) target.appendChild(gallery);
    }
    if (property.videoUrl) {
      try {
        const video = new URL(property.videoUrl, window.location.href);
        if (['http:', 'https:'].includes(video.protocol)) {
          const link = make('a', 'og-pm-source', 'Open property video');
          link.href = video.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          target.appendChild(link);
        }
      } catch {}
    }

    const allData = make('details');
    allData.appendChild(make('summary', '', 'Full submitted property details'));
    const fields = make('div', 'og-pm-all-fields');
    const hiddenKeys = new Set(['images', 'media', 'coverImage']);
    for (const [key, value] of Object.entries(property)) {
      if (hiddenKeys.has(key) || /password|token|secret|credential/i.test(key)) continue;
      const item = make('div');
      item.append(make('strong', '', key.replace(/([A-Z])/g, ' $1')), make('span', '', format(value)));
      fields.appendChild(item);
    }
    allData.appendChild(fields);
    target.appendChild(allData);

    const audit = Array.isArray(review?.audit) ? review.audit : [];
    if (audit.length) {
      const heading = make('div', 'og-pm-section', 'Review history');
      const list = make('ul', 'og-pm-audit');
      for (const entry of audit) {
        list.appendChild(make('li', '', [
          entry.action || 'Review update',
          entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus || '—'}` : entry.toStatus || '',
          entry.createdAt || entry.at || '',
        ].filter(Boolean).join(' · ')));
      }
      target.append(heading, list);
    }
  }

  async function request(path, options = {}) {
    const multipart = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const response = await originalFetch(`${apiBase()}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}), ...(options.body && !multipart ? { 'Content-Type': 'application/json' } : {}) },
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    return payload;
  }

  async function loadPropertyData() {
    try {
      const payload = await request('/admin/properties?limit=500');
      properties = propertyList(payload);
      propertyLoadError = '';
      queueEnhancement();
    } catch (error) {
      propertyLoadError = error instanceof Error ? error.message : 'Please refresh and sign in again.';
      queueEnhancement();
      console.error('Admin property edit controls could not load listing data.', error);
    }
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
      const parseCoordinate = (value, label, min, max) => {
        if (String(value).trim() === '') return null;
        const number = Number(value);
        if (!Number.isFinite(number) || number < min || number > max) {
          throw new Error(`${label} must be between ${min} and ${max}.`);
        }
        return number;
      };
      const lat = parseCoordinate(values.lat, 'Latitude', -90, 90);
      const lng = parseCoordinate(values.lng, 'Longitude', -180, 180);
      if ((lat === null) !== (lng === null)) throw new Error('Enter both latitude and longitude, or leave both blank.');
      let images = values.images.split(/\r?\n/).map((url) => url.trim()).filter(Boolean);
      const photoFiles = Array.from(form.elements.photoUploads.files || []);
      if (images.length + photoFiles.length > 30) throw new Error('A listing can have up to 30 photos.');
      if (photoFiles.length) {
        const formData = new FormData();
        photoFiles.forEach((file) => formData.append('images[]', file));
        const uploaded = await request('/upload/multiple', { method: 'POST', body: formData });
        const uploadedUrls = Array.isArray(uploaded?.urls) ? uploaded.urls : (uploaded?.url ? [uploaded.url] : []);
        if (uploadedUrls.length !== photoFiles.length) throw new Error('One or more photos could not be uploaded.');
        images = [...images, ...uploadedUrls];
      }
      let videoUrl = String(values.videoUrl || '').trim() || null;
      const videoFile = form.elements.videoUpload.files?.[0];
      if (videoFile) {
        const formData = new FormData();
        formData.append('video', videoFile);
        const uploaded = await request('/upload/video', { method: 'POST', body: formData });
        if (typeof uploaded?.url !== 'string' || !uploaded.url.trim()) throw new Error('The video upload did not return a media URL.');
        videoUrl = uploaded.url.trim();
      } else if (form.elements.removeVideo.checked) {
        videoUrl = null;
      }
      const payload = {
        title: values.title.trim(), type: values.type.trim(), purpose: values.purpose,
        city: values.city.trim(), district: values.district.trim(), tehsil: values.tehsil.trim(),
        locality: values.locality.trim(), society: values.society.trim(), address: values.address.trim(),
        lat, lng, latitude: lat, longitude: lng,
        price: values.price === '' ? null : Number(values.price), area: values.area.trim(),
        areaUnit: values.areaUnit.trim(),
        bedrooms: values.bedrooms === '' ? null : Number(values.bedrooms),
        bathrooms: values.bathrooms === '' ? null : Number(values.bathrooms),
        yearBuilt: values.yearBuilt === '' ? null : Number(values.yearBuilt),
        furnishing: values.furnishing.trim(), availability: values.availability.trim(),
        description: values.description.trim(),
        amenities: values.amenities.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        images,
        videoUrl,
        assignedAgent: name || phone || profile ? {
          id: profile ? String(profile.id) : null,
          userId: profile?.userId || null,
          city: profile?.city || '',
          name, phone, profileType: profile?.kind || 'manual',
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
    if (agentsLoaded) return;
    const cityAgents = await request('/admin/city-agents').catch((error) => {
      agentDirectoryMessage = `City agent directory did not load: ${error.message}`;
      return [];
    });
    const [profiles, users] = await Promise.all([
      request('/admin/mobile-agents').catch(() => []),
      request('/admin/users?role=agent').catch(() => []),
    ]);
    const normalizeAgent = (agent, kind) => {
      const id = String(agent.id ?? agent.userId ?? '');
      if (!id) return null;
      return {
        ...agent,
        id,
        kind,
        name: agent.name || agent.fullName || agent.agentName || 'Agent',
        phone: agent.phone || agent.phoneNumber || agent.mobile || '',
        city: agent.city || agent.cityName || agent.officeCity || agent.location?.city || '',
        userId: String(agent.userId || agent.authUserId || agent.agentUserId || (kind === 'account' ? id : '')),
      };
    };
    const accounts = (Array.isArray(users) ? users : [])
      .map((item) => normalizeAgent(item, 'account'))
      .filter(Boolean)
      .map((agent) => ({ ...agent, userId: agent.id }));
    const byUserId = new Map(accounts.map((agent) => [agent.userId, agent]));
    const byEmail = new Map(accounts.map((agent) => [normalize(agent.email), agent]).filter(([email]) => email));
    const byPhone = new Map(accounts.map((agent) => [String(agent.phone).replace(/\D/g, ''), agent]).filter(([phone]) => phone));
    const unlinkedProfiles = [
      ...(Array.isArray(cityAgents) ? cityAgents.map((item) => normalizeAgent(item, 'city')) : []),
      ...(Array.isArray(profiles) ? profiles.map((item) => normalizeAgent(item, 'profile')) : []),
    ].filter(Boolean);
    const contacts = [];
    for (const profile of unlinkedProfiles) {
      const linked = byUserId.get(profile.userId)
        || byEmail.get(normalize(profile.email))
        || byPhone.get(String(profile.phone).replace(/\D/g, ''));
      if (linked) {
        linked.city ||= profile.city;
        linked.phone ||= profile.phone;
        linked.name = linked.name === 'Agent' ? profile.name : linked.name;
      } else {
        contacts.push({ ...profile, userId: '' });
      }
    }
    agents = [...accounts, ...contacts];
    if (!agents.length && !agentDirectoryMessage) agentDirectoryMessage = 'No agents are currently available in the referral directory.';
    agentsLoaded = true;
  }

  function addFilters(root) {
    const table = root.querySelector('table');
    if (!table || root.querySelector('.og-pm-filters')) return;
    const filters = document.createElement('div');
    filters.className = 'og-pm-filters';
    const options = [
      ['all', 'All properties'],
      ['listed', 'Property listed'],
      ['in-progress', 'Property in progress'],
      ['closed', 'Property closed'],
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
    const heading = root.querySelector('h2');
    const headingLabels = {
      all: 'All properties',
      listed: 'Property listed',
      'in-progress': 'Property in progress',
      closed: 'Property closed',
    };
    if (heading && headingLabels[filter]) heading.textContent = headingLabels[filter];
    const summary = heading?.parentElement?.querySelector('p');
    const visibleCount = properties.filter((property) => matchesFilter(property, filter)).length;
    if (summary) summary.textContent = propertyLoadError
      ? `Edit controls unavailable: ${propertyLoadError}`
      : `${visibleCount} shown · ${properties.length} total properties`;
    const table = root.querySelector('table');
    if (!table) return;
    addFilters(root);
    const headers = table.querySelector('thead tr');
    if (headers && !headers.querySelector('[data-og-pm-header]')) {
      const th = document.createElement('th');
      th.dataset.ogPmHeader = 'true'; th.className = 'text-left px-4 py-3 font-semibold'; th.textContent = 'Manage';
      headers.appendChild(th);
    }
    if (headers && !headers.querySelector('[data-og-agent-header]')) {
      const th = document.createElement('th');
      th.dataset.ogAgentHeader = 'true'; th.className = 'text-left px-4 py-3 font-semibold'; th.textContent = 'Referred agent';
      headers.insertBefore(th, headers.querySelector('[data-og-pm-header]') || null);
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
          try {
            await loadAgents();
            const review = await request(`/admin/properties/${encodeURIComponent(current.id)}/review`);
            const fullProperty = { ...current, ...(review?.property || {}) };
            properties = properties.map((item) => String(item.id) === String(fullProperty.id) ? fullProperty : item);
            openModal(fullProperty, review || {});
          }
          catch (error) { window.alert(error.message || 'Could not load agent profiles.'); }
          finally { button.disabled = false; }
        });
        cell.appendChild(button);
      }
      if (button.textContent !== 'Edit listing') button.textContent = 'Edit listing';
      button.dataset.propertyId = String(property.id);
      const rowStatus = row.dataset.ogPropertyStatus;
      row.hidden = !matchesFilter(property, filter);
      let agentCell = row.querySelector('[data-og-agent-cell]');
      if (!agentCell) {
        agentCell = document.createElement('td');
        agentCell.dataset.ogAgentCell = 'true';
        agentCell.className = 'px-4 py-3 text-xs text-slate-500';
        row.insertBefore(agentCell, cell);
      }
      const assigned = property.assignedAgent || {};
      const assignedName = assigned.name || property.assignedAgentName || '';
      const assignedCity = assigned.city || property.assignedAgentCity || '';
      agentCell.textContent = assignedName ? `${assignedName}${assignedCity ? ` · ${assignedCity}` : ''}` : 'Not assigned';
    }
    const chips = root.querySelectorAll('.og-pm-filter');
    chips.forEach((button) => {
      const value = button.dataset.filter;
      const count = properties.filter((item) => matchesFilter(item, value)).length;
      const labels = {
        all: 'All properties',
        listed: 'Property listed',
        'in-progress': 'Property in progress',
        closed: 'Property closed',
        pending: 'Pending review',
        active: 'Active',
        'changes requested': 'Changes requested',
        rejected: 'Rejected',
      };
      const label = `${labels[value] || value} · ${count}`;
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
    void loadPropertyData();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
