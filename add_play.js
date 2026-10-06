const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const playBtn = `
      <!-- Demo Button Container -->
      <div class="demo-btn-container" style="position: relative; display: inline-block;">
          <a href="demo.html" id="btn-demo-play" style="display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--accent-purple); color: white; border: none; cursor: pointer; text-decoration: none; transition: all 0.3s ease; overflow: hidden; white-space: nowrap;">
              <svg style="flex-shrink: 0;" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span class="demo-text" style="display: none; margin-left: 8px; font-weight: 600; font-size: 0.85rem; opacity: 0; transition: opacity 0.3s ease;">View Demo</span>
          </a>
      </div>
`;

// Insert into header-right before btn-theme-toggle
html = html.replace('<button id="btn-theme-toggle"', playBtn + '\n      <button id="btn-theme-toggle"');

fs.writeFileSync('index.html', html);

// Add CSS for hover effect in style.css
let css = fs.readFileSync('style.css', 'utf8');
const hoverCSS = `
#btn-demo-play:hover {
    width: 130px !important;
    background: var(--accent-blue) !important;
}
#btn-demo-play:hover .demo-text {
    display: inline-block !important;
    opacity: 1 !important;
}
`;
fs.writeFileSync('style.css', css + '\n' + hoverCSS);

console.log('Added demo button to index.html');
