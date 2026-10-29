(function () {
  'use strict';

  if (window.location.pathname.replace(/\/+$/, '') !== '/admin/users') return;

  var snapshot = null;
  var checking = false;
  var apiFetch = window.fetch.bind(window);

  function userListPath(input) {
    var raw = typeof input === 'string' ? input : input && input.url;
    if (!raw) return false;

    try {
      var pathname = new URL(raw, window.location.origin).pathname;
      return pathname === '/api/users' || pathname === '/api/admin/users'
        || pathname === '/api-legacy/api/admin/users';
    } catch (error) {
      return false;
    }
  }

  function userIds(users) {
    if (!Array.isArray(users)) return null;
    return users
      .map(function (user) { return String(user && user.id != null ? user.id : ''); })
      .filter(Boolean)
      .sort()
      .join('|');
  }

  window.fetch = function (input, init) {
    var isUserList = userListPath(input);
    return apiFetch(input, init).then(function (response) {
      if (isUserList && response.ok) {
        response.clone().json().then(function (users) {
          var next = userIds(users);
          if (next !== null) snapshot = next;
        }).catch(function () {});
      }
      return response;
    });
  };

  async function checkForNewUsers() {
    if (checking || document.visibilityState !== 'visible') return;

    var token;
    try {
      token = window.localStorage.getItem('og_token');
    } catch (error) {
      return;
    }
    if (!token) return;

    checking = true;
    try {
      var response = await apiFetch('/api/users', {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + token,
        },
        cache: 'no-store',
      });
      if (!response.ok) return;

      var next = userIds(await response.json());
      if (next === null) return;
      if (snapshot === null) {
        snapshot = next;
      } else if (next !== snapshot) {
        window.location.reload();
      }
    } catch (error) {
      // A transient preview/API failure should not interrupt Admin use.
    } finally {
      checking = false;
    }
  }

  window.addEventListener('focus', checkForNewUsers);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkForNewUsers();
  });
  window.setInterval(checkForNewUsers, 15000);
})();
