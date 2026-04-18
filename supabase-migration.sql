-- =============================================
-- MIGRATION: Add Groups Architecture
-- Run this in Supabase SQL Editor if your
-- users and templates tables already exist.
-- =============================================

-- STEP 1: Create the new groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    columns JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- STEP 2: Add new columns to existing users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}'::jsonb;

-- STEP 3: Add new column to existing templates table
ALTER TABLE templates
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

-- STEP 4: Enable RLS on groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- Add delete policies to users and templates (may not have existed before)
DO $$ BEGIN
    CREATE POLICY "Enable delete access for all users" ON users FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Enable delete access for all templates" ON templates FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- STEP 5: Groups RLS policies
DO $$ BEGIN
    CREATE POLICY "Enable read for groups" ON groups FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Enable insert for groups" ON groups FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Enable update for groups" ON groups FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Enable delete for groups" ON groups FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
