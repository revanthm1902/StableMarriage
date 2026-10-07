let supabaseClient;
let currentUser = null;
let currentRole = null;
let realtimeSubscription = null;

// Admin State
let adminTasks = [];
let adminWorkers = [];
let adminUserEmails = {};
let isAnimating = false;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');
const userInfo = document.getElementById('user-info');
const authError = document.getElementById('auth-error');
const API_URL = 'http://localhost:3000';
const SVG_NS = "http://www.w3.org/2000/svg";

const dashboards = {
    requester: document.getElementById('requester-dashboard'),
    worker: document.getElementById('worker-dashboard'),
    admin: document.getElementById('admin-dashboard')
};

// Listeners
document.getElementById('btn-login').addEventListener('click', handleLogin);
document.getElementById('btn-register').addEventListener('click', handleRegister);
document.getElementById('btn-logout').addEventListener('click', handleLogout);
if (document.getElementById('btn-theme')) {
    document.getElementById('btn-theme').addEventListener('click', () => {
        const html = document.documentElement;
        html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
    });
}
document.getElementById('btn-create-task').addEventListener('click', handleCreateTask);
document.getElementById('btn-update-worker').addEventListener('click', handleUpdateWorkerProfile);
if (document.getElementById('btn-start')) document.getElementById('btn-start').addEventListener('click', handleRunMatching);
if (document.getElementById('btn-clear-db')) document.getElementById('btn-clear-db').addEventListener('click', handleClearDB);
if (document.getElementById('btn-randomize-task')) document.getElementById('btn-randomize-task').addEventListener('click', randomizeTaskInputs);
if (document.getElementById('btn-randomize-worker')) document.getElementById('btn-randomize-worker').addEventListener('click', randomizeWorkerInputs);

// Star rating UI
document.querySelectorAll('.star-rating span').forEach(star => {
    star.addEventListener('click', function() {
        const val = this.getAttribute('data-val');
        document.getElementById('rating-val').value = val;
        document.querySelectorAll('.star-rating span').forEach(s => {
            s.classList.toggle('active', s.getAttribute('data-val') <= val);
        });
    });
});

async function handleClearDB() {
    if(!confirm('Are you sure you want to delete all tasks and workers from the simulation?')) return;
    try {
        await fetch(API_URL + '/api/clear', { method: 'POST' });
        loadAdminData();
    } catch(e) {
        alert('Failed to clear DB');
    }
}

function randomizeTaskInputs() {
    document.getElementById('task-x').value = Math.floor(Math.random() * 700) + 50;
    document.getElementById('task-y').value = Math.floor(Math.random() * 500) + 50;
}
function randomizeWorkerInputs() {
    document.getElementById('worker-x').value = Math.floor(Math.random() * 700) + 50;
    document.getElementById('worker-y').value = Math.floor(Math.random() * 500) + 50;
}

// Initial Setup
async function initializeApp() {
    try {
        const response = await fetch(API_URL + '/api/config');
        if (!response.ok) throw new Error('Config fetch failed');
        const config = await response.json();
        
        supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') checkUserAndRoute();
        });
    } catch(e) {
        authError.textContent = "Cannot connect to server. Ensure 'node server.js' is running.";
    }
}
initializeApp();

async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    authError.textContent = '';
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { authError.textContent = 'Login Error: ' + error.message; return; }
    await checkUserAndRoute();
}

async function handleRegister() {
    const roleSelect = document.getElementById('role-select');
    if (roleSelect && !roleSelect.value) { authError.textContent = 'Please select a role.'; return; }
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = roleSelect.value;
    authError.textContent = 'Registering...';
    try {
        const response = await fetch(API_URL + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });
        const data = await response.json();
        if (!response.ok) authError.textContent = 'Registration Error: ' + (data.error || 'Unknown error');
        else authError.textContent = "Registration successful! You can now login.";
    } catch(e) {
        authError.textContent = "Registration failed.";
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    currentUser = null;
    currentRole = null;
    if (realtimeSubscription) supabaseClient.removeChannel(realtimeSubscription);
    showScreen('auth');
}

