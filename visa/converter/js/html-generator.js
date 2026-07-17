/**
 * html-generator.js
 * Bundles the Quizdown content, CSS, and JS into a single HTML string.
 * 
 * Updated: Fetches files from the 'quiz' folder structure.
 * Context: This script is loaded by index.html, so paths are relative to root.
 */

// Variable to cache the fetched assets (CSS strings and JS string)
let assetsPromise = null;

// DEFINITION: The list of CSS files to merge
// Updated paths to point to 'quiz/css' folder
const CSS_FILES = [
  './quiz/css/base.css',
  './quiz/css/sidebar.css',
  './quiz/css/layout.css',
  './quiz/css/content.css'
];

/**
 * Helper: Simple HTML escaper for the <title> tag
 */
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Helper: Generic fetch wrapper to get text content
 */
async function fetchAsset(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Helper: Loads all external CSS files and the JS file once.
 * Returns a Promise that resolves to [mergedCssString, jsString].
 */
function loadAssets() {
  if (!assetsPromise) {
    // 1. Create an array of promises for the CSS files
    const cssPromises = CSS_FILES.map(file => fetchAsset(file));
    
    // 2. Create a promise for the JS file (Now located in quiz/js/)
    const jsPromise = fetchAsset('./quiz/js/script.js');

    // 3. Wait for ALL promises (CSS + JS) to resolve
    assetsPromise = Promise.all([...cssPromises, jsPromise])
      .then(results => {
        // The last result is the JS content
        const jsContent = results.pop();
        
        // The remaining results are the CSS files, in order. Join them.
        const cssContent = results.join('\n\n/* --- END OF FILE --- */\n\n');
        
        return [cssContent, jsContent];
      })
      .catch((err) => {
        console.error("Error loading quiz assets:", err);
        // Reset cache so user can try again
        assetsPromise = null; 
        throw err;
      });
  }
  return assetsPromise;
}

/**
 * Helper: Finds title value ignoring case
 */
function extractTitleFromFrontMatter(text) {
  const headerMatch = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (headerMatch) {
    const headerText = headerMatch[1];
    const lines = headerText.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > -1) {
        const key = line.slice(0, colonIndex).trim();
        if (key.toLowerCase() === 'title') {
          return line.slice(colonIndex + 1).trim();
        }
      }
    }
  }
  return null;
}

/**
 * Helper: Strips point values from #Q markers
 */
function preprocessQuizdownContent(content) {
  return content.replace(/#Q:\s*\d+\s*/gi, '#Q ');
}

/**
 * Helper: Constructs the final HTML string.
 */
async function createFullHtml(quizTitle, quizBody, lang = 'en') {
  try {
    // Wait for assets to load (or pull from cache)
    const [cssContent, jsContent] = await loadAssets();
    const safeTitle = escapeHtml(quizTitle);

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <title>${safeTitle}</title>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  
  <!-- Fonts: Fira Code -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">

  <!-- MathJax 4 Configuration -->
  <script>
    window.MathJax = {
      loader: { load: ['input/tex', 'output/chtml', 'ui/menu'] },
      tex: {
        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
        processEscapes: true,
        packages: {'[+]': ['noerrors', 'action']}
      },
      chtml: {
        matchFontHeight: false,
        scale: 1,
        minScale: 0.5,
        // FIX: Disabled automatic linebreaks to force scrolling behavior
        linebreaks: {
          automatic: false 
        }
      },
      startup: {
        ready: () => {
          MathJax.startup.defaultReady();
        }
      }
    };
  </script>
  
  <!-- MathJax 4 Library -->
  <script src="https://cdn.jsdelivr.net/npm/mathjax@4/tex-chtml.js"></script>
  
  <style>
${cssContent}
  </style>
</head>

<body>
${quizBody}
  <script>
    const quizLang = '${lang}';
  <\/script>
  <script>
${jsContent}
  </script>
</body>
</html>`;

  } catch (error) {
    console.error("Failed to build HTML structure:", error);
    alert("Error: Could not load CSS or JS assets. Please check console for details.");
    return null;
  }
}

/**
 * Main Function called by ui.js
 */
async function generateQuizHtml(lang = 'en') {
  const codeElement = document.getElementById("quizdownCode");
  
  if (!codeElement) {
    console.error("Element #quizdownCode not found.");
    return null;
  }

  let quizdownContent = codeElement.value;
  
  if (!quizdownContent || !quizdownContent.trim()) {
    return null;
  }
  
  try {
    quizdownContent = preprocessQuizdownContent(quizdownContent);
    const extractedTitle = extractTitleFromFrontMatter(quizdownContent);
    const quizOutput = parseQuizdown(quizdownContent, lang);
    const finalTitle = extractedTitle || quizOutput.title;
    
    return await createFullHtml(finalTitle, quizOutput.body, lang);
    
  } catch (error) {
    console.error("Error generating quiz HTML:", error);
    return null;
  }
}