let supabaseClient;

// State
let currentUser = null;
let currentRole = null;
let realtimeSubscription = null;

// Admin State
let adminTasks = [];
let adminWorkers = [];
let currentSteps = []; // from server
let isAnimating = false;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');
const userInfo = document.getElementById('user-info');
const authError = document.getElementById('auth-error');

const dashboards = {
    requester: document.getElementById('requester-dashboard'),
    worker: document.getElementById('worker-dashboard'),
    admin: document.getElementById('admin-dashboard')
};

// Event Listeners for Auth
document.getElementById('btn-login').addEventListener('click', handleLogin);
document.getElementById('btn-register').addEventListener('click', handleRegister);
document.getElementById('btn-logout').addEventListener('click', handleLogout);
if(document.getElementById('btn-theme')) {
    document.getElementById('btn-theme').addEventListener('click', () => {
        const html = document.documentElement;
        html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    });
}

// Event Listeners for Requester
document.getElementById('btn-create-task').addEventListener('click', handleCreateTask);

// Event Listeners for Worker
document.getElementById('btn-update-worker').addEventListener('click', handleUpdateWorkerProfile);

// Event Listeners for Admin
const btnStart = document.getElementById('btn-start');
if (btnStart) btnStart.addEventListener('click', handleRunMatching);

const btnClear = document.getElementById('btn-clear-db');
if (btnClear) btnClear.addEventListener('click', handleClearDB);

async function handleClearDB() {
    if(!confirm('Are you sure you want to delete all tasks and workers from the simulation?')) return;
    try {
        await fetch(API_URL + '/api/clear', { method: 'POST' });
        loadAdminData();
    } catch(e) {
        alert('Failed to clear DB');
    }
}

const API_URL = 'http://localhost:3000';
const SVG_NS = "http://www.w3.org/2000/svg";

// Random positions helpers — only fill when user clicks Randomize
function randomizeTaskInputs() {
    const tx = document.getElementById('task-x');
    const ty = document.getElementById('task-y');
    if (tx) tx.value = Math.floor(Math.random() * 700) + 50;
    if (ty) ty.value = Math.floor(Math.random() * 500) + 50;
}

function randomizeWorkerInputs() {
    const wx = document.getElementById('worker-x');
    const wy = document.getElementById('worker-y');
    if (wx) wx.value = Math.floor(Math.random() * 700) + 50;
    if (wy) wy.value = Math.floor(Math.random() * 500) + 50;
}

// Randomize button listeners
const btnRandTask = document.getElementById('btn-randomize-task');
if (btnRandTask) btnRandTask.addEventListener('click', randomizeTaskInputs);

const btnRandWorker = document.getElementById('btn-randomize-worker');
if (btnRandWorker) btnRandWorker.addEventListener('click', randomizeWorkerInputs);

// Initial Setup - Fetch Config
async function initializeApp() {
    try {
        const response = await fetch(API_URL + '/api/config');
        if (!response.ok) throw new Error('Config fetch failed');
        const config = await response.json();
        
        if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
            authError.textContent = "Supabase configuration missing in .env!";
            return;
        }
        
        supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                checkUserAndRoute();
            }
        });
    } catch(e) {
        authError.textContent = "Cannot connect to server. Ensure 'node server.js' is running and access via http://localhost:3000.";
    }
}
initializeApp();

// --- Auth Logic ---
async function handleLogin() {
    const roleSelect = document.getElementById('role-select');
    if (roleSelect && !roleSelect.value) { authError.textContent = 'Please select a role before registering/logging in.'; return; }
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    authError.textContent = '';
    
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
        authError.textContent = 'Login Error: ' + error.message;
        return;
    }
    await checkUserAndRoute();
}

