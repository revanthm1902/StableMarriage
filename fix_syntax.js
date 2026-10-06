const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');

const startIdx = js.indexOf('async function loadRequesterTasks() {');
const endIdx = js.indexOf('// --- Worker Logic ---');

if (startIdx !== -1 && endIdx !== -1) {
    const before = js.substring(0, startIdx);
    const after = js.substring(endIdx);
    
    const correctFunction = `async function loadRequesterTasks() {
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
}
`;

    fs.writeFileSync('script.js', before + correctFunction + '\n' + after);
    console.log('Fixed script.js permanently');
} else {
    console.log('Could not find boundaries');
}
