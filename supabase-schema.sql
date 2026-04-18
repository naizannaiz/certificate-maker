-- =============================================
-- STEP 1: Create the groups table FIRST
-- (users and templates will reference it)
-- =============================================
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    columns JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- STEP 2: Create the users table
-- =============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    certificate_id TEXT UNIQUE NOT NULL,
    is_eligible BOOLEAN DEFAULT true,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    extra_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- STEP 3: Create the templates table
-- =============================================
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    background_url TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT false,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- STEP 4: Row Level Security
-- =============================================
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Groups policies
CREATE POLICY "Enable read for groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Enable insert for groups" ON groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for groups" ON groups FOR UPDATE USING (true);
CREATE POLICY "Enable delete for groups" ON groups FOR DELETE USING (true);

-- Users policies
CREATE POLICY "Enable read access for all users" ON users FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON users FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON users FOR DELETE USING (true);

-- Templates policies
CREATE POLICY "Enable read access for all templates" ON templates FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all templates" ON templates FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all templates" ON templates FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all templates" ON templates FOR DELETE USING (true);

-- =============================================
-- STEP 5: Supabase Storage for Template PDFs
-- =============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('templates', 'templates', true);
CREATE POLICY "Allow public viewing of templates" ON storage.objects FOR SELECT USING ( bucket_id = 'templates' );
CREATE POLICY "Allow uploads to templates" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'templates' );