async function handleRegister() {
    const roleSelect = document.getElementById('role-select');
    if (roleSelect && !roleSelect.value) { authError.textContent = 'Please select a role before registering/logging in.'; return; }
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role-select').value;
    authError.textContent = 'Registering...';
    
    try {
        const response = await fetch(API_URL + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        const data = await response.json();
        
        if (!response.ok) {
            authError.textContent = 'Registration Error: ' + (data.error || 'Unknown error');
        } else {
            authError.textContent = "Registration successful! You can now login.";
        }
    } catch(e) {
        authError.textContent = "Registration failed. Server might be unreachable.";
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentRole = null;
    if (realtimeSubscription) {
        supabaseClient.removeChannel(realtimeSubscription);
    }
    showScreen('auth');
}

async function checkUserAndRoute() {
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (user) {
        currentUser = user;
        const { data, error } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (error || !data) {
            alert('Could not determine user role from database. If you registered previously, your role may be missing.');
            await supabaseClient.auth.signOut();
            showScreen('auth');
            return;
        }

        currentRole = data.role;
        userInfo.textContent = `User: ${user.email.split('@')[0]} (${currentRole})`;
        showScreen('app', currentRole);
        initializeDashboard(currentRole);
    } else {
        showScreen('auth');
    }
}

function showScreen(screen, role = null) {
    if (screen === 'auth') {
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        const roleSel = document.getElementById('role-select');
        if (roleSel) roleSel.selectedIndex = 0;
        if (authError) authError.textContent = '';
    }
    
    authScreen.style.display = screen === 'auth' ? 'block' : 'none';
    appContainer.style.display = screen === 'app' ? 'flex' : 'none';

    if (screen === 'app' && role) {
        Object.keys(dashboards).forEach(r => {
            if (dashboards[r]) {
                dashboards[r].classList.add('hidden');
            }
        });
        if (dashboards[role]) {
            dashboards[role].classList.remove('hidden');
        }
        
        // Stats bar only for admin
        const stats = document.getElementById('stats-bar');
        if (stats) {
            if (role === 'admin') stats.classList.remove('hidden');
            else stats.classList.add('hidden');
        }
    }
}

function initializeDashboard(role) {
    if (role === 'requester') {
        loadRequesterTasks();
        
        realtimeSubscription = supabaseClient.channel('requester-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
                loadRequesterTasks();
            })
            .subscribe();
            
    } else if (role === 'worker') {
        loadWorkerProfile();
        loadWorkerAssignedTask();
        
        // Listen for task assignment instantly
        realtimeSubscription = supabaseClient.channel('worker-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
                loadWorkerAssignedTask();
            })
            .subscribe();
            
    } else if (role === 'admin') {
        loadAdminData();
        setupAdminRealtime();
    }
}

// --- Requester Logic ---
async function handleCreateTask() {
    const x = parseFloat(document.getElementById('task-x').value);
    const y = parseFloat(document.getElementById('task-y').value);
    let type = document.getElementById('task-type').value;
    if (type === 'Other') {
        type = document.getElementById('task-type-custom').value.trim();
        if (!type) {
            document.getElementById('task-msg').textContent = 'Please specify the custom task type.';
            return;
        }
    }
    const msg = document.getElementById('task-msg');
    msg.textContent = '';

    if (isNaN(x) || isNaN(y)) {
        msg.textContent = 'Please enter valid coordinates.';
        return;
    }

    const { error } = await supabaseClient
        .from('tasks')
        .insert([{ requester_id: currentUser.id, lat: x, lng: y, required_job_type: type, status: 'pending' }]);

    if (error) {
        msg.textContent = 'Error creating task: ' + error.message;
    } else {
        msg.textContent = 'Task created successfully!';
        document.getElementById('task-x').value = '';
        document.getElementById('task-y').value = '';
        loadRequesterTasks();
    }
}

async function loadRequesterTasks() {
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('requester_id', currentUser.id);

    if (!error && data) {
        const list = document.getElementById('requester-tasks-list');
        list.innerHTML = '';
        data.forEach(task => {
            const li = document.createElement('li');
            const statusLabel = (task.status === 'matched' || task.status === 'assigned') ? 'assigned' : task.status;
            li.innerHTML = `<span>Type: ${task.required_job_type} | Loc: (${task.lat}, ${task.lng}) | Status: ${statusLabel}</span>`;
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
                    try {
                        const resp = await fetch(API_URL + '/api/tasks/' + task.id, { method: 'DELETE' });
                        if (resp.ok) {
                            loadRequesterTasks();
                        } else {
                            alert('Failed to delete task.');
                        }
                    } catch(e) {
                        alert('Error deleting task: ' + e.message);
                    }
                };
                
                btnContainer.appendChild(delBtn);
                li.appendChild(btnContainer);
            }
            list.appendChild(li);
        });
    }
}

