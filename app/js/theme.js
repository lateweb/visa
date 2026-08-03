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

  function applyTheme(theme, persist) {
    const isDark = theme === 'dark';

    // FIX: the flash-prevention class lives on <html>.
    // Keep <body> in sync for legacy CSS only.
    document.documentElement.classList.toggle('dark', isDark);

    if (document.body) {
      document.body.classList.toggle('dark', isDark);
    }

    // FIX: do NOT persist on first load unless the user explicitly changes it.
    // Persisting too early can force light mode and cause a flash on reload.
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
    }

    const moon = document.getElementById('moon-icon');
    const sun = document.getElementById('sun-icon');

    if (moon && sun) {
      moon.style.display = isDark ? 'none' : 'inline';
      sun.style.display = isDark ? 'inline' : 'none';
    }
  }

  applyTheme(getInitialTheme(), false);

  const toggle = document.getElementById('theme-toggle');

  if (toggle) {
    toggle.addEventListener('click', () => {
      const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_KEY) {
      applyTheme(event.newValue === 'dark' ? 'dark' : 'light', false);
    }
  });
})();
