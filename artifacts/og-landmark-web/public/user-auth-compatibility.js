(function () {
  'use strict';

  function isAuthPage() {
    return window.location.pathname === '/auth' || window.location.pathname.startsWith('/auth/');
  }

  function attachRegistrationEmailVerification(root) {
    root.querySelectorAll('form').forEach(function (form) {
      var fields = form.querySelectorAll('input');
      if (
        fields.length < 5
        || !form.querySelector('input[type="email"]')
        || !form.querySelector('input[type="tel"]')
        || !form.querySelector('input[type="password"]')
        || form.dataset.ogEmailOtpAttached
      ) return;
      form.dataset.ogEmailOtpAttached = 'true';

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var allInputs = Array.from(form.querySelectorAll('input'));
        var names = allInputs.filter(function (input) { return input.type === 'text' || !input.type; });
        var firstName = (names[0] && names[0].value || '').trim();
        var lastName = (names[1] && names[1].value || '').trim();
        var email = (form.querySelector('input[type="email"]')?.value || '').trim().toLowerCase();
        var phone = (form.querySelector('input[type="tel"]')?.value || '').trim();
        var password = form.querySelector('input[type="password"]')?.value || '';
        var consent = form.querySelector('input[type="checkbox"]');
        var submit = form.querySelector('button[type="submit"]');
        var originalButtonText = submit?.textContent || 'Create Account';
        var error = form.querySelector('[data-og-email-otp-error]');
        if (!error) {
          error = document.createElement('p');
          error.dataset.ogEmailOtpError = 'true';
          error.className = 'text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md';
          error.hidden = true;
          form.insertBefore(error, form.firstChild);
        }
        function showError(message) {
          error.textContent = message;
          error.hidden = false;
        }
        if (!firstName || !email || !phone || !password) return showError('Complete all required fields.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Enter a valid email address.');
        if (password.length < 8) return showError('Password must be at least 8 characters.');
        if (consent && !consent.checked) return showError('Please accept the Terms of Service and Privacy Policy.');

        if (submit) { submit.disabled = true; submit.textContent = 'Sending code…'; }
        error.hidden = true;
        try {
          var response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName: firstName, lastName: lastName, email: email, phone: phone, password: password, confirmPassword: password, role: 'Buyer' })
          });
          var result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Unable to start registration.');
          if (!result.verificationRequired) {
            if (result.user && result.token) {
              localStorage.setItem('og_user', JSON.stringify(result.user));
              localStorage.setItem('og_token', result.token);
              window.location.href = '/user/';
              return;
            }
            throw new Error('The server did not return an email verification challenge.');
          }
          showEmailOtpPanel(form, result.email || email);
        } catch (error) {
          showError(error instanceof Error ? error.message : 'Unable to start registration.');
        } finally {
          if (submit) { submit.disabled = false; submit.textContent = originalButtonText; }
        }
      }, true);
    });
  }

  function showEmailOtpPanel(form, email) {
    form.hidden = true;
    var panel = document.createElement('div');
    panel.className = 'space-y-4';
    var title = document.createElement('h3');
    title.className = 'text-xl font-bold text-foreground';
    title.textContent = 'Verify your email';
    var description = document.createElement('p');
    description.className = 'text-sm text-muted-foreground';
    description.textContent = 'Enter the six-digit code sent to ' + email + '. It expires in 10 minutes.';
    var input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.maxLength = 6;
    input.autocomplete = 'one-time-code';
    input.placeholder = '000000';
    input.className = 'w-full h-12 text-center text-xl tracking-[0.5em] rounded-md border border-input bg-background px-3 py-2';
    var feedback = document.createElement('p');
    feedback.className = 'text-sm text-muted-foreground';
    feedback.hidden = true;
    var verify = document.createElement('button');
    verify.type = 'button';
    verify.className = 'w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11 rounded-md';
    verify.textContent = 'Verify Email';
    var resend = document.createElement('button');
    resend.type = 'button';
    resend.className = 'w-full border border-input bg-background hover:bg-accent h-10 rounded-md';
    resend.textContent = 'Resend Code';
    var back = document.createElement('button');
    back.type = 'button';
    back.className = 'w-full text-sm text-muted-foreground hover:text-foreground';
    back.textContent = 'Back to registration';
    panel.append(title, description, input, feedback, verify, resend, back);
    form.insertAdjacentElement('afterend', panel);

    function message(text, isError) {
      feedback.textContent = text;
      feedback.className = isError ? 'text-sm text-destructive' : 'text-sm text-muted-foreground';
      feedback.hidden = false;
    }
    verify.addEventListener('click', async function () {
      var otp = input.value.replace(/\D/g, '').slice(0, 6);
      input.value = otp;
      if (!/^\d{6}$/.test(otp)) return message('Enter the six-digit code.', true);
      verify.disabled = true;
      verify.textContent = 'Verifying…';
      try {
        var response = await fetch('/api/auth/verify-email', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, otp: otp })
        });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Email verification failed.');
        localStorage.setItem('og_user', JSON.stringify(result.user));
        localStorage.setItem('og_token', result.token);
        window.location.href = '/user/';
      } catch (error) {
        message(error instanceof Error ? error.message : 'Email verification failed.', true);
      } finally {
        verify.disabled = false;
        verify.textContent = 'Verify Email';
      }
    });
    resend.addEventListener('click', async function () {
      resend.disabled = true;
      try {
        var response = await fetch('/api/auth/resend-verification', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Unable to resend code.');
        message('A new code has been sent.', false);
      } catch (error) {
        message(error instanceof Error ? error.message : 'Unable to resend code.', true);
      } finally {
        resend.disabled = false;
      }
    });
    back.addEventListener('click', function () {
      panel.remove();
      form.hidden = false;
    });
    input.focus();
  }

  function normalizeAuthPage() {
    if (!isAuthPage()) return;

    var root = document.getElementById('root');
    if (!root) return;

    if (new URLSearchParams(window.location.search).get('mode') === 'login' && !root.dataset.ogLoginModeSelected) {
      var loginTab = Array.from(root.querySelectorAll('button,[role="tab"],[role="button"]')).find(function (button) {
        return /^(sign in|log in)$/i.test((button.textContent || '').trim());
      });
      if (loginTab && !root.dataset.ogLoginModePending) {
        root.dataset.ogLoginModePending = 'true';
        window.setTimeout(function () {
          if (!root.isConnected || root.dataset.ogLoginModeSelected) return;
          loginTab.click();
          root.dataset.ogLoginModeSelected = 'true';
          delete root.dataset.ogLoginModePending;
        }, 80);
      }
    }

    root.querySelectorAll('h3').forEach(function (heading) {
      var text = (heading.textContent || '').trim();
      if (text === 'Join as a Buyer' || text === 'Start Selling Today') {
        heading.textContent = 'Create your account';
      }
    });

    root.querySelectorAll('h1').forEach(function (heading) {
      var text = (heading.textContent || '').trim();
      if (text === 'Find Your Dream Property' || text === 'List & Sell Your Property') {
        heading.textContent = 'Browse or list properties';
      }
    });

    root.querySelectorAll('p').forEach(function (description) {
      var text = (description.textContent || '').trim();
      if (
        text === 'Create your free account to save properties & book visits'
        || text === 'List your property and connect with thousands of buyers'
        || text === 'Browse thousands of verified properties across Pakistan.'
        || text === "Reach lakhs of buyers with Pakistan's most trusted platform."
      ) {
        description.textContent = 'Browse, save, enquire and list properties with one account.';
      }
    });

    root.querySelectorAll('span, p, div').forEach(function (element) {
      var text = (element.textContent || '').trim();
      if (text === 'FOR BUYERS & TENANTS' || text === 'FOR PROPERTY SELLERS') {
        element.textContent = 'FOR ALL PROPERTY USERS';
      }
    });

    root.querySelectorAll('label').forEach(function (label) {
      if ((label.textContent || '').trim() !== 'I am a') return;
      var field = label.parentElement;
      if (field) {
        field.style.display = 'none';
        field.setAttribute('aria-hidden', 'true');
      }
    });

    root.querySelectorAll('button').forEach(function (button) {
      var text = (button.textContent || '').trim();
      if (text === 'Create Buyer Account' || text === 'Create Seller Account') {
        button.textContent = 'Create Account';
      }
    });

    attachRegistrationEmailVerification(root);
  }

  function start() {
    normalizeAuthPage();
    var root = document.getElementById('root');
    if (!root) return;

    var observer = new MutationObserver(normalizeAuthPage);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    window.addEventListener('popstate', normalizeAuthPage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