// --- Worker Logic ---
async function loadWorkerProfile() {
    const { data, error } = await supabaseClient
        .from('worker_profiles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();
        
    if (!error && data) {
        document.getElementById('worker-x').value = '';
        document.getElementById('worker-y').value = '';
        document.getElementById('worker-available').checked = data.is_available !== null ? data.is_available : true;
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
        .upsert({ user_id: currentUser.id, current_lat: x, current_lng: y, is_available: available, job_type: type || undefined });

    if (error) {
        msg.textContent = 'Error updating profile: ' + error.message;
    } else {
        msg.textContent = 'Profile updated successfully!';
    }
}

window.acceptAssignedTask = async function(taskId) {
    await supabaseClient.from('tasks').update({ status: 'completed' }).eq('id', taskId);
    loadWorkerAssignedTask();
};

window.rejectAssignedTask = async function(taskId) {
    await supabaseClient.from('tasks').update({ status: 'pending', assigned_worker_id: null }).eq('id', taskId);
    await supabaseClient.from('worker_profiles').update({ current_lat: null, current_lng: null, is_available: false }).eq('user_id', currentUser.id);
    loadWorkerProfile();
    loadWorkerAssignedTask();
};

async function loadWorkerAssignedTask() {
    const { data, error } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('assigned_worker_id', currentUser.id)
        .in('status', ['matched', 'completed']);

    const div = document.getElementById('worker-assigned-task');
    if (!error && data && data.length > 0) {
        const t = data[0];
        let buttonsHtml = '';
        if (t.status === 'matched' || t.status === 'matched') {
            buttonsHtml = `
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-primary" onclick="acceptAssignedTask('${t.id}')">Accept Task</button>
                    <button class="btn btn-secondary" style="border-color: var(--accent-red); color: var(--accent-red);" onclick="rejectAssignedTask('${t.id}')">Reject Task</button>
                </div>
            `;
        } else if (t.status === 'completed') {
            buttonsHtml = `<div style="margin-top: 15px; color: var(--accent-green); font-weight: bold; padding-top: 10px; border-top: 1px solid var(--border-color);">Task Accepted and In Progress</div>`;
        }
        
        div.innerHTML = `
            <div style="padding: 15px; background: var(--bg-tertiary); border-radius: 10px; border-left: 4px solid var(--accent-green); box-shadow: var(--shadow-sm);">
                <strong style="color: var(--accent-green); font-size: 1.1rem; display: block; margin-bottom: 10px;">✓ Task Assigned</strong>
                <div style="color: var(--text-secondary); margin-bottom: 5px;"><strong>Type:</strong> ${t.required_job_type}</div>
                <div style="color: var(--text-secondary); margin-bottom: 5px;"><strong>Location:</strong> (${t.lat}, ${t.lng})</div>
                <div style="color: var(--text-secondary); margin-bottom: 5px;"><strong>Task ID:</strong> ${t.id}</div>
                ${buttonsHtml}
            </div>`;
    } else {
        div.innerHTML = '<div style="color: var(--text-muted); padding: 10px;">No active task.</div>';
    }
}

// --- Admin Logic ---
let adminUserEmails = {};

async function loadAdminData() {
    try {
        const emailRes = await fetch(API_URL + '/api/users');
        if (emailRes.ok) adminUserEmails = await emailRes.json();
    } catch (e) {
        console.warn("Could not load user emails");
    }

    const [tasksRes, workersRes] = await Promise.all([
        supabaseClient.from('tasks').select('*'),
        supabaseClient.from('worker_profiles').select('*')
    ]);
    
    if (!tasksRes.error) adminTasks = tasksRes.data;
    if (!workersRes.error) adminWorkers = workersRes.data;
    
    updateAdminUI();
    renderMap();
    if (!isAnimating) renderAssignedHistory();
}

function renderAssignedHistory() {
    const historyDiv = document.getElementById('proposal-history');
    if (!historyDiv) return;
    historyDiv.innerHTML = ''; // Clear previous history
    
    let historyHtml = '';
    adminTasks.forEach((t, tIdx) => {
        if (t.assigned_worker_id && ['matched', 'completed'].includes(t.status)) {
            const wIdx = adminWorkers.findIndex(worker => worker.user_id === t.assigned_worker_id);
            if (wIdx !== -1) {
                if (t.status === 'matched') {
                    historyHtml += `<div class="history-entry accepted" style="margin-bottom: 5px;"><span>W${wIdx+1}</span><span class="arrow">→</span><span>T${tIdx+1}</span><span class="result-text" style="color: var(--accent-orange);">Pending Worker Action</span></div>`;
                } else if (t.status === 'completed') {
                    historyHtml += `<div class="history-entry accepted" style="margin-bottom: 5px;"><span>W${wIdx+1}</span><span class="arrow">→</span><span>T${tIdx+1}</span><span class="result-text accepted" style="color: var(--accent-green);">★ Accepted</span></div>`;
                } else if (t.status === 'rejected') {
                    historyHtml += `<div class="history-entry accepted" style="margin-bottom: 5px; border-left-color: var(--accent-red);"><span>W${wIdx+1}</span><span class="arrow">→</span><span>T${tIdx+1}</span><span class="result-text" style="color: var(--accent-red);">✕ Rejected</span></div>`;
                }
            }
        }
    });
    
    if (historyHtml) {
        historyDiv.innerHTML = '<div style="margin-bottom: 10px; font-weight: bold; color: var(--text-muted); font-size: 0.85rem;">Loaded from Database:</div>' + historyHtml;
    } else {
        historyDiv.innerHTML = '<div style="color: var(--text-muted); padding: 10px;">No history yet.</div>';
    }
}

function updateAdminUI() {
    const availWorkers = adminWorkers.filter(w => w.is_available);
    const pendTasks = adminTasks.filter(t => t.status === 'pending');
    
    const wCount = document.getElementById('db-workers-count');
    const tCount = document.getElementById('db-tasks-count');
    const sWCount = document.getElementById('stat-workers');
    const sTCount = document.getElementById('stat-tasks');
    
    if (wCount) wCount.textContent = availWorkers.length;
    if (tCount) tCount.textContent = pendTasks.length;
    if (sWCount) sWCount.textContent = adminWorkers.length;
    if (sTCount) sTCount.textContent = adminTasks.length;
    
    const matched = adminTasks.filter(t => t.assigned_worker_id).length;
    const sMatch = document.getElementById('stat-matched');
    if (sMatch) sMatch.textContent = matched;
    
    // Update matches table
    const tbody = document.getElementById('matches-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        adminTasks.forEach((t, i) => {
            if (t.assigned_worker_id) {
                const tr = document.createElement('tr');
                const wIdx = adminWorkers.findIndex(w => w.user_id === t.assigned_worker_id) + 1;
                tr.innerHTML = `<td>W${wIdx}</td><td>T${i+1}</td><td><span class="status-matched">Matched</span></td>`;
                tbody.appendChild(tr);
            }
        });
    }
}

