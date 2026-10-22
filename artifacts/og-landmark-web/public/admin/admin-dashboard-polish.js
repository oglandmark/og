(function () {
  'use strict';

  const root = document.getElementById('root');
  if (!root) return;

  function setMobileNavigation(open, returnFocus = false) {
    root.classList.toggle('og-mobile-nav-open', open);
    const toggle = root.querySelector('.og-admin-menu-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    if (returnFocus) toggle.focus();
  }

  function installResponsiveNavigation() {
    const aside = root.querySelector('aside');
    const header = root.querySelector('header');
    if (!aside || !header) return;

    root.classList.add('og-admin-shell');
    aside.id = aside.id || 'og-admin-sidebar';
    let toggle = header.querySelector('.og-admin-menu-toggle');
    let overlay = root.querySelector('.og-admin-nav-overlay');

    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'og-admin-menu-toggle';
      toggle.setAttribute('aria-label', 'Open navigation');
      toggle.setAttribute('aria-controls', aside.id);
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      header.insertBefore(toggle, header.firstElementChild);
    }

    if (!overlay) {
      overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = 'og-admin-nav-overlay';
      overlay.setAttribute('aria-label', 'Close navigation');
      root.appendChild(overlay);
    }

    if (!root.dataset.ogResponsiveNavigationBound) {
      root.addEventListener('click', (event) => {
        if (event.target.closest('.og-admin-menu-toggle')) {
          const isOpen = !root.classList.contains('og-mobile-nav-open');
          setMobileNavigation(isOpen);
          if (isOpen) root.querySelector('aside a:not([hidden])')?.focus();
          return;
        }
        if (event.target.closest('.og-admin-nav-overlay')) {
          setMobileNavigation(false, true);
          return;
        }
        if (event.target.closest('#og-admin-sidebar a')) setMobileNavigation(false, true);
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && root.classList.contains('og-mobile-nav-open')) setMobileNavigation(false, true);
      });
      root.dataset.ogResponsiveNavigationBound = 'true';
    }
  }

  function markDashboard() {
    const headings = Array.from(root.querySelectorAll('h3'), heading => heading.textContent.trim());
    const isDashboard = headings.includes('Recent Users') && headings.includes('Recent Properties');
    root.classList.toggle('og-admin-dashboard', isDashboard);
    installResponsiveNavigation();
  }

  const observer = new MutationObserver(markDashboard);
  observer.observe(root, { childList: true, subtree: true });
  markDashboard();
})();
