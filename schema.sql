-- schema.sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- We use Supabase Auth. User Roles table links to auth.users.
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID PRIMARY KEY,
    role VARCHAR(50) NOT NULL CHECK (role IN ('requester', 'worker', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.worker_profiles (
    user_id UUID PRIMARY KEY,
    job_type VARCHAR(100) NOT NULL,
    lat DOUBLE PRECISION NOT NULL DEFAULT 0,
    lng DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID,
    required_job_type VARCHAR(100) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'completed')),
    assigned_worker_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- User Roles RLS
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
-- Allow users to insert their role on sign up
CREATE POLICY "Users can insert own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Worker Profiles RLS
CREATE POLICY "Workers can read/update own profile" ON public.worker_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins have full access to worker profiles" ON public.worker_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Anyone can read available workers" ON public.worker_profiles FOR SELECT USING (is_available = true);

-- Tasks RLS
CREATE POLICY "Requesters can read own tasks" ON public.tasks FOR SELECT USING (auth.uid() = requester_id);
CREATE POLICY "Requesters can insert own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Workers can read assigned tasks" ON public.tasks FOR SELECT USING (auth.uid() = assigned_worker_id);
CREATE POLICY "Workers can update assigned tasks" ON public.tasks FOR UPDATE USING (auth.uid() = assigned_worker_id);
CREATE POLICY "Admins have full access to tasks" ON public.tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Realtime Setup
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_profiles;
