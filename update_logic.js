const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');

// 1. Clear DB Event Listener
const eventListenersAdmin = "const btnStart = document.getElementById('btn-start');\nif (btnStart) btnStart.addEventListener('click', handleRunMatching);\n\nconst btnClear = document.getElementById('btn-clear-db');\nif (btnClear) btnClear.addEventListener('click', handleClearDB);\n\nasync function handleClearDB() {\n    if(!confirm('Are you sure you want to delete all tasks and workers from the simulation?')) return;\n    try {\n        await fetch(API_URL + '/api/clear', { method: 'POST' });\n        loadAdminData();\n    } catch(e) {\n        alert('Failed to clear DB');\n    }\n}";
js = js.replace(/const btnStart = document.getElementById\('btn-start'\);\nif \(btnStart\) btnStart.addEventListener\('click', handleRunMatching\);/, eventListenersAdmin);

// 2. Pass mode to /api/match
const fetchMatch = `const mode = document.getElementById('algorithm-mode').value;
        const response = await fetch(API_URL + '/api/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });`;
js = js.replace(/const response = await fetch\(API_URL \+ '\/api\/match', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \}\s*\}\);/, fetchMatch);

// 3. Update loadRequesterTasks with delete button
const loadReqTasks = `async function loadRequesterTasks() {
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('requester_id', currentUser.id);

    if (!error && data) {
        const list = document.getElementById('requester-tasks-list');
        list.innerHTML = '';
        data.forEach(task => {
            const li = document.createElement('li');
            li.innerHTML = \`<span>Type: \${task.required_job_type} | Loc: (\${task.lat}, \${task.lng}) | Status: \${task.status}</span>\`;
            if (task.status === 'pending') {
                const btnContainer = document.createElement('div');
                btnContainer.style.display = 'flex';
                btnContainer.style.gap = '8px';
                
                const delBtn = document.createElement('button');
                delBtn.textContent = 'Delete';
                delBtn.className = 'btn btn-secondary';
                delBtn.style.padding = '4px 8px';
                delBtn.style.fontSize = '0.8rem';
                delBtn.style.borderColor = 'var(--accent-red)';
                delBtn.style.color = 'var(--accent-red)';
                delBtn.onclick = async () => {
                    await supabaseClient.from('tasks').delete().eq('id', task.id);
                    loadRequesterTasks();
                };
                
                btnContainer.appendChild(delBtn);
                li.appendChild(btnContainer);
            }
            list.appendChild(li);
        });
    }
}`;

js = js.replace(/async function loadRequesterTasks\(\) \{[\s\S]*?\}\n/, loadReqTasks + '\n');

fs.writeFileSync('script.js', js);
console.log('Fixed script functionalities');
