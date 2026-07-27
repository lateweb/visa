// app/js/quiz-parser.js

// Utility function to shuffle an array in place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// The main parser function, now with language support and exam mode
function parseQuizdown(text, lang = 'en', examMode = false) {
  text = text.replace(/\r\n/g, '\n');
  let quizTitle = "Generated Quiz";
  let questionText = text;

  // Translations for user-facing text
  const translations = {
    check: { en: 'Check', fi: 'Tarkista' },
    showHide: { en: 'Show/Hide', fi: 'Näytä/Piilota' }
  };

  // 1. Header Parsing
  if (text.startsWith('---\n')) {
    const endOfHeaderIndex = text.indexOf('\n---\n');
    if (endOfHeaderIndex > 0) {
      const headerText = text.substring(4, endOfHeaderIndex);
      questionText = text.substring(endOfHeaderIndex + 5);
      headerText.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join(':').trim();
          if (key.toLowerCase() === 'title') quizTitle = value;
        }
      });
    }
  }

  // Split into blocks
  const questionBlocks = questionText.split(/\n---\n/).filter(block => block.trim() !== '');

  const questionsHtml = questionBlocks.map((block, index) => {
    // Scope math stash per question
    let mathStash = [];

    // Helper: Mask Math (Protects pipes | and formatting chars)
    function maskMath(str) {
      if (!str) return '';
      // 1. Extract display math with \[...\]
      str = str.replace(/\\\[([\s\S]*?)\\\]/g, (match, p1) => {
        const token = `@@MATH_D_${mathStash.length}@@`;
        mathStash.push({ token, content: `<div class="math-scroll">\\[${p1}\\]</div>` });
        return token;
      });
      // 2. Extract display math with $$...$$
      str = str.replace(/\$\$([\s\S]*?)\$\$/g, (match, p1) => {
        const token = `@@MATH_D_${mathStash.length}@@`;
        mathStash.push({ token, content: `<div class="math-scroll">$$${p1}$$</div>` });
        return token;
      });
      // 3. Extract inline math with \(...\)
      str = str.replace(/\\\(([\s\S]*?)\\\)/g, (match, p1) => {
        const token = `@@MATH_I_${mathStash.length}@@`;
        mathStash.push({ token, content: `<span class="math-inline">\\(${p1}\\)</span>` });
        return token;
      });
      // 4. Extract inline math with $...$
      str = str.replace(/\$([^\$\n]+?)\$/g, (match, p1) => {
        const token = `@@MATH_I_${mathStash.length}@@`;
        mathStash.push({ token, content: `<span class="math-inline">$${p1}$</span>` });
        return token;
      });
      return str;
    }

    // Helper: Apply Formatting + Restore Math & Code
    function applyFormatting(str) {
      if (!str) return '';
      
      // 1. Mask inline code BEFORE math (so math inside backticks renders as raw code)
      str = str.replace(/`([^`]+)`/g, (match, p1) => {
        const token = `@@CODE_I_${mathStash.length}@@`;
        mathStash.push({ token, content: `<code class="backtick">${p1.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>` });
        return token;
      });
      
      // 2. Mask Math
      str = maskMath(str);
      
      // 3. Apply Markdown text styling
      str = str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      str = str.replace(/\*([^\*]+?)\*/g, '<i>$1</i>');
      
      // 4. Unmask everything
      mathStash.forEach(m => {
        str = str.split(m.token).join(m.content);
      });
      return str;
    }

    // Helper: Format Paragraphs
    function formatParagraphs(txt) {
      if (!txt) return '';
      return txt.split(/\n\s*\n/).filter(p => p.trim()).map(p => {
        const processed = applyFormatting(p.replace(/\n/g, '<br>'));
        const segments = processed
          .split(/(<div class="math-scroll">[\s\S]*?<\/div>)/g)
          .filter(Boolean);

        return segments.map(segment => {
          if (segment.startsWith('<div class="math-scroll">')) {
            return segment;
          }

          let trimmed = segment.trim();
          // Remove stray <br> tags injected directly before or after display math
          trimmed = trimmed.replace(/^(?:<br\s*\/?>|\s)+/gi, '');
          trimmed = trimmed.replace(/(?:<br\s*\/?>|\s)+$/gi, '');
          
          if (!trimmed) return '';
          return `<p class="content-text">${trimmed}</p>`;
        }).join('');
      }).join('');
    }

    // Helper: Interleave materials into formatted text
    function interleaveMaterials(text, materialList) {
      if (!text) return '';
      if (materialList.length === 0) {
        return formatParagraphs(text);
      }
      const tokenPattern = new RegExp(`(${materialList.map(m => m.token).join('|')})`, 'g');
      const parts = text.split(tokenPattern);
      let out = '';
      parts.forEach(part => {
        if (!part) return;
        const material = materialList.find(m => m.token === part);
        if (material) {
          out += material.html;
        } else {
          out += formatParagraphs(part);
        }
      });
      return out;
    }

    try {
      block = block.split('\n').filter(line => !line.trim().startsWith('//')).join('\n').trim();
      const qNum = index + 1;

      // PARSE MATERIALS – store html in list, replace with tokens
      let materialList = [];
      block = block.replace(/\[(code(?::[a-zA-Z0-9_-]+)?|quote|table|material|plot)\]\n?([\s\S]*?)\n?\[\/(?:code|quote|table|material|plot)\]/gi, (match, typeRaw, content) => {
        content = content.trim();
        let materialHtml = '';
        
        let type = typeRaw.toLowerCase();
        let codeLang = 'text';

        if (type.startsWith('code')) {
            const parts = type.split(':');
            type = 'code';
            if (parts.length > 1) {
                codeLang = parts[1];
            }
        }

        if (type === 'code') {
          materialHtml = `<div class="material-box code-box">
            <div class="code-header">
              <span class="code-lang">${codeLang}</span>
              <button class="copy-code-btn" aria-label="Copy code" title="Copy code">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              </button>
            </div>
            <pre><code class="language-${codeLang}">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
          </div>`;
        } 
        else if (type === 'table') {
          const protectedContent = maskMath(content);
          const rows = protectedContent.split('\n').map(r => r.trim().slice(1, -1).split('|').map(c => c.trim()));
          const header = rows[0];
          const body = rows.slice(2);
          
          const tableHtml = `<table class="data-table"><thead><tr>${
            header.map(h => `<th>${applyFormatting(h)}</th>`).join('')
          }</tr></thead><tbody>${
            body.map(r => `<tr>${r.map(d => `<td>${applyFormatting(d)}</td>`).join('')}</tr>`).join('')
          }</tbody></table>`;
          
          materialHtml = `<div class="material-box single-table-box">${tableHtml}</div>`;
        } 
        else if (type === 'quote') {
           const lines = content.split('\n');
           let quoteTextLines = [];
           let attribution = '';
           const attributionIndex = lines.findIndex(line => {
             const trimmed = line.trim();
             return trimmed.startsWith('—') || /^(author|by|source|attribution)\s*:/i.test(trimmed);
           });
           if (attributionIndex !== -1) {
              const attributionLine = lines[attributionIndex].trim();
              const prefixMatch = attributionLine.match(/^(author|by|source|attribution)\s*:\s*(.*)$/i);
              if (prefixMatch) {
                attribution = prefixMatch[2].trim();
              } else {
                attribution = attributionLine.replace(/^—\s*/, '');
              }
              if (attributionIndex < lines.length - 1) attribution += ' ' + lines.slice(attributionIndex + 1).join(' ').trim();
              quoteTextLines = lines.slice(0, attributionIndex);
           } else {
              quoteTextLines = lines;
           }
           materialHtml = `<div class="material-box"><figure><blockquote>${formatParagraphs(quoteTextLines.join('\n').trim())}</blockquote>${attribution ? `<figcaption>${applyFormatting(attribution)}</figcaption>` : ''}</figure></div>`;
        } 
        else if (type === 'material') {
          materialHtml = `<div class="material-box">${formatParagraphs(content)}</div>`;
        }

        const token = `@@MATERIAL_${materialList.length}@@`;
        materialList.push({ token, html: materialHtml });
        return token;
      });

      // PARSE Q/A/Options
      const lines = block.trim().split('\n');
      const questionLines = [], options = [], answerLines = [];
      let currentSection = 'none';
      let points = null; // default points

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#Q')) {
          currentSection = 'question';
          const qMatch = trimmedLine.match(/^#Q(?::\s*(\d+))?\s*(.*)$/i);
          if (qMatch) {
            if (qMatch[1]) points = parseInt(qMatch[1], 10);
            if (qMatch[2]) questionLines.push(qMatch[2].trim());
          }
        } else if (trimmedLine.startsWith('- [')) {
          currentSection = 'options';
          options.push({ correct: trimmedLine.startsWith('- [x]'), text: applyFormatting(trimmedLine.substring(5).trim()) });
        } else if (trimmedLine.startsWith('#A')) {
          currentSection = 'answer';
          const text = trimmedLine.substring(2).trim();
          if (text) answerLines.push(text);
        } else if (currentSection === 'question') {
          questionLines.push(line);
        } else if (currentSection === 'answer') {
          answerLines.push(line);
        }
      }

      const questionRaw = questionLines.join('\n').trim();
      const answerRaw = answerLines.join('\n').trim();
      const questionTitle = interleaveMaterials(questionRaw, materialList);
      const answer = answerRaw ? interleaveMaterials(answerRaw, materialList) : '';
      // Default points to 1 if not specified
      const questionPoints = points !== null ? points : 1;

      if (options.length > 2) shuffleArray(options);
      if (!questionTitle) return '';

      const isMcq = options.length > 0;
      const qId = `q${qNum}`;
      const correctAnswerLetter = isMcq ? String.fromCharCode(97 + options.findIndex(opt => opt.correct)) : '';

      let html = `<section class="question-block" id="${qId}" data-points="${questionPoints}" ${isMcq ? `data-correct-answer="${correctAnswerLetter}"` : ''} aria-labelledby="${qId}-title">`;
      html += `<p class="question-number" id="${qId}-number">${qNum}.</p><div class="question-title" id="${qId}-title">${questionTitle}</div>`;

      if (isMcq) {
        html += '<fieldset><div class="options" role="radiogroup">';
        options.forEach((opt, i) => {
          const val = String.fromCharCode(97 + i);
          html += `<label><input type="radio" name="${qId}" value="${val}"> <span>${opt.text}</span></label>`;
        });
        html += `</div></fieldset>`;
        if (!examMode) {
          html += `<button class="check-button" aria-controls="${qId}-feedback ${qId}-explanation">${translations.check[lang]}</button>`;
        }
        html += `<div class="feedback" id="${qId}-feedback" role="alert" aria-live="polite"></div><div class="explanation" id="${qId}-explanation" aria-live="polite">${answer}</div>`;
      } else {
        if (!examMode) {
          html += `<details><summary>${translations.showHide[lang]}</summary><div class="answer-box">${answer}</div></details>`;
        } else {
          // In exam mode, hide answer until finish
          html += `<div class="answer-box" style="display:none;">${answer}</div>`;
        }
      }
      html += '</section>';
      return html;

    } catch (e) {
      console.error(`Error parsing question block #${index + 1}:`, e);
      return `<section class="question-block error"><p class="question-title"><strong>${index + 1}.</strong> Error parsing this question.</p></section>`;
    }
  }).join('');

  return { title: quizTitle, body: `<h1>${quizTitle}</h1><div class="quiz-section">${questionsHtml}</div>` };
}
