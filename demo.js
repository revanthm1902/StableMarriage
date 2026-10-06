// Global State
const state = {
  workers: [],       // [{id, label, x, y, preferences: [], proposalIndex: 0, currentMatch: null}]
  tasks: [],         // [{id, label, x, y, preferences: [], currentMatch: null}]
  matches: [],       // [{workerId, taskId, distance}]
  proposalHistory: [], // [{proposer, target, result: 'accepted'|'rejected', step, detail}]
 
  algorithm: {
    mode: 'worker',  // 'worker' or 'task'
    status: 'ready', // 'ready', 'running', 'paused', 'completed'
    currentStep: 0,
    totalProposals: 0,
    acceptedProposals: 0,
    rejectedProposals: 0,
    pendingAction: null, // stores the next micro-step to execute
  },
 
  animationTimer: null,
  animationSpeed: 800,
  selectedEntity: null, // {type: 'worker'|'task', id}
  dragging: null,
  prefsGenerated: false,
};

const SVG_NS = "http://www.w3.org/2000/svg";

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    generateEntities();
    generatePreferences();
    renderVisualization();
    updateStatistics();
});

function setupEventListeners() {
    document.getElementById('btn-randomize').addEventListener('click', () => {
        generateEntities();
        if (state.algorithm.status !== 'ready') {
            resetSimulation();
        }
    });

    document.getElementById('btn-generate-prefs').addEventListener('click', () => {
        generatePreferences();
        renderVisualization();
    });

    document.getElementById('btn-reset').addEventListener('click', resetSimulation);

    document.getElementById('btn-start').addEventListener('click', () => {
        if (state.algorithm.status === 'ready') {
            initializeAlgorithm();
        }
        runSimulation();
    });

    document.getElementById('btn-pause').addEventListener('click', pauseSimulation);

    document.getElementById('btn-next-step').addEventListener('click', () => {
        if (state.algorithm.status === 'ready') {
            initializeAlgorithm();
        }
        if (state.algorithm.status !== 'completed') {
            nextStep();
        }
    });

    document.getElementById('btn-run-complete').addEventListener('click', () => {
        if (state.algorithm.status === 'ready') {
            initializeAlgorithm();
        }
        while (state.algorithm.status === 'running') {
            nextStep();
        }
        renderVisualization();
    });

    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            state.animationSpeed = val;
            if (speedValue) speedValue.textContent = val + 'ms';
           
            if (state.algorithm.status === 'running') {
                pauseSimulation();
                runSimulation();
            }
        });
    }

    const algoMode = document.getElementById('algorithm-mode');
    if (algoMode) {
        algoMode.addEventListener('change', (e) => {
            state.algorithm.mode = e.target.value;
            resetSimulation();
        });
    }

    const btnCloseInspector = document.getElementById('btn-close-inspector');
    if (btnCloseInspector) {
        btnCloseInspector.addEventListener('click', () => {
            document.getElementById('preference-inspector').classList.add('hidden');
            state.selectedEntity = null;
            renderVisualization();
        });
    }

    const btnVerify = document.getElementById('btn-verify-stability');
    if (btnVerify) {
        btnVerify.addEventListener('click', verifyStability);
    }

    const btnRunAgain = document.getElementById('btn-run-again');
    if (btnRunAgain) {
        btnRunAgain.addEventListener('click', () => {
            document.getElementById('completion-overlay').classList.add('hidden');
            resetSimulation();
            generateEntities();
        });
    }

    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const iconSun = document.getElementById('theme-icon-sun');
    const iconMoon = document.getElementById('theme-icon-moon');

    if (btnThemeToggle) {
        btnThemeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
           
            if (newTheme === 'light') {
                iconSun.classList.remove('hidden');
                iconMoon.classList.add('hidden');
            } else {
                iconSun.classList.add('hidden');
                iconMoon.classList.remove('hidden');
            }
        });
    }

    setupSvgInteractions();
}

function setupSvgInteractions() {
    const svg = document.getElementById('spatial-svg');
    if (!svg) return;

    svg.addEventListener('mousedown', startDrag);
    svg.addEventListener('mousemove', drag);
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('mouseleave', endDrag);

    // Touch support
    svg.addEventListener('touchstart', startDrag, {passive: false});
    svg.addEventListener('touchmove', drag, {passive: false});
    svg.addEventListener('touchend', endDrag);
}

