// template/js/script.js
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
      .tex-raw-inline { display:inline; white-space:pre-wrap; word-break:break-word; cursor:text; font-family: 'Fira Code', monospace; color: #d63384; font-size: 1.05em; }
      .tex-raw-block { display:block; white-space:pre-wrap; word-break:break-word; cursor:text; margin:0.5em 0; background: var(--quiz-surface); padding: 0.5em; border-radius: 4px; font-family: 'Fira Code', monospace; color: #d63384; font-size: 1.05em; }
      
      .question-number { cursor: pointer; user-select: none; font-weight: bold; color: inherit; font-size: 1.2em; display: inline-block; margin-right: 8px; }
      .question-number:hover { text-decoration: underline; }
      
      /* --- MATHJAX 4 OVERRIDES --- */

      mjx-assistive-mml { display: none !important; }

      /* Block Math Scrolling */
      .math-scroll {
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        margin: 0.5em 0;
        white-space: nowrap !important;
        cursor: default;
        -webkit-overflow-scrolling: touch;
      }
      
      /* FIX: Perfectly equalize the gap above display math by neutralizing text margin */
      .content-text + .math-scroll {
        margin-top: -0.5em;
      }
      
      .math-scroll mjx-container {
         max-width: none !important;
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
        box.classList.add('clean');
      }
    });
  }

  // --- THEME HANDLER ---
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

  // --- CODE COPY HANDLER ---
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
    toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>`;
    toggleBtn.setAttribute('aria-label', 'Toggle Navigation');

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

    document.body.appendChild(sidebar);
    document.body.appendChild(toggleBtn);

    // Open sidebar by default on wide screens (≥ 768px)
    if (window.innerWidth >= 768) {
      sidebar.classList.add('open');
    }

    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
    };

    toggleBtn.addEventListener('click', toggleSidebar);

    // Link clicks NO LONGER close the sidebar – allowing the quiz area to remain usable
    list.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        // do nothing – sidebar stays open
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
      incorrect: { en: "✖ Incorrect", fi: "✖ Väärin" },
      finish: { en: "Finish Quiz", fi: "Palauta" },
      score: { en: "Your Score", fi: "Pisteesi" },
      confirmFinish: { en: "Are you sure you want to finish? You can't change your answers after this.", fi: "Haluatko varmasti palauttaa? Et voi muuttaa vastauksiasi tämän jälkeen." },
      pointsLabel: { en: ' pts.', fi: ' p.' }   // used for per-question score badge update
    };

    if (typeof examMode !== 'undefined' && examMode) {
      wireExamMode(translations);
      return;
    }

    // Standard mode: individual check buttons
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

  function wireExamMode(translations) {
    const lang = typeof quizLang !== 'undefined' ? quizLang : 'en';
    const pointsSuffix = (translations.pointsLabel[lang] || translations.pointsLabel.en);

    // Create finish button
    const quizSection = document.querySelector('.quiz-section');
    const finishBtn = document.createElement('button');
    finishBtn.className = 'check-button finish-quiz-btn';
    finishBtn.textContent = translations.finish[lang] || translations.finish.en;
    finishBtn.style.display = 'block';
    finishBtn.style.margin = '2rem auto 0';
    quizSection.appendChild(finishBtn);

    finishBtn.addEventListener('click', () => {
      // Confirmation dialog
      const confirmMsg = translations.confirmFinish[lang] || translations.confirmFinish.en;
      if (!confirm(confirmMsg)) {
        return; // user cancelled
      }

      // Prevent double submission
      finishBtn.disabled = true;

      const questionBlocks = document.querySelectorAll('.question-block');
      let totalPoints = 0;
      let earnedPoints = 0;

      questionBlocks.forEach((qBlock) => {
        const points = parseInt(qBlock.dataset.points, 10) || 1;

        const isMcq = qBlock.querySelector('.options') !== null;
        const feedback = qBlock.querySelector('.feedback');
        const explanation = qBlock.querySelector('.explanation');
        const answerBox = qBlock.querySelector('.answer-box');
        const badge = qBlock.querySelector('.points-badge');

        if (isMcq) {
          totalPoints += points;   // only MCQ points count toward total
          const selected = qBlock.querySelector(`input[name="${qBlock.id}"]:checked`);
          const correctAnswer = qBlock.dataset.correctAnswer;

          if (selected && selected.value === correctAnswer) {
            earnedPoints += points;
            if (feedback) {
              feedback.textContent = translations.correct[lang] || '✓ Correct';
              feedback.className = 'feedback correct';
            }
            qBlock.classList.add('correct');
          } else {
            if (feedback) {
              if (!selected) {
                feedback.textContent = (translations.selectAnswer[lang] || '⚠ Please select an answer');
              } else {
                feedback.textContent = (translations.incorrect[lang] || '✖ Incorrect');
              }
              feedback.className = 'feedback incorrect';
            }
            qBlock.classList.add('incorrect');
          }

          if (explanation) explanation.style.display = 'block';

          // Update points badge to show earned/max
          if (badge) {
            const earned = (selected && selected.value === correctAnswer) ? points : 0;
            badge.innerText = `${earned} / ${points}${pointsSuffix}`;
          }
        } else {
          // Open-ended: not graded, leave badge unchanged (shows max points)
          if (answerBox) answerBox.style.display = 'block';
          // No points added to total, no badge update
        }
      });

      // Show result summary
      const resultDiv = document.createElement('div');
      resultDiv.id = 'exam-result';
      resultDiv.style.cssText = 'text-align: center; margin: 2rem 0; padding: 1rem; border: 2px solid var(--quiz-border); background: var(--quiz-surface);';
      const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const scoreLabel = translations.score[lang] || translations.score.en;
      resultDiv.innerHTML = `<h2>${scoreLabel}: ${earnedPoints} / ${totalPoints} (${percentage}%)</h2>`;
      quizSection.insertBefore(resultDiv, quizSection.firstChild);

      // Scroll to result
      resultDiv.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // --- INITIALIZATION ---

  function initializePage() {
    preventMathInteraction();
    installQuestionNumberClickHandler();

    buildSidebar();
    wireQuiz();
    autoFormatQuotes();
    setupCodeCopy();
    initTheme();

    // Syntax highlighting initialization with fallback protection
    if (typeof hljs !== 'undefined') {
      try {
        hljs.highlightAll();
      } catch (err) {
        console.warn("Syntax highlighting failed to initialize", err);
      }
    }

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
