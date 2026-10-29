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
  var isLocalAdminHost = /(^localhost$|^127\.0\.0\.1$|\.replit\.dev$|\.repl\.co$)/i
    .test(window.location.hostname);
  var previewBase = isPreviewHost ? '/api' : LIVE;
  var localLaravelAdminBase = /\.replit\.dev$|\.repl\.co$/i.test(window.location.hostname)
    ? '/api-legacy/api'
    : 'http://127.0.0.1:8000/api';
  window.__OG_LIVE_API_BASE__ = LIVE;
  window.__OG_ADMIN_LARAVEL_LOCAL__ = isLocalAdminHost;
  window.__OG_LOCAL_LARAVEL_API_BASE__ = localLaravelAdminBase;
  // Replit previews stay on the local Laravel proxy even if an earlier URL
  // override was saved. Production hosts continue using the live API.
  var base = (isPreviewHost ? '/api' : (fromQuery || fromStorage || previewBase)).replace(/\/+$/, '');
  window.__OG_API_BASE__ = base;
  // Persist ?api= so /admin and /user navigations keep the same API origin.
  if (fromQuery && !isPreviewHost) {
    try {
      localStorage.setItem('og_api_base', base);
    } catch (e) {}
  }
  if (isPreviewHost) {
    try {
      localStorage.removeItem('og_api_base');
    } catch (e) {}
  }

  function rewriteLocalAdminRoute(url, method) {
    if (!isLocalAdminHost || typeof url !== 'string') return { url: url, method: method };

    var parsed;
    try {
      parsed = new URL(url, window.location.origin);
    } catch (e) {
      return { url: url, method: method };
    }
    if (parsed.origin !== window.location.origin) return { url: url, method: method };

    var pathname = parsed.pathname;
    var verb = String(method || 'GET').toUpperCase();
    var laravelPath = null;
    var laravelRoot = localLaravelAdminBase;

    if (pathname === '/api/preview/live/mobile-agents' && verb === 'GET') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (pathname === '/api/users' && verb === 'GET') {
      laravelPath = laravelRoot + '/admin/users';
    } else if (pathname === '/api/admin/users' && verb === 'GET') {
      laravelPath = laravelRoot + '/admin/users';
    } else if (/^\/api\/admin\/users\/\d+\/activity$/.test(pathname) && verb === 'GET') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/users\/\d+\/(?:role|permissions)$/.test(pathname) && verb === 'PATCH') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/users\/\d+$/.test(pathname) && (verb === 'PUT' || verb === 'DELETE')) {
      laravelPath = laravelRoot + pathname.replace('/api/users/', '/admin/users/');
    } else if (pathname === '/api/admin/reports' && verb === 'GET') {
      laravelPath = laravelRoot + '/admin/reports';
    } else if (/^\/api\/admin\/reports\/\d+$/.test(pathname) && verb === 'PATCH') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (pathname === '/api/admin/properties' && verb === 'GET') {
      laravelPath = laravelRoot + '/admin/properties';
    } else if (/^\/api\/admin\/properties\/\d+$/.test(pathname) && verb === 'DELETE') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/properties\/\d+$/.test(pathname) && verb === 'PATCH') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/properties\/\d+\/visibility$/.test(pathname) && verb === 'PATCH') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/properties\/\d+\/(?:feature|recommend)$/.test(pathname) && verb === 'PATCH') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/properties\/\d+\/review$/.test(pathname) && verb === 'GET') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/properties\/\d+\/media$/.test(pathname) && verb === 'PATCH') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/properties\/\d+\/(?:approve|reject|request-changes)$/.test(pathname)
      && verb === 'PATCH') {
      laravelPath = laravelRoot + pathname.replace('/api/admin/properties/', '/properties/');
    } else if (pathname === '/api/admin/mobile-agents' && ['GET', 'POST'].indexOf(verb) !== -1) {
      laravelPath = laravelRoot + '/admin/mobile-agents';
    } else if (/^\/api\/admin\/mobile-agents\/\d+$/.test(pathname)
      && (verb === 'PUT' || verb === 'PATCH' || verb === 'DELETE')) {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
      if (verb === 'PUT') verb = 'PATCH';
    } else if (pathname === '/api/mobile/banners/all' && verb === 'GET') {
      laravelPath = laravelRoot + '/mobile/banners/all';
    } else if (pathname === '/api/mobile/banners' && verb === 'GET') {
      laravelPath = laravelRoot + '/mobile/banners';
    } else if (pathname === '/api/mobile/banners' && verb === 'POST') {
      laravelPath = laravelRoot + '/admin/mobile/banners';
    } else if (/^\/api\/mobile\/banners\/\d+$/.test(pathname)
      && ['PUT', 'POST', 'DELETE'].indexOf(verb) !== -1) {
      laravelPath = laravelRoot + pathname.replace('/api/mobile/banners/', '/admin/mobile/banners/');
    } else if (/^\/api\/upload\/(?:single|video)$/.test(pathname) && verb === 'POST') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (/^\/api\/admin\/property-media\/[A-Za-z0-9._-]+$/.test(pathname) && verb === 'GET') {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    } else if (pathname === '/api/admin/mobile-agent-preview-hidden' && ['GET', 'POST'].indexOf(verb) !== -1) {
      laravelPath = laravelRoot + pathname.replace(/^\/api/, '');
    }

    if (!laravelPath) return { url: url, method: method };
    return { url: laravelPath + parsed.search + parsed.hash, method: verb };
  }

  function rewrite(url, method) {
    if (typeof url !== 'string') return url;
    var rewritten = url;
    if (url.indexOf('/api/') === 0 || url === '/api') {
      rewritten = base + url.slice(4);
    } else if (url.indexOf(window.location.origin + '/api') === 0) {
      rewritten = base + url.slice(window.location.origin.length + 4);
    }
    return rewriteLocalAdminRoute(rewritten, method).url;
  }

  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var method = (init && init.method) || (input && input.method) || 'GET';
    var originalUrl = typeof input === 'string' ? input : input && input.url;
    var route = rewriteLocalAdminRoute(rewrite(originalUrl), method);
    if (typeof input === 'string') input = route.url;
    else if (input && typeof input.url === 'string') {
      try {
        input = new Request(route.url, input);
      } catch (e) {}
    }
    if (route.method && String(route.method).toUpperCase() !== String(method).toUpperCase()) {
      init = Object.assign({}, init || {}, { method: route.method });
    }
    return _fetch(input, init);
  };

  var _open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var route = rewriteLocalAdminRoute(rewrite(url, method), method);
    arguments[0] = route.method || method;
    arguments[1] = route.url;
    return _open.apply(this, arguments);
  };
})();