function getMousePosition(evt) {
    const svg = document.getElementById('spatial-svg');
    const CTM = svg.getScreenCTM();
    if (evt.touches) {
        evt = evt.touches[0];
    }
    return {
        x: (evt.clientX - CTM.e) / CTM.a,
        y: (evt.clientY - CTM.f) / CTM.d
    };
}

function startDrag(evt) {
    if (state.algorithm.status === 'running') return;

    let target = evt.target;
    while (target && target.tagName !== 'g' && target !== document.getElementById('spatial-svg')) {
        target = target.parentNode;
    }

    if (target && (target.classList.contains('worker-node') || target.classList.contains('task-node'))) {
        const type = target.dataset.type;
        const id = parseInt(target.dataset.id, 10);
        state.dragging = {
            type,
            id,
            node: target
        };
       
        inspectEntity(type, id);
    }
}

function drag(evt) {
    if (state.dragging) {
        evt.preventDefault();
        const coord = getMousePosition(evt);
       
        const padding = 30;
        coord.x = Math.max(padding, Math.min(800 - padding, coord.x));
        coord.y = Math.max(padding, Math.min(600 - padding, coord.y));

        const collection = state.dragging.type === 'worker' ? state.workers : state.tasks;
        const entity = collection.find(e => e.id === state.dragging.id);
       
        if (entity) {
            entity.x = coord.x;
            entity.y = coord.y;
            renderVisualization(); 
        }
    }
}

function endDrag(evt) {
    if (state.dragging) {
        state.dragging = null;
       
        if (state.prefsGenerated || state.algorithm.status === 'completed') {
            state.prefsGenerated = false;
            showToast("Spatial positions changed — preferences need to be regenerated.", "warning");
            if (state.algorithm.status !== 'ready') {
                resetSimulation();
            }
        }
        renderVisualization();
    }
}

function generateEntities() {
    const workerCountInput = document.getElementById('worker-count');
    const taskCountInput = document.getElementById('task-count');
    const n = workerCountInput ? parseInt(workerCountInput.value, 10) : 5;
    const m = taskCountInput ? parseInt(taskCountInput.value, 10) : 5;

    state.workers = [];
    state.tasks = [];
   
    const padding = 60;
    const width = 800;
    const height = 600;

    for (let i = 0; i < n; i++) {
        state.workers.push({
            id: i,
            label: `W${i+1}`,
            x: padding + Math.random() * (width - 2 * padding),
            y: padding + Math.random() * (height - 2 * padding),
            preferences: [],
            proposalIndex: 0,
            currentMatch: null
        });
    }

    for (let i = 0; i < m; i++) {
        state.tasks.push({
            id: i,
            label: `T${i+1}`,
            x: padding + Math.random() * (width - 2 * padding),
            y: padding + Math.random() * (height - 2 * padding),
            preferences: [],
            currentMatch: null
        });
    }

    state.prefsGenerated = false;
    resetSimulation();
    renderVisualization();
    updateStatistics();
}

function calculateDistance(entity1, entity2) {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    return parseFloat(Math.sqrt(dx * dx + dy * dy).toFixed(2));
}

function generatePreferences() {
    state.workers.forEach(w => {
        const distances = state.tasks.map(t => ({ id: t.id, dist: calculateDistance(w, t) }));
        distances.sort((a, b) => a.dist - b.dist);
        w.preferences = distances.map(d => d.id);
    });

    state.tasks.forEach(t => {
        const distances = state.workers.map(w => ({ id: w.id, dist: calculateDistance(w, t) }));
        distances.sort((a, b) => a.dist - b.dist);
        t.preferences = distances.map(d => d.id);
    });

    state.prefsGenerated = true;
    showToast("Preferences generated based on spatial distance", "success");
   
    if (state.selectedEntity) {
        inspectEntity(state.selectedEntity.type, state.selectedEntity.id);
    }
}

