// app/js/builder.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Elements
    const titleInput = document.getElementById('visual-title');
    const hiddenCode = document.getElementById('quizdownCode'); 

    let loadedContent = null;

    // 1. Load from URL (if opened from index.html)
    const fragment = window.location.hash.substring(1); // remove #
    const params = new URLSearchParams(fragment);
    const encodedQuiz = params.get("quiz");
    
    if (encodedQuiz) {
        try {
            // Verify LZString exists
            if(typeof LZString === 'undefined') {
                console.error("LZString library missing");
            } else {
                const decoded = LZString.decompressFromBase64(encodedQuiz);
                if (decoded && decoded.trim().length > 0) {
                    loadedContent = decoded;
                    // Strip hash from URL so a page refresh doesn't overwrite a newer auto-saved draft
                    window.history.replaceState(null, null, 'editor.html');
                }
            }
        } catch (e) {
            console.error("Failed to load quiz from URL", e);
        }
    }

    // 2. Restore Draft if no URL data was provided (Survives Refreshes & Crashes)
    if (!loadedContent) {
        const draft = localStorage.getItem('quiz_autosave_draft');
        if (draft && draft.trim().length > 10) {
            loadedContent = draft;
            
            // Show a quick visual indicator that draft was restored
            setTimeout(() => {
                const saveBtn = document.getElementById('saveBtn');
                if (saveBtn) {
                    const origText = saveBtn.textContent;
                    saveBtn.textContent = 'Draft Restored';
                    setTimeout(() => saveBtn.textContent = origText, 2500);
                }
            }, 500);
        }
    }

    // 3. Initialization Logic
    if (loadedContent) {
        window.parseRawToVisual(loadedContent);
        hiddenCode.value = loadedContent;
    } else if(window.visualState.questions.length === 0 && !window.visualState.header) {
        // Default empty state
        window.visualState = {
            header: "title: My New Quiz\n",
            questions: []
        };
        window.visualAddQuestion(); 
    }

    // Initial Render
    if(window.renderVisualEditor) {
        window.renderVisualEditor();
    }

    // 4. SYNCHRONIZATION: Visual -> Hidden Textarea
    // We listen to changes on the BODY to catch all inputs bubbling up
    document.body.addEventListener('input', (e) => {
        // Only trigger if interaction happens in the visual container or title
        if(e.target.closest('.builder-canvas')) {
            updateHeaderFromInput(); // Ensure title matches
            const raw = window.generateRawFromVisual();
            hiddenCode.value = raw;
            
            // Immediate autosave to prevent data loss
            if(raw.length > 10) {
                localStorage.setItem('quiz_autosave_draft', raw);
            } else {
                localStorage.removeItem('quiz_autosave_draft');
            }
        }
    });

    // Helper to update visualState header when title input changes
    function updateHeaderFromInput() {
        const val = document.getElementById('visual-title').value;
        if(window.visualState.header.includes('title:')) {
            window.visualState.header = window.visualState.header.replace(/title:.*\n?/i, `title: ${val}\n`);
        } else {
            window.visualState.header = `title: ${val}\n` + window.visualState.header;
        }
    }
    
    // Explicit listener for Title input
    if(titleInput) {
        titleInput.addEventListener('input', () => {
            updateHeaderFromInput();
            const raw = window.generateRawFromVisual();
            hiddenCode.value = raw;
            
            if(raw.length > 10) {
                localStorage.setItem('quiz_autosave_draft', raw);
            }
        });
    }

    // 5. Save Button
    const saveBtn = document.getElementById('saveBtn');
    if(saveBtn) {
        saveBtn.addEventListener('click', () => {
            // Force sync before save
            updateHeaderFromInput();
            hiddenCode.value = window.generateRawFromVisual();
            
            // Call storage.js function
            if(window.saveQuiz) {
                window.saveQuiz();
            } else {
                alert("Error: Save function not found. Please reload.");
            }
        });
    }

    // 6. Auto-Save Draft (Every 5 seconds fallback)
    setInterval(() => {
        const raw = hiddenCode.value;
        if(raw && raw.length > 10) {
            localStorage.setItem('quiz_autosave_draft', raw);
        }
    }, 5000);
    
    // Toolbar spacing
    const toolbar = document.querySelector('.sticky-toolbar');
    const contentArea = document.querySelector('.builder-canvas');
    
    if (toolbar && contentArea) {
        // Calculate toolbar height and add margin
        const toolbarHeight = toolbar.offsetHeight;
        contentArea.style.marginTop = toolbarHeight + 20 + 'px';
        
        window.addEventListener('resize', function() {
            const newHeight = toolbar.offsetHeight;
            contentArea.style.marginTop = newHeight + 20 + 'px';
        });
    }
});
