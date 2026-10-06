const fs = require('fs');
let js = fs.readFileSync('script.js', 'utf8');
// Split and join is the safest way to replace string literals without regex escape hell
js = js.split('\\${stepIndex + 1}').join('${stepIndex + 1}');
js = js.split('\\${wIdx+1}').join('${wIdx+1}');
js = js.split('\\${tIdx+1}').join('${tIdx+1}');
fs.writeFileSync('script.js', js);
console.log('Fixed ALL remaining backslashes');
