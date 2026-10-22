const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const patchDashboardAuth = require('./patch-dashboard-auth');
const bundlePath = path.join(__dirname, '..', 'public', 'assets', 'index-CXxrK7KP.js');
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

function extractUserBootstrapScript() {
  const html = fs.readFileSync(userHtmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, 'Could not find the User portal bootstrap script');
  return match[1];
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

test('legacy Buyer and Seller sessions stay on the shared User portal', () => {
  const script = extractUserBootstrapScript();
  for (const role of ['Buyer', 'Seller']) {
    const storage = createLocalStorage({
      og_token: `${role.toLowerCase()}-session-test`,
      og_user: JSON.stringify({ id: 123, name: `Dashboard ${role}`, role }),
    });
    const classes = [];
    let destination = '';

    vm.runInNewContext(script, {
      localStorage: storage,
      document: { documentElement: { classList: { add(value) { classes.push(value); } } } },
      window: { location: { replace(value) { destination = value; } } },
    });

    assert.equal(destination, '');
    assert.ok(classes.includes('public-account'));
    assert.equal(storage.getItem('og_token'), `${role.toLowerCase()}-session-test`);
    assert.equal(JSON.parse(storage.getItem('og_user')).id, 123);
  }
});

test('Agent and Developer sessions keep loading the compiled staff portal', () => {
  const script = extractUserBootstrapScript();
  for (const role of ['Agent', 'Developer']) {
    const storage = createLocalStorage({
      og_token: `${role.toLowerCase()}-session-test`,
      og_user: JSON.stringify({ id: 456, name: `Dashboard ${role}`, role }),
    });
    const elements = [];
    let destination = '';
    const window = { location: { replace(value) { destination = value; } } };
    const document = {
      documentElement: { classList: { add() {} } },
      head: { appendChild(element) { elements.push(element); } },
      createElement(tagName) { return { tagName }; },
    };

    vm.runInNewContext(script, { localStorage: storage, document, window });

    assert.equal(destination, '');
    assert.equal(window.__OG_USE_COMPILED_PORTAL__, true);
    assert.ok(elements.some(element => element.href === '/user/assets/user-Dqdqrl3U.css'));
    assert.ok(elements.some(element => element.src === '/user/assets/user-6XP8lI2T.js'));
  }
});

test('Admin sessions retain the Admin dashboard and missing sessions go to sign-in', () => {
  const script = extractUserBootstrapScript();
  const adminStorage = createLocalStorage({
    og_token: 'admin-session-test',
    og_user: JSON.stringify({ id: 789, role: 'Admin' }),
  });
  let destination = '';
  const document = { documentElement: { classList: { add() {} } } };

  vm.runInNewContext(script, {
    localStorage: adminStorage,
    document,
    window: { location: { replace(value) { destination = value; } } },
  });
  assert.equal(destination, '/admin/');

  destination = '';
  const emptyStorage = createLocalStorage();
  vm.runInNewContext(script, {
    localStorage: emptyStorage,
    document,
    window: { location: { replace(value) { destination = value; } } },
  });
  assert.equal(destination, '/auth?mode=login');
});
