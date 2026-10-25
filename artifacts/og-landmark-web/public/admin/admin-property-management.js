(function () {
  if (window.__ogPropertyManagementMounted) return;
  window.__ogPropertyManagementMounted = true;

  const originalFetch = window.fetch.bind(window);
  let properties = [];
  let apiProperties = [];
  let mobileDemoProperties = [];
  let mobileProjectProperties = [];
  const observedProperties = new Map();
  let agents = [];
  const propertyViews = new Set(['listed', 'in-progress', 'closed', 'pending', 'approved', 'rejected']);
  const requestedView = new URLSearchParams(window.location.search).get('propertyView');
  const listingInboxView = requestedView === 'inbox';
  const featuredView = requestedView === 'featured';
  const recommendedView = requestedView === 'recommended';
  const projectsView = requestedView === 'projects';
  const agricultureView = requestedView === 'agriculture';
  let filter = propertyViews.has(requestedView) ? requestedView : 'all';
  let categoryFilter = agricultureView ? 'agricultural' : projectsView ? 'projects' : 'all';
  let cityFilter = 'all';
  let featuredFilter = featuredView ? 'featured' : 'all';
  let recommendedFilter = recommendedView ? 'recommended' : 'all';
  let latestFilter = 'all';
  let propertySearch = '';
  let propertySort = 'newest';
  let propertyPage = 1;
  let propertyPageSize = 25;
  let latestMobileIds = new Set();
  let observer;
  let enhancementQueued = false;
  let modal;
  let propertyMap;
  let leafletPromise;
  let agentsLoaded = false;
  let agentDirectoryMessage = '';
  let propertyLoadError = '';
  const normalize = (value) => String(value ?? '').trim().toLowerCase();
  const statusOf = (property) => normalize(property.approvalStatus || property.listingStatus || property.status || 'pending');
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
    if (value === 'approved') {
      const approval = normalize(property.approvalStatus || 'active');
      const listing = normalize(property.listingStatus || property.status || 'active');
      return ['active', 'approved', 'listed'].includes(approval)
        && ['active', 'approved', 'listed'].includes(listing);
    }
    if (value === 'rejected') return statuses.includes('rejected');
    if (value === 'active') return statuses.some((status) => ['active', 'approved', 'live', 'listed'].includes(status));
    if (value === 'pending') {
      return statuses.some((status) => ['pending', 'changes requested', 'in progress', 'under review'].includes(status));
    }
    if (value === 'in-progress') {
      return statuses.some((status) => ['pending', 'changes requested', 'in progress', 'under review'].includes(status));
    }
    if (value === 'closed') {
      return statuses.some((status) => ['closed', 'sold', 'rented', 'expired', 'archived', 'rejected', 'inactive'].includes(status));
    }
    return statusOf(property) === value;
  };
  const categoryOf = (property) => normalize([
    property.category, property.propertyCategory, property.type, property.propertyType,
    property.subType, property.projectName,
  ].filter(Boolean).join(' '));
  const matchesCategory = (property, value) => {
    if (value === 'all') return true;
    const category = categoryOf(property);
    if (value === 'houses') return /house|home|villa|apartment|flat/.test(category);
    if (value === 'plots') return /plot|land|farm/.test(category);
    if (value === 'commercial') return /commercial|shop|office| plaza|retail/.test(category);
    if (value === 'agricultural') return /agri|agriculture|farm|orchard/.test(category);
    if (value === 'industrial') return /industrial|factory|warehouse/.test(category);
    if (value === 'projects') return /project|development/.test(category)
      || Boolean(property.projectId || property.developerProjectId || property.projectName);
    return true;
  };
  const matchesCity = (property, value) => {
    if (value === 'all') return true;
    const city = normalize(cityOf(property));
    const wanted = normalize(value);
    return city === wanted || city.startsWith(`${wanted} `) || (wanted === 'okara' && city.includes('okara'));
  };
  const cityOf = (property) => {
    const location = property?.location;
    return String(property?.city || property?.cityName || (typeof location === 'object' ? location?.city : location)
      || property?.tehsil || '').trim();
  };
  const isFeaturedProperty = (property) => property?.featured === true
    || property?.featured === 1
    || ['true', '1', 'yes'].includes(normalize(property?.featured));
  const matchesFeatured = (property, value) => value === 'all'
    || (value === 'featured' ? isFeaturedProperty(property) : !isFeaturedProperty(property));
  const isRecommendedProperty = (property) => property?.recommended === true
    || property?.recommended === 1
    || ['true', '1', 'yes'].includes(normalize(property?.recommended));
  const isApprovedForPromotion = (property) => {
    const approval = normalize(property?.approvalStatus || property?.listingStatus || property?.status || 'pending');
    const listing = normalize(property?.listingStatus || property?.approvalStatus || property?.status || 'pending');
    return ['active', 'approved'].includes(approval)
      && ['active', 'approved'].includes(listing);
  };
  const matchesRecommended = (property, value) => value === 'all'
    || (value === 'recommended' ? isRecommendedProperty(property) : !isRecommendedProperty(property));
  const matchesLatest = (property, value) => value === 'all' || latestMobileIds.has(String(property?.id));
  const compareLatest = (left, right) => {
    const leftDate = Date.parse(left.createdAt || '');
    const rightDate = Date.parse(right.createdAt || '');
    const dateOrder = (Number.isFinite(rightDate) ? rightDate : 0)
      - (Number.isFinite(leftDate) ? leftDate : 0);
    return dateOrder || (Number(right.id) || 0) - (Number(left.id) || 0);
  };
  const isMobilePublicListing = (property) => ['active', 'approved'].includes(normalize(property.approvalStatus || 'active'))
    && ['active', 'approved'].includes(normalize(property.listingStatus || 'active'));
  const getLatestMobileProperties = () => apiProperties
    .filter((property) => !property.isDemo && !property.isProject && isMobilePublicListing(property))
    .slice()
    .sort(compareLatest)
    .slice(0, 6);
  const matchesPropertyFilters = (
    property,
    status = filter,
    category = categoryFilter,
    city = cityFilter,
    featured = featuredFilter,
    recommended = recommendedFilter,
    latest = latestFilter,
  ) => matchesFilter(property, status)
    && matchesCategory(property, category)
    && matchesCity(property, city)
    && matchesFeatured(property, featured)
    && matchesRecommended(property, recommended)
    && matchesLatest(property, latest);
  const apiBase = () => String(window.__OG_API_BASE__ || '/api').replace(/\/+$/, '');
  const propertyList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.properties)) return payload.properties;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  };
  function rebuildPropertyData() {
    latestMobileIds = new Set(getLatestMobileProperties().map((property) => String(property.id)));
    const unique = new Map();
    for (const property of [
      ...apiProperties,
      ...observedProperties.values(),
      ...mobileDemoProperties,
      ...mobileProjectProperties,
    ]) {
      const key = property.id != null
        ? String(property.id)
        : `${normalize(property.title)}:${normalize(property.city)}`;
      if (!unique.has(key)) unique.set(key, property);
    }
    properties = [...unique.values()];
    window.__ogAdminListingProperties = properties;
    queueEnhancement();
  }
  function setPropertyData(payload) {
    const list = propertyList(payload);
    apiProperties = list;
    propertyLoadError = '';
    rebuildPropertyData();
  }
  function addObservedProperty(property) {
    if (!property || property.id == null) return;
    const id = String(property.id);
    if (observedProperties.has(id)) return;
    observedProperties.set(id, property);
    rebuildPropertyData();
  }
  async function loadMobileDemoProperties() {
    try {
      const response = await originalFetch('/admin/demo-properties.json');
      if (!response.ok) throw new Error(`Catalog request failed (${response.status})`);
      const catalog = await response.json();
      if (!Array.isArray(catalog)) throw new Error('Demo catalog is not a list');
      mobileDemoProperties = catalog.map((property) => ({
        ...property,
        id: `mobile-demo:${property.id}`,
        demoId: property.id,
        isDemo: true,
        approvalStatus: 'Active',
        listingStatus: 'Active',
        sellerName: property.agent || 'OG Landmark demo',
      }));
      rebuildPropertyData();
    } catch (error) {
      console.error('Mobile demo listings could not be loaded in Admin.', error);
    }
  }
  async function loadMobileProjectProperties() {
    try {
      const catalog = propertyList(await request('/admin/developer-projects'));
      mobileProjectProperties = catalog.map((project) => {
        const sourceStatus = project.status || project.approvalStatus || 'Pending';
        const isLive = ['live', 'approved', 'active'].includes(normalize(sourceStatus));
        return {
          ...project,
          id: `mobile-project:${project.id}`,
          title: project.title || project.name || 'Developer project',
          type: 'Project',
          category: 'Projects',
          city: project.city || project.location?.city || project.location || '',
          sellerName: project.developer || project.developerName || 'Developer',
          status: sourceStatus,
          approvalStatus: isLive ? 'Active' : sourceStatus,
          listingStatus: isLive ? 'Active' : sourceStatus,
          isProject: true,
        };
      });
      rebuildPropertyData();
    } catch (error) {
      console.error('Mobile developer projects could not be loaded in Admin.', error);
    }
  }
  window.addEventListener('og-admin-properties-loaded', (event) => {
    setPropertyData(event.detail);
  });
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
        if (list.length || Array.isArray(payload) || Array.isArray(payload?.properties)
          || Array.isArray(payload?.data) || Array.isArray(payload?.data?.data)
          || Array.isArray(payload?.items) || Array.isArray(payload?.results)) {
          setPropertyData(list);
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

  const propertyRootHeadings = new Set([
    'All Properties', 'Property review queue', 'Property listed', 'Pending approvals',
    'Approved properties', 'Rejected properties', 'Property in progress', 'Property closed',
    'Featured properties', 'Recommended properties', 'Projects', 'Agriculture Land',
  ]);
  function findRoot() {
    const markedRoot = document.querySelector('[data-og-property-management-root="true"]');
    const markedHeading = markedRoot?.querySelector('h2')?.textContent.trim();
    if (markedRoot?.isConnected && propertyRootHeadings.has(markedHeading)) return markedRoot;

    const heading = [...document.querySelectorAll('h2')]
      .find((node) => propertyRootHeadings.has(node.textContent.trim()));
    const root = heading?.closest('.space-y-4') || null;
    if (root) root.dataset.ogPropertyManagementRoot = 'true';
    return root;
  }

  function rowProperty(row, used) {
    const mediaProperty = row.querySelector('[data-og-listing-review]')?.__ogListingProperty;
    const listingId = row.dataset.ogListingId || row.getAttribute('data-og-listing-id') || mediaProperty?.id;
    const sharedProperties = Array.isArray(window.__ogAdminApiProperties) ? window.__ogAdminApiProperties : [];
    const byId = [...apiProperties, ...properties, ...sharedProperties]
      .find((item) => String(item.id) === String(listingId));
    if (byId && !used.has(String(byId.id))) {
      used.add(String(byId.id));
      return byId;
    }
    if (mediaProperty && !used.has(String(mediaProperty.id))) {
      used.add(String(mediaProperty.id));
      return mediaProperty;
    }
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
      .og-pm-filter-group{display:flex;flex-wrap:wrap;align-items:center;gap:7px;width:100%}
      .og-pm-filter-label{min-width:74px;color:#64748b;font:700 10px/1.2 system-ui;text-transform:uppercase;letter-spacing:.06em}
      .og-mobile-demo-tag{display:inline-flex;align-items:center;border:1px solid #e8d7aa;border-radius:999px;background:#fbf7ed;color:#805b12;padding:3px 7px;font:700 9px/1 system-ui;white-space:nowrap}
      .og-mobile-demo-photo{display:flex;width:42px;height:32px;align-items:center;justify-content:center;border-radius:6px;background:#eef2f7;color:#0B1F3A;font:700 8px system-ui;letter-spacing:.06em}
      .og-mobile-demo-subtitle{margin-top:3px;color:#64748b;font-size:11px}
      .og-pm-filter{border:1px solid #dbe2ea;border-radius:999px;background:#fff;color:#334155;padding:7px 12px;font:600 12px/1.2 system-ui;cursor:pointer}
      .og-pm-filter.is-active{background:#0B1F3A;color:#fff;border-color:#0B1F3A}
      .og-pm-table-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;width:100%;padding-top:4px}
      .og-pm-table-tools input,.og-pm-table-tools select{min-height:36px;border:1px solid #dbe2ea;border-radius:8px;background:#fff;padding:7px 10px;color:#334155;font:500 12px system-ui}
      .og-pm-table-tools input{flex:1;min-width:220px}
      .og-pm-pagination{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:12px 16px;color:#64748b;font:500 12px system-ui}
      .og-pm-pagination button{border:1px solid #dbe2ea;border-radius:7px;background:#fff;padding:6px 10px;color:#0B1F3A;cursor:pointer}
      .og-pm-pagination button:disabled{opacity:.45;cursor:not-allowed}
      .og-pm-manage{border:1px solid #c8a45a;border-radius:7px;background:#fff;color:#0B1F3A;padding:6px 9px;font:600 12px system-ui;white-space:nowrap;cursor:pointer}
      .og-pm-manage:hover{background:#fbf7ed}
      .og-pm-feature-toggle{min-width:112px;border:1px solid #dbe2ea;border-radius:999px;background:#fff;color:#475569;padding:7px 10px;font:700 11px/1.1 system-ui;white-space:nowrap;cursor:pointer}
      .og-pm-feature-toggle.is-featured{border-color:#c8a45a;background:#fbf7ed;color:#805b12}
      .og-pm-feature-toggle:disabled{opacity:.55;cursor:wait}
      .og-pm-agent-assign{display:block;margin-top:5px;border:0;background:transparent;padding:0;color:#946f24;font:700 10px system-ui;text-decoration:underline;cursor:pointer}
      .og-pm-feature-badge{display:inline-flex;align-items:center;border:1px solid #dbe2ea;border-radius:999px;background:#f8fafc;color:#64748b;padding:4px 8px;font:700 10px/1 system-ui;white-space:nowrap}
      .og-pm-feature-badge.is-featured{border-color:#e8d7aa;background:#fbf7ed;color:#805b12}
      .og-pm-recommend-toggle{min-width:120px;border:1px solid #dbe2ea;border-radius:999px;background:#fff;color:#475569;padding:7px 10px;font:700 11px/1.1 system-ui;white-space:nowrap;cursor:pointer}
      .og-pm-recommend-toggle.is-recommended{border-color:#b7d4c2;background:#f1f8f3;color:#21613a}
      .og-pm-recommend-toggle:disabled{opacity:.55;cursor:wait}
      .og-pm-latest-panel{margin:14px 16px 4px;padding:18px;border:1px solid #dbe4ee;border-radius:14px;background:linear-gradient(120deg,#f7fafc,#fff)}
      .og-pm-latest-head{margin-bottom:14px}
      .og-pm-latest-kicker{color:#9b762f;font:700 10px/1.2 system-ui;letter-spacing:.12em;text-transform:uppercase}
      .og-pm-latest-title{margin:4px 0 0;color:#0B1F3A;font:700 18px/1.2 system-ui}
      .og-pm-latest-subtitle{margin:4px 0 0;color:#64748b;font:400 12px/1.4 system-ui}
      .og-pm-latest-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:8px}
      .og-pm-latest-item{display:flex;align-items:center;gap:10px;min-width:0;padding:10px;border:1px solid #e5eaf0;border-radius:10px;background:#fff}
      .og-pm-latest-rank{display:grid;place-items:center;flex:0 0 30px;width:30px;height:30px;border-radius:9px;background:#0B1F3A;color:#fff;font:700 11px system-ui}
      .og-pm-latest-info{flex:1;min-width:0}
      .og-pm-latest-name{overflow:hidden;color:#0B1F3A;font:700 12px/1.3 system-ui;text-overflow:ellipsis;white-space:nowrap}
      .og-pm-latest-meta{overflow:hidden;margin-top:3px;color:#64748b;font:400 10px/1.3 system-ui;text-overflow:ellipsis;white-space:nowrap}
      .og-pm-latest-edit{border:1px solid #c8a45a;border-radius:7px;background:#fff;color:#0B1F3A;padding:6px 8px;font:700 10px system-ui;white-space:nowrap;cursor:pointer}
      .og-pm-latest-empty{padding:12px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b;font:500 12px system-ui}
      .og-pm-agriculture-overview{display:grid;grid-template-columns:minmax(220px,1.5fr) repeat(3,minmax(120px,1fr));gap:10px;margin:14px 16px 0;padding:16px;border:1px solid #dce7dc;border-radius:14px;background:linear-gradient(115deg,#f0f7f1,#fff)}
      .og-pm-agriculture-intro{align-self:center}.og-pm-agriculture-kicker{color:#54755c;font:800 10px system-ui;letter-spacing:.12em;text-transform:uppercase}
      .og-pm-agriculture-title{margin:4px 0;color:#153b25;font:700 18px/1.2 system-ui}.og-pm-agriculture-copy{margin:0;color:#64748b;font:400 11px/1.45 system-ui}
      .og-pm-agriculture-stat{padding:10px 12px;border:1px solid #e3ebe3;border-radius:10px;background:#fff}
      .og-pm-agriculture-stat span{display:block;color:#64748b;font:700 9px system-ui;letter-spacing:.06em;text-transform:uppercase}
      .og-pm-agriculture-stat strong{display:block;margin-top:5px;color:#153b25;font:700 19px/1.2 system-ui}
      @media(max-width:760px){.og-pm-agriculture-overview{grid-template-columns:repeat(3,minmax(0,1fr))}.og-pm-agriculture-intro{grid-column:1/-1}}
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

  function ensureMobileDemoRows(table) {
    const body = table.querySelector('tbody');
    const headers = [...(table.querySelectorAll('thead th') || [])];
    const mobileCatalog = [...mobileDemoProperties, ...mobileProjectProperties];
    if (!body || !headers.length || !mobileCatalog.length) return;
    for (const property of mobileCatalog) {
      const row = [...body.querySelectorAll('[data-og-mobile-demo-row]')]
        .find((item) => item.dataset.ogMobileDemoRow === String(property.id));
      if (row && row.cells.length === headers.length) continue;
      row?.remove();
      const next = document.createElement('tr');
      next.dataset.ogMobileDemoRow = String(property.id);
      next.className = 'border-t border-slate-100 hover:bg-slate-50/60';
      for (const header of headers) {
        const label = normalize(header.textContent);
        const cell = document.createElement('td');
        cell.className = 'px-4 py-3';
        if (label.includes('photo')) {
          const badge = document.createElement('span');
          badge.className = 'og-mobile-demo-photo';
          badge.textContent = property.isProject ? 'PROJECT' : 'DEMO';
          cell.appendChild(badge);
        } else if (label.includes('title') || label.includes('property')) {
          const title = document.createElement('div');
          title.className = 'font-medium text-[#0B1F3A]';
          title.textContent = property.title || 'Mobile demo listing';
          const detail = document.createElement('div');
          detail.className = 'og-mobile-demo-subtitle';
          detail.textContent = property.type || 'Property';
          const tag = document.createElement('span');
          tag.className = 'og-mobile-demo-tag';
          tag.textContent = property.isProject ? 'Mobile app project' : 'Mobile app demo';
          cell.append(title, detail, tag);
        } else if (label === 'city') {
          cell.textContent = property.city || '—';
        } else if (label === 'seller') {
          cell.textContent = property.sellerName || 'OG Landmark demo';
        } else if (label === 'price') {
          cell.textContent = property.price == null
            ? '—'
            : `PKR ${Number(property.price).toLocaleString()}`;
        } else if (label === 'status') {
          cell.textContent = property.isProject ? property.status : 'Active · Demo';
        } else if (label === 'featured') {
          const badge = document.createElement('span');
          badge.className = `og-pm-feature-badge${isFeaturedProperty(property) && !property.isProject ? ' is-featured' : ''}`;
          badge.textContent = property.isProject
            ? 'Not applicable'
            : isFeaturedProperty(property) ? 'Featured · Demo' : 'Not featured';
          cell.appendChild(badge);
        } else if (label === 'recommended') {
          const badge = document.createElement('span');
          badge.className = 'og-pm-feature-badge';
          badge.textContent = property.isProject ? 'Not applicable' : 'Demo fallback';
          cell.appendChild(badge);
        } else if (label.includes('referred agent')) {
          cell.textContent = property.isProject ? 'Project record' : 'Demo listing';
        } else if (label === 'manage') {
          const badge = document.createElement('span');
          badge.className = 'og-mobile-demo-tag';
          badge.textContent = 'Read only';
          cell.appendChild(badge);
        }
        next.appendChild(cell);
      }
      body.appendChild(next);
    }
  }

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

  async function toggleFeaturedProperty(property, button) {
    if (!property || property.isDemo || property.isProject || property.id == null
      || (!isApprovedForPromotion(property) && !isFeaturedProperty(property))) return;
    const nextFeatured = !isFeaturedProperty(property);
    button.disabled = true;
    button.dataset.pending = 'true';
    try {
      const updated = await request(
        `/admin/properties/${encodeURIComponent(property.id)}/feature`,
        { method: 'PATCH', body: JSON.stringify({ featured: nextFeatured }) },
      );
      const savedProperty = updated?.property || updated;
      const savedFeatured = typeof savedProperty?.featured === 'boolean'
        ? savedProperty.featured
        : nextFeatured;
      const id = String(property.id);
      const merged = { ...property, ...(savedProperty || {}), featured: savedFeatured };
      button.dataset.pending = '';
      apiProperties = apiProperties.map((item) => String(item.id) === id ? merged : item);
      if (observedProperties.has(id)) observedProperties.set(id, merged);
      rebuildPropertyData();
    } catch (error) {
      button.disabled = false;
      button.dataset.pending = '';
      window.alert(error.message || 'Could not update the Featured status.');
    }
  }

  async function toggleRecommendedProperty(property, button) {
    if (!property || property.isDemo || property.isProject || property.id == null
      || (!isApprovedForPromotion(property) && !isRecommendedProperty(property))) return;
    const nextRecommended = !isRecommendedProperty(property);
    button.disabled = true;
    button.dataset.pending = 'true';
    try {
      const updated = await request(
        `/admin/properties/${encodeURIComponent(property.id)}/recommend`,
        { method: 'PATCH', body: JSON.stringify({ recommended: nextRecommended }) },
      );
      const savedProperty = updated?.property || updated;
      const savedRecommended = typeof savedProperty?.recommended === 'boolean'
        ? savedProperty.recommended
        : nextRecommended;
      const id = String(property.id);
      const merged = { ...property, ...(savedProperty || {}), recommended: savedRecommended };
      button.dataset.pending = '';
      apiProperties = apiProperties.map((item) => String(item.id) === id ? merged : item);
      if (observedProperties.has(id)) observedProperties.set(id, merged);
      rebuildPropertyData();
    } catch (error) {
      button.disabled = false;
      button.dataset.pending = '';
      window.alert(error.message || 'Could not update the Recommended status.');
    }
  }

  async function loadPropertyData() {
    try {
      const payload = await request('/admin/properties');
      setPropertyData(payload);
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

  async function openPropertyEditor(property, trigger) {
    if (!property?.id) {
      window.alert('This property could not be identified. Refresh the listings and try again.');
      return;
    }
    if (trigger) trigger.disabled = true;
    try {
      await loadAgents();
      const review = await request(`/admin/properties/${encodeURIComponent(property.id)}/review`);
      const fullProperty = { ...property, ...(review?.property || {}) };
      if (!properties.some((item) => String(item.id) === String(fullProperty.id))) {
        properties = [...properties, fullProperty];
      } else {
        properties = properties.map((item) => String(item.id) === String(fullProperty.id) ? fullProperty : item);
      }
      openModal(fullProperty, review || {});
    } catch (error) {
      window.alert(error.message || 'Could not open this property for editing.');
    } finally {
      if (trigger) trigger.disabled = false;
    }
  }
  window.__ogOpenPropertyEditor = openPropertyEditor;

  function addFilters(root) {
    const table = root.querySelector('table');
    if (!table || root.querySelector('.og-pm-filters')) return;
    const filters = document.createElement('div');
    filters.className = 'og-pm-filters';
    const groups = [
      { label: 'Status', key: 'filter', items: [
      ['all', 'All properties'],
      ['listed', 'Property listed'],
      ['pending', 'Pending review'],
      ['active', 'Active'],
      ['changes requested', 'Changes requested'],
      ['rejected', 'Rejected'],
      ] },
      { label: 'City', key: 'city', items: [
        ['all', 'Cities'], ['Okara', 'Okara'], ['Depalpur', 'Depalpur'],
        ['Renala Khurd', 'Renala Khurd'], ['Haveli Lakha', 'Haveli Lakha'],
        ['Basir Pur', 'Basir Pur'],
      ] },
    ];
    for (const group of groups) {
      const row = document.createElement('div');
      row.className = 'og-pm-filter-group';
      const label = document.createElement('span');
      label.className = 'og-pm-filter-label';
      label.textContent = group.label;
      row.appendChild(label);
      for (const [value, title] of group.items) {
        const button = document.createElement('button');
        button.className = 'og-pm-filter';
        button.type = 'button';
        button.dataset[group.key] = value;
        button.addEventListener('click', () => {
          if (group.key === 'filter') filter = value;
          if (group.key === 'city') cityFilter = value;
          propertyPage = 1;
          queueEnhancement();
        });
        button.textContent = title;
        row.appendChild(button);
      }
      filters.appendChild(row);
    }
    const tools = document.createElement('div');
    tools.className = 'og-pm-table-tools';
    tools.innerHTML = `<input type="search" aria-label="Search properties" placeholder="Search title, city, owner, or address">
      <select aria-label="Sort properties"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="title">Title A–Z</option></select>
      <select aria-label="Rows per page"><option value="25">25 per page</option><option value="50">50 per page</option><option value="100">100 per page</option></select>`;
    const search = tools.querySelector('input');
    const sort = tools.querySelectorAll('select')[0];
    const pageSize = tools.querySelectorAll('select')[1];
    search.value = propertySearch;
    sort.value = propertySort;
    pageSize.value = String(propertyPageSize);
    search.addEventListener('input', () => {
      propertySearch = normalize(search.value);
      propertyPage = 1;
      queueEnhancement();
    });
    sort.addEventListener('change', () => {
      propertySort = sort.value;
      propertyPage = 1;
      queueEnhancement();
    });
    pageSize.addEventListener('change', () => {
      propertyPageSize = Number(pageSize.value) || 25;
      propertyPage = 1;
      queueEnhancement();
    });
    filters.appendChild(tools);
    table.closest('.bg-white')?.prepend(filters);
  }

  function refreshCityFilterOptions(root) {
    const cityRow = [...root.querySelectorAll('.og-pm-filter-group')]
      .find((row) => row.querySelector('.og-pm-filter-label')?.textContent.trim() === 'City');
    if (!cityRow) return;
    const cities = new Set([
      'Okara', 'Depalpur', 'Renala Khurd', 'Haveli Lakha', 'Basir Pur',
      ...properties.map(cityOf).filter(Boolean),
    ]);
    const existing = new Set([...cityRow.querySelectorAll('[data-city]')].map((button) => normalize(button.dataset.city)));
    for (const city of cities) {
      const key = normalize(city);
      if (!key || existing.has(key)) continue;
      const button = document.createElement('button');
      button.className = 'og-pm-filter';
      button.type = 'button';
      button.dataset.city = city;
      button.textContent = city;
      button.addEventListener('click', () => {
        cityFilter = city;
        propertyPage = 1;
        queueEnhancement();
      });
      cityRow.appendChild(button);
      existing.add(key);
    }
  }

  function renderLatestPanel(root, table) {
    if (featuredView || recommendedView || projectsView || agricultureView) {
      table.closest('.bg-white')?.querySelector('[data-og-latest-panel]')?.remove();
      return;
    }
    const card = table.closest('.bg-white');
    if (!card) return;
    let panel = card.querySelector('[data-og-latest-panel]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.ogLatestPanel = 'true';
      panel.className = 'og-pm-latest-panel';
      const filters = card.querySelector('.og-pm-filters');
      if (filters) filters.after(panel);
      else card.prepend(panel);
    }

    const latest = getLatestMobileProperties();
    const signature = JSON.stringify(latest.map((property) => [
      property.id, property.title, property.city, property.type, property.price, property.createdAt,
    ]));
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;
    panel.replaceChildren();

    const kicker = document.createElement('div');
    kicker.className = 'og-pm-latest-kicker';
    kicker.textContent = 'MOBILE HOME · LATEST 6';
    const title = document.createElement('h3');
    title.className = 'og-pm-latest-title';
    title.textContent = 'Latest properties';
    const subtitle = document.createElement('p');
    subtitle.className = 'og-pm-latest-subtitle';
    subtitle.textContent = 'Newest approved listings currently shown in the mobile app.';
    const heading = document.createElement('div');
    heading.className = 'og-pm-latest-head';
    heading.append(kicker, title, subtitle);
    panel.appendChild(heading);

    if (!latest.length) {
      const empty = document.createElement('div');
      empty.className = 'og-pm-latest-empty';
      empty.textContent = 'No approved live listings are available for the mobile Latest section.';
      panel.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'og-pm-latest-grid';
    latest.forEach((property, index) => {
      const item = document.createElement('div');
      item.className = 'og-pm-latest-item';
      const rank = document.createElement('span');
      rank.className = 'og-pm-latest-rank';
      rank.textContent = String(index + 1).padStart(2, '0');
      const info = document.createElement('div');
      info.className = 'og-pm-latest-info';
      const name = document.createElement('div');
      name.className = 'og-pm-latest-name';
      name.textContent = property.title || 'Untitled property';
      const meta = document.createElement('div');
      meta.className = 'og-pm-latest-meta';
      const price = property.price == null ? '' : `PKR ${Number(property.price).toLocaleString()}`;
      meta.textContent = [property.type, property.city, price].filter(Boolean).join(' · ');
      info.append(name, meta);
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'og-pm-latest-edit';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => { void openPropertyEditor(property, edit); });
      item.append(rank, info, edit);
      grid.appendChild(item);
    });
    panel.appendChild(grid);
  }

  function renderAgricultureOverview(root) {
    if (!agricultureView) return;
    const card = root.querySelector('.bg-white');
    if (!card) return;
    let panel = card.querySelector('[data-og-agriculture-overview]');
    if (!panel) {
      panel = document.createElement('section');
      panel.dataset.ogAgricultureOverview = 'true';
      panel.className = 'og-pm-agriculture-overview';
      const filters = card.querySelector('.og-pm-filters');
      if (filters) filters.before(panel);
      else card.prepend(panel);
    }
    const farms = apiProperties.filter((property) => !property.isDemo && !property.isProject && matchesCategory(property, 'agricultural'));
    const liveCount = farms.filter((property) => matchesFilter(property, 'listed')).length;
    const reviewCount = farms.filter((property) => matchesFilter(property, 'in-progress')).length;
    const signature = `${farms.length}:${liveCount}:${reviewCount}`;
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;
    panel.innerHTML = `<div class="og-pm-agriculture-intro"><div class="og-pm-agriculture-kicker">Land management</div><h3 class="og-pm-agriculture-title">Agriculture land</h3><p class="og-pm-agriculture-copy">Farmland listings are separated here and remain connected to the existing review, map, media and listing editor.</p></div>
      <div class="og-pm-agriculture-stat"><span>Land listings</span><strong>${farms.length}</strong></div>
      <div class="og-pm-agriculture-stat"><span>Live / approved</span><strong>${liveCount}</strong></div>
      <div class="og-pm-agriculture-stat"><span>Under review</span><strong>${reviewCount}</strong></div>`;
  }

  function updatePropertyTable(root, table) {
    const body = table.querySelector('tbody');
    if (!body) return 0;
    const rows = [...body.querySelectorAll('tr')].filter((row) => !row.querySelector('[colspan]'));
    const propertyForRow = (row) => row.dataset.ogMobileDemoRow
      ? [...mobileDemoProperties, ...mobileProjectProperties].find((item) => String(item.id) === row.dataset.ogMobileDemoRow)
      : row.querySelector('[data-og-pm-cell] button')?.__ogListingProperty;
    const matched = rows.filter((row) => row.dataset.ogMatchesFilters === 'true');
    const getProperty = (row) => propertyForRow(row) || {};
    matched.sort((a, b) => {
      const left = getProperty(a);
      const right = getProperty(b);
      if (propertySort === 'title') return String(left.title || '').localeCompare(String(right.title || ''), undefined, { sensitivity: 'base' });
      if (propertySort === 'price-low' || propertySort === 'price-high') {
        const difference = (Number(left.price) || 0) - (Number(right.price) || 0);
        return propertySort === 'price-low' ? difference : -difference;
      }
      const difference = new Date(left.createdAt || left.created_at || 0).getTime() - new Date(right.createdAt || right.created_at || 0).getTime();
      return propertySort === 'oldest' ? difference : -difference;
    });
    matched.forEach((row, index) => {
      if (body.children[index] !== row) body.insertBefore(row, body.children[index] || null);
    });
    const pageCount = Math.max(1, Math.ceil(matched.length / propertyPageSize));
    propertyPage = Math.min(propertyPage, pageCount);
    const start = (propertyPage - 1) * propertyPageSize;
    matched.forEach((row, index) => { row.hidden = index < start || index >= start + propertyPageSize; });
    rows.filter((row) => row.dataset.ogMatchesFilters !== 'true').forEach((row) => { row.hidden = true; });
    let pager = root.querySelector('.og-pm-pagination');
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'og-pm-pagination';
      pager.innerHTML = '<span data-page-summary></span><button type="button" data-page-prev>Previous</button><button type="button" data-page-next>Next</button>';
      table.parentElement?.insertAdjacentElement('afterend', pager);
      pager.querySelector('[data-page-prev]').addEventListener('click', () => { propertyPage = Math.max(1, propertyPage - 1); queueEnhancement(); });
      pager.querySelector('[data-page-next]').addEventListener('click', () => { propertyPage += 1; queueEnhancement(); });
    }
    const pageSummary = `Showing ${matched.length ? start + 1 : 0}–${Math.min(start + propertyPageSize, matched.length)} of ${matched.length}`;
    const summaryNode = pager.querySelector('[data-page-summary]');
    if (summaryNode.textContent !== pageSummary) summaryNode.textContent = pageSummary;
    pager.querySelector('[data-page-prev]').disabled = propertyPage <= 1;
    pager.querySelector('[data-page-next]').disabled = propertyPage >= pageCount;
    return matched.length;
  }

  function enhance() {
    if (!apiProperties.length && Array.isArray(window.__ogAdminApiProperties) && window.__ogAdminApiProperties.length) {
      setPropertyData(window.__ogAdminApiProperties);
    }
    const root = findRoot();
    if (!root) return;
    const heading = root.querySelector('h2');
    const headingLabels = {
      all: 'All properties',
      listed: 'Property listed',
      pending: 'Pending approvals',
      approved: 'Approved properties',
      rejected: 'Rejected properties',
      'in-progress': 'Property in progress',
      closed: 'Property closed',
    };
    const viewHeading = listingInboxView ? 'Property listed'
      : featuredView ? 'Featured properties'
        : recommendedView ? 'Recommended properties'
          : projectsView ? 'Projects'
            : agricultureView ? 'Agriculture Land' : headingLabels[filter];
    if (heading && viewHeading) heading.textContent = viewHeading;
    if (projectsView && heading && !root.querySelector('[data-og-project-add-action]')) {
      const action = document.createElement('a');
      action.href = '/admin/management/developer-projects?create=project';
      action.dataset.ogProjectAddAction = 'true';
      action.textContent = '+ Add Project';
      action.setAttribute('aria-label', 'Add a developer project');
      action.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;margin:8px 0;padding:10px 16px;border-radius:8px;background:#c8a45a;color:#0b1f3a;font:600 13px system-ui;text-decoration:none;box-shadow:0 2px 8px #0b1f3a18';
      heading.insertAdjacentElement('afterend', action);
    }
    const table = root.querySelector('table');
    if (!table) return;
    addFilters(root);
    renderAgricultureOverview(root);
    renderLatestPanel(root, table);
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
    if (headers && !headers.querySelector('[data-og-featured-header]')) {
      const th = document.createElement('th');
      th.dataset.ogFeaturedHeader = 'true';
      th.className = 'text-left px-4 py-3 font-semibold';
      th.textContent = 'Featured';
      headers.insertBefore(th, headers.querySelector('[data-og-agent-header]') || headers.querySelector('[data-og-pm-header]') || null);
    }
    if (headers && !headers.querySelector('[data-og-recommended-header]')) {
      const th = document.createElement('th');
      th.dataset.ogRecommendedHeader = 'true';
      th.className = 'text-left px-4 py-3 font-semibold';
      th.textContent = 'Recommended';
      headers.insertBefore(th, headers.querySelector('[data-og-agent-header]') || headers.querySelector('[data-og-pm-header]') || null);
    }
    ensureMobileDemoRows(table);
    const used = new Set();
    const rows = [...table.querySelectorAll('tbody tr')].filter((row) => !row.querySelector('[colspan]'));
    for (const row of rows) {
      if (row.dataset.ogMobileDemoRow) {
        const mobileRecord = [...mobileDemoProperties, ...mobileProjectProperties]
          .find((item) => String(item.id) === row.dataset.ogMobileDemoRow);
        if (mobileRecord) {
          const searchText = normalize([mobileRecord.title, mobileRecord.city, mobileRecord.sellerName, mobileRecord.address, row.innerText].join(' '));
          row.dataset.ogMatchesFilters = String(matchesPropertyFilters(mobileRecord) && (!propertySearch || searchText.includes(propertySearch)));
          row.hidden = row.dataset.ogMatchesFilters !== 'true';
        } else {
          row.dataset.ogMatchesFilters = String(!propertySearch || normalize(row.innerText).includes(propertySearch));
          row.hidden = row.dataset.ogMatchesFilters !== 'true';
        }
        continue;
      }
      const property = rowProperty(row, used);
      if (!property) {
        row.dataset.ogMatchesFilters = String(!propertySearch || normalize(row.innerText).includes(propertySearch));
        row.hidden = row.dataset.ogMatchesFilters !== 'true';
        continue;
      }
      if (!apiProperties.some((item) => String(item.id) === String(property.id))) {
        addObservedProperty(property);
      }
      row.dataset.ogPropertyStatus = statusOf(property);
      let cell = row.querySelector('[data-og-pm-cell]');
      if (!cell) {
        cell = document.createElement('td'); cell.dataset.ogPmCell = 'true'; cell.className = 'px-4 py-3';
        row.appendChild(cell);
      }
      let button = cell.querySelector('button');
      if (!button) {
        button = document.createElement('button'); button.className = 'og-pm-manage'; button.type = 'button';
        button.addEventListener('click', () => {
          const current = button.__ogListingProperty
            || properties.find((item) => String(item.id) === button.dataset.propertyId);
          if (current) void openPropertyEditor(current, button);
        });
        cell.appendChild(button);
      }
      if (button.textContent !== 'Edit listing') button.textContent = 'Edit listing';
      button.dataset.propertyId = String(property.id);
      button.dataset.ogPmEdit = 'true';
      button.__ogListingProperty = property;
      const rowStatus = row.dataset.ogPropertyStatus;
      const searchText = normalize([property.title, property.city, property.sellerName, property.address, property.district, property.locality, row.innerText].join(' '));
      row.dataset.ogMatchesFilters = String(matchesPropertyFilters(property) && (!propertySearch || searchText.includes(propertySearch)));
      row.hidden = row.dataset.ogMatchesFilters !== 'true';
      let featuredCell = row.querySelector('[data-og-featured-cell]');
      if (!featuredCell) {
        featuredCell = document.createElement('td');
        featuredCell.dataset.ogFeaturedCell = 'true';
        featuredCell.className = 'px-4 py-3';
        const featuredColumnIndex = [...headers.children]
          .findIndex((header) => header.hasAttribute('data-og-featured-header'));
        row.insertBefore(featuredCell, row.cells[featuredColumnIndex] || null);
      }
      let featureButton = featuredCell.querySelector('[data-og-feature-toggle]');
      if (!featureButton) {
        featureButton = document.createElement('button');
        featureButton.dataset.ogFeatureToggle = 'true';
        featureButton.type = 'button';
        featureButton.className = 'og-pm-feature-toggle';
        featureButton.addEventListener('click', () => {
          void toggleFeaturedProperty(featureButton.__ogListingProperty, featureButton);
        });
        featuredCell.appendChild(featureButton);
      }
      featureButton.__ogListingProperty = property;
      const isFeatured = isFeaturedProperty(property);
      const canPromote = isApprovedForPromotion(property);
      featureButton.textContent = isFeatured ? '★ Featured' : canPromote ? '☆ Feature listing' : 'Approve first';
      featureButton.classList.toggle('is-featured', isFeatured);
      featureButton.setAttribute('aria-pressed', String(isFeatured));
      featureButton.setAttribute('aria-label', `${isFeatured ? 'Remove from' : 'Add to'} Featured properties: ${property.title || 'listing'}`);
      featureButton.title = canPromote ? '' : 'Approve this listing before featuring it.';
      featureButton.disabled = featureButton.dataset.pending === 'true' || (!canPromote && !isFeatured);
      let recommendedCell = row.querySelector('[data-og-recommended-cell]');
      if (!recommendedCell) {
        recommendedCell = document.createElement('td');
        recommendedCell.dataset.ogRecommendedCell = 'true';
        recommendedCell.className = 'px-4 py-3';
        const recommendedColumnIndex = [...headers.children]
          .findIndex((header) => header.hasAttribute('data-og-recommended-header'));
        row.insertBefore(recommendedCell, row.cells[recommendedColumnIndex] || null);
      }
      let recommendedButton = recommendedCell.querySelector('[data-og-recommend-toggle]');
      if (!recommendedButton) {
        recommendedButton = document.createElement('button');
        recommendedButton.dataset.ogRecommendToggle = 'true';
        recommendedButton.type = 'button';
        recommendedButton.className = 'og-pm-recommend-toggle';
        recommendedButton.addEventListener('click', () => {
          void toggleRecommendedProperty(recommendedButton.__ogListingProperty, recommendedButton);
        });
        recommendedCell.appendChild(recommendedButton);
      }
      recommendedButton.__ogListingProperty = property;
      const isRecommended = isRecommendedProperty(property);
      recommendedButton.textContent = isRecommended ? '✓ Recommended' : canPromote ? '+ Recommend' : 'Approve first';
      recommendedButton.classList.toggle('is-recommended', isRecommended);
      recommendedButton.setAttribute('aria-pressed', String(isRecommended));
      recommendedButton.setAttribute('aria-label', `${isRecommended ? 'Remove from' : 'Add to'} Recommended properties: ${property.title || 'listing'}`);
      recommendedButton.title = canPromote ? '' : 'Approve this listing before recommending it.';
      recommendedButton.disabled = recommendedButton.dataset.pending === 'true' || (!canPromote && !isRecommended);
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
      let agentLabel = agentCell.querySelector('[data-og-agent-label]');
      if (!agentLabel) {
        agentLabel = document.createElement('span');
        agentLabel.dataset.ogAgentLabel = 'true';
        agentCell.appendChild(agentLabel);
      }
      agentLabel.textContent = assignedName ? `${assignedName}${assignedCity ? ` · ${assignedCity}` : ''}` : 'Not assigned';
      let agentButton = agentCell.querySelector('[data-og-agent-assign]');
      if (!agentButton) {
        agentButton = document.createElement('button');
        agentButton.type = 'button';
        agentButton.dataset.ogAgentAssign = 'true';
        agentButton.className = 'og-pm-agent-assign';
        agentButton.addEventListener('click', () => {
          const current = agentButton.__ogListingProperty;
          if (current) void openPropertyEditor(current, agentButton);
        });
        agentCell.appendChild(agentButton);
      }
      agentButton.__ogListingProperty = property;
      agentButton.textContent = assignedName ? 'Change agent' : 'Assign agent';
      agentButton.setAttribute('aria-label', `${assignedName ? 'Change' : 'Assign'} agent for ${property.title || 'listing'}`);
    }
    const summary = heading?.parentElement?.querySelector('p');
    const visibleCount = updatePropertyTable(root, table);
    refreshCityFilterOptions(root);
    if (summary) summary.textContent = propertyLoadError
      ? `Edit controls unavailable: ${propertyLoadError}`
      : `${visibleCount} shown · ${properties.length} total properties`;
    root.querySelectorAll('.og-pm-filter').forEach((button) => {
      const statusValue = button.dataset.filter;
      const categoryValue = button.dataset.category;
      const featuredValue = button.dataset.featured;
      const recommendedValue = button.dataset.recommended;
      const latestValue = button.dataset.latest;
      const cityValue = button.dataset.city;
      const value = statusValue ?? categoryValue ?? featuredValue ?? recommendedValue ?? latestValue ?? cityValue ?? 'all';
      const count = properties.filter((item) => {
        if (statusValue !== undefined) return matchesPropertyFilters(item, statusValue, categoryFilter, cityFilter, featuredFilter);
        if (categoryValue !== undefined) return matchesPropertyFilters(item, filter, categoryValue, cityFilter, featuredFilter);
        if (featuredValue !== undefined) return matchesPropertyFilters(item, filter, categoryFilter, cityFilter, featuredValue);
        if (recommendedValue !== undefined) return matchesPropertyFilters(item, filter, categoryFilter, cityFilter, featuredFilter, recommendedValue);
        if (latestValue !== undefined) return matchesPropertyFilters(item, filter, categoryFilter, cityFilter, featuredFilter, recommendedFilter, latestValue);
        return matchesPropertyFilters(item, filter, categoryFilter, cityValue, featuredFilter);
      }).length;
      const active = statusValue !== undefined ? filter === statusValue
        : categoryValue !== undefined ? categoryFilter === categoryValue
          : featuredValue !== undefined ? featuredFilter === featuredValue
            : recommendedValue !== undefined ? recommendedFilter === recommendedValue
                : latestValue !== undefined ? latestFilter === latestValue
                  : cityFilter === cityValue;
      const title = button.textContent.replace(/\s·\s\d+$/, '');
      const label = `${title} · ${count}`;
      if (button.textContent !== label) button.textContent = label;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  observer = new MutationObserver(queueEnhancement);
  const start = () => {
    ensureStyles();
    const initialProperties = Array.isArray(window.__ogAdminApiProperties)
      ? window.__ogAdminApiProperties : window.__ogAdminListingProperties;
    if (Array.isArray(initialProperties)) setPropertyData(initialProperties);
    void loadMobileDemoProperties();
    void loadMobileProjectProperties();
    observer.observe(document.body, { childList: true, subtree: true });
    queueEnhancement();
    if (/\/admin\/properties\/?$/.test(window.location.pathname) && window.localStorage?.getItem('og_token')) {
      void loadPropertyData();
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
