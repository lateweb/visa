// template/js/quiz-utils.js
/**
 * quiz-utils.js
 * Contains UI theme switching, code copying, quote formatting and flagging logic for the quiz interface.
 */
(() => {
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
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (e) {}
    }

    updateIcons();
  }

  function initTheme() {
    applyTheme(getInitialTheme(), false);

    const toggle = document.getElementById('theme-toggle');

    if (toggle) {
      toggle.addEventListener('click', () => {
        const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        applyTheme(next, true);
      });
    }
  }

  function setupCodeCopy() {
    document.querySelectorAll('.copy-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const codeEl = btn.closest('.code-box').querySelector('code');

        if (codeEl) {
          try {
            await navigator.clipboard.writeText(codeEl.textContent);

            const origHTML = btn.innerHTML;
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

            setTimeout(() => {
              btn.innerHTML = origHTML;
            }, 2000);
          } catch (err) {
            console.error('Failed to copy', err);
          }
        }
      });
    });
  }

  function autoFormatQuotes() {
    document.querySelectorAll('.material-box blockquote').forEach(quote => {
      const box = quote.closest('.material-box');
      if (box) box.classList.add('clean');
    });
  }

  function wireFlagging() {
    document.querySelectorAll('.flag-question-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const qBlock = btn.closest('.question-block');
        if (!qBlock) return;

        qBlock.classList.toggle('flagged');

        const link = document.querySelector(`.quiz-nav-item a[href="#${qBlock.id}"]`);
        if (link) link.classList.toggle('flagged');

        e.stopPropagation();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupCodeCopy();
    autoFormatQuotes();
    wireFlagging();

    // Safety call for highlight.js if loaded but not fired
    if (typeof hljs !== 'undefined') {
      try {
        hljs.highlightAll();
      } catch (err) {
        console.warn("Syntax highlighting failed", err);
      }
    }
  });
})();