function initializeAlgorithm() {
    if (!state.prefsGenerated) {
        generatePreferences();
    }

    state.workers.forEach(w => {
        w.proposalIndex = 0;
        w.currentMatch = null;
    });

    state.tasks.forEach(t => {
        t.proposalIndex = 0;
        t.currentMatch = null;
    });

    state.matches = [];
    state.proposalHistory = [];
    state.algorithm.currentStep = 0;
    state.algorithm.totalProposals = 0;
    state.algorithm.acceptedProposals = 0;
    state.algorithm.rejectedProposals = 0;
    state.algorithm.status = 'running';
   
    updateUIState();
    updateAlgorithmState();
    updateStatistics();
   
    document.getElementById('step-explanation').innerHTML = "Algorithm initialized. Ready to begin proposals.";
}

function prefers(entity, candidateId, currentId) {
    if (currentId === null) return true;
    const candidateRank = entity.preferences.indexOf(candidateId);
    const currentRank = entity.preferences.indexOf(currentId);
    return candidateRank < currentRank;
}

function nextStep() {
    if (state.algorithm.status === 'completed') return;

    const isWorkerProposing = state.algorithm.mode === 'worker';
    const proposers = isWorkerProposing ? state.workers : state.tasks;
    const receivers = isWorkerProposing ? state.tasks : state.workers;

    let p = proposers.find(entity => entity.currentMatch === null && entity.proposalIndex < entity.preferences.length);

    if (!p) {
        onAlgorithmComplete();
        return;
    }

    const receiverId = p.preferences[p.proposalIndex];
    const r = receivers.find(e => e.id === receiverId);
   
    p.proposalIndex++;
    state.algorithm.totalProposals++;
    state.algorithm.currentStep++;

    let explanation = "";
    let statusStr = "";
    const dist = calculateDistance(p, r);

    state.algorithm.pendingAction = { proposer: p, receiver: r };

    if (r.currentMatch === null) {
        p.currentMatch = r.id;
        r.currentMatch = p.id;
        state.algorithm.acceptedProposals++;
       
        explanation = `${isWorkerProposing ? 'Worker' : 'Task'} ${p.label} proposes to ${r.label}. ${r.label} is currently unmatched, so the proposal is accepted!`;
        statusStr = 'accepted';
       
        state.matches.push({
            workerId: isWorkerProposing ? p.id : r.id,
            taskId: isWorkerProposing ? r.id : p.id,
            distance: dist
        });
    } else {
        const currentMatchId = r.currentMatch;
        const currentMatch = proposers.find(e => e.id === currentMatchId);
       
        if (prefers(r, p.id, currentMatchId)) {
            currentMatch.currentMatch = null;
            p.currentMatch = r.id;
            r.currentMatch = p.id;
            state.algorithm.acceptedProposals++;
           
            explanation = `${p.label} proposes to ${r.label}. ${r.label} prefers ${p.label} over their current match ${currentMatch.label}. ${currentMatch.label} becomes unmatched.`;
            statusStr = 'accepted';
           
            const matchIndex = state.matches.findIndex(m =>
                (isWorkerProposing ? m.workerId : m.taskId) === currentMatch.id &&
                (isWorkerProposing ? m.taskId : m.workerId) === r.id
            );
            if (matchIndex !== -1) {
                state.matches.splice(matchIndex, 1);
            }
            state.matches.push({
                workerId: isWorkerProposing ? p.id : r.id,
                taskId: isWorkerProposing ? r.id : p.id,
                distance: dist
            });
           
        } else {
            state.algorithm.rejectedProposals++;
            explanation = `${p.label} proposes to ${r.label}. ${r.label} prefers their current match ${currentMatch.label} over ${p.label}. Proposal rejected.`;
            statusStr = 'rejected';
        }
    }

    state.proposalHistory.unshift({
        proposer: p.label,
        target: r.label,
        result: statusStr,
        step: state.algorithm.currentStep,
        detail: explanation
    });

    document.getElementById('step-explanation').innerHTML = explanation;
   
    renderVisualization();
    updateAlgorithmState();
    updateStatistics();
   
    setTimeout(() => {
        state.algorithm.pendingAction = null;
        if (state.algorithm.status !== 'running') {
            renderVisualization();
        }
    }, state.animationSpeed * 0.8);
}

