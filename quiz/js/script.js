/**
 * script.js
 * Handles interactive elements, navigation, and robustly manages MathJax interaction.
 * 
 * FIX: Forces Display Math ($$) to NOT wrap, enabling horizontal scroll.
 *      Forces Inline Math ($) to wrap naturally.
 *      Automatically formats blockquotes to look like Wikipedia citations.
 */
(() => {
  // --- STATE MANAGEMENT ---
  const ORIG_BY_SOURCE = new WeakMap();
  const PAGE_LOAD_TIME = new Date();

  // --- CSS INJECTION (MathJax Layout & Overrides) ---
  // Injected via JS to ensure it takes precedence over MathJax's internal styles
  const styleId = 'tex-inline-style';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Standard Converter Styles */
      .tex-raw-inline { display:inline; white-space:pre-wrap; word-break:break-word; cursor:text; font-family: 'Fira Code', monospace; color: #d63384; }
      .tex-raw-block { display:block; white-space:pre-wrap; word-break:break-word; cursor:text; margin:0.5em 0; background: #f8f9fa; padding: 0.5em; border-radius: 4px; font-family: 'Fira Code', monospace; color: #d63384; }
      
      .question-number { cursor: pointer; user-select: none; font-weight: bold; color: #184e77; font-size: 1.2em; display: inline-block; margin-right: 8px; }
      .question-number:hover { text-decoration: underline; }
      
      /* --- MATHJAX 4 OVERRIDES --- */
      
      /* 1. CONTAINER: Default behavior (prevents breaking by default for display math) */
      mjx-container {
        display: inline-block !important; /* Changed from inline to allow scrolling */
        white-space: nowrap !important;   /* CRITICAL: Force non-breaking for display math */
        margin: 0 !important;
        padding: 0 !important;
        line-height: inherit !important;
        font-size: inherit !important; 
        width: auto !important;
        max-width: 100% !important;
        
        /* Interaction Disabling */
        cursor: default !important;
        outline: none !important;
        user-select: none; 
      }

      /* 2. INLINE SPECIFIC: Force wrapping for $...$ */
      .math-inline mjx-container {
        display: inline !important;
        white-space: normal !important;      /* Allow wrapping for inline text */
        overflow-wrap: anywhere !important;
      }

      /* 3. INNER MATH */
      .math-inline mjx-container mjx-math {
        display: inline !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
        font-size: inherit !important;
        width: auto !important;
        max-width: 100% !important;
      }
      
      /* 4. ATOMIC TERMS: Prevent breaking inside numbers or variables */
      .math-inline mjx-container mjx-mrow > mjx-mi,
      .math-inline mjx-container mjx-mrow > mjx-mn,
      .math-inline mjx-container mjx-mrow > mjx-mo:not([fence="true"]):not([separator="true"]) {
        white-space: nowrap !important;
      }

      mjx-assistive-mml { display: none !important; }

      /* Block Math Scrolling */
      .math-scroll {
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        margin: 1em 0;
        white-space: nowrap !important; /* Enforce non-breaking on the wrapper too */
        cursor: default;
        -webkit-overflow-scrolling: touch;
      }
      
      /* Ensure display math inside scroll box doesn't try to be clever */
      .math-scroll mjx-container {
         white-space: nowrap !important;
         display: inline-block !important;
         min-width: 100%;
      }

      mjx-linebreak {
        display: inline-block !important;
        width: 100% !important;
        height: 0 !important;
        visibility: visible !important;
      }

      /* CRITICAL: ANSWER OPTION FIX */
      label mjx-container,
      .options label mjx-container,
      label .tex-raw-inline {
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
  }

  // --- MATHJAX HELPERS ---

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
    } catch (e) { console.warn("Error extracting TeX:", e); }
    return null;
  }

  function createRawNode(tex, isDisplay) {
    const node = isDisplay ? document.createElement('div') : document.createElement('span');
    node.className = isDisplay ? 'tex-raw-block' : 'tex-raw-inline';
    node.textContent = tex;
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
          if (tex) container.setAttribute('data-tex', tex);
        }
        
        // Default to auto, but CSS rule for labels will override this to 'none'
        container.style.pointerEvents = 'auto'; 
        container.style.cursor = 'default';
      }
    } catch (e) { console.error("Math annotation failed:", e); }
  }

  function toggleAllMathInQuestion(qBlock) {
    if (!qBlock) return;

    const rendered = Array.from(qBlock.querySelectorAll('[data-tex]'));
    
    if (rendered.length > 0) {
      for (const rn of rendered) {
        const tex = rn.getAttribute('data-tex');
        if (!tex) continue;
        const isDisplay = rn.getAttribute('display') === 'true' || 
                          rn.classList.contains('math-scroll') || 
                          (rn.parentElement && rn.parentElement.classList.contains('math-scroll')) ||
                          window.getComputedStyle(rn).display === 'block';

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
            wrapper.textContent = (isBlock ? '$$' : '$') + r.textContent + (isBlock ? '$$' : '$');
            r.replaceWith(wrapper);
            if (window.MathJax?.typesetPromise) MathJax.typesetPromise([wrapper]);
        }
      }
    }
  }

  // --- INTERACTION HANDLERS ---

  function isInteractiveEl(el) {
    if (!el || !el.closest) return false;
    return Boolean(el.closest('button, input, label, summary, a, textarea, select, .check-button'));
  }

  /**
   * NUCLEAR OPTION: Global Click Interceptor for Math
   * Prevents MathJax elements from stealing focus or events
   * unless they are inside interactive form elements.
   */
  function preventMathInteraction() {
    window.addEventListener('click', (ev) => {
      const target = ev.target;
      if (!target) return;

      const isMath = target.closest('mjx-container') || 
                     target.closest('.tex-raw-inline') || 
                     target.closest('.tex-raw-block') ||
                     target.tagName.toLowerCase() === 'mjx-math';

      if (isMath) {
        if (target.closest('label, button, a, input, select, textarea')) {
          return; 
        }
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
        if (path.some(isInteractiveEl)) return;

        const qNumberClicked = path.find(el => el?.classList?.contains('question-number'));
        
        if (qNumberClicked) {
          const qBlock = qNumberClicked.closest('.question-block');
          if (qBlock) {
             const hasRendered = qBlock.querySelector('[data-tex]') !== null;
             const hasRaw = qBlock.querySelector('.tex-raw-inline, .tex-raw-block') !== null;
             if (hasRendered || hasRaw) {
               toggleAllMathInQuestion(qBlock);
               ev.stopPropagation();
             }
          }
        }
      } catch (e) { console.error(e); }
    }, { capture: true, passive: true });
  }
  
  function processBackticks() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodesToProcess = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.includes('`')) {
        nodesToProcess.push(walker.currentNode);
      }
    }
    nodesToProcess.forEach(node => {
      if (node.parentElement.closest('pre, code, script, style')) return;
      
      const parts = node.nodeValue.split(/(`[^`]+`)/g);
      if (parts.length <= 1) return;
      
      const fragment = document.createDocumentFragment();
      parts.forEach(part => {
        if (part.startsWith('`') && part.endsWith('`')) {
          const span = document.createElement('span');
          span.textContent = part.slice(1, -1);
          span.className = 'backtick';
          fragment.appendChild(span);
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode.replaceChild(fragment, node);
    });
  }

  /**
   * AUTO-FORMAT QUOTES
   * Detects blockquotes inside material-boxes and modifies the container
   * to remove background/borders, mimicking Wikipedia citation style.
   */
  function autoFormatQuotes() {
    const quotes = document.querySelectorAll('.material-box blockquote');
    quotes.forEach(quote => {
      const box = quote.closest('.material-box');
      if (box) {
        // Adds the .clean class defined in CSS to remove the boxy look
        box.classList.add('clean');
      }
    });
  }

  // --- SIDEBAR & TIMER ---

  function buildTimer(sidebar) {
    const lang = typeof quizLang !== 'undefined' ? quizLang : 'en';
    const textLabels = {
        en: { time: "Time", started: "Started at" },
        fi: { time: "Aika", started: "Aloitettu klo" }
    };
    const labels = textLabels[lang] || textLabels.en;

    const timerContainer = document.createElement('div');
    timerContainer.className = 'quiz-timer-container';
    
    const timerValue = document.createElement('div');
    timerValue.className = 'quiz-timer-value';
    timerValue.textContent = "00:00:00";
    
    const timerLabel = document.createElement('div');
    timerLabel.className = 'quiz-timer-label';
    timerLabel.textContent = labels.time;

    const startLabel = document.createElement('div');
    startLabel.className = 'quiz-timer-start-time';
    const hours = PAGE_LOAD_TIME.getHours().toString().padStart(2, '0');
    const mins = PAGE_LOAD_TIME.getMinutes().toString().padStart(2, '0');
    startLabel.textContent = `${labels.started} ${hours}:${mins}`;

    timerContainer.appendChild(timerValue);
    timerContainer.appendChild(timerLabel);
    timerContainer.appendChild(startLabel);

    const h3 = sidebar.querySelector('h3');
    if (h3) {
        h3.insertAdjacentElement('afterend', timerContainer);
    } else {
        sidebar.prepend(timerContainer);
    }

    const startTime = PAGE_LOAD_TIME.getTime();
    setInterval(() => {
        const now = Date.now();
        const diff = Math.floor((now - startTime) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        timerValue.textContent = `${h}:${m}:${s}`;
    }, 1000);
  }

  function buildSidebar() {
    const sidebar = document.createElement('nav');
    sidebar.className = 'quiz-nav-sidebar';
    sidebar.innerHTML = '<h3>Questions</h3><ul class="quiz-nav-list"></ul>';
    const list = sidebar.querySelector('ul');
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'nav-toggle-btn';
    toggleBtn.innerHTML = '☰';
    toggleBtn.setAttribute('aria-label', 'Toggle Navigation');
    
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';

    buildTimer(sidebar);

    const questions = document.querySelectorAll('.question-block');
    questions.forEach((q, index) => {
      if (!q.id) q.id = `question-${index + 1}`;
      
      const numEl = q.querySelector('.question-number');
      const numberStr = numEl ? numEl.innerText.trim() : `${index + 1}`;

      const li = document.createElement('li');
      li.className = 'quiz-nav-item';
      li.innerHTML = `<a href="#${q.id}">${numberStr}</a>`;
      list.appendChild(li);
    });

    document.body.appendChild(overlay);
    document.body.appendChild(sidebar);
    document.body.appendChild(toggleBtn);

    const toggleSidebar = () => {
      if (window.innerWidth >= 1100) {
        document.body.classList.toggle('nav-hidden');
      } else {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
      }
    };

    toggleBtn.addEventListener('click', toggleSidebar);
    overlay.addEventListener('click', toggleSidebar);

    list.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth < 1100) {
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        }
      });
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          list.querySelectorAll('a').forEach(a => a.classList.remove('active'));
          const activeLink = list.querySelector(`a[href="#${id}"]`);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });
    
    questions.forEach(q => observer.observe(q));
  }

  // --- QUIZ LOGIC ---

  function wireQuiz() {
    const translations = {
      selectAnswer: { en: "⚠ Please select an answer", fi: "⚠ Valitse vastaus" },
      correct: { en: "✓ Correct", fi: "✓ Oikein" },
      incorrect: { en: "✖ Incorrect", fi: "✖ Väärin" }
    };

    document.querySelectorAll('.check-button').forEach(button => {
      button.addEventListener('click', () => {
        const qBlock = button.closest('.question-block');
        const feedback = qBlock.querySelector('.feedback');
        const explanation = qBlock.querySelector('.explanation');
        const selected = qBlock.querySelector(`input[name="${qBlock.id}"]:checked`);
        const lang = typeof quizLang !== 'undefined' ? quizLang : 'en';
        const t = translations;

        if (!selected) {
          feedback.textContent = (t.selectAnswer[lang] || t.selectAnswer.en);
          feedback.className = "feedback incorrect";
          if (explanation) explanation.style.display = 'none';
          return;
        }
        
        if (selected.value === qBlock.dataset.correctAnswer) {
          feedback.textContent = (t.correct[lang] || t.correct.en);
          feedback.className = "feedback correct";
          if (explanation) explanation.style.display = 'block';
          
          const navLink = document.querySelector(`.quiz-nav-item a[href="#${qBlock.id}"]`);
          if (navLink) navLink.classList.add('completed-nav');
        } else {
          feedback.textContent = (t.incorrect[lang] || t.incorrect.en);
          feedback.className = "feedback incorrect";
          if (explanation) explanation.style.display = 'none';
        }
      });
    });
  }

  // --- INITIALIZATION ---

  function initializePage() {
    preventMathInteraction(); // Start the guard immediately
    installQuestionNumberClickHandler();
    
    buildSidebar();
    wireQuiz();
    processBackticks();
    autoFormatQuotes(); // <--- Automatically styles quotes

    const onMathJaxReady = () => {
       annotateAllMathWithTex();
    };

    if (window.MathJax?.startup?.promise) {
        window.MathJax.startup.promise.then(onMathJaxReady).catch(e => console.error(e));
    } else {
        window.addEventListener('load', () => {
           if (window.MathJax?.startup?.promise) {
               window.MathJax.startup.promise.then(onMathJaxReady);
           } else {
               setTimeout(onMathJaxReady, 1000);
           }
        });
    }

    const obs = new MutationObserver((muts) => {
      if (muts.some(m => m.addedNodes && m.addedNodes.length)) {
        setTimeout(() => annotateAllMathWithTex(), 500); 
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePage);
  } else {
    initializePage();
  }
})();