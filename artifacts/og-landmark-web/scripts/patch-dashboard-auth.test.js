const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const patchDashboardAuth = require('./patch-dashboard-auth');
const bundlePath = path.join(__dirname, '..', 'public', 'assets', 'index-CXxrK7KP.js');
const websiteHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const userHtmlPath = path.join(__dirname, '..', 'public', 'user', 'index.html');

function createLocalStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function extractMarkedInlineScript(htmlPath, marker) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const markerIndex = html.indexOf(marker);
  assert.notEqual(markerIndex, -1, `Could not find script marker: ${marker}`);
  const scriptStart = html.indexOf('<script>', markerIndex);
  const scriptEnd = html.indexOf('</script>', scriptStart);
  assert.notEqual(scriptStart, -1, 'Could not find inline script start');
  assert.notEqual(scriptEnd, -1, 'Could not find inline script end');
  return html.slice(scriptStart + '<script>'.length, scriptEnd);
}

test('login and registration save the API session for the legacy dashboard and API clients', () => {
  const source = fs.readFileSync(bundlePath, 'utf8');
  const patched = patchDashboardAuth(source);

  assert.ok(patched.includes('localStorage.setItem("og_token",a.token);localStorage.setItem("og_user",JSON.stringify(o));return t({currentUser:o,token:a.token,'));
  assert.ok(patched.includes('localStorage.setItem("og_token",s.token);localStorage.setItem("og_user",JSON.stringify(a));return t({currentUser:a,token:s.token,'));
  assert.ok(patched.includes('const a=s.user;localStorage.setItem("og_token",s.token);localStorage.setItem("og_user",JSON.stringify(a));if(a.role==="Seller"||a.role==="Agent"){'));
});

test('logout clears the same session keys used by dashboard requests', () => {
  const source = fs.readFileSync(bundlePath, 'utf8');
  const patched = patchDashboardAuth(source);

  assert.ok(patched.includes('logout:()=>{localStorage.removeItem("og_token");localStorage.removeItem("og_user");t({currentUser:null,token:null,'));
});

test('fails explicitly if the expected dashboard bundle changes', () => {
  assert.throws(
    () => patchDashboardAuth('unexpected bundle content'),
    /Could not apply password login session persistence/,
  );
});

test('a saved legacy Buyer session on /user is restored and sent to the User dashboard', () => {
  const storage = createLocalStorage({
    'og-landmark-store': JSON.stringify({
      state: {
        currentUser: { id: 123, name: 'Dashboard Buyer', role: 'Buyer' },
        token: 'buyer-session-test',
      },
      version: 0,
    }),
  });
  const location = { pathname: '/user', href: '/user' };
  const timers = [];
  const script = extractMarkedInlineScript(
    websiteHtmlPath,
    '<!-- ── Post-login/register redirect to the existing role dashboards ── -->',
  );

  vm.runInNewContext(script, {
    localStorage: storage,
    window: { location },
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
  });
  timers.forEach((callback) => callback());

  assert.equal(storage.getItem('og_token'), 'buyer-session-test');
  assert.equal(JSON.parse(storage.getItem('og_user')).id, 123);
  assert.equal(location.href, '/portal/seller-dashboard.html');
});

test('the standalone /user entry can recover a persisted session before redirecting', () => {
  const storage = createLocalStorage({
    'og-landmark-store': JSON.stringify({
      state: {
        currentUser: { id: 456, name: 'Dashboard Seller', role: 'Seller' },
        token: 'seller-session-test',
      },
      version: 0,
    }),
  });
  let destination = '';
  const html = fs.readFileSync(userHtmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'Could not find the /user redirect script');

  vm.runInNewContext(match[1], {
    localStorage: storage,
    window: { location: { replace(value) { destination = value; } } },
  });

  assert.equal(destination, '/portal/seller-dashboard.html');
  assert.equal(storage.getItem('og_token'), 'seller-session-test');
  assert.equal(JSON.parse(storage.getItem('og_user')).id, 456);
});

test('legacy Seller sessions without canonical permissions also open the User dashboard', () => {
  const storage = createLocalStorage({
    'og_token': 'seller-session-test',
    'og_user': JSON.stringify({ id: 789, role: 'Seller' }),
  });
  const location = { pathname: '/user', href: '/user' };
  const timers = [];
  const script = extractMarkedInlineScript(
    websiteHtmlPath,
    '<!-- ── Post-login/register redirect to the existing role dashboards ── -->',
  );

  vm.runInNewContext(script, {
    localStorage: storage,
    window: { location },
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
  });
  timers.forEach(callback => callback());

  assert.equal(location.href, '/portal/seller-dashboard.html');
});
