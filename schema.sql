-- 1. Drop existing constraints if they exist
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- 2. Modify tasks table
-- New allowed statuses: 'pending', 'pending_matching', 'offered', 'assigned', 'completed'
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (
    status IN ('pending', 'pending_matching', 'offered', 'assigned', 'completed')
);

-- 3. Modify worker_profiles table
ALTER TABLE worker_profiles 
ADD COLUMN IF NOT EXISTS rating NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_ratings INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS experience INT DEFAULT 0;

-- 4. Create task_offers table
CREATE TABLE IF NOT EXISTS task_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    worker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending_worker', 'accepted_by_worker', 'rejected_by_worker')) DEFAULT 'pending_worker',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(task_id, worker_id)
);

-- 5. Enable RLS on task_offers
ALTER TABLE task_offers ENABLE ROW LEVEL SECURITY;

-- 6. Add basic RLS policies for task_offers (Adjust as per your security model)
-- Allow workers to read and update their own offers
CREATE POLICY "Workers can view their own offers" 
ON task_offers FOR SELECT 
USING (auth.uid() = worker_id);

CREATE POLICY "Workers can update their own offers" 
ON task_offers FOR UPDATE 
USING (auth.uid() = worker_id);

-- Allow requesters to view offers for their tasks
CREATE POLICY "Requesters can view offers for their tasks" 
ON task_offers FOR SELECT 
USING (
    task_id IN (SELECT id FROM tasks WHERE requester_id = auth.uid())
);

-- Service role can do everything (handled automatically)
