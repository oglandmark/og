(function () {
  'use strict';

  const root = document.getElementById('root');
  if (!root) return;

  function markDashboard() {
    const headings = Array.from(root.querySelectorAll('h3'), heading => heading.textContent.trim());
    const isDashboard = headings.includes('Recent Users') && headings.includes('Recent Properties');
    root.classList.toggle('og-admin-dashboard', isDashboard);
  }

  const observer = new MutationObserver(markDashboard);
  observer.observe(root, { childList: true, subtree: true });
  markDashboard();
})();
