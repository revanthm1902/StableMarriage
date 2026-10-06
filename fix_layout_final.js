const fs = require('fs');
let css = fs.readFileSync('style.css', 'utf8');

// Replace role-dashboard completely to ensure perfect clean centered layout with internal scrolling
const oldDashboardRegex = /\.role-dashboard\s*\{[^}]+\}/g;

css = css.replace(oldDashboardRegex, '');

// Also remove any stray cards-container rules and rewrite them cleanly
const oldCardsContainerRegex = /\.cards-container\s*\{[^}]+\}/g;
css = css.replace(oldCardsContainerRegex, '');

const oldDashboardCardRegex = /\.dashboard-card\s*\{[^}]+\}/g;
css = css.replace(oldDashboardCardRegex, '');

const cleanLayout = `
.role-dashboard {
    max-width: 1100px;
    width: 100%;
    margin: 40px auto;
    padding: 0 30px;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 140px); /* Leave room for header and margins */
}

.role-dashboard > h2 {
    text-align: center;
    font-size: 2rem;
    color: var(--text-primary);
    margin-bottom: 10px;
}

.role-dashboard > p {
    text-align: center;
    font-size: 1rem;
    color: var(--text-muted);
    margin-bottom: 40px;
}

.cards-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 30px;
    flex: 1; /* Take remaining vertical space */
    min-height: 0; /* Crucial for grid overflow */
}

.dashboard-card {
    background: var(--bg-secondary);
    padding: 30px;
    border-radius: 16px;
    box-shadow: var(--shadow-sm);
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    overflow-y: auto; /* Internal scrolling for the card */
    min-height: 0;
}

.dashboard-card h3 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 1.1rem;
    color: var(--accent-blue);
    border-bottom: 2px solid var(--bg-hover);
    padding-bottom: 10px;
    flex-shrink: 0;
}

/* Allow nested lists to behave properly */
#requester-tasks-list, 
#worker-assigned-task {
    flex: 1;
}
`;

css += '\n' + cleanLayout;
fs.writeFileSync('style.css', css);
console.log('Fixed UI layout completely');
