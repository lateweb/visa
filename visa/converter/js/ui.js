/**
 * ui.js
 * Manages button clicks, UI interactions, and Navigation.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const quizInput = document.getElementById('quizdownCode');
    const langSelect = document.getElementById('language-select');
    const openBuilderBtn = document.getElementById('openBuilderBtn');
   
    // HTML Buttons
    const runBtn = document.getElementById('runBtn');
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    
    // LaTeX Buttons
    const runBtnLatex = document.getElementById('runBtnLatex'); 
    const copyBtnQ = document.getElementById('copyBtnQ');
    const copyBtnQA = document.getElementById('copyBtnQA');
    const downloadBtnQ = document.getElementById('downloadBtnQ');
    const downloadBtnQA = document.getElementById('downloadBtnQA');
    
    // Sidebar Elements
    const sidebar = document.getElementById('storageSidebar');
    const resizeHandle = document.getElementById('resizeHandle');

    // --- NAVIGATION: Open Visual Builder ---
    if (openBuilderBtn) {
        openBuilderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const text = quizInput.value.trim();
            if (text) {
                // Compress data and pass to editor via URL
                const compressed = LZString.compressToBase64(text);
                window.location.href = `editor.html#quiz=${encodeURIComponent(compressed)}`;
            } else {
                // If empty, just go to the editor
                window.location.href = 'editor.html';
            }
        });
    }

    // 1. Enable/Disable buttons based on input
    if (quizInput) {
        quizInput.addEventListener('input', () => {
            const hasText = quizInput.value.trim().length > 0;
            if (runBtn) runBtn.disabled = !hasText;
            if (runBtnLatex) runBtnLatex.disabled = !hasText;
        });
        
        // Initial check
        const hasText = quizInput.value.trim().length > 0;
        if (runBtn) runBtn.disabled = !hasText;
        if (runBtnLatex) runBtnLatex.disabled = !hasText;
    }
    
    // --- SIDEBAR RESIZE LOGIC ---
    if (resizeHandle && sidebar) {
        let isResizing = false;

        resizeHandle.addEventListener('mousedown', (e) => {
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
               
                const html = await generateQuizHtml(langSelect.value);
               
                if (html) {
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                } else {
                    showToast('Please enter some text first.', 'warning');
                }
            } catch (error) {
                console.error("Error generating HTML:", error);
                showToast('Error generating preview.', 'error');
            } finally {
                runBtn.innerHTML = btnText;
                runBtn.disabled = false;
            }
        });
    }
    
    // Copy HTML Code
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const originalText = copyBtn.innerHTML;
            copyBtn.textContent = '...';
           
            try {
                if (typeof generateQuizHtml !== 'function') throw new Error("HTML Generator not loaded");
                const html = await generateQuizHtml(langSelect.value);
                if (html) {
                    await navigator.clipboard.writeText(html);
                    showStatusMessage(copyBtn, 'Copied!', 'success');
                } else {
                    showStatusMessage(copyBtn, 'No content', 'warning');
                }
            } catch (error) {
                console.error("Error copying HTML:", error);
                showStatusMessage(copyBtn, 'Failed', 'error');
            } finally {
                copyBtn.innerHTML = originalText;
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
                const html = await generateQuizHtml(langSelect.value);
                if (html) {
                    const match = quizInput.value.match(/^title:\s*(.+)$/m);
                    const title = match ? match[1].trim() : 'quiz';
                    const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.html';
                    downloadString(html, filename, 'text/html');
                    showStatusMessage(downloadBtn, 'Downloaded', 'success');
                } else {
                    showStatusMessage(downloadBtn, 'No content', 'warning');
                }
            } catch (error) {
                console.error("Error downloading HTML:", error);
                showStatusMessage(downloadBtn, 'Failed', 'error');
            } finally {
                downloadBtn.innerHTML = originalText;
            }
        });
    }

    // --- LATEX ACTIONS ---

    // 1. HELPER: Generate LaTeX using the global object
    async function getLatex(withAnswers) {
        const lang = langSelect ? langSelect.value : 'en';
        
        // Check for Compact Mode checkbox
        const compactCheckbox = document.getElementById('compactMode');
        const isCompact = compactCheckbox ? compactCheckbox.checked : false;

        if (window.LatexGenerator && typeof window.LatexGenerator.generateLatexDocument === 'function') {
            return window.LatexGenerator.generateLatexDocument(quizInput.value, withAnswers, lang, isCompact);
        }
        console.error("LatexGenerator not found");
        return null;
    }

    // 2. Button Handlers
    if (runBtnLatex) {
        runBtnLatex.addEventListener('click', async () => {
            const btnText = runBtnLatex.innerHTML;
            runBtnLatex.innerHTML = 'Processing...';
            runBtnLatex.disabled = true;

            try {
                // Generate just questions by default for preview
                const latex = await getLatex(false);
                
                if (latex) {
                    // Open as a text file in a new tab
                    const blob = new Blob([latex], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    window.open(url, '_blank');
                } else {
                    showToast('No content to generate.', 'warning');
                }
            } catch (err) {
                console.error("Error generating LaTeX:", err);
                showToast('Error generating LaTeX.', 'error');
            } finally {
                runBtnLatex.innerHTML = btnText;
                runBtnLatex.disabled = false;
            }
        });
    }

    async function handleClipboardLatex(withAnswers, successMsg, emptyMsg, failMsg, uiButton) {
        const originalText = uiButton.innerHTML;
        uiButton.textContent = '...';
        uiButton.disabled = true;
        try {
            const latex = await getLatex(withAnswers);
            if (latex) {
                await navigator.clipboard.writeText(latex);
                showStatusMessage(uiButton, successMsg, 'success');
            } else {
                showStatusMessage(uiButton, emptyMsg, 'warning');
            }
        } catch (error) {
            console.error("Error copying LaTeX:", error);
            showStatusMessage(uiButton, failMsg, 'error');
        } finally {
            uiButton.innerHTML = originalText;
            uiButton.disabled = false;
        }
    }
    
    if (copyBtnQ) copyBtnQ.addEventListener('click', () => handleClipboardLatex(false, 'Copied!', 'No content', 'Failed', copyBtnQ));
    if (copyBtnQA) copyBtnQA.addEventListener('click', () => handleClipboardLatex(true, 'Copied!', 'No content', 'Failed', copyBtnQA));
    
    if (downloadBtnQ) {
        downloadBtnQ.addEventListener('click', async () => {
            const originalText = downloadBtnQ.innerHTML;
            downloadBtnQ.textContent = '...';
            downloadBtnQ.disabled = true;
            try {
                const latex = await getLatex(false);
                if (latex) {
                    downloadString(latex, 'quiz_questions.tex', 'application/x-tex');
                    showStatusMessage(downloadBtnQ, 'Downloaded', 'success');
                } else {
                    showStatusMessage(downloadBtnQ, 'No content', 'warning');
                }
            } catch (error) {
                console.error("Error downloading LaTeX questions:", error);
                showStatusMessage(downloadBtnQ, 'Failed', 'error');
            } finally {
                downloadBtnQ.innerHTML = originalText;
                downloadBtnQ.disabled = false;
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
                    showStatusMessage(downloadBtnQA, 'Downloaded', 'success');
                } else {
                    showStatusMessage(downloadBtnQA, 'No content', 'warning');
                }
            } catch (error) {
                console.error("Error downloading LaTeX Q&A:", error);
                showStatusMessage(downloadBtnQA, 'Failed', 'error');
            } finally {
                downloadBtnQA.innerHTML = originalText;
                downloadBtnQA.disabled = false;
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
            document.getElementById('share-link').select();
            document.execCommand('copy');
            showStatusMessage(document.getElementById('copy-share-link'), 'Copied!', 'success');
        });
    }

    // --- INIT ---
    const urlParams = new URLSearchParams(window.location.search);
    const encodedQuiz = urlParams.get('quiz');
    if (encodedQuiz) {
        const decoded = decodeQuizFromUrl(encodedQuiz);
        if (decoded) {
            quizInput.value = decoded;
            quizInput.dispatchEvent(new Event('input'));
            showToast('Quiz loaded!', 'success');
        }
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

function showStatusMessage(button, message, type = 'success') {
    const existing = button.parentNode.querySelector('.status-message');
    if (existing) existing.remove();
    const status = document.createElement('span');
    status.className = `status-message ${type}`;
    status.textContent = message;
    status.style.cssText = `margin-left: 8px; font-size: 12px; padding: 2px 6px; border-radius: 4px; opacity: 0; transition: opacity 0.3s;`;
    if (type === 'success') { status.style.backgroundColor = '#dbeafe'; status.style.color = '#1e40af'; }
    else if (type === 'error') { status.style.backgroundColor = '#fee2e2'; status.style.color = '#991b1b'; }
    else { status.style.backgroundColor = '#fef3c7'; status.style.color = '#92400e'; }
    button.parentNode.appendChild(status);
    setTimeout(() => status.style.opacity = '1', 10);
    setTimeout(() => { status.style.opacity = '0'; setTimeout(() => { if (status.parentNode) status.remove(); }, 300); }, 2000);
}