function onAlgorithmComplete() {
    state.algorithm.status = 'completed';
    clearInterval(state.animationTimer);
   
    document.getElementById('step-explanation').innerHTML = "<strong>Algorithm Complete!</strong> No more unmatched entities can make valid proposals.";
   
    const overlay = document.getElementById('completion-overlay');
    const statsDiv = document.getElementById('completion-stats');
   
    let totalDist = 0;
    let minDist = Infinity;
    let maxDist = 0;
    state.matches.forEach(m => {
        totalDist += m.distance;
        if (m.distance < minDist) minDist = m.distance;
        if (m.distance > maxDist) maxDist = m.distance;
    });
    const avgDist = state.matches.length > 0 ? (totalDist / state.matches.length).toFixed(2) : 0;
    if (minDist === Infinity) minDist = 0;
   
    statsDiv.innerHTML = `
        <div="completion-stat-grid">
            <div class="completion-stat-item"><span class="completion-stat-value">${state.workers.length}</span><span class="completion-stat-label">Workers</span></div>
            <div class="completion-stat-item"><span class="completion-stat-value">${state.tasks.length}</span><span class="completion-stat-label">Tasks</span></div>
            <div class="completion-stat-item"><span class="completion-stat-value">${state.algorithm.totalProposals}</span><span class="completion-stat-label">Total Proposals</span></div>
            <div class="completion-stat-item"><span class="completion-stat-value">${state.matches.length}</span><span class="completion-stat-label">Matched Pairs</span></div>
            <div class="completion-stat-item"><span class="completion-stat-value">${avgDist}</span><span class="completion-stat-label">Avg Distance</span></div>
            <div class="completion-stat-item"><span class="completion-stat-value">${minDist.toFixed(2)}</span><span class="completion-stat-label">Min Distance</span></div>
            <div class="completion-stat-item"><span class="completion-stat-value">${maxDist.toFixed(2)}</span><span class="completion-stat-label">Max Distance</span></div>
            <div class="completion-stat-item"><span class="completion-stat-value">0</span><span class="completion-stat-label">Blocking Pairs</span></div>
        </div>
        <p style="color:var(--text-secondary);margin-top:16px;">All workers and tasks have been successfully matched. The resulting matching is stable.</p>
    `;
   
    if (overlay) {
        overlay.classList.remove('hidden');
    }
   
    updateUIState();
    updateStatistics();
    renderVisualization();
}

function runSimulation() {
    if (state.algorithm.status === 'completed') return;
   
    state.algorithm.status = 'running';
    clearInterval(state.animationTimer);
    state.animationTimer = setInterval(nextStep, state.animationSpeed);
   
    updateUIState();
}

function pauseSimulation() {
    if (state.algorithm.status === 'running') {
        state.algorithm.status = 'paused';
        clearInterval(state.animationTimer);
        updateUIState();
    }
}

function verifyStability() {
    let unstablePairs = [];
    const isWorkerProposing = state.algorithm.mode === 'worker';
   
    for (let i = 0; i < state.workers.length; i++) {
        for (let j = 0; j < state.tasks.length; j++) {
            const w = state.workers[i];
            const t = state.tasks[j];
           
            if (w.currentMatch === t.id && t.currentMatch === w.id) continue;
           
            const wPrefersT = prefers(w, t.id, w.currentMatch);
            const tPrefersW = prefers(t, w.id, t.currentMatch);
           
            if (wPrefersT && tPrefersW) {
                unstablePairs.push({ worker: w, task: t });
            }
        }
    }
   
    const resultDiv = document.getElementById('stability-result');
    if (resultDiv) {
        resultDiv.classList.remove('hidden', 'stable', 'unstable');
        if (unstablePairs.length === 0) {
            resultDiv.classList.add('stable');
            resultDiv.innerHTML = `✓ Stability Verified: The matching is stable! No blocking pairs found.`;
        } else {
            resultDiv.classList.add('unstable');
            let pairsHtml = unstablePairs.map(p => `⚠ Blocking pair: ${p.worker.label} and ${p.task.label}`).join('<br>');
            resultDiv.innerHTML = `✗ Unstable! Found ${unstablePairs.length} blocking pair(s).<br>${pairsHtml}`;
        }
    }
    return unstablePairs;
}

