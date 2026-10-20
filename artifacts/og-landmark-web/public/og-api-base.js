/**
 * OG Landmark — API base for static Hostinger deploy.
 * Rewrites same-origin /api/* (and absolute same-origin /api) to the Laravel API.
 *
 * Override for local preview:
 *   ?api=http://127.0.0.1:8000/api
 *   localStorage.setItem('og_api_base', 'http://127.0.0.1:8000/api')
 */
(function () {
  var LIVE = 'https://api.oglandmark.com/api';
  var params = new URLSearchParams(window.location.search);
  var fromQuery = params.get('api');
  var fromStorage = null;
  try {
    fromStorage = localStorage.getItem('og_api_base');
  } catch (e) {}
  var isPreviewHost = /(^localhost$|^127\.0\.0\.1$|\.replit\.dev$|\.replit\.app$|\.repl\.co$)/i
    .test(window.location.hostname);
  var previewBase = isPreviewHost ? '/api' : LIVE;
  window.__OG_LIVE_API_BASE__ = LIVE;
  // A production API URL saved during an earlier preview session should not
  // bypass the local Laravel proxy when this site is opened on Replit.
  if (isPreviewHost && !fromQuery && fromStorage === LIVE) fromStorage = null;
  var base = (fromQuery || fromStorage || previewBase).replace(/\/+$/, '');
  window.__OG_API_BASE__ = base;
  // Persist ?api= so /admin and /user navigations keep the same API origin.
  if (fromQuery) {
    try {
      localStorage.setItem('og_api_base', base);
    } catch (e) {}
  }

  function rewrite(url) {
    if (typeof url !== 'string') return url;
    if (url.indexOf('/api/') === 0 || url === '/api') {
      return base + url.slice(4);
    }
    if (url.indexOf(window.location.origin + '/api') === 0) {
      return base + url.slice(window.location.origin.length + 4);
    }
    return url;
  }

  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === 'string') input = rewrite(input);
    else if (input && typeof input.url === 'string') {
      try {
        input = new Request(rewrite(input.url), input);
      } catch (e) {}
    }
    return _fetch(input, init);
  };

  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    arguments[1] = rewrite(url);
    return _open.apply(this, arguments);
  };
})();
