// visa-main/app/js/latex-generator.js
/**
 * latex-generator.js
 * Converts Quizdown‑formatted text into a self‑contained, compilable
 * LaTeX document.  The one‑column, serif, black‑link baseline
 * (columns=one, font=serif, linkcolor=black) is hard‑coded – no
 * external preamble.cls is needed.
 *
 * Compact (two‑column) mode is still supported via the isCompact
 * parameter; its settings are also fully embedded.
 */

(function (global) {
  'use strict';

  // --- 1. Constants & Regex ---
  const SPECIAL_LATEX_MAP = [
    ['\\', '\\textbackslash{}'],
    ['&',  '\\&'],
    ['%',  '\\%'],
    ['$',  '\\$'],
    ['#',  '\\#'],
    ['_',  '\\_'],
    ['{',  '\\{'],
    ['}',  '\\}'],
    ['~',  '\\textasciitilde{}'],
    ['^',  '\\textasciicircum{}'],
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

      // Math masking order:
      // 1. Display math with \[...\] (Quizdown standard)
      processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (m, p1) => {
        const token = `PHMATHBLOCK${mathBlocks.length}ENDPH`;
        mathBlocks.push({ token, content: `\\[\n${p1.trim()}\n\\]` });
        return `\n\n${token}\n\n`;
      });

      // 2. Inline math with \(...\) (Quizdown standard)
      processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (m, p1) => {
        const token = `PHMATHINLINE${mathBlocks.length}ENDPH`;
        mathBlocks.push({ token, content: `$${p1.trim()}$` });
        return token;
      });

      // 3. Display math with $$...$$
      processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (m, p1) => {
        const token = `PHMATHBLOCK${mathBlocks.length}ENDPH`;
        mathBlocks.push({ token, content: `\\[\n${p1.trim()}\n\\]` });
        return `\n\n${token}\n\n`;
      });

      // 4. Inline math with $...$
      processed = processed.replace(/\$([^\$\n]+?)\$/g, (m, p1) => {
        const token = `PHMATHINLINE${mathBlocks.length}ENDPH`;
        mathBlocks.push({ token, content: `$${p1.trim()}$` });
        return token;
      });

      // 5. Special Characters & Escaping (applied to non‑math parts)
      processed = processed.replace(/€/g, '{\\EUR}');
      processed = escapeLatex(processed);

      // 6. Markdown Formatting
      processed = processed.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
      processed = processed.replace(/\*([^*]+?)\*/g, '\\textit{$1}');

      // 7. Paragraphs
      const paragraphs = processed.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
      processed = paragraphs.map(p => {
        if (p.startsWith('PHMATHBLOCK')) return p;
        return p.replace(/\n/g, ' \\\\\n');
      }).join('\n\n\\par\\vspace{1ex}\n\n');

      // 8. Restore Math
      mathBlocks.forEach(m => {
        processed = processed.split(m.token).join(m.content);
      });

      return processed;
    }

    function parseMaterialBlock(type, content) {
      const trimmed = content.trim();
      switch (type) {
        case 'code':
          return `\\begin{verbatim}\n${trimmed}\n\\end{verbatim}\n`;

        case 'quote': {
          const lines = trimmed.split('\n');
          let quoteLines = [];
          let attribution = '';
          const attrIdx = lines.findIndex(line => {
            const t = line.trim();
            return t.startsWith('—') || /^(author|by|source|attribution)\s*:/i.test(t);
          });
          if (attrIdx !== -1) {
            const attrLine = lines[attrIdx].trim();
            const prefixMatch = attrLine.match(/^(author|by|source|attribution)\s*:\s*(.*)$/i);
            attribution = prefixMatch ? prefixMatch[2].trim() : attrLine.replace(/^—\s*/, '');
            quoteLines = lines.slice(0, attrIdx);
          } else {
            quoteLines = lines;
          }
          let body = applyLatexFormatting(quoteLines.join('\n').trim());
          if (attribution) {
            body += `\\par\\vspace{0.8em}\\textbf{---} ${escapeLatex(attribution)}`;
          }
          return `\\begin{quote}\n${body}\n\\end{quote}\n`;
        }

        case 'material':
          return `\\begin{quote}\n${applyLatexFormatting(trimmed)}\n\\end{quote}\n`;

        case 'table': {
          const rows = trimmed.split('\n').map(r => r.trim()).filter(Boolean);
          if (rows.length < 2) return '% Invalid table';
          const dataRows = rows.filter(r => !/^\|?\s*:?-+:?\s*\|?/.test(r));
          if (dataRows.length === 0) return '% Invalid table';
          const grid = dataRows.map(r =>
            r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
          );
          const numCols = grid[0].length;
          const colSpec = '|' + 'c|'.repeat(numCols);
          let tab = `\\begin{center}\n\\small\n\\begin{tabular}{${colSpec}}\n\\hline\n`;
          grid.forEach(row => {
            const cells = row.map(c => applyLatexFormatting(c));
            tab += cells.join(' & ') + ' \\\\ \\hline\n';
          });
          tab += '\\end{tabular}\n\\end{center}\n';
          return tab;
        }

        default:
          return `% Unsupported material type: ${escapeLatex(type)}\n`;
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
        else if (current === 'none') {
          current = 'question';
          sections.question.push(line);
        }
      }
      return {
        question: sections.question.join('\n').trim(),
        options: sections.options,
        answer: sections.answer.join('\n').trim(),
        points: sections.points,
      };
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

        // Points string (if any) will be placed after the question body, right-aligned.
        const pointsStr = s.points ? `\\hfill (\\rule{1cm}{0.4pt} / ${escapeLatex(String(s.points))} p.)` : '';
        const qBody = applyLatexFormatting(s.question);

        // NO manual number – let enumerate handle the numbering.
        let qItem = `\\item ${qBody}\n${materialLatex}`;
        if (pointsStr) {
          qItem += `\\par\\vspace{0.5em}${pointsStr}`;
        }
        if (s.options.length > 0) {
          qItem += `\\begin{enumerate}[label=(\\alph*), leftmargin=*]\n`;
          s.options.forEach(opt => qItem += `\\item ${applyLatexFormatting(opt.text)}\n`);
          qItem += `\\end{enumerate}\n`;
        }
        qLatex += qItem;

        // Answer block
        let aContent = '';
        const correctOptIndex = s.options.findIndex(o => o.correct);
        if (correctOptIndex !== -1) {
          const letter = String.fromCharCode(97 + correctOptIndex);
          aContent += `\\textbf{(${letter})} ${applyLatexFormatting(s.options[correctOptIndex].text)}\\\\[0.5em]\n`;
        }
        if (s.answer) aContent += applyLatexFormatting(s.answer);
        aLatex += `\\item ${aContent}\n`;
      } catch (e) {
        console.error('Parse error in question', i + 1, e);
        qLatex += `\\item Error parsing question ${i + 1}.\n`;
      }
    });

    return { questions: qLatex, answers: aLatex, frontMatter };
  };

  // --- 4. Stand‑alone LaTeX Document Builder ---
  // Hardcodes the one‑column, serif, black‑link baseline (from preamble.cls)
  // so that no external class file is required.
  const generateLatexDocument = (content = '', includeAnswers = false, lang = 'en', isCompact = false) => {
    if (!content.trim()) return null;
    const parsed = parseQuizdownToLatex(content);
    const title = findTitleValue(parsed.frontMatter) || 'Quiz';

    const labels = {
      en: { q: 'Questions', a: 'Answer Key', name: 'Name', id: 'ID', date: 'Date' },
      fi: { q: 'Kysymykset', a: 'Vastaukset', name: 'Nimi', id: 'Op.nro', date: 'Päivämäärä' }
    }[lang] || labels.en;

    // ---------- Common packages and settings ----------
    const commonPreamble = `
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
${lang === 'fi' ? '\\usepackage[finnish]{babel}' : ''}
\\usepackage{amsmath,amssymb}
\\usepackage{microtype}
\\usepackage{setspace}
\\usepackage{geometry}
\\usepackage{fancyhdr}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{booktabs}
\\usepackage[font=small,labelfont={bf},labelsep=period,skip=6pt]{caption}
\\usepackage{xcolor}
\\definecolor{wikiblue}{RGB}{0,0,0}
\\usepackage[colorlinks=true,
            linkcolor=wikiblue,
            citecolor=wikiblue,
            urlcolor=wikiblue,
            pdfborder={0 0 0}]{hyperref}
\\usepackage{footmisc}
\\usepackage{graphicx}

% ----- footnotes -----
\\renewcommand{\\footnoterule}{\\kern -3pt \\hrule width \\columnwidth height 0.4pt \\kern 2.6pt}
\\addtolength{\\skip\\footins}{10pt}
\\renewcommand{\\footnotesep}{8pt}

% ----- section titles -----
\\titleformat{\\section}
  {\\bfseries\\normalsize\\raggedright}
  {\\thesection.}{0.5em}{}
\\titleformat{\\subsection}
  {\\bfseries\\normalsize\\raggedright}
  {\\thesubsection.}{0.5em}{}
\\titleformat{\\subsubsection}
  {\\bfseries\\normalsize\\raggedright}
  {\\thesubsubsection.}{0.5em}{}
\\titlespacing*{\\section}{5pt}{6pt}{2pt}
\\titlespacing*{\\subsection}{5pt}{4pt}{1pt}
\\titlespacing*{\\subsubsection}{5pt}{3pt}{0pt}

% ----- lists -----
\\setlist{nosep, labelindent=0pt}

% ----- custom maketitle (from preamble.cls) -----
\\makeatletter
\\def\\@maketitle{%
  \\newpage
  \\null
  \\vspace{-2em}%
  \\begin{center}%
  \\let \\footnote \\thanks
    {\\large \\textbf{\\@title} \\par}%
    \\vskip 0.5em%
    {\\small
      \\lineskip .5em%
      \\begin{tabular}[t]{c}%
        \\@author
      \\end{tabular}\\par}%
    \\vskip 0.5em%
    {\\small \\@date}%
  \\end{center}%
  \\par
  \\vskip 1em}
\\makeatother

\\renewcommand{\\UrlFont}{\\normalfont}
`;

    // ---------- Mode‑specific preamble and header ----------
    let docStart, docPreamble, docHeader;

    if (isCompact) {
      // --- Compact (two‑column) ---
      docStart = '\\documentclass[10pt,a4paper,twocolumn,fleqn]{article}';
      docPreamble = `
${commonPreamble}
\\usepackage{flushend}
\\geometry{margin=2cm, includehead, headheight=15pt, headsep=5pt}
\\setlength{\\columnsep}{10pt}
\\setstretch{0.9}
\\setlength{\\parindent}{1em}
\\setlength{\\parskip}{0pt}
\\microtypesetup{protrusion=true, expansion=true}
\\usepackage[lining,scosf]{newtxtext}
\\usepackage{newtxmath}
\\newcommand{\\pagenumstyle}{\\liningnums{\\thepage}}
\\fancyhf{}
\\fancyhead[L]{\\normalfont\\scshape{${escapeLatex(title)}}}
\\fancyhead[R]{\\normalfont\\pagenumstyle}
\\pagestyle{fancy}
`;
      docHeader = `
\\twocolumn[{
  \\centering
  {\\LARGE\\bfseries ${escapeLatex(title)} \\par}
  \\vspace{0.8em}
  \\noindent
  \\textbf{${labels.name}:} \\hrulefill \\hspace{1em} 
  \\textbf{${labels.id}:} \\hrulefill \\hspace{1em} 
  \\textbf{${labels.date}:} \\hrulefill
  \\vspace{1cm}
}]
`;
    } else {
      // --- One‑column, serif, black‑link baseline ---
      docStart = '\\documentclass[12pt,a4paper]{article}';
      docPreamble = `
${commonPreamble}
\\geometry{top=2.5cm, bottom=2.5cm, left=3cm, right=3cm,
          includehead, headheight=15pt, headsep=10pt}
\\onehalfspacing
\\setlength{\\parskip}{0.5\\baselineskip}
\\setlength{\\parindent}{0pt}
\\raggedright
\\hyphenpenalty=10000
\\exhyphenpenalty=10000
\\tolerance=10000
\\hbadness=10000
\\setlength{\\emergencystretch}{3em}
\\microtypesetup{protrusion=true, expansion=true, tracking=false}
\\usepackage[lining,scosf]{newtxtext}
\\usepackage{newtxmath}
\\newcommand{\\pagenumstyle}{\\liningnums{\\thepage}}
\\fancyhf{}
\\fancyhead[L]{\\normalfont\\scshape{${escapeLatex(title)}}}
\\fancyhead[R]{\\normalfont\\pagenumstyle}
\\pagestyle{fancy}
`;
      docHeader = `
\\title{${escapeLatex(title)}}
\\author{}
\\date{}
\\maketitle
\\noindent
\\textbf{${labels.name}:} \\hrulefill \\hspace{1em} 
\\textbf{${labels.date}:} \\hrulefill \\hspace{1em} 
\\textbf{${labels.id}:} \\hrulefill
\\vspace{1cm}
`;
    }

    // ---------- Assemble the full document ----------
    return `${docStart}
${docPreamble}

\\begin{document}
\\thispagestyle{plain}

${docHeader}

\\section*{${labels.q}}
\\begin{enumerate}[leftmargin=*]
${parsed.questions}
\\end{enumerate}

${includeAnswers ? `
\\newpage
\\section*{${labels.a}}
\\begin{enumerate}[leftmargin=*]
${parsed.answers}
\\end{enumerate}
` : ''}
\\end{document}`;
  };

  // Expose API
  global.LatexGenerator = { generateLatexDocument };

})(window);