async function checkUserAndRoute() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (user) {
        currentUser = user;
        const { data, error } = await supabaseClient.from('user_roles').select('role').eq('user_id', user.id).single();
        if (error || !data) {
            await supabaseClient.auth.signOut();
            showScreen('auth');
            return;
        }
        currentRole = data.role;
        userInfo.textContent = `User: ${user.email.split('@')[0]} (${currentRole})`;
        
        // Fetch emails for alphabetic sorting
        try {
            const emailRes = await fetch(API_URL + '/api/users');
            if (emailRes.ok) adminUserEmails = await emailRes.json();
        } catch(e){}

        showScreen('app', currentRole);
        initializeDashboard(currentRole);
    } else {
        showScreen('auth');
    }
}

function showScreen(screen, role = null) {
    authScreen.style.display = screen === 'auth' ? 'block' : 'none';
    appContainer.style.display = screen === 'app' ? 'flex' : 'none';
    if (screen === 'app' && role) {
        Object.keys(dashboards).forEach(r => { if(dashboards[r]) dashboards[r].classList.add('hidden'); });
        if(dashboards[role]) dashboards[role].classList.remove('hidden');
        
        const stats = document.getElementById('stats-bar');
        if (stats) stats.classList.toggle('hidden', role !== 'admin');
    }
}

function initializeDashboard(role) {
    if (realtimeSubscription) supabaseClient.removeChannel(realtimeSubscription);
    
    if (role === 'requester') {
        loadRequesterTasks();
        realtimeSubscription = supabaseClient.channel('requester-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadRequesterTasks())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_offers' }, () => loadRequesterTasks())
            .subscribe();
    } else if (role === 'worker') {
        loadWorkerProfile();
        loadWorkerAssignedTask();
        realtimeSubscription = supabaseClient.channel('worker-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadWorkerAssignedTask())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_offers' }, () => loadWorkerAssignedTask())
            .subscribe();
    } else if (role === 'admin') {
        loadAdminData();
        setupAdminRealtime();
    }
}

// ================= REQUESTER LOGIC =================

async function handleCreateTask() {
    const x = parseFloat(document.getElementById('task-x').value);
    const y = parseFloat(document.getElementById('task-y').value);
    let type = document.getElementById('task-type').value;
    if (type === 'Other') type = document.getElementById('task-type-custom').value.trim();
    const msg = document.getElementById('task-msg');
    
    if (isNaN(x) || isNaN(y) || !type) { msg.textContent = 'Invalid inputs.'; return; }

    const { error } = await supabaseClient.from('tasks').insert([{ requester_id: currentUser.id, lat: x, lng: y, required_job_type: type, status: 'pending' }]);
    if (error) msg.textContent = 'Error: ' + error.message;
    else {
        msg.textContent = 'Task posted!';
        document.getElementById('task-x').value = '';
        document.getElementById('task-y').value = '';
        loadRequesterTasks();
    }
}