function setupAdminRealtime() {
    realtimeSubscription = supabaseClient.channel('public-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
            if (payload.eventType === 'INSERT') {
                adminTasks.push(payload.new);
            } else if (payload.eventType === 'UPDATE') {
                const idx = adminTasks.findIndex(t => t.id === payload.new.id);
                if (idx !== -1) adminTasks[idx] = payload.new;
            }
            if (!isAnimating) {
                updateAdminUI();
                renderMap();
                renderAssignedHistory();
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_profiles' }, payload => {
            if (payload.eventType === 'INSERT') {
                adminWorkers.push(payload.new);
            } else if (payload.eventType === 'UPDATE') {
                const idx = adminWorkers.findIndex(w => w.user_id === payload.new.user_id);
                if (idx !== -1) adminWorkers[idx] = payload.new;
            }
            if (!isAnimating) {
                updateAdminUI();
                renderMap();
                renderAssignedHistory();
            }
        })
        .subscribe();
}

function renderMap() {
    const svg = document.getElementById('spatial-svg');
    if (!svg) return;
    svg.innerHTML = '';
    
    // Grid pattern
    const defs = document.createElementNS(SVG_NS, 'defs');
    const pattern = document.createElementNS(SVG_NS, 'pattern');
    pattern.setAttribute('id', 'grid');
    pattern.setAttribute('width', '40');
    pattern.setAttribute('height', '40');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 40 0 L 0 0 0 40');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#334155');
    path.setAttribute('stroke-width', '0.5');
    pattern.appendChild(path);
    defs.appendChild(pattern);
    svg.appendChild(defs);
    
    const bgRect = document.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'url(#grid)');
    svg.appendChild(bgRect);
    
    // Match edges
    adminTasks.forEach(t => {
        if (t.assigned_worker_id) {
            const w = adminWorkers.find(worker => worker.user_id === t.assigned_worker_id);
            if (w) {
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', w.current_lat);
                line.setAttribute('y1', w.current_lng);
                line.setAttribute('x2', t.lat);
                line.setAttribute('y2', t.lng);
                line.setAttribute('class', 'match-edge');
                svg.appendChild(line);
            }
        }
    });

    // Workers
    adminWorkers.forEach((w, i) => {
        if (w.current_lat === null || w.current_lng === null) return; // Don't draw if cleared
        
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'worker-node');
        g.setAttribute('transform', `translate(${w.current_lat}, ${w.current_lng})`);
        
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', '18');
        circle.setAttribute('fill', w.is_available ? '#3b82f6' : '#1e40af');
        circle.setAttribute('stroke', '#1e3a8a');
        circle.setAttribute('stroke-width', '2');
        
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = 'W' + (i + 1);
        text.setAttribute('y', '4');
        
        const title = document.createElementNS(SVG_NS, 'title');
        const email = adminUserEmails[w.user_id] || w.user_id;
        title.textContent = `Worker: W${i+1}\nUser: ${email}\nRole: ${w.job_type}\nStatus: ${w.is_available ? 'Available' : 'Busy'}\nLocation: (${w.current_lat}, ${w.current_lng})`;
        g.appendChild(title);
        
        g.appendChild(circle);
        g.appendChild(text);
        svg.appendChild(g);
    });

    // Tasks
    adminTasks.forEach((t, i) => {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'task-node');
        g.setAttribute('transform', `translate(${t.lat}, ${t.lng})`);
        
        const rect = document.createElementNS(SVG_NS, 'rect');
        const size = 30;
        const half = size / 2;
        rect.setAttribute('x', -half);
        rect.setAttribute('y', -half);
        rect.setAttribute('width', size);
        rect.setAttribute('height', size);
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', t.assigned_worker_id ? '#b45309' : '#f59e0b');
        rect.setAttribute('stroke', '#78350f');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('transform', 'rotate(45)');
        
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = 'T' + (i + 1);
        text.setAttribute('y', '4');
        
        const title = document.createElementNS(SVG_NS, 'title');
        const email = adminUserEmails[t.requester_id] || t.requester_id;
        title.textContent = `Task: T${i+1}\nRequester: ${email}\nRequired: ${t.required_job_type}\nStatus: ${t.status}\nLocation: (${t.lat}, ${t.lng})`;
        g.appendChild(title);
        
        g.appendChild(rect);
        g.appendChild(text);
        svg.appendChild(g);
    });
}

