const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');
js = js.replace(/\\\$\\{/g, '${');
fs.writeFileSync('script.js', js);
console.log('Fixed template literals in script.js');