async function loadRequesterTasks() {
    const { data: tasks } = await supabaseClient.from('tasks').select('*').eq('requester_id', currentUser.id).order('created_at', { ascending: false });
    if (!tasks) return;
    
    const activeList = document.getElementById('requester-tasks-list');
    const completedList = document.getElementById('requester-completed-tasks-list');
    activeList.innerHTML = ''; completedList.innerHTML = '';
    
    for (const t of tasks) {
        if (t.status === 'completed') {
            completedList.innerHTML += `<li class="task-item" style="border-left-color:var(--accent-green)">Type: ${t.required_job_type} | ID: ${t.id} - <strong>Completed</strong></li>`;
            continue;
        }
        
        let extraHtml = '';
        
        if (t.status === 'offered') {
            // Count accepted workers
            const { data: offers } = await supabaseClient.from('task_offers').select('worker_id').eq('task_id', t.id).eq('status', 'accepted_by_worker');
            const acceptedCount = offers ? offers.length : 0;
            if (acceptedCount > 0) {
                extraHtml = `<button class="blinking-badge" onclick="openWorkerSelection('${t.id}')">🔔 ${acceptedCount} Workers Accepted</button>`;
            } else {
                extraHtml = `<span style="font-size:0.8rem; color:var(--text-muted); margin-left:10px;">Waiting for worker replies...</span>`;
            }
        } else if (t.status === 'assigned') {
            extraHtml = `<button class="btn btn-primary" style="margin:0 0 0 10px; width:auto; padding:4px 10px; display:inline-block;" onclick="openRateModal('${t.id}', '${t.assigned_worker_id}')">Finish & Rate</button>`;
        } else if (t.status === 'pending') {
            extraHtml = `<button class="btn btn-secondary" style="margin:0 0 0 10px; width:auto; padding:4px 10px; display:inline-block;" onclick="deleteTask('${t.id}')">Delete</button>`;
        }
        
        activeList.innerHTML += `<li class="task-item">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${t.required_job_type}</strong> | Loc: (${t.lat}, ${t.lng}) | Status: <span style="color:var(--accent-blue); text-transform:uppercase; font-size:0.8rem;">${t.status}</span></div>
                <div>${extraHtml}</div>
            </div>
        </li>`;
    }
}

window.deleteTask = async function(id) {
    await fetch(API_URL + '/api/tasks/' + id, { method: 'DELETE' });
    loadRequesterTasks();
};

window.openWorkerSelection = async function(taskId) {
    // Fetch workers who accepted
    const { data: offers } = await supabaseClient.from('task_offers')
        .select(`worker_id`)
        .eq('task_id', taskId)
        .eq('status', 'accepted_by_worker');
        
    const listDiv = document.getElementById('worker-selection-list');
    listDiv.innerHTML = '';
    
    if (!offers || offers.length === 0) {
        listDiv.innerHTML = 'No accepted offers yet.';
    } else {
        const workerIds = offers.map(o => o.worker_id);
        const { data: profiles } = await supabaseClient.from('worker_profiles').select('*').in('user_id', workerIds);
        
        // Sort logic
        const sorted = offers.map(o => {
            const p = (profiles || []).find(x => x.user_id === o.worker_id) || {};
            return {
                id: o.worker_id,
                email: adminUserEmails[o.worker_id] || 'Unknown',
                rating: p.rating || 0,
                experience: p.experience || 0
            };
        }).sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            if (b.experience !== a.experience) return b.experience - a.experience;
            return a.email.localeCompare(b.email);
        });
        
        sorted.forEach(w => {
            listDiv.innerHTML += `
                <div class="worker-card">
                    <div>
                        <strong>${w.email}</strong><br>
                        <span style="font-size:0.8rem; color:var(--text-muted)">★ ${Number(w.rating).toFixed(1)} | Exp: ${w.experience} jobs</span>
                    </div>
                    <button class="btn btn-primary" style="width:auto; padding:5px 12px;" onclick="approveWorker('${taskId}', '${w.id}')">Approve</button>
                </div>
            `;
        });
    }
    
    document.getElementById('worker-selection-modal').classList.remove('hidden');
};

window.approveWorker = async function(taskId, workerId) {
    await fetch(API_URL + '/api/tasks/approve_worker', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ task_id: taskId, worker_id: workerId })
    });
    document.getElementById('worker-selection-modal').classList.add('hidden');
    loadRequesterTasks();
};

window.openRateModal = function(taskId, workerId) {
    document.getElementById('btn-submit-rating').onclick = async () => {
        const rating = document.getElementById('rating-val').value;
        await fetch(API_URL + '/api/tasks/rate_worker', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ task_id: taskId, worker_id: workerId, rating: parseInt(rating) })
        });
        document.getElementById('rate-worker-modal').classList.add('hidden');
        loadRequesterTasks();
    };
    document.getElementById('rate-worker-modal').classList.remove('hidden');
};

// ================= WORKER LOGIC =================