async function handleRunMatching() {
    const btn = document.getElementById('btn-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Running...'; }
    
    document.getElementById('step-explanation').textContent = "Fetching matches from server...";
    
    try {
        const mode = document.getElementById('algorithm-mode').value;
        const response = await fetch(API_URL + '/api/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode })
        });
        
        if (!response.ok) throw new Error('Matching API failed');
        const data = await response.json();
        
        if (data.steps && data.steps.length > 0) {
            const sp = document.getElementById('stat-proposals');
            if (sp) sp.textContent = data.steps.length;
            animateServerSteps(data.steps);
        } else {
            document.getElementById('step-explanation').textContent = "No valid proposals found.";
            loadAdminData();
        }
    } catch (e) {
        console.error(e);
        alert('Failed to run matching.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '▶ Run Matching (Server)'; }
    }
}

function animateServerSteps(steps) {
    isAnimating = true;
    const svg = document.getElementById('spatial-svg');
    const speedSlider = document.getElementById('speed-slider');
    const speed = speedSlider ? parseInt(speedSlider.value, 10) : 800;
    
    let delay = 0;
    const historyDiv = document.getElementById('proposal-history');
    if (historyDiv) historyDiv.innerHTML = '';
    
    steps.forEach((step, stepIndex) => {
        setTimeout(() => {
            const wIdx = adminWorkers.findIndex(worker => worker.user_id === step.worker_id);
            const tIdx = adminTasks.findIndex(task => task.id === step.task_id);
            const w = adminWorkers[wIdx];
            const t = adminTasks[tIdx];
            if (!w || !t) return;

            document.getElementById('current-step-display').textContent = `Step ${stepIndex + 1}`;
            
            let resultHtml = "";

            if (step.type === 'proposal') {
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', w.current_lat);
                line.setAttribute('y1', w.current_lng);
                line.setAttribute('x2', t.lat);
                line.setAttribute('y2', t.lng);
                line.setAttribute('class', 'animation-path');
                svg.appendChild(line);
                setTimeout(() => line.remove(), speed);
                
                document.getElementById('current-proposal-display').innerHTML = `<span style="color:var(--accent-purple)">W${wIdx+1} &rarr; T${tIdx+1}</span>`;
                document.getElementById('step-explanation').textContent = `Worker W${wIdx+1} proposes to Task T${tIdx+1}.`;
            } else if (step.type === 'accept') {
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', w.current_lat);
                line.setAttribute('y1', w.current_lng);
                line.setAttribute('x2', t.lat);
                line.setAttribute('y2', t.lng);
                line.setAttribute('class', 'match-edge');
                svg.appendChild(line);
                
                document.getElementById('step-explanation').textContent = `Task T${tIdx+1} assigns Worker W${wIdx+1}.`;
                resultHtml = `<div class="history-entry accepted"><span>W${wIdx+1}</span><span class="arrow">→</span><span>T${tIdx+1}</span><span class="result-text accepted">✓ Assigned</span></div>`;
            } else if (step.type === 'reject') {
                const rejectCircle = document.createElementNS(SVG_NS, 'circle');
                rejectCircle.setAttribute('cx', t.lat);
                rejectCircle.setAttribute('cy', t.lng);
                rejectCircle.setAttribute('r', 25);
                rejectCircle.setAttribute('fill', 'none');
                rejectCircle.setAttribute('stroke', '#f87171');
                rejectCircle.setAttribute('stroke-width', '2');
                svg.appendChild(rejectCircle);
                setTimeout(() => rejectCircle.remove(), speed / 2);
                
                document.getElementById('step-explanation').textContent = `Task T${tIdx+1} rejects Worker W${wIdx+1}.`;
                resultHtml = `<div class="history-entry rejected"><span>W${wIdx+1}</span><span class="arrow">→</span><span>T${tIdx+1}</span><span class="result-text rejected">✗ Rejected</span></div>`;
            }
            
            if (resultHtml && historyDiv) {
                historyDiv.insertAdjacentHTML('afterbegin', resultHtml);
            }
            
        }, delay);
        delay += speed;
    });
    
    setTimeout(() => {
        isAnimating = false;
        document.getElementById('step-explanation').innerHTML = "<strong>Algorithm Complete!</strong> Server execution finished.";
        document.getElementById('algorithm-status-badge').textContent = "Completed";
        
        // Show summary overlay
        const overlay = document.getElementById('completion-overlay');
        const matchedCount = adminTasks.filter(t => t.assigned_worker_id).length;
        document.getElementById('summary-matched').textContent = matchedCount;
        document.getElementById('summary-proposals').textContent = steps.length;
        
        if (overlay) {
            overlay.classList.remove('hidden');
            // Force reflow for transitions
            void overlay.offsetWidth;
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
            overlay.querySelector('.modal-container').style.transform = 'translateY(0)';
            
            document.getElementById('btn-close-summary').onclick = () => {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                overlay.querySelector('.modal-container').style.transform = 'translateY(20px)';
                setTimeout(() => overlay.classList.add('hidden'), 300);
            };
        }
        
        loadAdminData(); // Refresh final matches state
    }, delay + 500);
}
