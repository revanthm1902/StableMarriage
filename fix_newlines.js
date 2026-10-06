const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');
css = css.replace('.dashboard-card {\\n    display: flex;\\n    flex-direction: column;\\n    overflow-y: auto;\\n    min-height: 0;\\n}', 
`.dashboard-card {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    min-height: 0;
}`);
fs.writeFileSync('style.css', css);
