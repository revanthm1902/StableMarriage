const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');

// 1. Validation in Auth
js = js.replace("const role = document.getElementById('role-select').value;",
`const role = document.getElementById('role-select').value;
    if (!role) { authError.textContent = 'Please select a role.'; return; }`);

js = js.replace("const email = document.getElementById('email').value;",
`const roleSelect = document.getElementById('role-select');
    if (roleSelect && !roleSelect.value) { authError.textContent = 'Please select a role before registering/logging in.'; return; }
    const email = document.getElementById('email').value;`);

// 2. handleCreateTask -> setRandomPositions
js = js.replace("msg.textContent = 'Task created successfully!';\n        loadRequesterTasks();",
`msg.textContent = 'Task created successfully!';
        loadRequesterTasks();
        setRandomPositions();`);

// 3. Worker logic
js = js.replace(/async function loadWorkerProfile\(\) \{[\s\S]*?async function handleUpdateWorkerProfile\(\) \{[\s\S]*?\}\n/,
`async function loadWorkerProfile() {
    const { data, error } = await supabaseClient
        .from('worker_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
        
    if (!error && data) {
        document.getElementById('worker-x').value = data.current_lat || 50;
        document.getElementById('worker-y').value = data.current_lng || 50;
        document.getElementById('worker-available').checked = data.is_available;
        const jobSelect = document.getElementById('worker-job-type');
        const customInput = document.getElementById('worker-job-custom');
        
        let found = false;
        if(jobSelect) {
            for (let i = 0; i < jobSelect.options.length; i++) {
                if (jobSelect.options[i].value === data.job_type) {
                    jobSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found && data.job_type) {
                jobSelect.value = 'Other';
                customInput.style.display = 'block';
                customInput.value = data.job_type;
            } else {
                if(customInput) customInput.style.display = 'none';
            }
        }
    }
}

async function handleUpdateWorkerProfile() {
    const x = parseFloat(document.getElementById('worker-x').value);
    const y = parseFloat(document.getElementById('worker-y').value);
    const available = document.getElementById('worker-available').checked;
    
    let type = document.getElementById('worker-job-type') ? document.getElementById('worker-job-type').value : null;
    if (type === 'Other') {
        type = document.getElementById('worker-job-custom').value.trim();
        if (!type) {
            document.getElementById('worker-msg').textContent = 'Please specify the custom job type.';
            return;
        }
    }
    
    const msg = document.getElementById('worker-msg');
    msg.textContent = '';

    if (isNaN(x) || isNaN(y)) {
        msg.textContent = 'Please enter valid coordinates.';
        return;
    }

    const { error } = await supabaseClient
        .from('worker_profiles')
        .update({ current_lat: x, current_lng: y, is_available: available, job_type: type || undefined })
        .eq('user_id', currentUser.id);

    if (error) {
        msg.textContent = 'Error updating profile: ' + error.message;
    } else {
        msg.textContent = 'Profile updated successfully!';
        setRandomPositions();
    }
}
`);

// 4. renderMap -> append title
js = js.replace("        const text = document.createElementNS(SVG_NS, 'text');\n        text.textContent = 'W' + (i + 1);",
`        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = 'W' + (i + 1);
        
        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = \`Worker: W\${i+1}\\nRole: \${w.job_type}\\nStatus: \${w.is_available ? 'Available' : 'Busy'}\\nLocation: (\${w.current_lat}, \${w.current_lng})\`;
        g.appendChild(title);`);

js = js.replace("        const text = document.createElementNS(SVG_NS, 'text');\n        text.textContent = 'T' + (i + 1);",
`        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = 'T' + (i + 1);
        
        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = \`Task: T\${i+1}\\nRequired: \${t.required_job_type}\\nStatus: \${t.status}\\nLocation: (\${t.lat}, \${t.lng})\`;
        g.appendChild(title);`);

fs.writeFileSync('script.js', js);
console.log('Script updated successfully');
