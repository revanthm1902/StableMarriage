const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');

const garbageIndex = css.indexOf('admin dashboard should look like this');
if (garbageIndex !== -1) {
    const customStartIndex = css.indexOf('/* ===== AUTH / ROLE SPECIFIC');
    if (customStartIndex !== -1) {
        // If my custom appends are still there, they are AFTER the garbage.
        // Wait, earlier I did css.substring(0, lastBrace + 1)!
        // That means I DELETED the garbage AND my custom appends!!
    }
}
// Since I already truncated at lastBrace in the previous step, the garbage IS GONE.
// But so are my custom appends!
// Let me just append them again securely.
css += `
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
input[type=email], input[type=password], input[type=text], select, input[type=number] {
  width: 100%; padding: 8px 12px; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); font-family: inherit; font-size: 0.85rem; margin-bottom: 8px;
}
input:focus, select:focus { outline: none; border-color: var(--accent-blue); box-shadow: 0 0 0 3px rgba(74,158,255,0.1); }
.role-dashboard h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
}
.role-dashboard h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 10px;
}
`;
fs.writeFileSync('style.css', css);
console.log('Appended securely');
