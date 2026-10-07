const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');
code = code.replace(".eq('status', 'pending_matching');", ".in('status', ['pending', 'pending_matching']);");
fs.writeFileSync('server.js', code);
