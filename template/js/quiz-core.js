// template/js/quiz-core.js
/**
 * quiz-core.js
 * Contains the core checking logic, exam finish flows, and automatic saving of open answers.
 * Requires window.QuizSidebar to be previously declared.
 */
(() => {
    // ----- Custom confirmation modal with Enter key support and prevention of double overlay -----
    function customExamConfirm(message, okText, cancelText) {
        return new Promise((resolve) => {
            // Guard: if an overlay already exists, do not create another one.
            if (document.querySelector('.exam-modal-overlay.active')) {
                resolve(false);
                return;
            }

            const overlay = document.createElement('div');
            overlay.className = 'exam-modal-overlay active';
            const box = document.createElement('div');
            box.className = 'exam-modal-box';

            const text = document.createElement('div');
            text.textContent = message;

            const actions = document.createElement('div');
            actions.className = 'exam-modal-actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'exam-modal-btn';
            cancelBtn.textContent = cancelText || 'Cancel';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'exam-modal-btn primary';
            confirmBtn.textContent = okText || 'OK';

            actions.appendChild(cancelBtn);
            actions.appendChild(confirmBtn);
            box.appendChild(text);
            box.appendChild(actions);
            overlay.appendChild(box);
            document.body.appendChild(overlay);

            // Focus the confirm button by default so Enter triggers it.
            setTimeout(() => confirmBtn.focus(), 50);

            let resolved = false;

            const close = (result) => {
                if (resolved) return;
                resolved = true;
                overlay.classList.remove('active');
                // Remove the overlay from DOM after transition
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                }, 200);
                resolve(result);
            };

            // Click handlers
            cancelBtn.onclick = () => close(false);
            confirmBtn.onclick = () => close(true);

            // Keydown handler: Enter triggers confirm, Escape triggers cancel
            const keydownHandler = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    close(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    close(false);
                }
            };
            overlay.addEventListener('keydown', keydownHandler);

            // Also ensure that clicking outside the box doesn't close it (we want explicit action)
            // But we can optionally allow clicking on overlay to cancel, but we'll keep it strict.
            // Optionally, we can add overlay click to cancel? We'll not to prevent accidental closure.
        });
    }

    function setupOpenAnswerAutosave() {
        const answerDivs = document.querySelectorAll('.open-answer-textarea[contenteditable="true"]');
        if (answerDivs.length === 0) return;

        // Retrieve quiz instance ID (injected by generator) – fallback to a constant if missing
        const instanceId = typeof quizInstanceId !== 'undefined' ? quizInstanceId : 'global';

        const autoResize = (div) => { div.style.height = 'auto'; div.style.height = div.scrollHeight + 'px'; };
        const getStorageKey = (qBlock) => `open-answer-${instanceId}-${qBlock.id}`;

        const saveAnswer = (div) => {
            const qBlock = div.closest('.question-block');
            if (!qBlock || !qBlock.id) return;
            try {
                const content = div.innerText.trim() === '' ? '' : div.innerHTML;
                localStorage.setItem(getStorageKey(qBlock), content);
            } catch (e) {}
        };

        const isEmpty = (div) => (div.querySelectorAll('img').length === 0 && div.innerText.trim() === '');
        const normalizeEmptyDiv = (div) => { if (isEmpty(div)) div.innerHTML = ''; };

        const syncAllAnswerMarks = () => {
            document.querySelectorAll('.open-answer-textarea[contenteditable="true"]').forEach(div => {
                const qBlock = div.closest('.question-block');
                if (!qBlock) return;
                if (isEmpty(div)) window.QuizSidebar.markUnanswered(qBlock);
                else window.QuizSidebar.markAnswered(qBlock);
            });
        };

        const restoreAnswers = () => {
            document.querySelectorAll('.open-answer-textarea[contenteditable="true"]').forEach(div => {
                const qBlock = div.closest('.question-block');
                if (!qBlock || !qBlock.id) return;
                const saved = localStorage.getItem(getStorageKey(qBlock));
                if (saved !== null) {
                    div.innerHTML = saved;
                    autoResize(div);
                }
            });
            syncAllAnswerMarks();
        };

        answerDivs.forEach(div => {
            div.addEventListener('input', () => {
                autoResize(div);
                // Save after a short delay to avoid excessive writes
                clearTimeout(div._saveTimer);
                div._saveTimer = setTimeout(() => saveAnswer(div), 300);
                const qBlock = div.closest('.question-block');
                if (qBlock) {
                    if (isEmpty(div)) {
                        window.QuizSidebar.markUnanswered(qBlock);
                        normalizeEmptyDiv(div);
                    } else {
                        window.QuizSidebar.markAnswered(qBlock);
                    }
                }
            });
            div.addEventListener('blur', () => saveAnswer(div));
            div.addEventListener('paste', (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        e.preventDefault();
                        const blob = items[i].getAsFile();
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            const img = document.createElement('img');
                            img.src = evt.target.result;
                            img.alt = 'Pasted image';
                            const sel = window.getSelection();
                            if (sel.rangeCount) {
                                const range = sel.getRangeAt(0);
                                range.deleteContents();
                                range.insertNode(img);
                                range.setStartAfter(img);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                            } else {
                                e.target.appendChild(img);
                            }
                            autoResize(e.target);
                            saveAnswer(e.target);
                            window.QuizSidebar.markAnswered(e.target.closest('.question-block'));
                        };
                        reader.readAsDataURL(blob);
                        return;
                    }
                }
            });
            autoResize(div);
            normalizeEmptyDiv(div);
            if (!isEmpty(div)) window.QuizSidebar.markAnswered(div.closest('.question-block'));
        });
        restoreAnswers();
    }

    function wireQuiz() {
        const translations = {
            selectAnswer: { en: "⚠ Please select an answer", fi: "⚠ Valitse vastaus" },
            unanswered: { en: "⚠ Unanswered", fi: "⚠ Ei vastattu" },
            correct: { en: "✓ Correct", fi: "✓ Oikein" },
            incorrect: { en: "✖ Incorrect", fi: "✖ Väärin" },
            finish: { en: "Finish Quiz", fi: "Palauta" },
            score: { en: "Your Score", fi: "Pisteesi" },
            confirmFinish: { en: "Are you sure you want to finish? You can't change your answers after this.", fi: "Haluatko varmasti palauttaa? Et voi muuttaa vastauksiasi tämän jälkeen." },
            cancel: { en: "Cancel", fi: "Peruuta" },
            ok: { en: "OK", fi: "OK" },
            pointsLabel: { en: ' pts.', fi: ' p.' }
        };

        const lang = typeof quizLang !== 'undefined' ? quizLang : 'en';

        if (typeof examMode !== 'undefined' && examMode) {
            const quizSection = document.querySelector('.quiz-section');
            const finishBtn = document.createElement('button');
            finishBtn.className = 'check-button finish-quiz-btn';
            finishBtn.textContent = translations.finish[lang] || translations.finish.en;
            finishBtn.style.display = 'block';
            finishBtn.style.margin = '2rem auto 0';
            quizSection.appendChild(finishBtn);

            document.querySelectorAll('.question-block input[type="radio"]').forEach(radio => {
                radio.addEventListener('change', function () {
                    const qBlock = this.closest('.question-block');
                    if (qBlock) window.QuizSidebar.markAnswered(qBlock);
                });
            });

            // Disable the finish button after first click to prevent multiple modals
            let finishing = false;
            finishBtn.addEventListener('click', () => {
                if (finishing) return;
                finishing = true;
                customExamConfirm(
                    translations.confirmFinish[lang] || translations.confirmFinish.en,
                    translations.ok[lang] || translations.ok.en,
                    translations.cancel[lang] || translations.cancel.en
                ).then(confirmed => {
                    if (!confirmed) {
                        finishing = false;
                        return;
                    }

                    // Proceed with finishing
                    window.QuizSidebar.stopTimer();
                    finishBtn.disabled = true;
                    finishBtn.style.display = 'none';
                    const sidebarFinishBtn = document.querySelector('.sidebar-finish-btn');
                    if (sidebarFinishBtn) sidebarFinishBtn.style.display = 'none';
                    document.querySelectorAll('.flag-question-btn').forEach(btn => btn.disabled = true);

                    let totalPoints = 0, earnedPoints = 0;
                    document.querySelectorAll('.question-block').forEach((qBlock) => {
                        const points = parseInt(qBlock.dataset.points, 10) || 1;
                        const isMcq = qBlock.querySelector('.options') !== null;
                        const feedback = qBlock.querySelector('.feedback');
                        const explanation = qBlock.querySelector('.explanation');

                        if (isMcq) {
                            totalPoints += points;
                            const selected = qBlock.querySelector(`input[name="${qBlock.id}"]:checked`);
                            const correctAnswer = qBlock.dataset.correctAnswer;

                            qBlock.querySelectorAll(`input[type="radio"]`).forEach(radio => {
                                radio.disabled = true;
                                const label = radio.closest('label');
                                if (radio.value === correctAnswer) label.classList.add('is-correct-option');
                                else if (radio.checked) label.classList.add('is-wrong-option');
                            });

                            if (selected && selected.value === correctAnswer) {
                                earnedPoints += points;
                                if (feedback) { feedback.textContent = translations.correct[lang] || '✓ Correct'; feedback.className = 'feedback correct'; }
                                window.QuizSidebar.markGraded(qBlock, true);
                            } else {
                                if (feedback) {
                                    if (!selected) { feedback.textContent = translations.unanswered[lang] || '⚠ Unanswered'; feedback.className = 'feedback warning'; }
                                    else { feedback.textContent = translations.incorrect[lang] || '✖ Incorrect'; feedback.className = 'feedback incorrect'; }
                                }
                                window.QuizSidebar.markGraded(qBlock, false);
                            }
                            if (explanation) explanation.style.display = 'block';
                            const badge = qBlock.querySelector('.points-badge');
                            if (badge) badge.innerText = `${selected && selected.value === correctAnswer ? points : 0} / ${points}${translations.pointsLabel[lang] || translations.pointsLabel.en}`;
                        } else {
                            const openAnswerDiv = qBlock.querySelector('.open-answer-textarea');
                            if (openAnswerDiv) {
                                openAnswerDiv.setAttribute('contenteditable', 'false');
                                // Save final answer with quiz-specific key
                                const instanceId = typeof quizInstanceId !== 'undefined' ? quizInstanceId : 'global';
                                const key = `open-answer-${instanceId}-${qBlock.id}`;
                                try { localStorage.setItem(key, openAnswerDiv.innerHTML); } catch(e){}
                            }
                            ['open-answer-label', 'model-answer-label', 'answer-box'].forEach(cls => {
                                const el = qBlock.querySelector(`.${cls}`);
                                if (el) el.style.display = 'block';
                            });
                        }
                    });

                    const resultDiv = document.createElement('div');
                    resultDiv.id = 'exam-result';
                    resultDiv.style.cssText = 'text-align: center; margin: 2rem 0; padding: 1rem; border: 2px solid var(--quiz-border); background: var(--quiz-surface);';
                    const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
                    resultDiv.innerHTML = `<h2>${translations.score[lang] || translations.score.en}: ${earnedPoints} / ${totalPoints} (${percentage}%)</h2>`;
                    document.querySelector('.quiz-section').insertBefore(resultDiv, document.querySelector('.quiz-section').firstChild);
                    resultDiv.scrollIntoView({ behavior: 'smooth' });
                });
            });
        } else {
            document.querySelectorAll('.check-button').forEach(button => {
                button.addEventListener('click', () => {
                    const qBlock = button.closest('.question-block');
                    const feedback = qBlock.querySelector('.feedback');
                    const explanation = qBlock.querySelector('.explanation');
                    const selected = qBlock.querySelector(`input[name="${qBlock.id}"]:checked`);

                    if (!selected) {
                        feedback.textContent = translations.selectAnswer[lang] || translations.selectAnswer.en;
                        feedback.className = "feedback warning";
                        if (explanation) explanation.style.display = 'none';
                        return;
                    }

                    const isCorrect = (selected.value === qBlock.dataset.correctAnswer);
                    if (isCorrect) {
                        feedback.textContent = translations.correct[lang] || translations.correct.en;
                        feedback.className = "feedback correct";
                        if (explanation) explanation.style.display = 'block';
                        window.QuizSidebar.markGraded(qBlock, true);
                    } else {
                        feedback.textContent = translations.incorrect[lang] || translations.incorrect.en;
                        feedback.className = "feedback incorrect";
                        if (explanation) explanation.style.display = 'none';
                        window.QuizSidebar.markGraded(qBlock, false);
                    }
                });
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupOpenAnswerAutosave();
        wireQuiz();
    });
})();
