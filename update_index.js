const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.split('<select id="algorithm-mode" disabled>').join('<select id="algorithm-mode">');
html = html.split('<option value="worker">Worker-Proposing (Server)</option>').join('<option value="worker">Worker-Proposing (Server)</option>\n<option value="task">Task-Proposing (Server)</option>');

// Find btn-start and add btn-clear-db after it
const startBtnMatch = html.match(/<button id="btn-start".*?<\/button>/);
if (startBtnMatch) {
    const clearBtn = '\n<button id="btn-clear-db" class="btn btn-secondary" style="border-color: var(--accent-red); color: var(--accent-red); margin-top: 10px;">Clear Simulation DB</button>';
    html = html.split(startBtnMatch[0]).join(startBtnMatch[0] + clearBtn);
}

fs.writeFileSync('index.html', html);
console.log('Fixed UI controls in index.html');