function resetSimulation() {
    clearInterval(state.animationTimer);
    state.algorithm.status = 'ready';
    state.algorithm.currentStep = 0;
    state.algorithm.totalProposals = 0;
    state.algorithm.acceptedProposals = 0;
    state.algorithm.rejectedProposals = 0;
    state.algorithm.pendingAction = null;
   
    state.matches = [];
    state.proposalHistory = [];
   
    state.workers.forEach(w => {
        w.proposalIndex = 0;
        w.currentMatch = null;
    });
   
    state.tasks.forEach(t => {
        t.proposalIndex = 0;
        t.currentMatch = null;
    });
   
    const expl = document.getElementById('step-explanation');
    if (expl) expl.innerHTML = "Simulation reset. Press Start to begin.";
   
    const overlay = document.getElementById('completion-overlay');
    if (overlay) overlay.classList.add('hidden');
   
    const stabRes = document.getElementById('stability-result');
    if (stabRes) stabRes.innerHTML = "";
   
    updateUIState();
    updateAlgorithmState();
    updateStatistics();
    renderVisualization();
}

function updateUIState() {
    const s = state.algorithm.status;
    const btnStart = document.getElementById('btn-start');
    const btnPause = document.getElementById('btn-pause');
    const btnNextStep = document.getElementById('btn-next-step');
    const btnRunComplete = document.getElementById('btn-run-complete');
    const btnGenPrefs = document.getElementById('btn-generate-prefs');
   
    if (btnStart) btnStart.disabled = (s === 'running' || s === 'completed');
    if (btnPause) btnPause.disabled = (s !== 'running');
    if (btnNextStep) btnNextStep.disabled = (s === 'running' || s === 'completed');
    if (btnRunComplete) btnRunComplete.disabled = (s === 'running' || s === 'completed');
    if (btnGenPrefs) btnGenPrefs.disabled = (s === 'running' || s === 'paused' || s === 'completed');
   
    const badge = document.getElementById('algorithm-status-badge');
    if (badge) {
        badge.textContent = s.charAt(0).toUpperCase() + s.slice(1);
        badge.className = 'status-badge status-' + s;
    }
}

function inspectEntity(type, id) {
    state.selectedEntity = { type, id };
    const inspector = document.getElementById('preference-inspector');
    const header = document.getElementById('pref-inspector-header');
    const list = document.getElementById('pref-inspector-list');
   
    if (!inspector || !header || !list) return;
   
    const entity = (type === 'worker' ? state.workers : state.tasks).find(e => e.id === id);
    if (!entity) return;
   
    inspector.classList.remove('hidden');
    header.textContent = `${type === 'worker' ? 'Worker' : 'Task'} ${entity.label} Preferences`;
   
    list.innerHTML = '';
   
    if (!state.prefsGenerated) {
        list.innerHTML = '<li>Please generate preferences first.</li>';
    } else {
        const others = type === 'worker' ? state.tasks : state.workers;
       
        entity.preferences.forEach((prefId, index) => {
            const other = others.find(o => o.id === prefId);
            const dist = calculateDistance(entity, other);
           
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.padding = '5px 0';
            li.style.borderBottom = '1px solid #333';
           
            if (entity.currentMatch === prefId) {
                li.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
                li.style.fontWeight = 'bold';
            }
            else if (index < entity.proposalIndex) {
                li.style.color = '#888';
                li.style.textDecoration = 'line-through';
            }
           
            li.innerHTML = `<span>#${index + 1}: ${other.label}</span> <span>${dist}u</span>`;
            list.appendChild(li);
        });
    }
   
    renderVisualization();
}

