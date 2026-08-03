// app/js/visual-editor.js

// Global state
window.visualState = {
    header: "",
    questions: []
};

// --- UTILITY: Auto-Grow Textarea ---
window.autoGrow = function(element) {
    // Resetting height to a small value allows the scrollHeight to shrink
    // dynamically when a user deletes lines.
    element.style.height = '5px';
    element.style.height = (element.scrollHeight) + 'px';
};

// --- PARSER (Text -> Object) ---
window.parseRawToVisual = function(text) {
    window.visualState = { header: "", questions: [] };
    const parts = text.split(/^---$/gm).map(p => p.trim()).filter(p => p);

    if (parts.length > 0) {
        if(parts[0].includes('title:') || parts[0].includes('Title:')) {
            window.visualState.header = parts[0];
            parts.shift(); 
        }
    }

    parts.forEach(part => {
        let qObj = { text: "", type: "open", options: [], answer: "", materials: [] };
        let qaSplit = part.split(/#A\s*/);
        let qSection = qaSplit[0];
        let aSection = qaSplit.length > 1 ? qaSplit[1] : "";

        // Regex for materials matches code, quote, table, material, plot and optional langs
        const materialRegex = /\[(code(?::[a-zA-Z0-9_-]+)?|quote|table|material|plot)\]\n?([\s\S]*?)\n?\[\/(?:code|quote|table|material|plot)\]/gi;
        let match;
        while ((match = materialRegex.exec(qSection)) !== null) {
            let fullType = match[1].toLowerCase();
            let content = match[2].trim();
            
            let type = fullType;
            let lang = '';
            let author = '';
            
            if (fullType.startsWith('code:')) {
                type = 'code';
                lang = fullType.substring(5);
            } else if (fullType === 'code') {
                type = 'code';
                lang = 'text';
            }
            
            if (type === 'quote') {
                // look for Author: or Source: at the end of the quote block
                let lines = content.split('\n');
                let attrIdx = lines.findIndex(l => {
                    let t = l.trim();
                    return t.startsWith('—') || /^(author|by|source|attribution)\s*:/i.test(t);
                });
                if (attrIdx !== -1) {
                    let attrLine = lines[attrIdx].trim();
                    let prefixMatch = attrLine.match(/^(author|by|source|attribution)\s*:\s*(.*)$/i);
                    author = prefixMatch ? prefixMatch[2].trim() : attrLine.replace(/^—\s*/, '');
                    content = lines.slice(0, attrIdx).join('\n').trim();
                }
            }
            
            let matObj = { type, content };
            if (type === 'code') matObj.lang = lang;
            if (type === 'quote') matObj.author = author;
            
            qObj.materials.push(matObj);
        }
        
        qSection = qSection.replace(materialRegex, "").trim();
        qSection = qSection.replace(/^#Q(?::\d+)?\s*/i, "").trim();

        let cleanTextLines = [];
        qSection.split('\n').forEach(line => {
            let m = /^-\s*\[([ x])\]\s*(.*)$/i.exec(line.trim());
            if (m) {
                qObj.type = "mc";
                qObj.options.push({ correct: m[1].toLowerCase() === 'x', text: m[2] });
            } else {
                cleanTextLines.push(line);
            }
        });

        qObj.text = cleanTextLines.join('\n').trim();
        qObj.answer = aSection.trim();
        window.visualState.questions.push(qObj);
    });
}

// --- SERIALIZER (Object -> Text) ---
window.generateRawFromVisual = function() {
    let headerStr = "";
    if (window.visualState.header && window.visualState.header.trim() !== "") {
        headerStr = "---\n" + window.visualState.header.trim() + "\n---";
    } else {
        headerStr = "---\ntitle: Untitled Quiz\n---";
    }

    let questionBlocks = window.visualState.questions.map(q => {
        let qBlock = "#Q\n";
        qBlock += q.text + "\n\n";
        
        q.materials.forEach(mat => {
            if (mat.type === 'quote') {
                qBlock += `[quote]\n${mat.content}\n`;
                if (mat.author && mat.author.trim() !== '') {
                    qBlock += `Author: ${mat.author}\n`;
                }
                qBlock += `[/quote]\n\n`;
            } else if (mat.type === 'code') {
                let tag = (mat.lang && mat.lang.trim() !== '' && mat.lang !== 'text') ? `code:${mat.lang.trim()}` : 'code';
                qBlock += `[${tag}]\n${mat.content}\n[/code]\n\n`;
            } else {
                qBlock += `[${mat.type}]\n${mat.content}\n[/${mat.type}]\n\n`;
            }
        });
        
        if (q.type === 'mc') {
            q.options.forEach(opt => {
                const mark = opt.correct ? 'x' : ' ';
                qBlock += `- [${mark}] ${opt.text}\n`;
            });
        }
        
        if (q.answer && q.answer.trim() !== '') {
            qBlock += "#A\n" + q.answer;
        } else {
            qBlock += "#A"; // Must include the marker even if empty
        }
        return qBlock;
    });

    if (questionBlocks.length > 0) {
        return headerStr + "\n" + questionBlocks.join("\n---\n");
    } else {
        return headerStr;
    }
}

// --- RENDERER ---
window.renderVisualEditor = function() {
    const container = document.getElementById('visual-questions-container');
    if(!container) return; 
    
    container.innerHTML = "";
    const titleMatch = window.visualState.header ? window.visualState.header.match(/title:\s*(.*)/i) : null;
    const titleInput = document.getElementById('visual-title');
    if(titleInput && titleMatch) titleInput.value = titleMatch[1];

    window.visualState.questions.forEach((q, index) => {
        const card = document.createElement('div');
        card.className = "visual-card question-card";
        
        card.innerHTML = `
            <div class="card-header">
                <span class="q-number">Q${index + 1}</span>
                <div style="display:flex; align-items:center; gap: 10px;">
                    <select onchange="window.updateQType(${index}, this.value)" style="margin-bottom:0; padding:6px 12px; width:auto; font-weight:600; background:var(--surface-muted);">
                        <option value="mc" ${q.type === 'mc' ? 'selected' : ''}>Multiple Choice</option>
                        <option value="open" ${q.type === 'open' ? 'selected' : ''}>Open Ended</option>
                    </select>
                    <button class="btn-delete" title="Delete Question" onclick="window.visualDeleteQ(${index})">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            
            <label>Question Text</label>
            <textarea 
                class="input-q-text" 
                placeholder="Type your question here..."
                oninput="window.autoGrow(this); window.updateQText(${index}, this.value)"
            >${q.text}</textarea>

            <div class="materials-section">
                <div id="mat-container-${index}">
                    ${q.materials.map((m, mIdx) => renderMaterialHTML(index, mIdx, m)).join('')}
                </div>
                <div class="mat-buttons">
                    <button class="btn-tiny" onclick="window.addMaterial(${index}, 'code')">+ Add Code</button>
                    <button class="btn-tiny" onclick="window.addMaterial(${index}, 'quote')">+ Add Quote</button>
                    <button class="btn-tiny" onclick="window.addMaterial(${index}, 'table')">+ Add Table</button>
                    <button class="btn-tiny" onclick="window.addMaterial(${index}, 'plot')">+ Add Plot</button>
                    <button class="btn-tiny" onclick="window.addMaterial(${index}, 'material')">+ Add Material</button>
                </div>
            </div>

            <div class="answer-section" style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--surface-muted);">
                <label>${q.type === 'mc' ? 'Options & Explanation' : 'Model Answer'}</label>
                <div id="options-container-${index}">
                    ${renderAnswerSection(index, q)}
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    setTimeout(() => {
        document.querySelectorAll('textarea').forEach(el => window.autoGrow(el));
    }, 0);
}

// --- MATERIAL RENDERERS ---

function renderMaterialHTML(qIdx, mIdx, material) {
    if (material.type === 'table') {
        return renderTableEditor(qIdx, mIdx, material.content);
    }
    
    if (material.type === 'quote') {
        return `
        <div class="visual-material-item">
            <div class="mat-header">
                <span class="mat-tag">Quote</span>
                <button class="btn-delete-tiny" title="Remove Quote" onclick="window.deleteMaterial(${qIdx}, ${mIdx})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <textarea placeholder="Quote text..." oninput="window.autoGrow(this); window.updateMaterial(${qIdx}, ${mIdx}, 'content', this.value)">${material.content}</textarea>
            <input type="text" placeholder="Author / Source (Optional)" value="${material.author || ''}" oninput="window.updateMaterial(${qIdx}, ${mIdx}, 'author', this.value)">
        </div>`;
    }

    if (material.type === 'code') {
        return `
        <div class="visual-material-item">
            <div class="mat-header">
                <span class="mat-tag">Code</span>
                <div style="display:flex; gap:8px; align-items:center;">
                    <label style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0;">Language:</label>
                    <input type="text" style="width:100px; padding:2px 8px; margin-bottom:0;" placeholder="e.g. js" value="${material.lang || 'text'}" oninput="window.updateMaterial(${qIdx}, ${mIdx}, 'lang', this.value)">
                    <button class="btn-delete-tiny" title="Remove Code" onclick="window.deleteMaterial(${qIdx}, ${mIdx})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            </div>
            <textarea class="code-font" placeholder="Paste code here..." oninput="window.autoGrow(this); window.updateMaterial(${qIdx}, ${mIdx}, 'content', this.value)">${material.content}</textarea>
        </div>`;
    }

    if (material.type === 'plot') {
        return `
        <div class="visual-material-item">
            <div class="mat-header">
                <span class="mat-tag">Plot (Desmos)</span>
                <button class="btn-delete-tiny" title="Remove Plot" onclick="window.deleteMaterial(${qIdx}, ${mIdx})">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">Enter LaTeX expressions (one per line):</p>
            <textarea class="code-font" placeholder="y = x^2\ny = \\sin(x)" oninput="window.autoGrow(this); window.updateMaterial(${qIdx}, ${mIdx}, 'content', this.value)">${material.content}</textarea>
        </div>`;
    }

    return `
    <div class="visual-material-item">
        <div class="mat-header">
            <span class="mat-tag">${material.type}</span>
            <button class="btn-delete-tiny" title="Remove Material" onclick="window.deleteMaterial(${qIdx}, ${mIdx})">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
        <textarea placeholder="Material text..." oninput="window.autoGrow(this); window.updateMaterial(${qIdx}, ${mIdx}, 'content', this.value)">${material.content}</textarea>
    </div>`;
}

// --- TABLE EDITOR LOGIC ---

function mdToGrid(md) {
    if (!md || md.trim() === '') return null;
    let lines = md.trim().split('\n');
    lines = lines.filter(l => !l.match(/^\|?\s*:?-+:?\s*\|/)); // Remove separator line
    
    return lines.map(line => {
        let row = line.trim().replace(/^\||\|$/g, '').split('|');
        return row.map(cell => cell.trim());
    });
}

function gridToMd(grid) {
    if (!grid || grid.length === 0) return "";
    
    // Header
    let md = "| " + grid[0].join(" | ") + " |\n";
    
    // Separator
    md += "|" + grid[0].map(() => " --- ").join("|") + "|\n";
    
    // Body
    for (let i = 1; i < grid.length; i++) {
        md += "| " + grid[i].join(" | ") + " |\n";
    }
    return md.trim();
}

function renderTableEditor(qIdx, mIdx, content) {
    const grid = mdToGrid(content);

    // Initialization UI
    if (!grid || grid.length === 0) {
        return `
            <div class="visual-material-item">
                <div class="mat-header">
                    <span class="mat-tag">Table</span>
                    <button class="btn-delete-tiny" title="Remove Table" onclick="window.deleteMaterial(${qIdx}, ${mIdx})">
                         <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="table-editor-wrapper table-init-box">
                    <p style="margin-bottom:10px; font-weight:500;">Create a new table</p>
                    <div style="display:flex; gap:8px;">
                        <button class="btn btn-secondary btn-sm" style="border-radius:6px;" onclick="window.initTable(${qIdx}, ${mIdx}, 2, 2)">2x2</button>
                        <button class="btn btn-secondary btn-sm" style="border-radius:6px;" onclick="window.initTable(${qIdx}, ${mIdx}, 3, 3)">3x3</button>
                        <button class="btn btn-secondary btn-sm" style="border-radius:6px;" onclick="window.initTable(${qIdx}, ${mIdx}, 4, 2)">4x2</button>
                    </div>
                </div>
            </div>
        `;
    }

    // Render Grid
    let rowsHtml = '';
    grid.forEach((row, rIdx) => {
        let cellsHtml = '';
        row.forEach((cell, cIdx) => {
            const isHeader = (rIdx === 0);
            cellsHtml += `
                <td>
                    <input type="text" 
                           class="table-cell-input ${isHeader ? 'table-header-input' : ''}" 
                           value="${cell}" 
                           placeholder="${isHeader ? 'Header' : 'Cell'}"
                           oninput="window.updateTableCell(${qIdx}, ${mIdx}, ${rIdx}, ${cIdx}, this.value)">
                </td>
            `;
        });
        rowsHtml += `<tr>${cellsHtml}</tr>`;
    });

    return `
        <div class="visual-material-item">
            <div class="mat-header">
                <span class="mat-tag">Table Editor</span>
                <button class="btn-delete-tiny" title="Remove Table" onclick="window.deleteMaterial(${qIdx}, ${mIdx})">
                     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="table-editor-wrapper">
                <div style="overflow-x:auto;">
                    <table class="visual-table">
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>
                <div class="table-controls">
                    <button class="btn btn-secondary btn-sm" style="border-radius:6px;" onclick="window.tableAddRow(${qIdx}, ${mIdx})">+ Row</button>
                    <button class="btn btn-secondary btn-sm" style="border-radius:6px;" onclick="window.tableRemoveRow(${qIdx}, ${mIdx})">- Row</button>
                    
                    <span style="color:var(--border-color);">|</span>
                    
                    <button class="btn btn-secondary btn-sm" style="border-radius:6px;" onclick="window.tableAddCol(${qIdx}, ${mIdx})">+ Col</button>
                    <button class="btn btn-secondary btn-sm" style="border-radius:6px;" onclick="window.tableRemoveCol(${qIdx}, ${mIdx})">- Col</button>
                    
                    <button class="btn btn-sm" style="color:#ef4444; border-color:transparent; margin-left:auto; background:transparent;" onclick="window.tableReset(${qIdx}, ${mIdx})">Reset</button>
                </div>
            </div>
        </div>
    `;
}

// --- TABLE ACTIONS ---
window.initTable = (qIdx, mIdx, rows, cols) => {
    let grid = [];
    for(let r=0; r<rows; r++) {
        let row = [];
        for(let c=0; c<cols; c++) row.push(r===0 ? `Head ${c+1}` : `Data`);
        grid.push(row);
    }
    window.visualState.questions[qIdx].materials[mIdx].content = gridToMd(grid);
    window.renderVisualEditor();
};

window.updateTableCell = (qIdx, mIdx, rIdx, cIdx, val) => {
    let grid = mdToGrid(window.visualState.questions[qIdx].materials[mIdx].content);
    if(grid && grid[rIdx]) {
        grid[rIdx][cIdx] = val;
        window.visualState.questions[qIdx].materials[mIdx].content = gridToMd(grid);
    }
};

window.tableAddRow = (qIdx, mIdx) => {
    let grid = mdToGrid(window.visualState.questions[qIdx].materials[mIdx].content);
    if(!grid) return;
    let cols = grid[0].length;
    let newRow = new Array(cols).fill("...");
    grid.push(newRow);
    window.visualState.questions[qIdx].materials[mIdx].content = gridToMd(grid);
    window.renderVisualEditor();
};

window.tableRemoveRow = (qIdx, mIdx) => {
    let grid = mdToGrid(window.visualState.questions[qIdx].materials[mIdx].content);
    if(!grid || grid.length <= 1) return; // Prevent deleting the header row
    grid.pop(); // Removes last row
    window.visualState.questions[qIdx].materials[mIdx].content = gridToMd(grid);
    window.renderVisualEditor();
};

window.tableAddCol = (qIdx, mIdx) => {
    let grid = mdToGrid(window.visualState.questions[qIdx].materials[mIdx].content);
    if(!grid) return;
    grid.forEach(row => row.push("..."));
    window.visualState.questions[qIdx].materials[mIdx].content = gridToMd(grid);
    window.renderVisualEditor();
};

window.tableRemoveCol = (qIdx, mIdx) => {
    let grid = mdToGrid(window.visualState.questions[qIdx].materials[mIdx].content);
    if(!grid || grid[0].length <= 1) return; // Prevent deleting last column
    grid.forEach(row => row.pop()); // Removes last cell from every row
    window.visualState.questions[qIdx].materials[mIdx].content = gridToMd(grid);
    window.renderVisualEditor();
};

window.tableReset = (qIdx, mIdx) => {
    if(confirm("Clear this table?")) {
        window.visualState.questions[qIdx].materials[mIdx].content = "";
        window.renderVisualEditor();
    }
};

// --- GENERIC ACTIONS ---
function renderAnswerSection(index, q) {
    if (q.type === 'open') {
        return `
            <textarea 
                class="input-answer" 
                placeholder="Type the model answer..." 
                oninput="window.autoGrow(this); window.updateAnswer(${index}, this.value)"
            >${q.answer}</textarea>`;
    } else {
        let html = `<div class="mc-options-list">`;
        q.options.forEach((opt, oIdx) => {
            html += `
                <div class="mc-option-row">
                    <input type="checkbox" ${opt.correct ? 'checked' : ''} onchange="window.updateOptionCorrect(${index}, ${oIdx}, this.checked)" title="Mark as correct">
                    <input type="text" value="${opt.text}" oninput="window.updateOptionText(${index}, ${oIdx}, this.value)" placeholder="Option text">
                    <button class="btn-delete" title="Remove Option" onclick="window.deleteOption(${index}, ${oIdx})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
        });
        html += `<button class="btn-sm btn-secondary" style="margin-top:5px; border-radius: 6px;" onclick="window.addOption(${index})">+ Add Option</button></div>`;
        html += `<label style="margin-top:20px; display:block;">Explanation (Optional)</label>`;
        html += `
            <textarea 
                class="input-answer" 
                placeholder="Explain why the answer is correct..."
                oninput="window.autoGrow(this); window.updateAnswer(${index}, this.value)"
            >${q.answer}</textarea>`;
        return html;
    }
}

// Basic CRUD
window.updateQText = (idx, val) => window.visualState.questions[idx].text = val;
window.updateAnswer = (idx, val) => window.visualState.questions[idx].answer = val;
window.visualDeleteQ = (idx) => { if(confirm("Delete this question?")) { window.visualState.questions.splice(idx, 1); window.renderVisualEditor(); }};
window.visualAddQuestion = () => { 
    window.visualState.questions.push({ text: "", type: "mc", options: [{text:"Option 1", correct:false}, {text:"Option 2", correct:true}], answer: "", materials:[] });
    window.renderVisualEditor(); 
    setTimeout(() => { 
        const container = document.getElementById('visual-questions-container');
        if(container && container.lastElementChild) {
            container.lastElementChild.scrollIntoView({ behavior: 'smooth' });
            const textarea = container.lastElementChild.querySelector('textarea');
            if(textarea) textarea.focus();
        }
    }, 100);
};
window.updateQType = (idx, type) => {
    window.visualState.questions[idx].type = type;
    if(type === 'mc' && window.visualState.questions[idx].options.length === 0) window.visualState.questions[idx].options = [{text:"Option 1", correct:false}];
    window.renderVisualEditor();
};
window.addMaterial = (qIdx, type) => { window.visualState.questions[qIdx].materials.push({type: type, content: ""}); window.renderVisualEditor(); };
window.updateMaterial = (qIdx, mIdx, field, val) => {
    if (field === 'content') {
        window.visualState.questions[qIdx].materials[mIdx].content = val;
    } else if (field === 'author') {
        window.visualState.questions[qIdx].materials[mIdx].author = val;
    } else if (field === 'lang') {
        window.visualState.questions[qIdx].materials[mIdx].lang = val;
    }
};
window.deleteMaterial = (qIdx, mIdx) => { window.visualState.questions[qIdx].materials.splice(mIdx, 1); window.renderVisualEditor(); };
window.updateOptionText = (qIdx, oIdx, val) => window.visualState.questions[qIdx].options[oIdx].text = val;
window.updateOptionCorrect = (qIdx, oIdx, val) => window.visualState.questions[qIdx].options[oIdx].correct = val;
window.addOption = (qIdx) => { window.visualState.questions[qIdx].options.push({text: "", correct: false}); window.renderVisualEditor(); };
window.deleteOption = (qIdx, oIdx) => { window.visualState.questions[qIdx].options.splice(oIdx, 1); window.renderVisualEditor(); };
