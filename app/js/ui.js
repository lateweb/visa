// app/js/ui.js

/**
 * Manages button clicks, UI interactions, and Navigation.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const quizInput = document.getElementById('quizdownCode');
    const langSelect = document.getElementById('language-select');
    const examModeCheckbox = document.getElementById('examModeCheckbox');
    const compactModeCheckbox = document.getElementById('compactMode');
    const openBuilderBtn = document.getElementById('openBuilderBtn');
   
    // HTML Buttons
    const runBtn = document.getElementById('runBtn');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    
    // LaTeX Buttons
    const copyBtnQ = document.getElementById('copyBtnQ');
    const copyBtnQA = document.getElementById('copyBtnQA');
    const downloadBtnQ = document.getElementById('downloadBtnQ');
    const downloadBtnQA = document.getElementById('downloadBtnQA');
    
    // Sidebar Elements
    const sidebar = document.getElementById('storageSidebar');
    const resizeHandle = document.getElementById('resizeHandle');

    // --- PREFERENCES: Load & Save Choices ---
    const savedLang = localStorage.getItem('pref_lang');
    const savedExam = localStorage.getItem('pref_exam');
    const savedCompact = localStorage.getItem('pref_compact');

    if (savedLang && langSelect) langSelect.value = savedLang;
    if (savedExam && examModeCheckbox) examModeCheckbox.checked = (savedExam === 'true');
    if (savedCompact && compactModeCheckbox) compactModeCheckbox.checked = (savedCompact === 'true');

    if (langSelect) langSelect.addEventListener('change', () => localStorage.setItem('pref_lang', langSelect.value));
    if (examModeCheckbox) examModeCheckbox.addEventListener('change', () => localStorage.setItem('pref_exam', examModeCheckbox.checked));
    if (compactModeCheckbox) compactModeCheckbox.addEventListener('change', () => localStorage.setItem('pref_compact', compactModeCheckbox.checked));

    // --- NAVIGATION: Open Visual Builder ---
    if (openBuilderBtn) {
        openBuilderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const text = quizInput.value.trim();
            if (text) {
                const compressed = LZString.compressToBase64(text);
                window.location.href = `editor.html#quiz=${encodeURIComponent(compressed)}`;
            } else {
                localStorage.removeItem('quiz_autosave_draft');
                window.location.href = 'editor.html';
            }
        });
    }

    // 1. Enable/Disable buttons based on input
    if (quizInput) {
        quizInput.addEventListener('input', () => {
            const hasText = quizInput.value.trim().length > 0;
            if (runBtn) runBtn.disabled = !hasText;
        });
        
        const hasText = quizInput.value.trim().length > 0;
        if (runBtn) runBtn.disabled = !hasText;
    }
    
    // --- SIDEBAR RESIZE LOGIC ---
    if (resizeHandle && sidebar) {
        let isResizing = false;

        resizeHandle.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            sidebar.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            let newWidth = e.clientX;
            if (newWidth < 200) newWidth = 200;
            if (newWidth > 600) newWidth = 600;
            sidebar.style.width = `${newWidth}px`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                sidebar.style.userSelect = '';
            }
        });
    }
    
    // --- HTML ACTIONS ---
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            const btnText = runBtn.innerHTML;
            runBtn.innerHTML = 'Generating...';
            runBtn.disabled = true;
           
            try {
                if (typeof generateQuizHtml !== 'function') throw new Error("HTML Generator not loaded");
               
                const examMode = examModeCheckbox ? examModeCheckbox.checked : false;
                const html = await generateQuizHtml(langSelect.value, examMode);
               
                if (html) {
                    // Create blob URL and open directly – no loading screen
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                    // Revoke the blob URL after a short delay to free memory
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                } else {
                    showToast('Please enter some text first.', 'warning');
                }
            } catch (error) {
                console.error("Error generating HTML:", error);
                showToast('Error generating preview.', 'error');
            } finally {
                runBtn.innerHTML = btnText;
                runBtn.disabled = !quizInput.value.trim().length;
            }
        });
    }
    
    // --- Keyboard shortcut: Ctrl+Enter or Ctrl+E to trigger HTML preview ---
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && (e.key === 'Enter' || e.key.toLowerCase() === 'e')) {
            e.preventDefault();
            if (runBtn && !runBtn.disabled) runBtn.click();
        }
    });
    
    // Copy HTML Code
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const originalText = copyBtn.innerHTML;
            copyBtn.textContent = 'Copying...';
            try {
                if (typeof generateQuizHtml !== 'function') throw new Error("HTML Generator not loaded");
                const examMode = examModeCheckbox ? examModeCheckbox.checked : false;
                const html = await generateQuizHtml(langSelect.value, examMode);
                if (html) {
                    await navigator.clipboard.writeText(html);
                    copyBtn.textContent = 'Copied!';
                } else {
                    copyBtn.textContent = 'No content';
                }
            } catch (error) {
                console.error("Error copying HTML:", error);
                copyBtn.textContent = 'Failed';
            } finally {
                setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
            }
        });
    }
    
    // Download HTML File
    if (downloadBtn) {
        downloadBtn.addEventListener('click', async () => {
            const originalText = downloadBtn.innerHTML;
            downloadBtn.textContent = '...';
            try {
                if (typeof generateQuizHtml !== 'function') throw new Error("HTML Generator not loaded");
                const examMode = examModeCheckbox ? examModeCheckbox.checked : false;
                const html = await generateQuizHtml(langSelect.value, examMode);
                if (html) {
                    const match = quizInput.value.match(/^title:\s*(.+)$/m);
                    const title = match ? match[1].trim() : 'quiz';
                    const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';
                    downloadString(html, filename, 'text/html');
                    downloadBtn.textContent = 'Downloaded';
                } else {
                    downloadBtn.textContent = 'No content';
                }
            } catch (error) {
                console.error("Error downloading HTML:", error);
                downloadBtn.textContent = 'Failed';
            } finally {
                setTimeout(() => { downloadBtn.innerHTML = originalText; }, 2000);
            }
        });
    }

    // --- LATEX ACTIONS ---
    async function getLatex(withAnswers) {
        const lang = langSelect ? langSelect.value : 'en';
        const isCompact = compactModeCheckbox ? compactModeCheckbox.checked : false;
        if (window.LatexGenerator && typeof window.LatexGenerator.generateLatexDocument === 'function') {
            return window.LatexGenerator.generateLatexDocument(quizInput.value, withAnswers, lang, isCompact);
        }
        console.error("LatexGenerator not found");
        return null;
    }

    async function handleClipboardLatex(withAnswers, uiButton) {
        const originalText = uiButton.innerHTML;
        uiButton.textContent = '...';
        uiButton.disabled = true;
        try {
            const latex = await getLatex(withAnswers);
            if (latex) {
                await navigator.clipboard.writeText(latex);
                uiButton.textContent = 'Copied!';
            } else {
                uiButton.textContent = 'No content';
            }
        } catch (error) {
            console.error("Error copying LaTeX:", error);
            uiButton.textContent = 'Failed';
        } finally {
            setTimeout(() => {
                uiButton.innerHTML = originalText;
                uiButton.disabled = false;
            }, 2000);
        }
    }
    
    if (copyBtnQ) copyBtnQ.addEventListener('click', () => handleClipboardLatex(false, copyBtnQ));
    if (copyBtnQA) copyBtnQA.addEventListener('click', () => handleClipboardLatex(true, copyBtnQA));
    
    if (downloadBtnQ) {
        downloadBtnQ.addEventListener('click', async () => {
            const originalText = downloadBtnQ.innerHTML;
            downloadBtnQ.textContent = '...';
            downloadBtnQ.disabled = true;
            try {
                const latex = await getLatex(false);
                if (latex) {
                    downloadString(latex, 'quiz_questions.tex', 'application/x-tex');
                    downloadBtnQ.textContent = 'Downloaded';
                } else {
                    downloadBtnQ.textContent = 'No content';
                }
            } catch (error) {
                console.error("Error downloading LaTeX questions:", error);
                downloadBtnQ.textContent = 'Failed';
            } finally {
                setTimeout(() => { downloadBtnQ.innerHTML = originalText; downloadBtnQ.disabled = false; }, 2000);
            }
        });
    }
    
    if (downloadBtnQA) {
        downloadBtnQA.addEventListener('click', async () => {
            const originalText = downloadBtnQA.innerHTML;
            downloadBtnQA.textContent = '...';
            downloadBtnQA.disabled = true;
            try {
                const latex = await getLatex(true);
                if (latex) {
                    downloadString(latex, 'quiz_questions_answers.tex', 'application/x-tex');
                    downloadBtnQA.textContent = 'Downloaded';
                } else {
                    downloadBtnQA.textContent = 'No content';
                }
            } catch (error) {
                console.error("Error downloading LaTeX Q&A:", error);
                downloadBtnQA.textContent = 'Failed';
            } finally {
                setTimeout(() => { downloadBtnQA.innerHTML = originalText; downloadBtnQA.disabled = false; }, 2000);
            }
        });
    }
    
    // --- SHARE ACTIONS ---
    function encodeQuizForUrl(quizText) { return LZString.compressToBase64(quizText); }
    function decodeQuizFromUrl(encoded) { try { return LZString.decompressFromBase64(encoded); } catch (e) { return ''; } }
    
    if (document.getElementById('share-quiz')) {
        document.getElementById('share-quiz').addEventListener('click', () => {
            const text = quizInput.value.trim();
            if (!text) return showToast('No content!', 'warning');
            const url = `${window.location.origin}${window.location.pathname}?quiz=${encodeURIComponent(encodeQuizForUrl(text))}`;
            document.getElementById('share-link').value = url;
        });
    }

    if (document.getElementById('copy-share-link')) {
        document.getElementById('copy-share-link').addEventListener('click', () => {
            const linkInput = document.getElementById('share-link');
            linkInput.select();
            document.execCommand('copy');
            const btn = document.getElementById('copy-share-link');
            const originalText = btn.innerHTML;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.innerHTML = originalText; }, 2000);
        });
    }

    // --- INIT & AUTOSAVE ---
    const urlParams = new URLSearchParams(window.location.search);
    const encodedQuiz = urlParams.get('quiz');
    
    let loadedFromUrl = false;

    if (encodedQuiz) {
        const decoded = decodeQuizFromUrl(encodedQuiz);
        if (decoded) {
            quizInput.value = decoded;
            quizInput.dispatchEvent(new Event('input'));
            showToast('Quiz loaded!', 'success');
            loadedFromUrl = true;
            
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        }
    }
    
    // Auto-restore shared draft
    if (!loadedFromUrl && quizInput) {
        const draft = localStorage.getItem('quiz_autosave_draft');
        if (draft && draft.trim().length > 10) {
            quizInput.value = draft;
            quizInput.dispatchEvent(new Event('input'));
            showToast('Unsaved draft restored', 'success');
        }
    }

    // Auto-save on input for Converter (syncs with Visual Builder perfectly)
    if (quizInput) {
        quizInput.addEventListener('input', () => {
            const raw = quizInput.value;
            if (raw.trim().length > 10) {
                localStorage.setItem('quiz_autosave_draft', raw);
            } else if (raw.trim().length === 0) {
                localStorage.removeItem('quiz_autosave_draft');
            }
        });
        
        setInterval(() => {
            const raw = quizInput.value;
            if (raw.trim().length > 10) {
                localStorage.setItem('quiz_autosave_draft', raw);
            }
        }, 5000);
    }
    
    const savedQuizzes = JSON.parse(localStorage.getItem('savedQuizzes') || '[]');
    const savedCount = document.getElementById('savedCount');
    if (savedCount) savedCount.textContent = savedQuizzes.length;
});

function downloadString(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); window.URL.revokeObjectURL(url); }, 100);
}

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-notification');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
}
