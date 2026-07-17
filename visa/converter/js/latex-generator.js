/**
 * latex-generator.js
 * Purpose: Converts Quizdown-formatted text into a compile-ready LaTeX document.
 * 
 * FIXES: 
 * - Fixed CRITICAL crash in \twocolumn header by replacing fragile 'center' env with \centering.
 * - Wrapped \twocolumn content in braces {} to protect against parsing errors.
 * - Removed fragile \\[0.5em] in header, replaced with robust \par\vspace.
 * - Kept strict B&W styling and Compact Mode sizing logic.
 */

(function (global) {
  'use strict';

  // --- 1. Constants & Regex ---
  const SPECIAL_LATEX_MAP = [
    ['\\', '\\textbackslash{}'], 
    ['&', '\\&'], 
    ['%', '\\%'], 
    ['$', '\\$'], 
    ['#', '\\#'], 
    ['_', '\\_'], 
    ['{', '\\{'], 
    ['}', '\\}'], 
    ['~', '\\textasciitilde{}'], 
    ['^', '\\textasciicircum{}'],
  ];

  const ESCAPE_REGEX = new RegExp(
    SPECIAL_LATEX_MAP.map(([k]) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 
    'g'
  );

  // --- 2. Helpers ---
  const escapeLatex = (text = '') => {
    if (!text) return '';
    return text.replace(ESCAPE_REGEX, match => {
      const entry = SPECIAL_LATEX_MAP.find(([k]) => k === match);
      return entry ? entry[1] : match;
    });
  };

  const findTitleValue = frontMatter => {
    if (!frontMatter || typeof frontMatter !== 'object') return null;
    const titleKey = Object.keys(frontMatter).find(k => k.toLowerCase() === 'title');
    return titleKey ? frontMatter[titleKey] : null;
  };

  // --- 3. Core Parsing Logic ---
  const parseQuizdownToLatex = (text = '') => {
    
    function applyLatexFormatting(str) {
      if (!str) return '';
      const mathBlocks = [];
      let processed = str;

      // 1. Extract Display Math 
      processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (m, p1) => {
        const token = `PHMATHBLOCK${mathBlocks.length}ENDPH`; 
        const mathContent = p1.trim().replace(/\n/g, ' \\\\\n');
        mathBlocks.push({ token, content: `\\begin{gather*}\n${mathContent}\n\\end{gather*}` });
        return `\n\n${token}\n\n`;
      });

      // 2. Extract Inline Math
      processed = processed.replace(/\$([^\$\n]+?)\$/g, (m, p1) => {
        const token = `PHMATHINLINE${mathBlocks.length}ENDPH`;
        mathBlocks.push({ token, content: `$${p1.trim()}$` });
        return token;
      });

      // 3. Special Characters & Escaping
      processed = processed.replace(/€/g, '{\\EUR}');
      processed = escapeLatex(processed);

      // 4. Markdown Formatting
      processed = processed.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
      processed = processed.replace(/\*([^*]+?)\*/g, '\\textit{$1}');

      // 5. Paragraphs
      const paragraphs = processed.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      const mapped = paragraphs.map(p => {
        if (p.startsWith('PHMATHBLOCK')) return p;
        return p.replace(/\n/g, ' \\\\\n');
      });
      processed = mapped.join('@@PARAGRAPHBREAK@@');

      // 6. Restore Math
      mathBlocks.forEach(m => {
        processed = processed.split(m.token).join(m.content);
      });

      // 7. Formatting Fixes
      processed = processed
        .replace(/(\\end\{gather\*\})@@PARAGRAPHBREAK@@(\\begin\{gather\*\})/g, '$1\n$2')
        .replace(/(\\end\{gather\*\})@@PARAGRAPHBREAK@@/g, '$1\\par\\vspace{-0.5ex}\n')
        .replace(/@@PARAGRAPHBREAK@@(\\begin\{gather\*\})/g, '\\par\\vspace{-1ex}\n$1')
        .replace(/@@PARAGRAPHBREAK@@/g, '\\par\\vspace{1ex}\n\n');

      return processed;
    }

    function parseMaterialBlock(type, content) {
      const trimmed = content.replace(/^\n+|\n+$/g, '');
      switch (type) {
        case 'code':
          return `\\begin{tcolorbox}[colback=white, colframe=black, boxrule=0.5pt, sharp corners]\n\\begin{Verbatim}[breaklines=true, fontsize=\\small]\n${trimmed}\n\\end{Verbatim}\n\\end{tcolorbox}\n`;
        
        case 'quote': {
          const parts = trimmed.split(/\n[—-]{1,2}\s*/);
          let quoteContent = applyLatexFormatting(parts[0].trim());
          if (parts.length > 1) {
            quoteContent += `\\par\\vspace{0.8em}\\textbf{---} ${applyLatexFormatting(parts.slice(1).join(' '))}`;
          }
          return `\\begin{tcolorbox}[colback=white, colframe=black, boxrule=0.5pt, sharp corners]\n${quoteContent}\n\\end{tcolorbox}\n`;
        }
        
        case 'material':
          return `\\begin{tcolorbox}[colback=white, colframe=black, boxrule=0.5pt, sharp corners]\n${applyLatexFormatting(trimmed)}\n\\end{tcolorbox}\n`;
        
        case 'table': {
          const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
          if (lines.length < 2) return '% Invalid table';
          const splitRow = row => row.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
          const header = splitRow(lines[0]);
          let bodyLines = lines.slice(1);
          if (/^[:\-\s|]+$/.test(lines[1])) bodyLines = lines.slice(2);
          const body = bodyLines.map(splitRow);
          const colspec = header.map(() => 'X[c,m]').join(' | ');
          
          let table = `\\begin{center}\n\\small\\begin{tblr}{\n  width=\\linewidth,\n  colspec={ ${colspec} },\n  row{1} = {font=\\bfseries, c, m},\n  hlines,\n  vlines,\n}\n`;
          table += header.map(h => applyLatexFormatting(h)).join(' & ') + ' \\\\\n';
          body.forEach(row => table += row.map(d => applyLatexFormatting(d)).join(' & ') + ' \\\\\n');
          table += '\\end{tblr}\n\\end{center}\n';
          return table;
        }
        
        default: return `\\begin{tcolorbox}[title=${escapeLatex(type)}, colback=white, colframe=black]${trimmed}\\end{tcolorbox}`;
      }
    }

    function splitBlockIntoSections(block) {
      const lines = block.replace(/\r/g, '').split('\n');
      const sections = { question: [], options: [], answer: [], points: null };
      let current = 'none';

      for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          if (current === 'question') sections.question.push('');
          if (current === 'answer') sections.answer.push('');
          continue;
        }
        const qMatch = line.match(/^#Q(?::\s*(\d+))?\s*(.*)$/i);
        if (qMatch) {
          current = 'question';
          if (qMatch[1]) sections.points = qMatch[1];
          if (qMatch[2]) sections.question.push(qMatch[2].trim());
          continue;
        }
        const aMatch = line.match(/^#A\b(.*)$/i);
        if (aMatch) {
          current = 'answer';
          if (aMatch[1]) sections.answer.push(aMatch[1].trim());
          continue;
        }
        if (line.startsWith('//')) continue;
        const optMatch = line.match(/^\s*-\s*\[\s*([xX]?)\s*\]\s*(.*)$/);
        if (optMatch) {
          current = 'options';
          sections.options.push({ correct: !!optMatch[1], text: optMatch[2].trim() });
          continue;
        }
        if (current === 'question') sections.question.push(line);
        else if (current === 'answer') sections.answer.push(line);
        else if (current === 'none') { current = 'question'; sections.question.push(line); }
      }
      return { question: sections.question.join('\n').trim(), options: sections.options, answer: sections.answer.join('\n').trim(), points: sections.points };
    }

    const frontMatter = {};
    let contentBody = text;
    const headerMatch = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (headerMatch) {
      contentBody = text.slice(headerMatch[0].length);
      headerMatch[1].split('\n').forEach(line => {
        const idx = line.indexOf(':');
        if (idx > -1) frontMatter[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
      });
    }

    const blocks = contentBody.split(/^\s*---\s*$/m).map(b => b.trim()).filter(Boolean);
    let qLatex = '', aLatex = '';

    blocks.forEach((block, i) => {
      try {
        let materialLatex = '';
        const cleanBlock = block.replace(/\[(code|quote|table|material|plot)\]\s*([\s\S]*?)\s*\[\/\1\]/gi, (m, type, content) => {
          materialLatex += parseMaterialBlock(type.toLowerCase(), content);
          return '';
        });
        const s = splitBlockIntoSections(cleanBlock);
        const pointsStr = s.points ? `\\hfill (\\rule{1cm}{0.4pt} / ${escapeLatex(String(s.points))} p.)` : '';
        const qHeader = `\\textbf{\\large ${i + 1}.}${pointsStr}`;
        const qBody = applyLatexFormatting(s.question);
        
        let qItem = `\\item\n\\begin{minipage}[t]{\\linewidth}\n${qHeader} \\\\ \n${qBody}\\par\n${materialLatex}`;
        if (s.options.length > 0) {
          qItem += `\\begin{enumerate}[label=(\\alph*)]\n`;
          s.options.forEach(opt => qItem += `\\item ${applyLatexFormatting(opt.text)}\n`);
          qItem += `\\end{enumerate}\n`;
        }
        qItem += `\\end{minipage}\n`;
        qLatex += qItem;

        let aContent = '';
        const correctOptIndex = s.options.findIndex(o => o.correct);
        if (correctOptIndex !== -1) {
            const letter = String.fromCharCode(97 + correctOptIndex);
            aContent += `\\textbf{(${letter})} ${applyLatexFormatting(s.options[correctOptIndex].text)}\\\\[0.5em]\n`;
        }
        if (s.answer) aContent += applyLatexFormatting(s.answer);
        aLatex += `\\item\n\\textbf{\\large ${i + 1}.} \\\\\n${aContent}\n`;
      } catch (e) { console.error("Parse error", e); qLatex += `\\item Error parsing question ${i+1}`; }
    });
    return { questions: qLatex, answers: aLatex, frontMatter };
  };

  // --- 4. LaTeX Template ---
  const generateLatexDocument = (content = '', includeAnswers = false, lang = 'en', isCompact = false) => {
    if (!content.trim()) return null;
    const parsed = parseQuizdownToLatex(content);
    const title = findTitleValue(parsed.frontMatter) || 'Quiz';
    const labels = {
        en: { q: 'Questions', a: 'Answer Key', name: 'Name', id: 'ID', date: 'Date' },
        fi: { q: 'Kysymykset', a: 'Vastaukset', name: 'Nimi', id: 'Op.nro', date: 'Päivämäärä' }
    }[lang] || labels.en;
    const babel = lang === 'fi' ? '\\usepackage[finnish]{babel}' : '';

    const docClass = isCompact 
        ? '\\documentclass[10pt, a4paper, twocolumn, fleqn]{article}' 
        : '\\documentclass[12pt, a4paper, fleqn]{article}';
    
    const margin = isCompact ? '0.5in' : '1in';
    const parskip = isCompact ? '0.4em' : '0.8em';

    // Header Construction
    // CRITICAL FIX: Wrapped in braces {}, used \centering instead of environment to prevent fragility
    let documentHeader = '';
    
    if (isCompact) {
        documentHeader = `
\\twocolumn[{
  \\centering
  {\\Large\\bfseries ${escapeLatex(title)} \\par}
  \\vspace{0.8em}
  \\noindent
  \\textbf{${labels.name}:} \\hrulefill \\hspace{1em} 
  \\textbf{${labels.id}:} \\rule{3cm}{0.4pt} \\hspace{1em} 
  \\textbf{${labels.date}:} \\rule{3cm}{0.4pt}
  \\vspace{1cm}
}]
`;
    } else {
        documentHeader = `
\\begin{center}
    {\\Huge\\bfseries ${escapeLatex(title)}}\\\\[1cm]
\\end{center}
\\noindent
\\begin{tabularx}{\\textwidth}{@{}l X l X@{}}
\\textbf{${labels.name}:} & \\hrulefill & \\textbf{${labels.date}:} & \\hrulefill \\\\[2em]
\\textbf{${labels.id}:} & \\hrulefill & & \\\\
\\end{tabularx}
\\vspace{1cm}
`;
    }

    return `${docClass}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
${babel}
\\usepackage{lmodern}
\\usepackage{amsmath, amsfonts, amssymb}
\\usepackage{geometry}
\\usepackage{enumitem}
\\usepackage{fancyhdr}
\\usepackage{tabularx}
\\usepackage{tabularray}
\\usepackage{tcolorbox}
\\usepackage{fancyvrb}
\\usepackage{fvextra}
\\usepackage{marvosym}
\\geometry{a4paper, margin=${margin}}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{${parskip}}
\\setlength{\\mathindent}{0pt}
\\pagestyle{fancy}
\\fancyhf{}
\\lhead{${escapeLatex(title)}}
\\rhead{\\thepage}
\\setlist[enumerate,1]{label=, leftmargin=0pt, itemsep=2em} 
\\setlist[enumerate,2]{label=(\\alph*), leftmargin=*, itemsep=0.5em}

\\begin{document}
\\thispagestyle{plain}

${documentHeader}
\\section*{${labels.q}}
\\begin{enumerate}
${parsed.questions}
\\end{enumerate}
${includeAnswers ? `
\\newpage
\\section*{${labels.a}}
\\begin{enumerate}
${parsed.answers}
\\end{enumerate}
` : ''}
\\end{document}`;
  };

  // Expose API
  global.LatexGenerator = { generateLatexDocument };

})(window);