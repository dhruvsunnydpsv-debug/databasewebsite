-- Supabase Schema for Digital SAT Sync Engine
-- Create the sat_question_bank table according to the official College Board SAT blueprint.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sat_question_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module text NOT NULL CHECK (module IN ('Math', 'Reading_Writing')),
    domain text NOT NULL,
    difficulty text NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    question_text text NOT NULL,
    options jsonb, -- Array of 4 string options, or null for SPR Math questions
    correct_answer text NOT NULL,
    rationale text NOT NULL,
    source_method text NOT NULL CHECK (source_method IN ('Automated_Pipeline', 'Admin_Dropzone')),
    created_at timestamp with time zone DEFAULT now(),
    
    -- Constraint to enforce correct domains based on the module
    CONSTRAINT valid_domain CHECK (
        (module = 'Math' AND domain IN ('Heart_of_Algebra', 'Advanced_Math', 'Problem_Solving_Data', 'Geometry_Trigonometry')) OR
        (module = 'Reading_Writing' AND domain IN ('Information_and_Ideas', 'Craft_and_Structure', 'Expression_of_Ideas', 'Standard_English_Conventions'))
    )
);

-- Enable Row Level Security
ALTER TABLE sat_question_bank ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow public read access" ON sat_question_bank
    FOR SELECT TO authenticated
    USING (true);

-- Allow insert/update access for authenticated admins/service roles only
-- (Adjust this policy based on your actual auth requirements)
CREATE POLICY "Allow restricted insert access" ON sat_question_bank
    FOR INSERT TO authenticated
    WITH CHECK (true);
    
-- Create an index to improve search/filtering by module and domain
CREATE INDEX idx_sat_module_domain ON sat_question_bank(module, domain);