function updateAlgorithmState() {
    const curStepDisplay = document.getElementById('current-step-display');
    const curPropDisplay = document.getElementById('current-proposal-display');
    const matchesTbody = document.getElementById('matches-tbody');
    const unmatchedList = document.getElementById('unmatched-list');
    const propHistory = document.getElementById('proposal-history');
   
    if (curStepDisplay) curStepDisplay.textContent = `Step ${state.algorithm.currentStep}`;
   
    if (curPropDisplay) {
        if (state.algorithm.pendingAction) {
            const p = state.algorithm.pendingAction.proposer;
            const r = state.algorithm.pendingAction.receiver;
            curPropDisplay.innerHTML = `<span style="color:#a855f7">${p.label} &rarr; ${r.label}</span>`;
        } else {
            curPropDisplay.textContent = "None";
        }
    }
   
    if (matchesTbody) {
        matchesTbody.innerHTML = '';
        state.matches.forEach(m => {
            const w = state.workers.find(w => w.id === m.workerId);
            const t = state.tasks.find(t => t.id === m.taskId);
            if (w && t) {
                const tr = document.createElement('tr');
                const statusClass = state.algorithm.status === 'completed' ? 'status-matched' : 'status-pending';
                const statusText = state.algorithm.status === 'completed' ? 'Matched' : 'Pending';
                tr.innerHTML = `<td>${w.label}</td><td>${t.label}</td><td>${m.distance}</td><td><span class="${statusClass}">${statusText}</span></td>`;
                matchesTbody.appendChild(tr);
            }
        });
    }
   
    if (unmatchedList) {
        unmatchedList.innerHTML = '';
        const isWP = state.algorithm.mode === 'worker';
        const proposers = isWP ? state.workers : state.tasks;
        const unmatched = proposers.filter(e => e.currentMatch === null);
        if (unmatched.length === 0 && state.algorithm.currentStep > 0) {
            unmatchedList.innerHTML = '<span class="unmatched-tag" style="border-color:var(--accent-green)">All matched!</span>';
        } else if (unmatched.length === 0) {
            unmatchedList.innerHTML = '<span class="unmatched-tag">None yet</span>';
        } else {
            unmatched.forEach(e => {
                const span = document.createElement('span');
                span.className = 'unmatched-tag';
                span.textContent = e.label;
                unmatchedList.appendChild(span);
            });
        }
    }
   
    if (propHistory) {
        propHistory.innerHTML = '';
        state.proposalHistory.forEach(ph => {
            const div = document.createElement('div');
            div.className = `history-entry ${ph.result}`;
            div.innerHTML = `<span>${ph.proposer}</span><span class="arrow">→</span><span>${ph.target}</span> <span class="result-text ${ph.result}">${ph.result === 'accepted' ? '✓ Accepted' : '✗ Rejected'}</span>`;
            propHistory.appendChild(div);
        });
    }
}

function updateStatistics() {
    document.getElementById('stat-workers').textContent = state.workers.length;
    document.getElementById('stat-tasks').textContent = state.tasks.length;
    document.getElementById('stat-proposals').textContent = state.algorithm.totalProposals;
    document.getElementById('stat-accepted').textContent = state.algorithm.acceptedProposals;
    document.getElementById('stat-rejected').textContent = state.algorithm.rejectedProposals;
    document.getElementById('stat-matched').textContent = state.matches.length;
    document.getElementById('stat-unmatched').textContent = (state.workers.length + state.tasks.length) - (state.matches.length * 2);
   
    let totalDist = 0;
    state.matches.forEach(m => totalDist += m.distance);
    const avgDist = state.matches.length > 0 ? (totalDist / state.matches.length).toFixed(2) : 0;
    document.getElementById('stat-avg-distance').textContent = avgDist;
}

