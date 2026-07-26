// js/theme.js
(function() {
    'use strict';
    const toggle = document.getElementById('theme-toggle');
    const moon = document.getElementById('moon-icon');
    const sun = document.getElementById('sun-icon');
    const apply = (theme) => {
        document.body.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('visa-theme', theme);
        if (moon && sun) {
            moon.style.display = theme === 'dark' ? 'none' : 'inline';
            sun.style.display = theme === 'dark' ? 'inline' : 'none';
        }
    };
    const saved = localStorage.getItem('visa-theme') || 'light';
    apply(saved);
    if (toggle) {
        toggle.addEventListener('click', () => {
            const next = document.body.classList.contains('dark') ? 'light' : 'dark';
            apply(next);
        });
    }
})();
