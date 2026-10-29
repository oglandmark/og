/* Bridge the compiled admin dashboard to Laravel's OTP and session contracts. */
(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.OGAdminAuthCompatibility = api;
    if (root.document) api.mount(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const TOKEN_KEY = 'og_token';
  const USER_KEY = 'og_user';
  const ADMIN_AUTH_KEY = 'adminAuth';
  const ADMIN_LOGIN_PATH = /^\/admin\/login\/?$/;
  const ADMIN_PATH = /^\/admin(?:\/|$)/;
  const PROTECTED_API_SUFFIX = /^\/(?:admin\/|users(?:\/|$)|properties(?:\/|$)|inquiries(?:\/|$))/;

  function apiBase(windowRef) {
    let base = windowRef.__OG_API_BASE__;
    if (!base) {
      try { base = windowRef.localStorage?.getItem('og_api_base'); } catch {}
    }
    if (!base) {
      try { base = new URLSearchParams(windowRef.location.search).get('api'); } catch {}
    }
    return String(base || '/api').replace(/\/+$/, '');
  }

  function endpoints(windowRef) {
    const base = apiBase(windowRef);
    return {
      verify: `${base}/auth/admin-verify`,
      otp: `${base}/auth/admin-otp`,
      me: `${base}/auth/me`,
    };
  }

  function isAdminUser(user) {
    if (!user) return false;
    const roleIsAdmin = String(user.role || '').trim().toLowerCase() === 'admin';
    const hasAdminPermission = Array.isArray(user.permissions)
      && user.permissions.some(permission => String(permission).trim().toLowerCase() === 'admin');
    return roleIsAdmin || hasAdminPermission;
  }

  function extractUser(payload) {
    return payload?.user && typeof payload.user === 'object' ? payload.user : payload;
  }

  function loginRequest(email, password) {
    return { email: String(email || '').trim(), password: String(password || '') };
  }

  function otpRequest(email, otp, rememberDevice = false) {
    const payload = { email: String(email || '').trim().toLowerCase(), otp: String(otp || '').trim() };
    if (rememberDevice) payload.rememberDevice = true;
    return payload;
  }

  function requiresOtp(payload) {
    return Boolean(payload?.success && !payload.token);
  }

  function persistSession(storage, token, user) {
    if (!token || !isAdminUser(user)) return false;
    const dashboardUser = String(user.role || '').trim().toLowerCase() === 'admin'
      ? user
      : { ...user, role: 'Admin' };
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(dashboardUser));
    storage.setItem(ADMIN_AUTH_KEY, 'true');
    return true;
  }

  function clearSession(storage) {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
    storage.removeItem(ADMIN_AUTH_KEY);
  }

  async function readJson(response) {
    return response.status === 204 ? null : response.json().catch(() => ({}));
  }

  async function request(windowRef, url, body, token, method = 'POST') {
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await windowRef.fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `Request failed (${response.status})`);
    }
    return payload;
  }

  function mount(windowRef) {
    const documentRef = windowRef.document;
    if (!documentRef || windowRef.__ogAdminAuthCompatibilityMounted) return;
    windowRef.__ogAdminAuthCompatibilityMounted = true;

    if (ADMIN_LOGIN_PATH.test(windowRef.location.pathname)) {
      mountLogin(windowRef);
      return;
    }
    if (ADMIN_PATH.test(windowRef.location.pathname)) mountSessionRecovery(windowRef);
  }

  function mountLogin(windowRef) {
    const documentRef = windowRef.document;
    const storage = windowRef.localStorage;
    const endpointsForWindow = endpoints(windowRef);
    const style = documentRef.createElement('style');
    style.textContent = `
      .og-admin-otp{margin-top:14px;padding:14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;font-family:DM Sans,system-ui,sans-serif}
      .og-admin-otp[hidden]{display:none}
      .og-admin-otp p{margin:0 0 10px;color:#475569;font-size:12px;line-height:1.5}
      .og-admin-otp input{box-sizing:border-box;width:100%;height:42px;margin-bottom:9px;border:1px solid #cbd5e1;border-radius:9px;padding:0 11px;font:600 15px system-ui;letter-spacing:.16em}
      .og-admin-otp button{min-height:38px;border:0;border-radius:9px;padding:8px 12px;background:#0B1F3A;color:#fff;font:700 12px system-ui;cursor:pointer}
      .og-admin-otp button:disabled{opacity:.6;cursor:wait}
      .og-admin-otp [data-error]{margin:0 0 9px;color:#b91c1c;font-size:12px}
      .og-admin-otp [data-actions]{display:flex;gap:8px;flex-wrap:wrap}
      .og-admin-otp [data-resend],.og-admin-otp [data-back]{background:#e9edf2;color:#334155}
      .og-admin-otp [data-remember-label]{display:flex;align-items:flex-start;gap:8px;margin:0 0 12px;color:#475569;font:500 12px/1.45 DM Sans,system-ui,sans-serif}
      .og-admin-otp [data-remember-device]{margin:2px 0 0;accent-color:#0B1F3A}
      .og-admin-login-error{margin:12px 0 0;padding:10px 12px;border:1px solid #fecdd3;border-radius:10px;background:#fff1f2;color:#b91c1c;font:500 12px/1.45 DM Sans,system-ui,sans-serif}
      .og-admin-login-error[hidden]{display:none}
    `;
    documentRef.head.appendChild(style);

    const existingToken = storage.getItem(TOKEN_KEY);
    let existingUser = null;
    try { existingUser = JSON.parse(storage.getItem(USER_KEY) || 'null'); } catch {}
    if (existingToken && isAdminUser(existingUser)) {
      clearSession(storage);
      request(windowRef, endpointsForWindow.me, null, existingToken, 'GET')
        .then(payload => {
          const user = extractUser(payload);
          if (!isAdminUser(user)) return;
          persistSession(storage, existingToken, user);
          windowRef.location.href = '/admin/';
        })
        .catch(() => {});
    }

    let mode = 'credentials';
    let pendingEmail = '';
    let busy = false;
    let container;
    let errorNode;
    let codeInput;
    let verifyButton;
    let resendButton;
    let backButton;
    let rememberDeviceCheckbox;
    let credentialErrorNode;

    function findForm() {
      const form = documentRef.querySelector('#root form');
      return form && form.querySelector('#email') && form.querySelector('#password') ? form : null;
    }

    function ensureOtpControls(form) {
      if (container?.isConnected) return;
      container = documentRef.createElement('section');
      container.className = 'og-admin-otp';
      container.hidden = true;
      container.setAttribute('aria-label', 'Admin verification code');
      container.innerHTML = `
        <p data-instructions>Enter the six-digit sign-in code sent to your admin email.</p>
        <p data-error role="alert" hidden></p>
        <input data-code inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-label="Six-digit verification code">
        <label data-remember-label><input data-remember-device type="checkbox">Remember this device for 30 days. Only select this on a private device.</label>
        <div data-actions>
          <button type="button" data-verify>Verify code</button>
          <button type="button" data-resend>Send another code</button>
          <button type="button" data-back>Back to sign in</button>
        </div>`;
      form.insertAdjacentElement('afterend', container);
      errorNode = container.querySelector('[data-error]');
      codeInput = container.querySelector('[data-code]');
      verifyButton = container.querySelector('[data-verify]');
      resendButton = container.querySelector('[data-resend]');
      backButton = container.querySelector('[data-back]');
      rememberDeviceCheckbox = container.querySelector('[data-remember-device]');
      verifyButton.addEventListener('click', verifyCode);
      resendButton.addEventListener('click', resendCode);
      backButton.addEventListener('click', returnToCredentials);
      codeInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          verifyCode();
        }
      });
    }

    function showError(message) {
      if (mode === 'otp' && container && !container.hidden) {
        if (!errorNode) return;
        errorNode.textContent = message;
        errorNode.hidden = !message;
        if (credentialErrorNode) credentialErrorNode.hidden = true;
        return;
      }

      const form = findForm();
      if (!credentialErrorNode) {
        credentialErrorNode = documentRef.createElement('p');
        credentialErrorNode.className = 'og-admin-login-error';
        credentialErrorNode.setAttribute('role', 'alert');
        credentialErrorNode.setAttribute('aria-live', 'polite');
        credentialErrorNode.hidden = true;
      }
      if (form && !credentialErrorNode.isConnected) {
        form.insertAdjacentElement('afterend', credentialErrorNode);
      }
      credentialErrorNode.textContent = message;
      credentialErrorNode.hidden = !message;
      if (errorNode) {
        errorNode.textContent = '';
        errorNode.hidden = true;
      }
    }

    function setBusy(value) {
      busy = value;
      const form = findForm();
      if (form) {
        form.querySelectorAll('button').forEach(button => { button.disabled = value; });
      }
      if (verifyButton) verifyButton.disabled = value;
      if (resendButton) resendButton.disabled = value;
      if (backButton) backButton.disabled = value;
      if (rememberDeviceCheckbox) rememberDeviceCheckbox.disabled = value;
    }

    function acceptSession(payload) {
      if (!payload?.token || !isAdminUser(payload.user)) {
        showError(payload?.user ? 'This account is not an admin.' : 'The sign-in response was incomplete. Try again.');
        return false;
      }
      persistSession(storage, payload.token, payload.user);
      windowRef.location.href = '/admin/';
      return true;
    }

    async function beginSignIn(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (busy) return;
      // This submit handler is delegated from document, so currentTarget is
      // document rather than the form that initiated the event.
      const form = event.target;
      const email = form.querySelector('#email').value.trim();
      const password = form.querySelector('#password').value;
      if (!email || !password) {
        ensureOtpControls(form);
        showError('Enter your admin email and password.');
        return;
      }
      ensureOtpControls(form);
      showError('');
      setBusy(true);
      try {
        const payload = await request(windowRef, endpointsForWindow.verify, loginRequest(email, password));
        if (payload?.token) {
          acceptSession(payload);
        } else if (requiresOtp(payload)) {
          pendingEmail = email.trim().toLowerCase();
          mode = 'otp';
          container.hidden = false;
          codeInput.value = '';
          codeInput.focus();
        } else {
          showError(payload?.error || 'Could not start admin sign-in. Try again.');
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Connection error. Try again.');
      } finally {
        setBusy(false);
      }
    }

    async function verifyCode() {
      if (busy || mode !== 'otp') return;
      const otp = codeInput.value.trim();
      if (!/^\d{6}$/.test(otp)) {
        showError('Enter the six-digit verification code.');
        codeInput.focus();
        return;
      }
      showError('');
      setBusy(true);
      try {
        const payload = await request(windowRef, endpointsForWindow.otp, otpRequest(pendingEmail, otp, rememberDeviceCheckbox.checked));
        if (!acceptSession(payload)) return;
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not verify this code. Try again.');
      } finally {
        setBusy(false);
      }
    }

    async function resendCode() {
      if (busy || mode !== 'otp') return;
      const form = findForm();
      const email = form?.querySelector('#email')?.value.trim() || pendingEmail;
      const password = form?.querySelector('#password')?.value || '';
      showError('');
      setBusy(true);
      try {
        const payload = await request(windowRef, endpointsForWindow.verify, loginRequest(email, password));
        if (payload?.token) {
          acceptSession(payload);
        } else if (requiresOtp(payload)) {
          pendingEmail = email.trim().toLowerCase();
          codeInput.value = '';
          container.querySelector('[data-instructions]').textContent =
            'A new sign-in code was requested. Enter the latest code sent to your admin email.';
        } else {
          showError(payload?.error || 'Could not send a new code. Try again.');
        }
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Could not send a new code. Try again.');
      } finally {
        setBusy(false);
      }
    }

    function returnToCredentials() {
      if (busy) return;
      mode = 'credentials';
      pendingEmail = '';
      container.hidden = true;
      showError('');
      findForm()?.querySelector('#password')?.focus();
    }

    documentRef.addEventListener('submit', event => {
      const form = event.target;
      if (!form?.matches?.('#root form') || !form.querySelector('#email') || !form.querySelector('#password')) return;
      beginSignIn(event);
    }, true);
  }

  function mountSessionRecovery(windowRef) {
    const storage = windowRef.localStorage;
    const token = storage.getItem(TOKEN_KEY);
    let savedUser = null;
    try { savedUser = JSON.parse(storage.getItem(USER_KEY) || 'null'); } catch {}
    if (token && isAdminUser(savedUser)) {
      // The compiled dashboard checks role synchronously during mount. Project
      // permission-based Admin accounts before its guard runs, not after /me.
      persistSession(storage, token, savedUser);
      try { savedUser = JSON.parse(storage.getItem(USER_KEY) || 'null'); } catch {}
    }
    if (!token || !isAdminUser(savedUser)) {
      clearSession(storage);
      windowRef.location.replace('/admin/login');
      return;
    }

    const endpoint = endpoints(windowRef).me;
    const apiPath = new URL(apiBase(windowRef), windowRef.location.href).pathname.replace(/\/+$/, '');
    let recoveryPromise;
    let invalidSession = false;
    const originalFetch = windowRef.fetch.bind(windowRef);
    recoveryPromise = originalFetch(endpoint, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }).then(async response => {
      const user = extractUser(await readJson(response));
      if (!response.ok || !isAdminUser(user)) {
        invalidSession = true;
        clearSession(storage);
        windowRef.location.replace('/admin/login');
        return false;
      }
      persistSession(storage, token, user);
      return true;
    }).catch(() => {
      invalidSession = true;
      clearSession(storage);
      windowRef.location.replace('/admin/login');
      return false;
    });

    windowRef.fetch = function (input, init) {
      let pathname = '';
      try {
        const url = typeof input === 'string' ? input : input?.url;
        pathname = new URL(url, windowRef.location.href).pathname;
      } catch {}
      const apiSuffix = pathname.startsWith(apiPath) ? pathname.slice(apiPath.length) : '';
      if (!PROTECTED_API_SUFFIX.test(apiSuffix) || pathname === new URL(endpoint, windowRef.location.href).pathname) {
        return originalFetch(input, init);
      }
      return recoveryPromise.then(valid => {
        if (valid && !invalidSession) return originalFetch(input, init);
        return new Response(JSON.stringify({ error: 'Invalid or expired session.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      });
    };
  }

  return {
    apiBase,
    clearSession,
    endpoints,
    extractUser,
    isAdminUser,
    loginRequest,
    mount,
    otpRequest,
    persistSession,
    requiresOtp,
  };
});
