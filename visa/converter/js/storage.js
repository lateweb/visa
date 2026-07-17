/* storage.js */

let isSaving = false;

// Expose functions globally so builder.js can access them
window.saveQuiz = saveQuiz;
window.loadQuiz = loadQuiz;
window.deleteQuiz = deleteQuiz;
window.loadSavedQuizzes = loadSavedQuizzes;

// Generate a unique ID for each quiz
function generateQuizId() {
    return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Sanitize filename for downloads
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
}

// Extract title from quizdown content
function extractQuizTitle(quizdownContent) {
    let quizTitle = "Generated Quiz";
    
    if (quizdownContent && quizdownContent.startsWith('---\n')) {
        const endOfHeaderIndex = quizdownContent.indexOf('\n---\n');
        if (endOfHeaderIndex > 0) {
            const headerText = quizdownContent.substring(4, endOfHeaderIndex);
            headerText.split('\n').forEach(line => {
                const parts = line.split(':');
                if (parts.length >= 2) {
                    const key = parts[0].trim().toLowerCase();
                    const value = parts.slice(1).join(':').trim();
                    if (key === 'title') {
                        quizTitle = value;
                    }
                }
            });
        }
    }
    
    return quizTitle;
}

// Escape HTML for safe display
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Save quiz to localStorage - always creates new quiz
function saveQuiz() {
    if (isSaving) return;
    isSaving = true;
    
    const quizInput = document.getElementById("quizdownCode");
    const cssInput = document.getElementById("cssCode");
    const jsInput = document.getElementById("jsCode");

    if (!quizInput) {
        console.error("Critical: No quiz input found to save.");
        isSaving = false;
        return;
    }

    const quizdownContent = quizInput.value;
    // Handle cases where CSS/JS inputs might not exist (e.g., in editor.html)
    const cssContent = cssInput ? cssInput.value : "";
    const jsContent = jsInput ? jsInput.value : "";
    
    if (!quizdownContent.trim()) {
        isSaving = false;
        if (document.getElementById('saveBtn')) {
            showStatusMessage(document.getElementById('saveBtn'), 'No content', 'warning');
        }
        return;
    }
    
    const timestamp = new Date().toISOString();
    const quizTitle = extractQuizTitle(quizdownContent);
    const uniqueId = generateQuizId();
    
    const savedQuizzes = JSON.parse(localStorage.getItem('savedQuizzes') || '[]');
    
    // Always create new quiz entry
    const quizItem = {
        id: uniqueId,
        title: quizTitle,
        quizdown: quizdownContent,
        css: cssContent,
        js: jsContent,
        timestamp: timestamp
    };
    
    savedQuizzes.push(quizItem);
    localStorage.setItem('savedQuizzes', JSON.stringify(savedQuizzes));
    
    // Update UI
    loadSavedQuizzes();
    
    // Show success message
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        const originalText = saveBtn.textContent;
        // Check if we are in builder or converter for button text
        saveBtn.textContent = 'Saved!';
        
        // Use a generic toast if available
        if(typeof showToast === 'function') {
            showToast("Quiz saved to Library!", "success");
        }
        
        setTimeout(() => {
            // Restore original text based on context
            saveBtn.innerHTML = originalText.includes('Progress') ? 'Save Progress' : (originalText.includes('<svg') ? originalText : 'Save Quiz');
            isSaving = false;
        }, 1000);
    } else {
        isSaving = false;
    }
}

