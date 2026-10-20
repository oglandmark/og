/* Keep admin login enhancements separate from the compiled admin bundle. */
(function () {
  'use strict';

  if (!/^\/admin\/login\/?$/.test(window.location.pathname)) return;

  const styles = `
    .og-admin-forgot-row{display:flex;justify-content:flex-end;margin-top:-.35rem}
    .og-admin-forgot-link{border:0;background:none;padding:0;color:#99783c;font-family:inherit;font-size:12px;font-weight:600;line-height:1.4;cursor:pointer}
    .og-admin-forgot-link:hover{text-decoration:underline}
    .og-reset-backdrop{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(7,20,40,.68);backdrop-filter:blur(5px)}
    .og-reset-backdrop[hidden]{display:none}
    .og-reset-card{width:min(440px,100%);background:#fff;border:1px solid #e7e9ed;border-radius:22px;padding:28px;box-shadow:0 28px 90px rgba(0,0,0,.28);font-family:DM Sans,system-ui,sans-serif}
    .og-reset-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
    .og-reset-kicker{display:inline-flex;align-items:center;gap:8px;color:#99783c;font-size:10px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}
    .og-reset-kicker:before{content:"";width:7px;height:7px;border-radius:50%;background:#c8a45a}
    .og-reset-title{margin:12px 0 7px;color:#0b1f3a;font-size:25px;line-height:1.15;font-weight:750}
    .og-reset-copy{margin:0 0 22px;color:#64748b;font-size:13px;line-height:1.55}
    .og-reset-close{border:0;background:#f1f5f9;color:#334155;width:34px;height:34px;border-radius:50%;font-size:19px;cursor:pointer}
    .og-reset-field{display:grid;gap:7px;margin:0 0 15px}
    .og-reset-field label{color:#334155;font-size:12px;font-weight:700}
    .og-reset-field input{box-sizing:border-box;width:100%;height:44px;border:1px solid #dbe1e8;border-radius:11px;padding:0 13px;color:#0b1f3a;font:500 14px DM Sans,system-ui,sans-serif;outline:none}
    .og-reset-field input:focus{border-color:#c8a45a;box-shadow:0 0 0 3px rgba(200,164,90,.17)}
    .og-reset-message{margin:0 0 14px;padding:10px 12px;border-radius:10px;font-size:12px;line-height:1.45}
    .og-reset-message[data-kind="error"]{background:#fff1f2;color:#be123c}
    .og-reset-message[data-kind="success"]{background:#f0fdf4;color:#166534}
    .og-reset-submit{width:100%;height:45px;border:0;border-radius:11px;background:#c8a45a;color:#0b1f3a;font:750 13px DM Sans,system-ui,sans-serif;cursor:pointer}
    .og-reset-submit:hover{background:#b8943a}
    .og-reset-submit:disabled{opacity:.65;cursor:wait}
    .og-reset-resend{display:block;margin:14px auto 0;border:0;background:none;color:#99783c;font:700 12px DM Sans,system-ui,sans-serif;cursor:pointer}
    .og-reset-footer{margin:17px 0 0;color:#94a3b8;text-align:center;font-size:11px}
    @media(max-width:480px){.og-reset-card{padding:23px 20px;border-radius:18px}.og-reset-title{font-size:23px}}
  `;

  function addStyle() {
    if (document.getElementById('og-admin-recovery-style')) return;
    const style = document.createElement('style');
    style.id = 'og-admin-recovery-style';
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function replaceLogo() {
    const logo = document.querySelector('img[src="/og-logo.png"]');
    if (!logo || logo.dataset.ogCurrentLogo) return;
    logo.src = '/og-landmark-logo-white.png?v=20261020';
    logo.alt = 'OG Landmark';
    logo.dataset.ogCurrentLogo = 'true';
  }

  function createModal() {
    const backdrop = document.createElement('div');
    backdrop.className = 'og-reset-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="og-reset-card" role="dialog" aria-modal="true" aria-labelledby="og-reset-title">
        <div class="og-reset-head">
          <div>
            <span class="og-reset-kicker">Admin account recovery</span>
            <h2 class="og-reset-title" id="og-reset-title">Reset your password</h2>
          </div>
          <button class="og-reset-close" type="button" aria-label="Close">×</button>
        </div>
        <p class="og-reset-copy" data-copy></p>
        <div data-content></div>
        <p class="og-reset-footer">Reset codes expire after 15 minutes.</p>
      </section>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop || event.target.closest('.og-reset-close')) closeModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !backdrop.hidden) closeModal();
    });
    return backdrop;
  }

  let modal;
  let email = '';
  let notice = '';
  let noticeKind = 'success';
  let busy = false;
  let step = 'email';

  function recoveryApiEndpoint(path) {
    // Respect the same environment-aware API base used by the rest of the site:
    // Replit preview uses its local Laravel proxy; the live site uses production.
    const base = String(window.__OG_API_BASE__ || '/api').replace(/\/+$/, '');
    return `${base}${path}`;
  }

  function showNotice(message, kind = 'success') {
    notice = message;
    noticeKind = kind;
    const content = modal?.querySelector('[data-content]');
    if (!content) return;
    let messageElement = content.querySelector('.og-reset-message');
    if (!messageElement) {
      messageElement = document.createElement('p');
      messageElement.className = 'og-reset-message';
      content.prepend(messageElement);
    }
    messageElement.dataset.kind = kind;
    messageElement.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    messageElement.textContent = message;
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    step = 'email';
    notice = '';
  }

  function renderModal() {
    if (!modal) return;
    const copy = modal.querySelector('[data-copy]');
    const content = modal.querySelector('[data-content]');
    if (step === 'email') {
      copy.textContent = 'Enter the administrator email. If it matches an admin account, we’ll send a six-digit verification code.';
      content.innerHTML = `
        ${notice ? `<p class="og-reset-message" data-kind="${noticeKind}" role="${noticeKind === 'error' ? 'alert' : 'status'}"></p>` : ''}
        <form data-reset-email-form>
          <div class="og-reset-field"><label for="og-reset-email">Administrator email</label><input id="og-reset-email" type="email" autocomplete="email" required></div>
          <button class="og-reset-submit" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Sending code…' : 'Send reset code'}</button>
        </form>`;
      const input = content.querySelector('#og-reset-email');
      input.value = email;
      if (notice) content.querySelector('.og-reset-message').textContent = notice;
      content.querySelector('form').addEventListener('submit', requestCode);
      return;
    }
    if (step === 'code') {
      copy.textContent = `Enter the code sent to ${email}, then choose a new password.`;
      content.innerHTML = `
        ${notice ? `<p class="og-reset-message" data-kind="${noticeKind}" role="${noticeKind === 'error' ? 'alert' : 'status'}"></p>` : ''}
        <form data-reset-password-form>
          <div class="og-reset-field"><label for="og-reset-code">Six-digit verification code</label><input id="og-reset-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></div>
          <div class="og-reset-field"><label for="og-new-password">New password</label><input id="og-new-password" type="password" autocomplete="new-password" minlength="8" maxlength="256" required></div>
          <div class="og-reset-field"><label for="og-confirm-password">Confirm new password</label><input id="og-confirm-password" type="password" autocomplete="new-password" minlength="8" maxlength="256" required></div>
          <button class="og-reset-submit" type="submit" ${busy ? 'disabled' : ''}>${busy ? 'Updating password…' : 'Reset password'}</button>
        </form>
        <button class="og-reset-resend" type="button" data-resend ${busy ? 'disabled' : ''}>Send a new code</button>`;
      if (notice) content.querySelector('.og-reset-message').textContent = notice;
      content.querySelector('form').addEventListener('submit', resetPassword);
      content.querySelector('[data-resend]').addEventListener('click', requestCode);
      return;
    }
    copy.textContent = 'Your admin password has been updated. You can now sign in with your new password.';
    content.innerHTML = `<button class="og-reset-submit" type="button" data-done>Return to admin sign in</button>`;
    content.querySelector('[data-done]').addEventListener('click', closeModal);
  }

  async function requestCode(event) {
    event?.preventDefault();
    const emailInput = modal.querySelector('#og-reset-email');
    if (emailInput?.value) email = emailInput.value.trim().toLowerCase();
    if (!email) return showNotice('Enter your administrator email to continue.', 'error');
    const isResend = step === 'code';
    const actionButton = isResend ? modal.querySelector('[data-resend]') : modal.querySelector('form .og-reset-submit');
    const previousLabel = actionButton?.textContent;
    busy = true;
    notice = '';
    if (actionButton) {
      actionButton.disabled = true;
      actionButton.textContent = 'Sending code…';
    }
    try {
      const response = await fetch(recoveryApiEndpoint('/auth/admin-forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not send the reset code. Try again.');
      if (data.smtpOff) {
        throw new Error(data.message || 'The email service could not deliver the code. Please try again later.');
      }
      step = 'code';
      notice = 'If the email matches an admin account, a code has been sent. Check your inbox and spam folder.';
      noticeKind = 'success';
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Could not send the reset code. Try again.';
      noticeKind = 'error';
    } finally {
      busy = false;
      if (step === 'code' && noticeKind === 'success') renderModal();
      else if (actionButton) {
        actionButton.disabled = false;
        actionButton.textContent = previousLabel || 'Send a new code';
        showNotice(notice, noticeKind);
      }
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    const code = modal.querySelector('#og-reset-code').value.trim();
    const password = modal.querySelector('#og-new-password').value;
    const confirmation = modal.querySelector('#og-confirm-password').value;
    if (!/^\d{6}$/.test(code)) return showNotice('Enter the six-digit code from your email.', 'error');
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return showNotice('Use at least 8 characters, including a letter and a number.', 'error');
    }
    if (password !== confirmation) return showNotice('The passwords do not match.', 'error');
    const submitButton = modal.querySelector('form .og-reset-submit');
    busy = true;
    notice = '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Updating password…';
    }
    try {
      const response = await fetch(recoveryApiEndpoint('/auth/admin-reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Password could not be reset. Request a new code and try again.');
      step = 'done';
      notice = '';
    } catch (error) {
      notice = error instanceof Error ? error.message : 'Password could not be reset. Request a new code and try again.';
      noticeKind = 'error';
    } finally {
      busy = false;
      if (step === 'done') renderModal();
      else {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Reset password';
        }
        showNotice(notice, noticeKind);
      }
    }
  }

  function openModal() {
    if (!modal) modal = createModal();
    email = document.querySelector('#email')?.value.trim().toLowerCase() || '';
    step = 'email';
    notice = '';
    renderModal();
    modal.hidden = false;
    setTimeout(() => modal.querySelector('#og-reset-email')?.focus(), 0);
  }

  function addForgotLink() {
    if (window.location.pathname !== '/admin/login') return;
    const form = document.querySelector('form');
    const password = document.querySelector('#password');
    const passwordGroup = password?.parentElement;
    if (!form || !passwordGroup || form.querySelector('.og-admin-forgot-row')) return;
    const row = document.createElement('div');
    row.className = 'og-admin-forgot-row';
    row.innerHTML = '<button class="og-admin-forgot-link" type="button">Forgot password?</button>';
    row.querySelector('button').addEventListener('click', openModal);
    passwordGroup.insertAdjacentElement('afterend', row);
  }

  function mount() {
    addStyle();
    replaceLogo();
    addForgotLink();
    new MutationObserver(() => {
      replaceLogo();
      addForgotLink();
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
