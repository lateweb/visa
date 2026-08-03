// template/js/quiz-utils.js
/**
 * quiz-utils.js
 * Contains UI theme switching, code copying, quote formatting and flagging logic for the quiz interface.
 */
(() => {
    function initTheme() {
        const toggle = document.getElementById('theme-toggle');
        const moon = document.getElementById('moon-icon');
        const sun = document.getElementById('sun-icon');
        if (toggle) {
            toggle.addEventListener('click', () => {
                const isDark = document.body.classList.contains('dark');
                const next = isDark ? 'light' : 'dark';
                document.body.classList.toggle('dark', next === 'dark');
                try { localStorage.setItem('visa-theme', next); } catch(e) {}
                if (moon && sun) {
                    moon.style.display = next === 'dark' ? 'none' : 'inline';
                    sun.style.display = next === 'dark' ? 'inline' : 'none';
                }
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
                        setTimeout(() => { btn.innerHTML = origHTML; }, 2000);
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
            try { hljs.highlightAll(); } catch (err) { console.warn("Syntax highlighting failed", err); }
        }
    });
})();