// Load and display saved quizzes
function loadSavedQuizzes() {
    const savedQuizzesList = document.getElementById('savedQuizzesList');
    if (!savedQuizzesList) return;
    
    const savedQuizzes = JSON.parse(localStorage.getItem('savedQuizzes') || '[]');
    
    // Update saved count badge
    const savedCount = document.getElementById('savedCount');
    if (savedCount) {
        savedCount.textContent = savedQuizzes.length;
    }
    
    savedQuizzesList.innerHTML = '';
    
    if (savedQuizzes.length === 0) {
        savedQuizzesList.innerHTML = '<div class="empty-state">No saved quizzes yet.</div>';
        return;
    }
    
    // Sort by most recent first
    savedQuizzes.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    savedQuizzes.forEach(quiz => {
        const quizItem = document.createElement('div');
        quizItem.className = 'saved-quiz-item';
        quizItem.dataset.quizId = quiz.id;
        
        const date = new Date(quiz.timestamp);
        const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        quizItem.innerHTML = `
            <div class="quiz-info">
                <h3>${escapeHtml(quiz.title)}</h3>
                <div class="quiz-date">${escapeHtml(formattedDate)}</div>
            </div>
            <div class="quiz-actions">
                <button class="load-btn" data-id="${quiz.id}">Load</button>
                <button class="delete-btn" data-id="${quiz.id}">Delete</button>
            </div>
        `;
        
        savedQuizzesList.appendChild(quizItem);
    });
    
    // Add event listeners to buttons using Delegation or direct attachment
    // Direct attachment for clarity:
    document.querySelectorAll('.load-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const quizId = e.currentTarget.dataset.id;
            loadQuiz(quizId);
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const quizId = e.currentTarget.dataset.id;
            deleteQuiz(quizId);
        });
    });
}

// Load a specific quiz by ID
function loadQuiz(quizId) {
    const savedQuizzes = JSON.parse(localStorage.getItem('savedQuizzes') || '[]');
    const quiz = savedQuizzes.find(q => q.id === quizId);
    
    if (quiz) {
        const quizInput = document.getElementById('quizdownCode');
        const cssInput = document.getElementById('cssCode');
        const jsInput = document.getElementById('jsCode');

        if(quizInput) quizInput.value = quiz.quizdown;
        if(cssInput) cssInput.value = quiz.css || "";
        if(jsInput) jsInput.value = quiz.js || "";
        
        // Trigger input event to enable generate buttons
        if(quizInput) quizInput.dispatchEvent(new Event('input'));

        // CRITICAL: Sync Visual Editor if we are on editor.html
        if (typeof window.parseRawToVisual === 'function' && typeof window.renderVisualEditor === 'function') {
            window.parseRawToVisual(quiz.quizdown);
            window.renderVisualEditor();
        }
        
        // Show loaded message
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            const originalText = saveBtn.innerHTML; // Keep icon
            saveBtn.textContent = 'Loaded!';
            setTimeout(() => {
                saveBtn.innerHTML = originalText;
            }, 1000);
        }

        if(typeof showToast === 'function') {
            showToast(`Loaded "${quiz.title}"`, 'success');
        }
    }
}

// Delete quiz with confirmation dialog
function deleteQuiz(quizId) {
    if (!confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) {
        return;
    }
    
    const savedQuizzes = JSON.parse(localStorage.getItem('savedQuizzes') || '[]');
    const filteredQuizzes = savedQuizzes.filter(q => q.id !== quizId);
    
    localStorage.setItem('savedQuizzes', JSON.stringify(filteredQuizzes));
    loadSavedQuizzes();
    
    if(typeof showToast === 'function') {
        showToast("Quiz deleted", "success");
    }
}

// Search through saved quizzes
function searchQuizzes() {
    const searchInput = document.getElementById('searchInput');
    if(!searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();
    const quizItems = document.querySelectorAll('.saved-quiz-item');
    
    quizItems.forEach(item => {
        const title = item.querySelector('h3')?.textContent.toLowerCase() || '';
        const date = item.querySelector('.quiz-date')?.textContent.toLowerCase() || '';
        
        if (title.includes(searchTerm) || date.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Helper for UI status (kept for compatibility with index.html)
function showStatusMessage(button, message, type) {
    const status = document.createElement('span');
    status.className = `status-message ${type}`;
    status.textContent = message;
    status.style.marginLeft = '10px';
    status.style.fontSize = '12px';
    
    // Quick simple styling in case CSS class missing
    status.style.color = type === 'warning' ? '#b45309' : '#047857';
    
    button.parentNode.appendChild(status);
    setTimeout(() => status.remove(), 2000);
}

// Initialize saved quizzes on load
document.addEventListener('DOMContentLoaded', () => {
    // Add search event listener
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', searchQuizzes);
    }
    
    // Initial load of the sidebar
    loadSavedQuizzes();
    
    // Add save button event listener if it exists
    // Note: builder.js might also attach one, which is fine (multiple listeners)
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveQuiz);
    }
});