async function loadWorkerProfile() {
    const { data } = await supabaseClient.from('worker_profiles').select('*').eq('user_id', currentUser.id).single();
    if (data) {
        document.getElementById('worker-x').value = '';
        document.getElementById('worker-y').value = '';
        document.getElementById('worker-available').checked = data.is_available;
        document.getElementById('worker-rating').textContent = Number(data.rating || 0).toFixed(1);
        document.getElementById('worker-experience').textContent = data.experience || 0;
        
        const jobSelect = document.getElementById('worker-job-type');
        let found = false;
        for (let i = 0; i < jobSelect.options.length; i++) {
            if (jobSelect.options[i].value === data.job_type) { jobSelect.selectedIndex = i; found = true; break; }
        }
        if (!found && data.job_type) {
            jobSelect.value = 'Other';
            document.getElementById('worker-job-custom').style.display = 'block';
            document.getElementById('worker-job-custom').value = data.job_type;
        }
    }
}

async function handleUpdateWorkerProfile() {
    const x = parseFloat(document.getElementById('worker-x').value);
    const y = parseFloat(document.getElementById('worker-y').value);
    const available = document.getElementById('worker-available').checked;
    let type = document.getElementById('worker-job-type').value;
    if (type === 'Other') type = document.getElementById('worker-job-custom').value.trim();
    
    if (isNaN(x) || isNaN(y)) return;
    
    await supabaseClient.from('worker_profiles').upsert({ user_id: currentUser.id, current_lat: x, current_lng: y, is_available: available, job_type: type });
    document.getElementById('worker-msg').textContent = 'Profile updated!';
}

async function loadWorkerAssignedTask() {
    const div = document.getElementById('worker-assigned-task');
    const compDiv = document.getElementById('worker-completed-tasks-list');
    if (!div || !compDiv) return;
    
    try {
        const response = await fetch(`${API_URL}/api/worker_dashboard/${currentUser.id}`);
        const data = await response.json();
        
        const tasks = data.tasks;
        const offers = data.offers;
        
        let hasContent = false;
        div.innerHTML = ''; 
        compDiv.innerHTML = '';
        
        if (tasks && tasks.length > 0) {
            tasks.forEach(t => {
                if (t.status === 'completed') {
                    compDiv.innerHTML += `<li class="task-item" style="border-left-color:var(--accent-green)">Type: ${t.required_job_type} | ID: ${t.id} - <strong>Completed</strong></li>`;
                } else if (t.status === 'assigned') {
                    hasContent = true;
                    div.innerHTML += `
                        <div style="padding:15px; background:var(--bg-tertiary); border-radius:10px; border-left:4px solid var(--accent-green);">
                            <strong style="color:var(--accent-green); display:block; margin-bottom:10px;">✓ Active Task Assigned to You!</strong>
                            <div><strong>Type:</strong> ${t.required_job_type}</div>
                            <div><strong>Loc:</strong> (${t.lat}, ${t.lng})</div>
                            <div style="margin-top:10px; font-size:0.85rem; color:var(--text-muted);">Please wait for the requester to mark it as completed.</div>
                        </div>`;
                }
            });
        }
        
        if (offers && offers.length > 0) {
            offers.forEach(o => {
                const t = o.tasks;
                if (!t) return;
                if (o.status === 'pending_worker') {
                    hasContent = true;
                    div.innerHTML += `
                        <div style="padding:15px; margin-bottom:10px; background:var(--bg-tertiary); border-radius:10px; border-left:4px solid var(--accent-purple);">
                            <strong style="color:var(--accent-purple); display:block; margin-bottom:10px;">You have a new offer!</strong>
                            <div><strong>Type:</strong> ${t.required_job_type}</div>
                            <div><strong>Loc:</strong> (${t.lat}, ${t.lng})</div>
                            <div style="margin-top:10px; display:flex; gap:10px;">
                                <button class="btn btn-primary" onclick="replyOffer('${t.id}', 'accept')">Accept</button>
                                <button class="btn btn-secondary" onclick="replyOffer('${t.id}', 'reject')">Reject</button>
                            </div>
                        </div>`;
                } else if (o.status === 'accepted_by_worker' && t.status === 'offered') {
                    hasContent = true;
                    div.innerHTML += `
                        <div style="padding:15px; margin-bottom:10px; background:var(--bg-tertiary); border-radius:10px; border-left:4px solid var(--accent-blue);">
                            <strong style="color:var(--accent-blue); display:block; margin-bottom:10px;">✓ Offer Accepted</strong>
                            <div><strong>Type:</strong> ${t.required_job_type}</div>
                            <div><strong>Loc:</strong> (${t.lat}, ${t.lng})</div>
                            <div style="margin-top:10px; font-size:0.85rem; color:var(--text-muted);">Waiting for Requester approval...</div>
                        </div>`;
                }
            });
        }
        
        if (!hasContent) {
            div.innerHTML = '<div style="color:var(--text-muted); padding: 10px;">No active tasks or offers.</div>';
        }
    } catch(err) {
        div.innerHTML = `<div style="color:var(--accent-red); padding: 10px;">Error loading tasks: ${err.message}</div>`;
    }
}

