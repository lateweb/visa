// template/js/quiz-math.js
/**
 * quiz-math.js
 * Deals with MathJax styles, extraction for copies, and toggling of math elements.
 * Unifies all Math output to \[ \] and \( \) exclusively.
 */
(() => {
    const ORIG_BY_SOURCE = new WeakMap();

    function injectCSS() {
        const styleId = 'tex-inline-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .tex-raw-inline { display:inline; white-space:pre-wrap; word-break:break-word; cursor:text; font-family: 'Fira Code', monospace; color: #d63384; font-size: 1.05em; }
                .tex-raw-block { display:block; white-space:pre-wrap; word-break:break-word; cursor:text; margin:0.5em 0; background: var(--quiz-surface); padding: 0.5em; border-radius: 4px; font-family: 'Fira Code', monospace; color: #d63384; font-size: 1.05em; }
                .question-number { cursor: pointer; user-select: none; font-weight: bold; color: inherit; font-size: 1.2em; display: inline-block; margin-right: 8px; }
                .question-number:hover { text-decoration: underline; }
                mjx-assistive-mml { display: none !important; }
                .math-scroll { overflow-x: auto; overflow-y: hidden; max-width: 100%; margin: 0.5em 0; white-space: nowrap !important; cursor: default; -webkit-overflow-scrolling: touch; }
                .content-text + .math-scroll { margin-top: -0.5em; }
                .math-scroll mjx-container { max-width: none !important; white-space: nowrap !important; display: inline-block !important; min-width: 100%; }
                mjx-linebreak { display: inline-block !important; width: 100% !important; height: 0 !important; visibility: visible !important; }
                label mjx-container, .options label mjx-container, label .tex-raw-inline { pointer-events: none !important; }
            `;
            document.head.appendChild(style);
        }
    }

    function texFromMathObj(math) {
        if (!math) return null;
        if (math.math) return math.math;
        try {
            const root = math.typesetRoot;
            if (root) {
                const ann = root.querySelector('annotation') || root.querySelector('script[type="math/tex"]');
                if (ann) return ann.textContent || ann.innerText || null;
                if (root.getAttribute('data-tex')) return root.getAttribute('data-tex');
            }
        } catch (e) {}
        return null;
    }

    function createRawNode(tex, isDisplay) {
        const node = isDisplay ? document.createElement('div') : document.createElement('span');
        node.className = isDisplay ? 'tex-raw-block' : 'tex-raw-inline';
        // Always enforce brackets over dollar delimiters for standardized presentation
        node.textContent = isDisplay ? `\\[${tex}\\]` : `\\(${tex}\\)`;
        return node;
    }

    function annotateAllMathWithTex() {
        try {
            if (!window.MathJax?.startup?.document) return;
            const doc = window.MathJax.startup.document;
            for (const math of doc.math) {
                const root = math.typesetRoot;
                if (!root) continue;
                const container = root.tagName.toLowerCase() === 'mjx-container' ? root : (root.closest('mjx-container') || root);
                if (!container.hasAttribute('data-tex')) {
                    const tex = texFromMathObj(math);
                    if (tex) {
                        container.setAttribute('data-tex', tex);
                        container.setAttribute('data-display', math.display ? 'true' : 'false');
                    }
                }
                container.style.pointerEvents = 'auto'; 
                container.style.cursor = 'default';
            }
        } catch (e) {}
    }

    function toggleAllMathInQuestion(qBlock) {
        if (!qBlock) return;
        const rendered = Array.from(qBlock.querySelectorAll('[data-tex]'));
        if (rendered.length > 0) {
            for (const rn of rendered) {
                const tex = rn.getAttribute('data-tex');
                if (!tex) continue;
                const isDisplay = rn.getAttribute('data-display') === 'true' || rn.getAttribute('display') === 'true' || rn.classList.contains('math-scroll') || (rn.parentElement && rn.parentElement.classList.contains('math-scroll')) || window.getComputedStyle(rn).display === 'block';
                const rawNode = createRawNode(tex, isDisplay);
                ORIG_BY_SOURCE.set(rawNode, rn);
                rn.replaceWith(rawNode);
            }
            return;
        }
        const raw = Array.from(qBlock.querySelectorAll('.tex-raw-inline, .tex-raw-block'));
        if (raw.length > 0) {
            for (const r of raw) {
                const orig = ORIG_BY_SOURCE.get(r);
                if (orig) {
                    r.replaceWith(orig);
                } else {
                    const isBlock = r.classList.contains('tex-raw-block');
                    const wrapper = document.createElement(isBlock ? 'div' : 'span');
                    wrapper.className = isBlock ? 'math-scroll' : 'math-inline';
                    // Re-use textContent which has the standardized brackets applied
                    wrapper.textContent = r.textContent;
                    r.replaceWith(wrapper);
                    if (window.MathJax?.typesetPromise) MathJax.typesetPromise([wrapper]);
                }
            }
        }
    }

    function setupMathCopyHandler() {
        document.addEventListener('copy', (e) => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            const fragment = selection.getRangeAt(0).cloneContents();
            const mathContainers = fragment.querySelectorAll ? fragment.querySelectorAll('[data-tex]') : [];
            fragment.querySelectorAll('style, script, link[rel="stylesheet"]').forEach(el => el.remove());
            if (mathContainers.length > 0) {
                mathContainers.forEach(container => {
                    const tex = container.getAttribute('data-tex');
                    if (tex) {
                        const isDisplay = container.getAttribute('data-display') === 'true' || container.getAttribute('display') === 'true' || container.classList.contains('math-scroll') || (container.parentElement && container.parentElement.classList.contains('math-scroll'));
                        const formattedTex = isDisplay ? `\\[${tex}\\]` : `\\(${tex}\\)`;
                        container.parentNode.replaceChild(document.createTextNode(formattedTex), container);
                    }
                });
            }
            const plainText = fragment.textContent || '';
            if (plainText.trim()) {
                e.clipboardData.setData('text/plain', plainText);
                e.preventDefault();
            }
        });
    }

    function preventMathInteraction() {
        window.addEventListener('click', (ev) => {
            const target = ev.target;
            if (!target) return;
            const isMath = target.closest('mjx-container') || target.closest('.tex-raw-inline') || target.closest('.tex-raw-block') || target.tagName.toLowerCase() === 'mjx-math';
            if (isMath && !target.closest('label, button, a, input, select, textarea')) {
                ev.stopPropagation();
                ev.stopImmediatePropagation();
                ev.preventDefault();
                return false;
            }
        }, { capture: true }); 
    }

    function installQuestionNumberClickHandler() {
        window.addEventListener('click', (ev) => {
            try {
                const path = ev.composedPath ? ev.composedPath() : [];
                if (path.some(el => el && el.closest && el.closest('button, input, label, summary, a, textarea, select, .check-button'))) return;
                const qNumberClicked = path.find(el => el?.classList?.contains('question-number'));
                if (qNumberClicked) {
                    const qBlock = qNumberClicked.closest('.question-block');
                    if (qBlock && (qBlock.querySelector('[data-tex]') || qBlock.querySelector('.tex-raw-inline, .tex-raw-block'))) {
                        toggleAllMathInQuestion(qBlock);
                        ev.stopPropagation();
                    }
                }
            } catch (e) {}
        }, { capture: true, passive: true });
    }

    document.addEventListener('DOMContentLoaded', () => {
        injectCSS();
        preventMathInteraction();
        installQuestionNumberClickHandler();
        setupMathCopyHandler();
        
        const onMathJaxReady = () => annotateAllMathWithTex();
        
        if (window.MathJax?.startup?.promise) {
            window.MathJax.startup.promise.then(onMathJaxReady);
        } else {
            window.addEventListener('load', () => {
                if (window.MathJax?.startup?.promise) window.MathJax.startup.promise.then(onMathJaxReady);
                else setTimeout(onMathJaxReady, 1000);
            });
        }
        
        const obs = new MutationObserver((muts) => {
            if (muts.some(m => m.addedNodes && m.addedNodes.length)) setTimeout(annotateAllMathWithTex, 500);
        });
        obs.observe(document.documentElement, { childList: true, subtree: true });
    });
})();
