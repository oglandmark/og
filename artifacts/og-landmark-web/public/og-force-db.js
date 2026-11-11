/**
 * OG Landmark — force SPA property list from the Laravel API (MySQL app_data).
 * Clears one-time sticky demo persist, then overlays /api/properties onto the
 * Zustand persist key so the live bundle does not keep seeded demo villas.
 *
 * Load AFTER og-api-base.js and BEFORE (or with) the main bundle.
 */
(function () {
  var STORE_KEY = 'og-landmark-store';
  var FLAG_KEY = 'og_store_db_v2';
  var isPreviewHost = /(^localhost$|^127\.0\.0\.1$|\.replit\.dev$|\.replit\.app$|\.repl\.co$)/i
    .test(window.location.hostname);

  function clearStickyDemoOnce() {
    try {
      if (localStorage.getItem(FLAG_KEY) === '1') return;
      localStorage.removeItem(STORE_KEY);
      localStorage.setItem(FLAG_KEY, '1');
    } catch (e) {}
  }

  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.properties)) return payload.properties;
    return null;
  }

  function writePersistProperties(list) {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      if (!parsed.state || typeof parsed.state !== 'object') parsed.state = {};
      parsed.state.properties = list;
      // Drop demo saved IDs that may not exist in DB
      if (!Array.isArray(parsed.state.savedPropertyIds) || list.length === 0) {
        parsed.state.savedPropertyIds = [];
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
    } catch (e) {}
  }

  function cachedCollection(key) {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      var value = parsed && parsed.state && parsed.state[key];
      return Array.isArray(value) ? value : [];
    } catch (e) {
      return [];
    }
  }

  function hasPreviewSession() {
    try {
      if (localStorage.getItem('og_token')) return true;
      var parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      return Boolean(parsed && parsed.state && parsed.state.token);
    } catch (e) {
      return false;
    }
  }

  function installAnonymousPreviewFallbacks() {
    if (!isPreviewHost) return;
    var appFetch = window.fetch.bind(window);
    var collections = {
      '/api/users': 'users',
      '/api/inquiries': 'inquiries',
      '/api/offers': 'offers',
      '/api/appointments': 'appointments',
      '/api/conversations': 'conversations',
      '/api/notifications': 'notifications',
      '/api/blog': 'blogPosts'
    };
    window.fetch = function (input, init) {
      var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      var sourceUrl = typeof input === 'string' ? input : input && input.url;
      var parsed;
      try {
        parsed = new URL(sourceUrl, window.location.origin);
      } catch (e) {
        return appFetch(input, init);
      }
      if (method !== 'GET') return appFetch(input, init);
      if (parsed.pathname === '/api/preview/live/mobile-agents') {
        return appFetch('/api/mobile-agents' + parsed.search, init);
      }
      if (!hasPreviewSession() && Object.prototype.hasOwnProperty.call(collections, parsed.pathname)) {
        return Promise.resolve(new Response(JSON.stringify(cachedCollection(collections[parsed.pathname])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      }
      return appFetch(input, init);
    };
  }

  function applyToZustandIfPresent(list) {
    try {
      // Best-effort: some builds expose store on window; otherwise persist + reload hydrate is enough
      if (window.__OG_LANDMARK_STORE__ && typeof window.__OG_LANDMARK_STORE__.setState === 'function') {
        window.__OG_LANDMARK_STORE__.setState({ properties: list });
      }
    } catch (e) {}
  }

  function preloadPreviewPropertiesBeforeApp() {
    if (!isPreviewHost) return;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/api/properties?limit=500', false);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send(null);
      if (xhr.status < 200 || xhr.status >= 300) return;
      var list = normalizeList(JSON.parse(xhr.responseText));
      if (!list) return;
      writePersistProperties(list);
      window.__OG_DB_PROPERTIES__ = list;
    } catch (e) {}
  }

  function fetchAndApply() {
    var url = '/api/properties?limit=500';
    return fetch(url, { credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw new Error('properties ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var list = normalizeList(data);
        if (!list) {
          writePersistProperties([]);
          return;
        }
        writePersistProperties(list);
        applyToZustandIfPresent(list);
        window.__OG_DB_PROPERTIES__ = list;
        window.dispatchEvent(new CustomEvent('og-properties-from-db', { detail: { count: list.length } }));
      })
      .catch(function () {
        // Prefer empty over sticky demo if API is down
        writePersistProperties([]);
      });
  }

  clearStickyDemoOnce();
  preloadPreviewPropertiesBeforeApp();
  installAnonymousPreviewFallbacks();

  // Run after API rewriter is ready; retry a few times so late hydrate in the SPA can be overwritten
  var attempts = 0;
  function tick() {
    attempts += 1;
    fetchAndApply().finally(function () {
      if (attempts < 4) setTimeout(tick, 1500 * attempts);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(tick, 50);
    });
  } else {
    setTimeout(tick, 50);
  }
})();
