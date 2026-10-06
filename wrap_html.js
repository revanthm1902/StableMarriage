const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

html = html.replace('<h2>Requester Dashboard</h2>', '<h2>Requester Dashboard</h2>\n<p style="margin-bottom:30px; color:var(--text-muted);">Manage and post your tasks.</p>');

// Wrap Create Task
html = html.replace('<h3>Create Task</h3>', '<div class="dashboard-card">\n<h3>Create Task</h3>');
html = html.replace('<div id="task-msg"></div>', '<div id="task-msg"></div>\n</div>');

// Wrap My Tasks
html = html.replace('<h3>My Tasks</h3>', '<div class="dashboard-card">\n<h3>My Tasks</h3>');
html = html.replace('</ul>', '</ul>\n</div>');

// Worker
html = html.replace('<h2>Worker Dashboard</h2>', '<h2>Worker Dashboard</h2>\n<p style="margin-bottom:30px; color:var(--text-muted);">Update your availability and find matches.</p>');
html = html.replace('<h3>My Status</h3>', '<div class="dashboard-card">\n<h3>My Profile Settings</h3>');
html = html.replace('<div id="worker-msg"></div>', '<div id="worker-msg"></div>\n</div>');

html = html.replace('<h3>Current Assigned Task</h3>', '<div class="dashboard-card">\n<h3>Current Assigned Task</h3>');
html = html.replace('<div id="worker-assigned-task">No active task.</div>', '<div id="worker-assigned-task">No active task.</div>\n</div>');

fs.writeFileSync('index.html', html);
console.log('Wrapped sections in cards successfully');