function renderVisualization() {
    const svg = document.getElementById('spatial-svg');
    if (!svg) return;
   
    svg.innerHTML = '';
   
    const defs = document.createElementNS(SVG_NS, 'defs');
    const pattern = document.createElementNS(SVG_NS, 'pattern');
    pattern.setAttribute('id', 'grid');
    pattern.setAttribute('width', '40');
    pattern.setAttribute('height', '40');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
   
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'M 40 0 L 0 0 0 40');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#334155');
    path.setAttribute('stroke-width', '0.5');
    pattern.appendChild(path);
    defs.appendChild(pattern);
    svg.appendChild(defs);
   
    const bgRect = document.createElementNS(SVG_NS, 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', 'url(#grid)');
    svg.appendChild(bgRect);
   
    if (state.selectedEntity && state.prefsGenerated) {
        const entity = (state.selectedEntity.type === 'worker' ? state.workers : state.tasks).find(e => e.id === state.selectedEntity.id);
        const others = state.selectedEntity.type === 'worker' ? state.tasks : state.workers;
       
        if (entity) {
            others.forEach(other => {
                const line = document.createElementNS(SVG_NS, 'line');
                line.setAttribute('x1', entity.x);
                line.setAttribute('y1', entity.y);
                line.setAttribute('x2', other.x);
                line.setAttribute('y2', other.y);
                line.setAttribute('stroke', 'rgba(148, 163, 184, 0.2)');
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-dasharray', '4,4');
                svg.appendChild(line);
            });
        }
    }
   
    state.matches.forEach(m => {
        const w = state.workers.find(w => w.id === m.workerId);
        const t = state.tasks.find(t => t.id === m.taskId);
        if (w && t) {
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', w.x);
            line.setAttribute('y1', w.y);
            line.setAttribute('x2', t.x);
            line.setAttribute('y2', t.y);
            line.setAttribute('stroke', '#4ade80');
            line.setAttribute('stroke-width', '3');
            svg.appendChild(line);
        }
    });
   
    if (state.algorithm.pendingAction) {
        const p = state.algorithm.pendingAction.proposer;
        const r = state.algorithm.pendingAction.receiver;
       
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', p.x);
        line.setAttribute('y1', p.y);
        line.setAttribute('x2', r.x);
        line.setAttribute('y2', r.y);
        line.setAttribute('stroke', '#a855f7');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', '8,4');
       
        const animate = document.createElementNS(SVG_NS, 'animate');
        animate.setAttribute('attributeName', 'stroke-dashoffset');
        animate.setAttribute('from', '12');
        animate.setAttribute('to', '0');
        animate.setAttribute('dur', '0.5s');
        animate.setAttribute('repeatCount', 'indefinite');
        line.appendChild(animate);
       
        svg.appendChild(line);
    }
   
    state.workers.forEach(w => {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'worker-node');
        g.setAttribute('data-type', 'worker');
        g.setAttribute('data-id', w.id);
        g.setAttribute('transform', `translate(${w.x}, ${w.y})`);
        g.style.cursor = 'grab';
       
        let isSelected = state.selectedEntity && state.selectedEntity.type === 'worker' && state.selectedEntity.id === w.id;
        let isProposing = state.algorithm.pendingAction && state.algorithm.pendingAction.proposer.id === w.id && state.algorithm.mode === 'worker';
       
        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('r', isSelected ? '24' : '20');
        circle.setAttribute('fill', w.currentMatch !== null ? '#1e40af' : '#3b82f6');
        circle.setAttribute('stroke', isProposing ? '#a855f7' : (isSelected ? '#fff' : '#1e3a8a'));
        circle.setAttribute('stroke-width', isProposing || isSelected ? '4' : '2');
       
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = w.label;
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('y', '5');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-weight', 'bold');
        text.style.pointerEvents = 'none';
       
        g.appendChild(circle);
        g.appendChild(text);
        svg.appendChild(g);
    });
   
    state.tasks.forEach(t => {
        const g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('class', 'task-node');
        g.setAttribute('data-type', 'task');
        g.setAttribute('data-id', t.id);
        g.setAttribute('transform', `translate(${t.x}, ${t.y})`);
        g.style.cursor = 'grab';
       
        let isSelected = state.selectedEntity && state.selectedEntity.type === 'task' && state.selectedEntity.id === t.id;
        let isReceiving = state.algorithm.pendingAction && state.algorithm.pendingAction.receiver.id === t.id;
       
        const rect = document.createElementNS(SVG_NS, 'rect');
        const size = isSelected ? 44 : 36;
        const half = size / 2;
        rect.setAttribute('x', -half);
        rect.setAttribute('y', -half);
        rect.setAttribute('width', size);
        rect.setAttribute('height', size);
        rect.setAttribute('rx', '6');
        rect.setAttribute('fill', t.currentMatch !== null ? '#b45309' : '#f59e0b');
        rect.setAttribute('stroke', isReceiving ? '#a855f7' : (isSelected ? '#fff' : '#78350f'));
        rect.setAttribute('stroke-width', isReceiving || isSelected ? '4' : '2');
        rect.setAttribute('transform', 'rotate(45)');
       
        const text = document.createElementNS(SVG_NS, 'text');
        text.textContent = t.label;
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('y', '5');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-weight', 'bold');
        text.style.pointerEvents = 'none';
       
        g.appendChild(rect);
        g.appendChild(text);
        svg.appendChild(g);
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = type === 'success' ? '#166534' :
                                  type === 'warning' ? '#9a3412' :
                                  type === 'error' ? '#991b1b' : '#1e40af';
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    toast.style.zIndex = '9999';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    toast.textContent = message;
   
    document.body.appendChild(toast);
   
    setTimeout(() => toast.style.opacity = '1', 10);
   
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