window.replyOffer = async function(taskId, action) {
    const endpoint = action === 'accept' ? '/api/task_offers/accept' : '/api/task_offers/reject';
    await fetch(API_URL + endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ task_id: taskId, worker_id: currentUser.id })
    });
    loadWorkerAssignedTask();
};

// ================= ADMIN LOGIC =================

async function loadAdminData() {
    const [tasksRes, workersRes, offersRes] = await Promise.all([
        supabaseClient.from('tasks').select('*'),
        supabaseClient.from('worker_profiles').select('*'),
        supabaseClient.from('task_offers').select('*')
    ]);
    
    if (!tasksRes.error) adminTasks = tasksRes.data;
    if (!workersRes.error) adminWorkers = workersRes.data;
    window.adminOffers = offersRes.data || [];
    
    updateAdminUI();
    renderMap();
    if (!isAnimating) renderAssignedHistory();
}

function renderAssignedHistory() {
    const historyDiv = document.getElementById('proposal-history');
    if (!historyDiv) return;
    historyDiv.innerHTML = '';
    
    let historyHtml = '';
    adminTasks.forEach((t, tIdx) => {
        if (t.assigned_worker_id && ['assigned', 'completed'].includes(t.status)) {
            const wIdx = adminWorkers.findIndex(worker => worker.user_id === t.assigned_worker_id);
            if (wIdx !== -1) {
                if (t.status === 'assigned') {
                    historyHtml += `<div class="history-entry accepted" style="margin-bottom: 5px;"><span>T${tIdx+1}</span><span class="arrow">→</span><span>W${wIdx+1}</span><span class="result-text accepted">✓ Assigned</span></div>`;
                } else if (t.status === 'completed') {
                    historyHtml += `<div class="history-entry accepted" style="margin-bottom: 5px;"><span>T${tIdx+1}</span><span class="arrow">→</span><span>W${wIdx+1}</span><span class="result-text accepted">★ Completed</span></div>`;
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
    const wEl = document.getElementById('stat-workers');
    const tEl = document.getElementById('stat-tasks');
    if (wEl) wEl.textContent = adminWorkers.length;
    if (tEl) tEl.textContent = adminTasks.length;
    
    const tbody = document.getElementById('matches-tbody');
    if (tbody) {
        tbody.innerHTML = '';
        adminTasks.forEach((t, i) => {
            if (t.status !== 'pending' && t.status !== 'pending_matching') {
                const tr = document.createElement('tr');
                let statusClass = 'status-badge status-badge-offered';
                let wText = 'Multiple (Offered)';
                let displayStatus = t.status;
                
                if (t.assigned_worker_id) {
                    const wIdx = adminWorkers.findIndex(w => w.user_id === t.assigned_worker_id) + 1;
                    wText = 'W' + wIdx;
                    statusClass = t.status === 'assigned' ? 'status-badge status-badge-blue' : 'status-badge status-badge-completed';
                } else if (t.status === 'offered') {
                    const accepted = (window.adminOffers || []).filter(o => o.task_id === t.id && o.status === 'accepted_by_worker');
                    if (accepted.length > 0) {
                        displayStatus = 'Accepted';
                        statusClass = 'status-badge status-badge-blue';
                    }
                }
                
                tr.innerHTML = `<td>${wText}</td><td>T${i+1}</td><td><span class="${statusClass}" style="background:var(--bg-hover); padding:3px 6px; border-radius:4px; font-size:0.75rem;">${displayStatus}</span></td>`;
                tbody.appendChild(tr);
            }
        });
    }
}

function setupAdminRealtime() {
    realtimeSubscription = supabaseClient.channel('public-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, payload => {
            if (!isAnimating) loadAdminData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_profiles' }, payload => {
            if (!isAnimating) loadAdminData();
        })
        .subscribe();
}

function renderMap() {
    const svg = document.getElementById('spatial-svg');
    if (!svg) return;
    svg.innerHTML = '';
    
    const defs = document.createElementNS(SVG_NS, 'defs');
    const pattern = document.createElementNS(SVG_NS, 'pattern');
    pattern.setAttribute('id', 'grid');
    pattern.setAttribute('width', '40');
    pattern.setAttribute('height', '40');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 40 0 L 0 0 0 40');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'var(--grid-line-color)');
    path.setAttribute('stroke-width', '0.5');
    pattern.appendChild(path);
    defs.appendChild(pattern);
    svg.appendChild(defs);
    
    const bgRect = document.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'url(#grid)');
    svg.appendChild(bgRect);
    
    // Draw edges
    adminTasks.forEach(t => {
        if (t.assigned_worker_id) {
            const w = adminWorkers.find(worker => worker.user_id === t.assigned_worker_id);
            if (w && w.current_lat) drawEdge(svg, w.current_lat, w.current_lng, t.lat, t.lng, 'match-edge');
        } else if (t.status === 'offered') {
            const offers = window.adminOffers.filter(o => o.task_id === t.id);
            offers.forEach(o => {
                const w = adminWorkers.find(worker => worker.user_id === o.worker_id);
                if (w && w.current_lat) drawEdge(svg, w.current_lat, w.current_lng, t.lat, t.lng, 'animation-path'); // Use purple line for offers
            });
        }
    });

    adminWorkers.forEach((w, i) => {
        if (w.current_lat === null) return; 
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'worker-node');
        g.setAttribute('transform', `translate(${w.current_lat}, ${w.current_lng})`);
        
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', '18');
        circle.setAttribute('fill', w.is_available ? 'var(--worker-fill)' : 'var(--worker-fill-matched)');
        circle.setAttribute('stroke', 'var(--worker-stroke)');
        circle.setAttribute('stroke-width', '2');
        
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = 'W' + (i + 1);
        text.setAttribute('y', '4');

        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = `Worker: W${i+1}\nUser: ${adminUserEmails[w.user_id] || 'Unknown'}\nRating: ${Number(w.rating||0).toFixed(1)} ★\nExperience: ${w.experience||0}`;
        
        g.appendChild(title);
        g.appendChild(circle);
        g.appendChild(text);
        svg.appendChild(g);
    });

    adminTasks.forEach((t, i) => {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'task-node');
        g.setAttribute('transform', `translate(${t.lat}, ${t.lng})`);
        
        const rect = document.createElementNS(SVG_NS, 'rect');
        const size = 30;
        rect.setAttribute('x', -size/2);
        rect.setAttribute('y', -size/2);
        rect.setAttribute('width', size);
        rect.setAttribute('height', size);
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', t.status !== 'pending' ? 'var(--task-fill-matched)' : 'var(--task-fill)');
        rect.setAttribute('stroke', 'var(--task-stroke)');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('transform', 'rotate(45)');
        
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = 'T' + (i + 1);
        text.setAttribute('y', '4');

        const title = document.createElementNS(SVG_NS, 'title');
        title.textContent = `Task: T${i+1}\nRequester: ${adminUserEmails[t.requester_id] || 'Unknown'}\nType: ${t.required_job_type}\nStatus: ${t.status}`;
        
        g.appendChild(title);
        g.appendChild(rect);
        g.appendChild(text);
        svg.appendChild(g);
    });
}

function drawEdge(svg, x1, y1, x2, y2, className) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', className);
    svg.appendChild(line);
    return line;
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
        const data = await response.json();
        
        if (data.steps && data.steps.length > 0) {
            const sp = document.getElementById('stat-proposals');
            if (sp) sp.textContent = data.steps.length;
            await animateServerSteps(data.steps);
        } else {
            document.getElementById('step-explanation').textContent = "No valid proposals found. (Make sure pending Tasks and available Workers have matching Job Types!)";
            loadAdminData();
        }
    } catch (e) {
        alert('Failed to run matching.');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '▶ Run Matching (Server)'; }
    }
}

