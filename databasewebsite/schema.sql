-- ============================================================
-- MASTER SCHEMA: Digital SAT Question Bank 2026 Syllabus
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. Create / Migrate Table ────────────────────────────────
CREATE TABLE IF NOT EXISTS sat_question_bank (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    module          TEXT    NOT NULL CHECK (module IN ('Math', 'Reading_Writing')),
    domain          TEXT    NOT NULL,
    sub_domain      TEXT,                             -- e.g. 'Words in Context', 'Linear functions'
    difficulty      TEXT    NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
    question_text   TEXT    NOT NULL,
    is_spr          BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = Student-Produced Response (no options)
    options         JSONB,                            -- ["A text","B text","C text","D text"] or NULL for SPR
    correct_answer  TEXT    NOT NULL,
    rationale       TEXT,
    raw_original_text TEXT,                           -- Source material for verification
    source_method   TEXT    NOT NULL DEFAULT 'Automated_Pipeline'
                            CHECK (source_method IN ('Automated_Pipeline', 'Admin_Dropzone', 'AI_HARVEST')),
    created_at      TIMESTAMPTZ DEFAULT now(),

    -- Enforce correct domains per module (2026 Syllabus)
    CONSTRAINT valid_domain CHECK (
        (module = 'Math' AND domain IN (
            'Algebra', 'Advanced Math',
            'Problem-solving and Data Analysis', 'Geometry and Trigonometry'
        )) OR
        (module = 'Reading_Writing' AND domain IN (
            'Craft and Structure', 'Information and Ideas',
            'Standard English Conventions', 'Expression of Ideas'
        ))
    ),

    -- SPR questions must have null options
    CONSTRAINT spr_options_null CHECK (
        (is_spr = TRUE AND options IS NULL) OR
        (is_spr = FALSE)
    )
);

-- ── 2. Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sat_module      ON sat_question_bank(module);
CREATE INDEX IF NOT EXISTS idx_sat_domain      ON sat_question_bank(domain);
CREATE INDEX IF NOT EXISTS idx_sat_difficulty  ON sat_question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_sat_domain_diff ON sat_question_bank(domain, difficulty);

-- ── 3. Row Level Security ─────────────────────────────────────
ALTER TABLE sat_question_bank ENABLE ROW LEVEL SECURITY;

-- Public can read
DROP POLICY IF EXISTS "Allow public read access" ON sat_question_bank;
CREATE POLICY "Allow public read access" ON sat_question_bank
    FOR SELECT TO anon, authenticated USING (true);

-- Authenticated / service role can insert
DROP POLICY IF EXISTS "Allow restricted insert access" ON sat_question_bank;
CREATE POLICY "Allow restricted insert access" ON sat_question_bank
    FOR INSERT TO authenticated WITH CHECK (true);

-- ── 4. VIEWS: One per domain × difficulty (24 total) ─────────
-- ── MATH VIEWS ───────────────────────────────────────────────
CREATE OR REPLACE VIEW view_math_algebra_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Algebra' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_algebra_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Algebra' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_algebra_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Algebra' AND difficulty = 'Hard';

CREATE OR REPLACE VIEW view_math_advanced_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced Math' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_advanced_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced Math' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_advanced_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced Math' AND difficulty = 'Hard';

CREATE OR REPLACE VIEW view_math_psda_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Problem-solving and Data Analysis' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_psda_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Problem-solving and Data Analysis' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_psda_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Problem-solving and Data Analysis' AND difficulty = 'Hard';

CREATE OR REPLACE VIEW view_math_geotrig_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry and Trigonometry' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_math_geotrig_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry and Trigonometry' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_math_geotrig_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry and Trigonometry' AND difficulty = 'Hard';

-- ── READING & WRITING VIEWS ──────────────────────────────────
CREATE OR REPLACE VIEW view_rw_craft_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Craft and Structure' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_craft_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Craft and Structure' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_craft_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Craft and Structure' AND difficulty = 'Hard';

CREATE OR REPLACE VIEW view_rw_info_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Information and Ideas' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_info_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Information and Ideas' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_info_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Information and Ideas' AND difficulty = 'Hard';

CREATE OR REPLACE VIEW view_rw_sec_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Standard English Conventions' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_sec_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Standard English Conventions' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_sec_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Standard English Conventions' AND difficulty = 'Hard';

CREATE OR REPLACE VIEW view_rw_expression_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Expression of Ideas' AND difficulty = 'Easy';
CREATE OR REPLACE VIEW view_rw_expression_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Expression of Ideas' AND difficulty = 'Medium';
CREATE OR REPLACE VIEW view_rw_expression_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Expression of Ideas' AND difficulty = 'Hard';

-- ── 5. Helper view: inventory snapshot ────────────────────────
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

