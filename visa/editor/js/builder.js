/* builder.js */

document.addEventListener('DOMContentLoaded', () => {
    
    // Elements
    const titleInput = document.getElementById('visual-title');
    const hiddenCode = document.getElementById('quizdownCode'); 

    // 1. Initialization Logic
    if(window.visualState.questions.length === 0 && !window.visualState.header) {
        // Default state
        window.visualState = {
            header: "title: My New Quiz\n",
            questions: []
        };
        // If no questions, add one empty one
        window.visualAddQuestion(); 
    }

    // Initial Render
    if(window.renderVisualEditor) {
        window.renderVisualEditor();
    }

    // 2. Load from URL (if opened from index.html)
    const urlParams = new URLSearchParams(window.location.search);
    // const encodedQuiz = urlParams.get('quiz');
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
                if (decoded) {
                    window.parseRawToVisual(decoded);
                    window.renderVisualEditor();
                    hiddenCode.value = decoded;
                }
            }
        } catch (e) {
            console.error("Failed to load quiz from URL", e);
        }
    }

    // 3. SYNCHRONIZATION: Visual -> Hidden Textarea
    // We listen to changes on the BODY to catch all inputs bubbling up
    document.body.addEventListener('input', (e) => {
        // Only trigger if interaction happens in the visual container or title
        if(e.target.closest('.builder-canvas')) {
            updateHeaderFromInput(); // Ensure title matches
            const raw = window.generateRawFromVisual();
            hiddenCode.value = raw;
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
            hiddenCode.value = window.generateRawFromVisual();
        });
    }

    // 4. Save Button
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

    // 5. Auto-Save Draft (Every 10 seconds)
    setInterval(() => {
        const raw = hiddenCode.value;
        if(raw.length > 10) {
            localStorage.setItem('quiz_autosave_draft', raw);
        }
    }, 10000);

    // Check for autosave on load if empty
    if(!encodedQuiz && localStorage.getItem('quiz_autosave_draft')) {
        // Optional: you could ask user if they want to restore
        // For now, we ignore to not annoy them, but the data is safe.
    }
    
    // Add this to your builder.js or a script tag
    document.addEventListener('DOMContentLoaded', function() {
    const toolbar = document.querySelector('.sticky-toolbar');
    const contentArea = document.querySelector('.builder-canvas');
    
    if (toolbar && contentArea) {
        // Calculate toolbar height and add margin
        const toolbarHeight = toolbar.offsetHeight;
        contentArea.style.marginTop = toolbarHeight + 20 + 'px';
        
        // Optional: handle window resize
        window.addEventListener('resize', function() {
            const newHeight = toolbar.offsetHeight;
            contentArea.style.marginTop = newHeight + 20 + 'px';
        });
    }
});
});