function animateServerSteps(steps) {
    isAnimating = true;
    const svg = document.getElementById('spatial-svg');
    const speed = parseInt(document.getElementById('speed-slider').value, 10);
    
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
                const line = drawEdge(svg, w.current_lat, w.current_lng, t.lat, t.lng, 'animation-path');
                setTimeout(() => line.remove(), speed);
                document.getElementById('step-explanation').textContent = step.proposer === 'task' 
                    ? `Task T${tIdx+1} proposes to Worker W${wIdx+1}.`
                    : `Worker W${wIdx+1} proposes to Task T${tIdx+1}.`;
                
                const propStr = step.proposer === 'task' ? `T${tIdx+1} &rarr; W${wIdx+1}` : `W${wIdx+1} &rarr; T${tIdx+1}`;
                document.getElementById('current-proposal-display').innerHTML = `<span style="color:var(--accent-purple)">${propStr}</span>`;
                
            } else if (step.type === 'accept') {
                drawEdge(svg, w.current_lat, w.current_lng, t.lat, t.lng, 'match-edge');
                document.getElementById('step-explanation').textContent = step.proposer === 'task'
                    ? `Worker W${wIdx+1} tentatively accepts Task T${tIdx+1}.`
                    : `Task T${tIdx+1} tentatively accepts Worker W${wIdx+1}.`;
                    
                const propStr = step.proposer === 'task' ? `T${tIdx+1} &rarr; W${wIdx+1}` : `W${wIdx+1} &rarr; T${tIdx+1}`;
                resultHtml = `<div class="history-entry accepted"><span>${step.proposer === 'task' ? `T${tIdx+1}` : `W${wIdx+1}`}</span><span class="arrow">→</span><span>${step.proposer === 'task' ? `W${wIdx+1}` : `T${tIdx+1}`}</span><span class="result-text accepted">✓ Accepted</span></div>`;
            } else if (step.type === 'reject') {
                document.getElementById('step-explanation').textContent = step.proposer === 'task'
                    ? `Worker W${wIdx+1} rejects Task T${tIdx+1}.`
                    : `Task T${tIdx+1} rejects Worker W${wIdx+1}.`;
                    
                resultHtml = `<div class="history-entry rejected"><span>${step.proposer === 'task' ? `T${tIdx+1}` : `W${wIdx+1}`}</span><span class="arrow">→</span><span>${step.proposer === 'task' ? `W${wIdx+1}` : `T${tIdx+1}`}</span><span class="result-text rejected">✗ Rejected</span></div>`;
            }
            
            if (resultHtml && historyDiv) historyDiv.insertAdjacentHTML('afterbegin', resultHtml);
            
        }, delay);
        delay += speed;
    });
    
    setTimeout(() => {
        isAnimating = false;
        document.getElementById('step-explanation').innerHTML = "<strong>Algorithm Complete!</strong> Server execution finished. Waiting for worker responses.";
        document.getElementById('algorithm-status-badge').textContent = "Completed";
        
        const overlay = document.getElementById('completion-overlay');
        document.getElementById('summary-matched').textContent = "Yes";
        document.getElementById('summary-proposals').textContent = steps.length;
        
        if (overlay) {
            overlay.classList.remove('hidden');
            document.getElementById('btn-close-summary').onclick = () => overlay.classList.add('hidden');
        }
        
        loadAdminData();
    }, delay + 500);
}
