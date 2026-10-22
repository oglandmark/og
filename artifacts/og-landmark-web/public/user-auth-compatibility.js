(function () {
  'use strict';

  function isAuthPage() {
    return window.location.pathname === '/auth' || window.location.pathname.startsWith('/auth/');
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
