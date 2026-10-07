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
            email_confirm: true,
            user_metadata: { role } // Optionally save in metadata
        });
        if (error) return res.status(400).json({ error: error.message });
        
        const { error: roleError } = await supabase.from('user_roles').insert([{ user_id: data.user.id, role }]);
        if (roleError) return res.status(400).json({ error: roleError.message });
        
        await supabase.from('users').insert([{ id: data.user.id, email, password_hash: 'dummy', role }]).catch(()=>null);
        
        if (role === 'worker') {
            await supabase.from('worker_profiles').insert([{ user_id: data.user.id, job_type: 'Plumber', is_available: true }]);
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
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function getDistance(lat1, lng1, lat2, lng2) {
    return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
}

app.delete('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase.from('tasks').delete().eq('id', id).eq('status', 'pending');
        if (error) return res.status(400).json({ error: error.message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users', async (req, res) => {
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) return res.status(400).json({ error: error.message });
        
        const userMap = {};
        users.forEach(u => userMap[u.id] = u.email);
        res.json(userMap);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/match', async (req, res) => {
    try {
        // Fetch pending tasks
        const { data: tasks, error: tError } = await supabase
            .from('tasks')
            .select('*')
            .eq('status', 'pending');
        
        // Fetch available workers
        const { data: workers, error: wError } = await supabase
            .from('worker_profiles')
            .select('*')
            .eq('is_available', true);

        if (tError || wError) return res.status(500).json({ error: 'Failed to fetch data' });

        const mode = req.body.mode || 'task';
        const steps = [];
        const matches = [];
        const jobTypes = [...new Set([...tasks.map(t => t.required_job_type), ...workers.map(w => w.job_type)])];

        const TASK_CAPACITY = mode === 'task' ? 3 : 1;

        for (const job of jobTypes) {
            const jobTasks = tasks.filter(t => t.required_job_type === job).map(t => ({...t, matchedWorkers: [], proposalIndex: 0, currentMatch: null}));
            const jobWorkers = workers.filter(w => w.job_type === job).map(w => ({...w, currentMatch: null, proposalIndex: 0}));

            if (jobTasks.length === 0 || jobWorkers.length === 0) continue;

            jobTasks.forEach(t => {
                t.preferences = [...jobWorkers].sort((a, b) => getDistance(a.current_lat, a.current_lng, t.lat, t.lng) - getDistance(b.current_lat, b.current_lng, t.lat, t.lng));
            });

            jobWorkers.forEach(w => {
                w.preferences = [...jobTasks].sort((a, b) => getDistance(w.current_lat, w.current_lng, a.lat, a.lng) - getDistance(w.current_lat, w.current_lng, b.lat, b.lng));
            });

            let hasUnmatched = true;
            
            if (mode === 'task') {
                // Task proposes to Worker (Many-to-1)
                while (hasUnmatched) {
                    hasUnmatched = false;
                    for (const t of jobTasks) {
                        if (t.matchedWorkers.length < TASK_CAPACITY && t.proposalIndex < t.preferences.length) {
                            hasUnmatched = true;
                            const targetWorker = t.preferences[t.proposalIndex++];
                            
                            steps.push({ type: 'proposal', worker_id: targetWorker.user_id, task_id: t.id, job_type: job, proposer: 'task' });

                            if (targetWorker.currentMatch === null) {
                                targetWorker.currentMatch = t;
                                t.matchedWorkers.push(targetWorker);
                                steps.push({ type: 'accept', worker_id: targetWorker.user_id, task_id: t.id, replaced_task_id: null, proposer: 'task' });
                            } else {
                                const currentT = targetWorker.currentMatch;
                                const workerPrefers = targetWorker.preferences.findIndex(ct => ct.id === t.id) < targetWorker.preferences.findIndex(ct => ct.id === currentT.id);
                                
                                if (workerPrefers) {
                                    targetWorker.currentMatch = t;
                                    t.matchedWorkers.push(targetWorker);
                                    currentT.matchedWorkers = currentT.matchedWorkers.filter(w => w.user_id !== targetWorker.user_id);
                                    steps.push({ type: 'accept', worker_id: targetWorker.user_id, task_id: t.id, replaced_task_id: currentT.id, proposer: 'task' });
                                } else {
                                    steps.push({ type: 'reject', worker_id: targetWorker.user_id, task_id: t.id, proposer: 'task' });
                                }
                            }
                            break; 
                        }
                    }
                }
            } else {
                // Worker proposes to Task (1-to-1)
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
            }

            if (mode === 'task') {
                jobTasks.forEach(t => {
                    if (t.matchedWorkers.length > 0) {
                        matches.push({ task_id: t.id, worker_ids: t.matchedWorkers.map(w => w.user_id) });
                    }
                });
            } else {
                jobWorkers.forEach(w => {
                    if (w.currentMatch) {
                        matches.push({ task_id: w.currentMatch.id, worker_ids: [w.user_id] });
                    }
                });
            }
        }

        // Apply state changes to DB
        for (const match of matches) {
            // Update task status to offered
            await supabase.from('tasks').update({ status: 'offered' }).eq('id', match.task_id);
            
            // Insert offers
            const offers = match.worker_ids.map(w_id => ({
                task_id: match.task_id,
                worker_id: w_id,
                status: 'pending_worker'
            }));
            await supabase.from('task_offers').insert(offers);
        }

        res.json({ message: 'Matching completed', matches, steps });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during match' });
    }
});

// Worker accepts offer
app.post('/api/task_offers/accept', async (req, res) => {
    try {
        const { task_id, worker_id } = req.body;
        await supabase.from('task_offers').update({ status: 'accepted_by_worker' })
            .eq('task_id', task_id).eq('worker_id', worker_id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Worker rejects offer
app.post('/api/task_offers/reject', async (req, res) => {
    try {
        const { task_id, worker_id } = req.body;
        await supabase.from('task_offers').update({ status: 'rejected_by_worker' })
            .eq('task_id', task_id).eq('worker_id', worker_id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Fetch worker dashboard data (bypasses RLS issues)
app.get('/api/worker_dashboard/:worker_id', async (req, res) => {
    try {
        const { worker_id } = req.params;
        
        // Fetch tasks assigned to worker
        const { data: tasks } = await supabase.from('tasks')
            .select('*')
            .eq('assigned_worker_id', worker_id)
            .order('created_at', { ascending: false });
            
        // Fetch offers for worker
        const { data: offers } = await supabase.from('task_offers')
            .select('*, tasks(*)')
            .eq('worker_id', worker_id)
            .in('status', ['pending_worker', 'accepted_by_worker']);
            
        res.json({ tasks: tasks || [], offers: offers || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Requester approves worker
app.post('/api/tasks/approve_worker', async (req, res) => {
    try {
        const { task_id, worker_id } = req.body;
        
        // Update task
        await supabase.from('tasks').update({ 
            status: 'assigned', 
            assigned_worker_id: worker_id 
        }).eq('id', task_id);
        
        // Worker becomes unavailable
        await supabase.from('worker_profiles').update({ is_available: false }).eq('user_id', worker_id);
        
        // Auto-reject other offers for this task
        await supabase.from('task_offers')
            .update({ status: 'rejected_by_worker' })
            .eq('task_id', task_id)
            .neq('worker_id', worker_id);
            
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Requester rates worker and completes task
app.post('/api/tasks/rate_worker', async (req, res) => {
    try {
        const { task_id, worker_id, rating } = req.body;
        
        // Mark task as completed
        await supabase.from('tasks').update({ status: 'completed' }).eq('id', task_id);
        
        // Update worker stats
        const { data: profile } = await supabase.from('worker_profiles').select('*').eq('user_id', worker_id).single();
        if (profile) {
            const currentTotalRatings = profile.total_ratings || 0;
            const currentRating = profile.rating || 0;
            const currentExperience = profile.experience || 0;
            
            const newTotalRatings = currentTotalRatings + 1;
            const newRating = ((currentRating * currentTotalRatings) + rating) / newTotalRatings;
            const newExperience = currentExperience + 1;
            
            // Mark worker as available again
            await supabase.from('worker_profiles').update({
                rating: newRating,
                total_ratings: newTotalRatings,
                experience: newExperience,
                is_available: true
            }).eq('user_id', worker_id);
        }
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Production Matching Engine running on port ${PORT}`));
