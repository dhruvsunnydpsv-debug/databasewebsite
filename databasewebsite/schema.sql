-- ============================================================
-- MASTER SCHEMA: Digital SAT Question Bank v2
-- Run this in Supabase SQL Editor to migrate from v1.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. DROP old table if you want a clean slate ──────────────
-- (Comment this out if you wish to preserve existing data and only ALTER)
-- DROP TABLE IF EXISTS sat_question_bank CASCADE;

-- ── 2. Create / Migrate Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS sat_question_bank (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    module          TEXT    NOT NULL CHECK (module IN ('Math', 'Reading_Writing')),
    domain          TEXT    NOT NULL,
    difficulty      TEXT    NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    question_text   TEXT    NOT NULL,
    is_spr          BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = Student-Produced Response (no options)
    options         JSONB,                            -- ["A text","B text","C text","D text"] or NULL for SPR
    correct_answer  TEXT    NOT NULL,
    rationale       TEXT,
    source_method   TEXT    NOT NULL DEFAULT 'Automated_Pipeline'
                            CHECK (source_method IN ('Automated_Pipeline', 'Admin_Dropzone')),
    created_at      TIMESTAMPTZ DEFAULT now(),

    -- Enforce correct domains per module
    CONSTRAINT valid_domain CHECK (
        (module = 'Math' AND domain IN (
            'Heart_of_Algebra', 'Advanced_Math',
            'Problem_Solving_Data', 'Geometry_Trigonometry'
        )) OR
        (module = 'Reading_Writing' AND domain IN (
            'Information_and_Ideas', 'Craft_and_Structure',
            'Expression_of_Ideas', 'Standard_English_Conventions'
        ))
    ),

    -- SPR questions must have null options
    CONSTRAINT spr_options_null CHECK (
        (is_spr = TRUE AND options IS NULL) OR
        (is_spr = FALSE)
    )
);

-- Add is_spr column to existing tables that don't have it yet (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'sat_question_bank' AND column_name = 'is_spr') THEN
        ALTER TABLE sat_question_bank
            ADD COLUMN is_spr BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- ── 3. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sat_module      ON sat_question_bank(module);
CREATE INDEX IF NOT EXISTS idx_sat_domain      ON sat_question_bank(domain);
CREATE INDEX IF NOT EXISTS idx_sat_difficulty  ON sat_question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_sat_is_spr      ON sat_question_bank(is_spr);
CREATE INDEX IF NOT EXISTS idx_sat_domain_diff ON sat_question_bank(domain, difficulty);

-- ── 4. Row Level Security ─────────────────────────────────────
ALTER TABLE sat_question_bank ENABLE ROW LEVEL SECURITY;

-- Public can read
DROP POLICY IF EXISTS "Allow public read access" ON sat_question_bank;
CREATE POLICY "Allow public read access" ON sat_question_bank
    FOR SELECT TO anon, authenticated USING (true);

-- Authenticated / service role can insert
DROP POLICY IF EXISTS "Allow restricted insert access" ON sat_question_bank;
CREATE POLICY "Allow restricted insert access" ON sat_question_bank
    FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- ── 5. VIEWS: One per domain × difficulty (24 total) ─────────
-- ── MATH VIEWS (4 domains × 3 difficulties = 12) ─────────────
-- ============================================================

-- Heart of Algebra
CREATE OR REPLACE VIEW view_math_algebra_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Heart_of_Algebra'   AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_algebra_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Heart_of_Algebra'   AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_algebra_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Heart_of_Algebra'   AND difficulty = 'Hard';

-- Advanced Math
CREATE OR REPLACE VIEW view_math_advanced_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced_Math'      AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_advanced_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced_Math'      AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_advanced_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced_Math'      AND difficulty = 'Hard';

-- Problem Solving & Data Analysis
CREATE OR REPLACE VIEW view_math_psda_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Problem_Solving_Data' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_psda_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Problem_Solving_Data' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_psda_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Problem_Solving_Data' AND difficulty = 'Hard';

-- Geometry & Trigonometry
CREATE OR REPLACE VIEW view_math_geotrig_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry_Trigonometry' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_geotrig_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry_Trigonometry' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_geotrig_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry_Trigonometry' AND difficulty = 'Hard';

-- ── READING & WRITING VIEWS (4 domains × 3 difficulties = 12) ─
-- Information and Ideas
CREATE OR REPLACE VIEW view_rw_info_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Information_and_Ideas'        AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_info_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Information_and_Ideas'        AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_info_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Information_and_Ideas'        AND difficulty = 'Hard';

-- Craft and Structure
CREATE OR REPLACE VIEW view_rw_craft_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Craft_and_Structure'         AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_craft_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Craft_and_Structure'         AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_craft_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Craft_and_Structure'         AND difficulty = 'Hard';

-- Expression of Ideas
CREATE OR REPLACE VIEW view_rw_expression_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Expression_of_Ideas'    AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_expression_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Expression_of_Ideas'    AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_expression_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Expression_of_Ideas'    AND difficulty = 'Hard';

-- Standard English Conventions
CREATE OR REPLACE VIEW view_rw_sec_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Standard_English_Conventions'  AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_sec_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Standard_English_Conventions'  AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_sec_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Standard_English_Conventions'  AND difficulty = 'Hard';

-- ── 6. Helper view: inventory snapshot used by the harvester ──
CREATE OR REPLACE VIEW view_inventory AS
    SELECT
        module,
        domain,
        difficulty,
        COUNT(*) AS question_count,
        SUM(CASE WHEN is_spr THEN 1 ELSE 0 END) AS spr_count
    FROM sat_question_bank
    GROUP BY module, domain, difficulty
    ORDER BY module, domain, difficulty;
