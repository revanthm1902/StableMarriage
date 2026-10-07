const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');
css = css.replace(/--grid-line-color:\s*rgba\(0,\s*0,\s*0,\s*0\.15\);/g, '--grid-line-color: #e0e2e8;');
css = css.replace(/--grid-line-color:\s*rgba\(255,\s*255,\s*255,\s*0\.15\);/g, '--grid-line-color: #334155;');
fs.writeFileSync('style.css', css);
