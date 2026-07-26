// app/js/latex-generator.js
/**
 * latex-generator.js
 * Converts Quizdown‑formatted text into a LaTeX document that closely
 * mirrors the one‑column, serif, black‑link style defined in preamble.cls.
 * All previous tcolorbox/fancyvrb/tabularray dependencies are removed;
 * the output relies only on the preamble class and standard LaTeX.
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

  // --- 3. Core Parsing Logic (simplified – standard LaTeX only) ---
  const parseQuizdownToLatex = (text = '') => {

    function applyLatexFormatting(str) {
      if (!str) return '';
      const mathBlocks = [];
      let processed = str;

      // 1. Extract Display Math
      processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (m, p1) => {
        const token = `PHMATHBLOCK${mathBlocks.length}ENDPH`;
        const mathContent = p1.trim();
        mathBlocks.push({ token, content: `\\[\n${mathContent}\n\\]` });
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
      processed = paragraphs.map(p => {
        if (p.startsWith('PHMATHBLOCK')) return p;
        return p.replace(/\n/g, ' \\\\\n');
      }).join('\n\n\\par\\vspace{1ex}\n\n');

      // 6. Restore Math
      mathBlocks.forEach(m => {
        processed = processed.split(m.token).join(m.content);
      });

      return processed;
    }

    function parseMaterialBlock(type, content) {
      const trimmed = content.trim();
      switch (type) {
        case 'code':
          // Use standard verbatim – no extra packages required
          return `\\begin{verbatim}\n${trimmed}\n\\end{verbatim}\n`;

        case 'quote': {
          const lines = trimmed.split('\n');
          let quoteLines = [];
          let attribution = '';
          // Find first line starting with — or attribution keyword
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

          // Remove separator line (e.g. |---|)
          const dataRows = rows.filter(r => !/^\|?\s*:?-+:?\s*\|?/.test(r));
          if (dataRows.length === 0) return '% Invalid table';

          // Split each row by pipes
          const grid = dataRows.map(r =>
            r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim())
          );

          const numCols = grid[0].length;
          const colSpec = '|' + 'c|'.repeat(numCols);
          let tab = `\\begin{center}\n\\small\n\\begin{tabular}{${colSpec}}\n\\hline\n`;
          grid.forEach((row, idx) => {
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
        const pointsStr = s.points ? `\\hfill (\\rule{1cm}{0.4pt} / ${escapeLatex(String(s.points))} p.)` : '';
        const qHeader = `\\textbf{\\large ${i + 1}.}${pointsStr}`;
        const qBody = applyLatexFormatting(s.question);

        let qItem = `\\item ${qHeader}\\par\n${qBody}\n${materialLatex}`;
        if (s.options.length > 0) {
          qItem += `\\begin{enumerate}[label=(\\alph*), leftmargin=*]\n`;
          s.options.forEach(opt => qItem += `\\item ${applyLatexFormatting(opt.text)}\n`);
          qItem += `\\end{enumerate}\n`;
        }
        qLatex += qItem;

        let aContent = '';
        const correctOptIndex = s.options.findIndex(o => o.correct);
        if (correctOptIndex !== -1) {
          const letter = String.fromCharCode(97 + correctOptIndex);
          aContent += `\\textbf{(${letter})} ${applyLatexFormatting(s.options[correctOptIndex].text)}\\\\[0.5em]\n`;
        }
        if (s.answer) aContent += applyLatexFormatting(s.answer);
        aLatex += `\\item \\textbf{\\large ${i + 1}.} \\par\n${aContent}\n`;
      } catch (e) {
        console.error('Parse error in question', i + 1, e);
        qLatex += `\\item Error parsing question ${i + 1}.\n`;
      }
    });

    return { questions: qLatex, answers: aLatex, frontMatter };
  };

  // --- 4. LaTeX Template (mirrors one‑column, serif, black‑link baseline) ---
  const generateLatexDocument = (content = '', includeAnswers = false, lang = 'en', isCompact = false) => {
    if (!content.trim()) return null;
    const parsed = parseQuizdownToLatex(content);
    const title = findTitleValue(parsed.frontMatter) || 'Quiz';

    const labels = {
      en: { q: 'Questions', a: 'Answer Key', name: 'Name', id: 'ID', date: 'Date' },
      fi: { q: 'Kysymykset', a: 'Vastaukset', name: 'Nimi', id: 'Op.nro', date: 'Päivämäärä' }
    }[lang] || labels.en;

    const babel = lang === 'fi' ? '\\usepackage[finnish]{babel}' : '';

    // Class options: columns, font, linkcolor – taken straight from preamble.cls
    const classOptions = isCompact
      ? 'columns=two, font=serif, linkcolor=black'
      : 'columns=one, font=serif, linkcolor=black';

    const docClass = `\\documentclass[${classOptions}]{preamble}`;

    // Build the title / header block
    let documentHeader = '';
    if (isCompact) {
      documentHeader = `
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
      documentHeader = `
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

    return `${docClass}
\\usepackage[T1]{fontenc}
${babel}
% No additional packages needed – preamble.cls covers typography,
% geometry, titles, lists, and hyperlinks.

\\begin{document}
\\thispagestyle{plain}

${documentHeader}

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
