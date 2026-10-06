const fs = require('fs');

// 1. Update CSS
let css = fs.readFileSync('style.css', 'utf8');

// Replace role-dashboard styles
css = css.replace('.role-dashboard { max-width: 1000px; margin: 40px auto; padding: 30px; flex: 1; overflow: visible; background: transparent; border: none; box-shadow: none; }', '');
css = css.replace('.role-dashboard {\r\n    max-width: 1000px;\r\n    margin: 40px auto;\r\n    padding: 30px;\r\n    flex: 1;\r\n    overflow-y: auto;\r\n    background: transparent;\r\n    border: none;\r\n    box-shadow: none;\r\n}', '');

// Replace cards-container
css = css.replace('.cards-container {\r\n    display: grid;\r\n    grid-template-columns: 1fr 1fr;\r\n    gap: 20px;\r\n}', '');
css = css.replace('.cards-container { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }', '');

// Add properly bounded flex grid logic
const boundedCSS = `
.role-dashboard {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px 30px;
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: transparent;
    border: none;
    box-shadow: none;
}

.role-dashboard > h2 {
    flex-shrink: 0;
}

.role-dashboard > p {
    flex-shrink: 0;
}

.cards-container {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    overflow: hidden;
    min-height: 0; /* Important for grid item overflow */
}

.dashboard-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
}

/* Allow lists inside cards to scroll */
#requester-tasks-list, 
#worker-assigned-task {
    flex: 1;
    overflow-y: auto;
    padding-right: 5px;
}
`;

css += '\n' + boundedCSS;

// Add play button floating style for auth screen
css += `
.auth-floating-play {
    position: absolute;
    top: 20px;
    right: 20px;
}
`;

fs.writeFileSync('style.css', css);

// 2. Add play buttons in HTML
let html = fs.readFileSync('index.html', 'utf8');

const playBtn = `
      <div class="demo-btn-container" style="position: relative; display: inline-block;">
          <a href="demo.html" id="btn-demo-play" style="display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: var(--accent-purple); color: white; border: none; cursor: pointer; text-decoration: none; transition: all 0.3s ease; overflow: hidden; white-space: nowrap;">
              <svg style="flex-shrink: 0;" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span class="demo-text" style="display: none; margin-left: 8px; font-weight: 600; font-size: 0.85rem; opacity: 0; transition: opacity 0.3s ease;">View Demo</span>
          </a>
      </div>
`;

// Inject into auth-screen if not present
if (!html.includes('auth-floating-play')) {
    html = html.replace('<div id="auth-screen" class="screen">', '<div id="auth-screen" class="screen">\n<div class="auth-floating-play">' + playBtn + '</div>');
}

// Inject into dashboard header if not present
if (!html.includes('<!-- Dashboard play -->')) {
    html = html.replace('<button id="btn-theme"', '<!-- Dashboard play -->\n' + playBtn + '\n<button id="btn-theme"');
}

fs.writeFileSync('index.html', html);

console.log('UI cleanly constrained for internal scrolling, Play buttons added!');
