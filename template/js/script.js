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
  let timerInterval = null; // holds the interval ID for the exam timer

  // --- CSS INJECTION (MathJax Layout & Overrides) ---
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

      .math-scroll {
        overflow-x: auto;
        overflow-y: hidden;
        max-width: 100%;
        margin: 0.5em 0;
        white-space: nowrap !important;
        cursor: default;
        -webkit-overflow-scrolling: touch;
      }
      
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

  // --- COPY HANDLER: copy LaTeX source, no script/style leakage ---
  function setupMathCopyHandler() {
    document.addEventListener('copy', (e) => {
      const selection = window.getSelection();
      if (!selection.rangeCount) return;

      const range = selection.getRangeAt(0);
      const fragment = range.cloneContents();

      // Find all math containers in the selected fragment
      const mathContainers = fragment.querySelectorAll
        ? fragment.querySelectorAll('mjx-container[data-tex]')
        : [];

      // Remove all <style> and <script> blocks from the fragment to prevent leakage
      fragment.querySelectorAll('style, script, link[rel="stylesheet"]').forEach(el => el.remove());

      if (mathContainers.length > 0) {
        // Replace each math container with its LaTeX source
        mathContainers.forEach(container => {
          const tex = container.getAttribute('data-tex');
          if (tex) {
            const textNode = document.createTextNode(tex);
            container.parentNode.replaceChild(textNode, container);
          }
        });
      }

      // Use the browser's own text serialisation of the cleaned fragment
      const plainText = fragment.textContent || '';

      if (plainText.trim()) {
        e.clipboardData.setData('text/plain', plainText);
        e.preventDefault();
      } else {
        // If the fragment is empty (shouldn't happen), let the default copy occur
        return;
      }
    });
  }

  // --- INTERACTION HANDLERS ---

  function isInteractiveEl(el) {
    if (!el || !el.closest) return false;
    return Boolean(el.closest('button, input, label, summary, a, textarea, select, .check-button'));
  }

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

  // --- OPEN ANSWER AUTOSAVE, AUTO‑EXPAND & IMAGE PASTE (exam mode) ---
  function setupOpenAnswerAutosave() {
    const answerDivs = document.querySelectorAll('.open-answer-textarea[contenteditable="true"]');
    if (answerDivs.length === 0) return;

    // Auto‑resize: adjust height to content
    const autoResize = (div) => {
      div.style.height = 'auto';
      div.style.height = div.scrollHeight + 'px';
    };

    // Debounce helper
    const debounce = (fn, delay) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    };

    const saveAnswer = (div) => {
      const qBlock = div.closest('.question-block');
      if (!qBlock || !qBlock.id) return;
      const key = `open-answer-${qBlock.id}`;
      try {
        // Save empty string if div is effectively empty
        const content = div.innerText.trim() === '' ? '' : div.innerHTML;
        localStorage.setItem(key, content);
      } catch (e) {
        // storage full or disabled – ignore silently
      }
    };

    const restoreAnswers = () => {
      document.querySelectorAll('.open-answer-textarea[contenteditable="true"]').forEach(div => {
        const qBlock = div.closest('.question-block');
        if (!qBlock || !qBlock.id) return;
        const key = `open-answer-${qBlock.id}`;
        const saved = localStorage.getItem(key);
        if (saved !== null) {
          div.innerHTML = saved;
          autoResize(div);
        }
      });
      syncAllAnswerMarks(); // update sidebar after restoring
    };

    // Check if the div is effectively empty (no visible text, no images)
    const isEmpty = (div) => {
      const imgs = div.querySelectorAll('img');
      if (imgs.length > 0) return false; // has image → not empty
      return div.innerText.trim() === '';
    };

    // Clean up any stray <br> that would prevent :empty from working
    const normalizeEmptyDiv = (div) => {
      if (isEmpty(div)) {
        // Remove all child nodes to make the div truly empty for :empty CSS
        div.innerHTML = '';
      }
    };

    // Sidebar helpers
    const markUnanswered = (qBlock) => {
      const id = qBlock.id;
      if (!id) return;
      const link = document.querySelector(`.quiz-nav-item a[href="#${id}"]`);
      if (link) link.classList.remove('answered');
    };

    // Sync all open-answer divs with sidebar marks
    const syncAllAnswerMarks = () => {
      document.querySelectorAll('.open-answer-textarea[contenteditable="true"]').forEach(div => {
        const qBlock = div.closest('.question-block');
        if (!qBlock) return;
        if (isEmpty(div)) {
          markUnanswered(qBlock);
        } else {
          markQuestionAsAnswered(qBlock); // reuse existing
        }
      });
    };
    window._syncAllAnswerMarks = syncAllAnswerMarks; // for any external use

    const debouncedSave = debounce((div) => {
      saveAnswer(div);
    }, 500);

    // Handle image paste from clipboard
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = (evt) => {
            const img = document.createElement('img');
            img.src = evt.target.result;
            img.alt = 'Pasted image';

            // Insert the image at the current cursor position (or just append)
            const sel = window.getSelection();
            if (sel.rangeCount) {
              const range = sel.getRangeAt(0);
              range.deleteContents();
              range.insertNode(img);
              // Move cursor after the image
              range.setStartAfter(img);
              range.collapse(true);
              sel.removeAllRanges();
              sel.addRange(range);
            } else {
              e.target.appendChild(img);
            }

            // Trigger resize and save
            autoResize(e.target);
            saveAnswer(e.target);
            // Mark as answered (image means not empty)
            markQuestionAsAnswered(e.target.closest('.question-block'));
          };
          reader.readAsDataURL(blob);
          return; // only handle one image at a time to be safe
        }
      }
    };

    answerDivs.forEach(div => {
      // Unified input handler: resize, save, sync sidebar based on emptiness
      const onInput = () => {
        autoResize(div);
        debouncedSave(div);
        
        const qBlock = div.closest('.question-block');
        if (!qBlock) return;
        
        // Check if empty after this input
        if (isEmpty(div)) {
          markUnanswered(qBlock);
          // Ensure div becomes truly empty for placeholder to show
          normalizeEmptyDiv(div);
        } else {
          markQuestionAsAnswered(qBlock);
        }
      };

      div.addEventListener('input', onInput);

      // Save on blur
      div.addEventListener('blur', () => saveAnswer(div));

      // Paste handler for images
      div.addEventListener('paste', handlePaste);

      // Initial resize and sidebar sync (in case of pre‑filled content from server)
      autoResize(div);
      normalizeEmptyDiv(div); // clean up empty state
      if (!isEmpty(div)) {
        markQuestionAsAnswered(div.closest('.question-block'));
      }
    });

    // Restore any previously saved answers
    restoreAnswers();

    // Expose for manual use
    window._restoreOpenAnswers = restoreAnswers;
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
    timerInterval = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((now - startTime) / 1000);
      const h = Math.floor(diff / 3600).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      timerValue.textContent = `${h}:${m}:${s}`;
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /**
   * Mark a question as answered in the sidebar.
   * Adds the 'answered' class which gives the button a split background
   * (top half normal, bottom half grey).
   */
  function markQuestionAsAnswered(qBlock) {
    const id = qBlock.id;
    if (!id) return;
    const link = document.querySelector(`.quiz-nav-item a[href="#${id}"]`);
    if (link) {
      // Remove any leftover graded classes first (in case of re-answering)
      link.classList.remove('q-correct', 'q-incorrect');
      link.classList.add('answered');
    }
  }

  /**
   * Mark a question as graded (correct/incorrect) in the sidebar.
   * Removes the 'answered' split and applies a solid green/red block.
   */
  function markQuestionAsGraded(qBlock, isCorrect) {
    const id = qBlock.id;
    if (!id) return;
    const link = document.querySelector(`.quiz-nav-item a[href="#${id}"]`);
    if (!link) return;
    link.classList.remove('answered', 'q-correct', 'q-incorrect');
    link.classList.add(isCorrect ? 'q-correct' : 'q-incorrect');
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
      const a = document.createElement('a');
      a.href = `#${q.id}`;
      a.textContent = numberStr;
      li.appendChild(a);
      list.appendChild(li);
    });

    document.body.appendChild(sidebar);
    document.body.appendChild(toggleBtn);

    if (window.innerWidth >= 768) {
      sidebar.classList.add('open');
    }

    const toggleSidebar = () => {
      sidebar.classList.toggle('open');
    };

    toggleBtn.addEventListener('click', toggleSidebar);

    list.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        // Do nothing – sidebar stays open on navigation clicks
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
      pointsLabel: { en: ' pts.', fi: ' p.' }
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
          feedback.className = "feedback warning";
          if (explanation) explanation.style.display = 'none';
          // Do NOT change sidebar – stays as answered or ungraded.
          return;
        }

        // Check the answer and update sidebar with correct/incorrect
        const isCorrect = (selected.value === qBlock.dataset.correctAnswer);
        if (isCorrect) {
          feedback.textContent = (t.correct[lang] || t.correct.en);
          feedback.className = "feedback correct";
          if (explanation) explanation.style.display = 'block';
          markQuestionAsGraded(qBlock, true);
        } else {
          feedback.textContent = (t.incorrect[lang] || t.incorrect.en);
          feedback.className = "feedback incorrect";
          if (explanation) explanation.style.display = 'none';
          markQuestionAsGraded(qBlock, false);
        }
      });
    });
  }

  function wireExamMode(translations) {
    const lang = typeof quizLang !== 'undefined' ? quizLang : 'en';
    const pointsSuffix = (translations.pointsLabel[lang] || translations.pointsLabel.en);

    const quizSection = document.querySelector('.quiz-section');
    const finishBtn = document.createElement('button');
    finishBtn.className = 'check-button finish-quiz-btn';
    finishBtn.textContent = translations.finish[lang] || translations.finish.en;
    finishBtn.style.display = 'block';
    finishBtn.style.margin = '2rem auto 0';
    quizSection.appendChild(finishBtn);

    // Live tracking: mark as answered when a radio is selected
    document.querySelectorAll('.question-block input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', function () {
        const qBlock = this.closest('.question-block');
        if (qBlock) markQuestionAsAnswered(qBlock);
      });
    });

    // Mark open‑ended as answered on first input (handled in setupOpenAnswerAutosave)

    finishBtn.addEventListener('click', () => {
      const confirmMsg = translations.confirmFinish[lang] || translations.confirmFinish.en;
      if (!confirm(confirmMsg)) {
        return;
      }

      // Stop the timer when finishing the quiz
      stopTimer();

      finishBtn.disabled = true;
      finishBtn.style.display = 'none';

      const questionBlocks = document.querySelectorAll('.question-block');
      let totalPoints = 0;
      let earnedPoints = 0;

      questionBlocks.forEach((qBlock) => {
        const points = parseInt(qBlock.dataset.points, 10) || 1;

        const isMcq = qBlock.querySelector('.options') !== null;
        const feedback = qBlock.querySelector('.feedback');
        const explanation = qBlock.querySelector('.explanation');
        const answerBox = qBlock.querySelector('.answer-box');
        const openAnswerDiv = qBlock.querySelector('.open-answer-textarea');
        const badge = qBlock.querySelector('.points-badge');

        if (isMcq) {
          totalPoints += points;
          const selected = qBlock.querySelector(`input[name="${qBlock.id}"]:checked`);
          const correctAnswer = qBlock.dataset.correctAnswer;

          if (selected && selected.value === correctAnswer) {
            earnedPoints += points;
            if (feedback) {
              feedback.textContent = translations.correct[lang] || '✓ Correct';
              feedback.className = 'feedback correct';
            }
            markQuestionAsGraded(qBlock, true);
          } else {
            if (feedback) {
              if (!selected) {
                feedback.textContent = (translations.selectAnswer[lang] || '⚠ Please select an answer');
                feedback.className = 'feedback warning';
              } else {
                feedback.textContent = (translations.incorrect[lang] || '✖ Incorrect');
                feedback.className = 'feedback incorrect';
              }
            }
            markQuestionAsGraded(qBlock, false);
          }

          if (explanation) explanation.style.display = 'block';

          if (badge) {
            const earned = (selected && selected.value === correctAnswer) ? points : 0;
            badge.innerText = `${earned} / ${points}${pointsSuffix}`;
          }
        } else {
          // Open‑ended: lock the answer area, reveal labels and model answer
          if (openAnswerDiv) {
            openAnswerDiv.setAttribute('contenteditable', 'false');
            // Trigger a final save just in case
            saveAnswerOnFinish(openAnswerDiv);
          }
          const openLabel = qBlock.querySelector('.open-answer-label');
          const modelLabel = qBlock.querySelector('.model-answer-label');
          if (openLabel) openLabel.style.display = 'block';
          if (modelLabel) modelLabel.style.display = 'block';
          if (answerBox) {
            answerBox.style.display = 'block';
          }
        }
      });

      const resultDiv = document.createElement('div');
      resultDiv.id = 'exam-result';
      resultDiv.style.cssText = 'text-align: center; margin: 2rem 0; padding: 1rem; border: 2px solid var(--quiz-border); background: var(--quiz-surface);';
      const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
      const scoreLabel = translations.score[lang] || translations.score.en;
      resultDiv.innerHTML = `<h2>${scoreLabel}: ${earnedPoints} / ${totalPoints} (${percentage}%)</h2>`;
      quizSection.insertBefore(resultDiv, quizSection.firstChild);

      resultDiv.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Helper to save answer on finish (same pattern as autosave)
  function saveAnswerOnFinish(div) {
    const qBlock = div.closest('.question-block');
    if (!qBlock || !qBlock.id) return;
    const key = `open-answer-${qBlock.id}`;
    try {
      localStorage.setItem(key, div.innerHTML);
    } catch (e) {}
  }

  // --- INITIALIZATION ---

  function initializePage() {
    preventMathInteraction();
    installQuestionNumberClickHandler();
    setupMathCopyHandler();

    buildSidebar();
    wireQuiz();
    autoFormatQuotes();
    setupCodeCopy();
    initTheme();
    setupOpenAnswerAutosave();

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
