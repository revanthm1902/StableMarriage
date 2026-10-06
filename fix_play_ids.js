const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Replace duplicate ids with unique ids and a shared class
html = html.replace(/id="btn-demo-play"/g, 'class="btn-demo-play"');

fs.writeFileSync('index.html', html);

let css = fs.readFileSync('style.css', 'utf8');
css = css.replace(/#btn-demo-play:hover/g, '.btn-demo-play:hover');
fs.writeFileSync('style.css', css);

console.log('Fixed play button class selectors!');
