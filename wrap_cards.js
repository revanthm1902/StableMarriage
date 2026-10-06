const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// For Requester Dashboard
const reqCardsRegex = /(<div class="dashboard-card">\s*<h3>Create Task<\/h3>[\s\S]*?<ul id="requester-tasks-list"><\/ul>\s*<\/div>)/;
html = html.replace(reqCardsRegex, '<div class="cards-container">\n$1\n</div>');

// For Worker Dashboard
const workerCardsRegex = /(<div class="dashboard-card">\s*<h3>My Profile Settings<\/h3>[\s\S]*?<div id="worker-assigned-task">No active task.<\/div>\s*<\/div>)/;
html = html.replace(workerCardsRegex, '<div class="cards-container">\n$1\n</div>');

fs.writeFileSync('index.html', html);
console.log('Fixed cards-container wrap!');
