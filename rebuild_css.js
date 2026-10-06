const fs = require('fs');
const userCss = fs.readFileSync('user_light_css.css', 'utf8');

// I also need to make sure the dark theme CSS variables are injected since the user CSS I scraped might only be the light theme.
// Let's check if the dark theme was already there, but just to be sure I'll prepend the Dark Theme CSS.

const darkTheme = `
/* ===== CSS VARIABLES — DARK THEME (DEFAULT) ===== */
:root,
[data-theme="dark"] {
  --bg-primary: #0f1419;
  --bg-secondary: #1a1f2e;
  --bg-tertiary: #242938;
  --bg-hover: #2d3348;
  --text-primary: #e8eaed;
  --text-secondary: #9aa0a6;
  --text-muted: #5f6368;
  --accent-blue: #4a9eff;
  --accent-orange: #ff8c42;
  --accent-green: #34d399;
  --accent-red: #f87171;
  --accent-purple: #a78bfa;
  --accent-yellow: #fbbf24;
  --border-color: #2d3348;
  --border-radius: 12px;
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.2);
  --header-bg: linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%);
  --grid-line-color: #334155;
  --svg-bg: #1b2030;
  --overlay-bg: rgba(15, 20, 25, 0.92);
  --modal-backdrop: rgba(0, 0, 0, 0.6);
  --worker-fill: #3b82f6;
  --worker-fill-matched: #1e40af;
  --worker-stroke: #1e3a8a;
  --task-fill: #f59e0b;
  --task-fill-matched: #b45309;
  --task-stroke: #78350f;
}
`;


const customAppends = `
/* ===== AUTH / ROLE SPECIFIC (Added for Fullstack) ===== */
.screen {
    max-width: 400px;
    margin: 100px auto;
    background: var(--bg-secondary);
    padding: 30px;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
    border: 1px solid var(--border-color);
}

.auth-form {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.role-dashboard {
    max-width: 1000px;
    margin: 20px auto;
    padding: 20px;
    flex: 1;
    overflow-y: auto;
}

#auth-error, #task-msg, #worker-msg {
    margin-top: 10px;
    font-size: 0.9rem;
}
#auth-error { color: var(--accent-red); }

input[type=email], input[type=password], input[type=text] {
  width: 100%; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-family: inherit; font-size: 0.85rem;
}
input:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(74,158,255,0.1); }
`;

fs.writeFileSync('style.css', darkTheme + '\n' + userCss + '\n' + customAppends);
console.log('Rebuilt style.css');
