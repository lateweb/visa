// app/js/theme.js
(function () {
  'use strict';

  const THEME_KEY = 'visa-theme';

  function systemPrefersDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function getInitialTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}

    return systemPrefersDark() ? 'dark' : 'light';
  }

  function persistTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {}
  }

  function updateIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    const moon = document.getElementById('moon-icon');
    const sun = document.getElementById('sun-icon');

    if (moon && sun) {
      moon.style.display = isDark ? 'none' : 'inline';
      sun.style.display = isDark ? 'inline' : 'none';
    }
  }

  function applyTheme(theme, persist) {
    const isDark = theme === 'dark';

    document.documentElement.classList.toggle('dark', isDark);

    if (document.body) {
      document.body.classList.toggle('dark', isDark);
    }

    if (persist) {
      persistTheme(theme);
    }

    updateIcons();
  }

  function syncBodyToDocumentElement() {
    if (document.body) {
      document.body.classList.toggle('dark', document.documentElement.classList.contains('dark'));
    }
  }

  function initToggle() {
    syncBodyToDocumentElement();
    updateIcons();

    const toggle = document.getElementById('theme-toggle');

    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        applyTheme(next, true);
      });
    }
  }

  applyTheme(getInitialTheme(), false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initToggle);
  } else {
    initToggle();
  }

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY) {
      applyTheme(event.newValue === 'dark' ? 'dark' : 'light', false);
    }
  });
})();
