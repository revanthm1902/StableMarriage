require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

app.get('/api/config', (req, res) => {
    res.json({ SUPABASE_URL: supabaseUrl, SUPABASE_ANON_KEY: anonKey });
});

app.post('/api/auth/register', async (req, res) => {
    const { email, password, role } = req.body;
    try {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (error) return res.status(400).json({ error: error.message });
        
        const { error: roleError } = await supabase.from('user_roles').insert([{ user_id: data.user.id, role }]);
        if (roleError) return res.status(400).json({ error: roleError.message });
        
        if (role === 'worker') {
            await supabase.from('worker_profiles').insert([{ user_id: data.user.id, job_type: 'Plumber' }]);
        }
        
        res.json({ message: 'User created' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/clear', async (req, res) => {
    try {
        await supabase.from('tasks').delete().not('id', 'is', null);
        await supabase.from('worker_profiles').delete().not('user_id', 'is', null);
        // we can also remove users from user_roles to wipe it completely
        await supabase.from('user_roles').delete().not('user_id', 'is', null);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function getDistance(lat1, lng1, lat2, lng2) {
    return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
}

app.post('/api/match', async (req, res) => {
    try {
        const mode = req.body.mode || 'worker';
        
        const { data: tasks, error: tError } = await supabase
            .from('tasks')
            .select('*')
            .eq('status', 'pending');
        
        const { data: workers, error: wError } = await supabase
            .from('worker_profiles')
            .select('*')
            .eq('is_available', true);

        if (tError || wError) return res.status(500).json({ error: 'Failed to fetch data' });

        const steps = [];
        const matches = [];
        const jobTypes = [...new Set([...tasks.map(t => t.required_job_type), ...workers.map(w => w.job_type)])];

        for (const job of jobTypes) {
            const jobTasks = tasks.filter(t => t.required_job_type === job);
            const jobWorkers = workers.filter(w => w.job_type === job);

            if (jobTasks.length === 0 || jobWorkers.length === 0) continue;

            jobWorkers.forEach(w => {
                w.preferences = [...jobTasks].sort((a, b) => getDistance(w.current_lat, w.current_lng, a.lat, a.lng) - getDistance(w.current_lat, w.current_lng, b.lat, b.lng));
                w.proposalIndex = 0;
                w.currentMatch = null;
            });

            jobTasks.forEach(t => {
                t.preferences = [...jobWorkers].sort((a, b) => getDistance(a.current_lat, a.current_lng, t.lat, t.lng) - getDistance(b.current_lat, b.current_lng, t.lat, t.lng));
                t.proposalIndex = 0;
                t.currentMatch = null;
            });

            let hasUnmatched = true;
            
            if (mode === 'worker') {
                while (hasUnmatched) {
                    hasUnmatched = false;
                    for (const w of jobWorkers) {
                        if (w.currentMatch === null && w.proposalIndex < w.preferences.length) {
                            hasUnmatched = true;
                            const targetTask = w.preferences[w.proposalIndex++];
                            steps.push({ type: 'proposal', worker_id: w.user_id, task_id: targetTask.id, job_type: job, proposer: 'worker' });

                            if (targetTask.currentMatch === null) {
                                targetTask.currentMatch = w;
                                w.currentMatch = targetTask;
                                steps.push({ type: 'accept', worker_id: w.user_id, task_id: targetTask.id, replaced_worker_id: null, proposer: 'worker' });
                            } else {
                                const currentW = targetTask.currentMatch;
                                const targetPrefers = targetTask.preferences.findIndex(cw => cw.user_id === w.user_id) < targetTask.preferences.findIndex(cw => cw.user_id === currentW.user_id);
                                if (targetPrefers) {
                                    targetTask.currentMatch = w;
                                    w.currentMatch = targetTask;
                                    currentW.currentMatch = null;
                                    steps.push({ type: 'accept', worker_id: w.user_id, task_id: targetTask.id, replaced_worker_id: currentW.user_id, proposer: 'worker' });
                                } else {
                                    steps.push({ type: 'reject', worker_id: w.user_id, task_id: targetTask.id, proposer: 'worker' });
                                }
                            }
                            break; 
                        }
                    }
                }
            } else if (mode === 'task') {
                while (hasUnmatched) {
                    hasUnmatched = false;
                    for (const t of jobTasks) {
                        if (t.currentMatch === null && t.proposalIndex < t.preferences.length) {
                            hasUnmatched = true;
                            const targetWorker = t.preferences[t.proposalIndex++];
                            steps.push({ type: 'proposal', worker_id: targetWorker.user_id, task_id: t.id, job_type: job, proposer: 'task' });

                            if (targetWorker.currentMatch === null) {
                                targetWorker.currentMatch = t;
                                t.currentMatch = targetWorker;
                                steps.push({ type: 'accept', worker_id: targetWorker.user_id, task_id: t.id, replaced_task_id: null, proposer: 'task' });
                            } else {
                                const currentT = targetWorker.currentMatch;
                                const workerPrefers = targetWorker.preferences.findIndex(ct => ct.id === t.id) < targetWorker.preferences.findIndex(ct => ct.id === currentT.id);
                                if (workerPrefers) {
                                    targetWorker.currentMatch = t;
                                    t.currentMatch = targetWorker;
                                    currentT.currentMatch = null;
                                    steps.push({ type: 'accept', worker_id: targetWorker.user_id, task_id: t.id, replaced_task_id: currentT.id, proposer: 'task' });
                                } else {
                                    steps.push({ type: 'reject', worker_id: targetWorker.user_id, task_id: t.id, proposer: 'task' });
                                }
                            }
                            break; 
                        }
                    }
                }
            }

            jobWorkers.forEach(w => {
                if (w.currentMatch) matches.push({ worker_id: w.user_id, task_id: w.currentMatch.id });
            });
        }

        for (const match of matches) {
            await supabase.from('tasks').update({ status: 'matched', assigned_worker_id: match.worker_id }).eq('id', match.task_id);
            await supabase.from('worker_profiles').update({ is_available: false }).eq('user_id', match.worker_id);
        }

        res.json({ message: 'Matching completed', matches, steps });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during match' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Production Matching Engine running on port ${PORT}`));
