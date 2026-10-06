const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const reqStart = html.indexOf('<div id="requester-dashboard"');
const adminStart = html.indexOf('<main id="admin-dashboard"');

if (reqStart !== -1 && adminStart !== -1) {
    const before = html.substring(0, reqStart);
    const after = html.substring(adminStart);

    const dashboards = `        <div id="requester-dashboard" class="role-dashboard hidden">
            <h2>Requester Dashboard</h2>
            <p style="margin-bottom:30px; color:var(--text-muted);">Manage and post your tasks.</p>
            
            <div class="cards-container">
                <div class="dashboard-card">
                    <h3>Create Task</h3>
                    <div style="margin-top: 10px;">Input Location (X, Y from 0-800)</div>
                    <input type="number" id="task-x" placeholder="X (0-800)" min="0" max="800">
                    <input type="number" id="task-y" placeholder="Y (0-600)" min="0" max="600">
                    <select id="task-type" onchange="document.getElementById('task-type-custom').style.display = this.value === 'Other' ? 'block' : 'none';">
                        <option value="Plumber">Plumber</option>
                        <option value="Electrician">Electrician</option>
                        <option value="Cleaner">Cleaner</option>
                        <option value="Carpenter">Carpenter</option>
                        <option value="Painter">Painter</option>
                        <option value="Delivery">Delivery</option>
                        <option value="Other">Other</option>
                    </select>
                    <input type="text" id="task-type-custom" placeholder="Specify custom task type..." style="display: none; margin-top: 8px;">
                    <button id="btn-create-task" class="btn btn-primary">Create Task</button>
                    <div id="task-msg"></div>
                </div>
                
                <div class="dashboard-card">
                    <h3>My Tasks</h3>
                    <ul id="requester-tasks-list"></ul>
                </div>
            </div>
        </div>

        <div id="worker-dashboard" class="role-dashboard hidden">
            <h2>Worker Dashboard</h2>
            <p style="margin-bottom:30px; color:var(--text-muted);">Update your availability and find matches.</p>
            
            <div class="cards-container">
                <div class="dashboard-card">
                    <h3>My Profile Settings</h3>
                    <label style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="worker-available" checked style="width:auto;"> Available
                    </label>
                    <div style="margin-top: 10px;">Profession / Job Type</div>
                    <select id="worker-job-type" onchange="document.getElementById('worker-job-custom').style.display = this.value === 'Other' ? 'block' : 'none';">
                        <option value="Plumber">Plumber</option>
                        <option value="Electrician">Electrician</option>
                        <option value="Cleaner">Cleaner</option>
                        <option value="Carpenter">Carpenter</option>
                        <option value="Painter">Painter</option>
                        <option value="Delivery">Delivery</option>
                        <option value="Other">Other</option>
                    </select>
                    <input type="text" id="worker-job-custom" placeholder="Specify custom job type..." style="display: none; margin-top: 8px;">
                    <div style="margin-top: 10px;">Location (X, Y from 0-800)</div>
                    <input type="number" id="worker-x" placeholder="X (0-800)" min="0" max="800">
                    <input type="number" id="worker-y" placeholder="Y (0-600)" min="0" max="600">
                    <button id="btn-update-worker" class="btn btn-primary">Update Profile</button>
                    <div id="worker-msg"></div>
                </div>
                
                <div class="dashboard-card">
                    <h3>Current Assigned Task</h3>
                    <div id="worker-assigned-task">No active task.</div>
                </div>
            </div>
        </div>\n\n`;

    fs.writeFileSync('index.html', before + dashboards + after);
    console.log('Fixed index.html structure entirely!');
} else {
    console.log('STILL FAILED TO FIND BOUNDARIES', reqStart, adminStart);
}
