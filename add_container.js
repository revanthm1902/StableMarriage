const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Requester
html = html.replace(
    '<p style="margin-bottom:30px; color:var(--text-muted);">Manage and post your tasks.</p>', 
    '<p style="margin-bottom:30px; color:var(--text-muted);">Manage and post your tasks.</p>\n<div class="cards-container">'
);
html = html.replace('</ul>\n</div>\n        </div>', '</ul>\n</div>\n</div>\n        </div>');

// Worker
html = html.replace(
    '<p style="margin-bottom:30px; color:var(--text-muted);">Update your availability and find matches.</p>', 
    '<p style="margin-bottom:30px; color:var(--text-muted);">Update your availability and find matches.</p>\n<div class="cards-container">'
);
html = html.replace('No active task.</div>\n</div>\n        </div>', 'No active task.</div>\n</div>\n</div>\n        </div>');

fs.writeFileSync('index.html', html);
console.log('Added cards-container successfully');
