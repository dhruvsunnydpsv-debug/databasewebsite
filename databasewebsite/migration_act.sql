-- ============================================================
-- MIGRATION: ACT Integration (Non-breaking & Re-runnable)
-- ============================================================

-- 1. Add new columns
ALTER TABLE sat_question_bank 
ADD COLUMN IF NOT EXISTS exam_type TEXT NOT NULL DEFAULT 'SAT',
ADD COLUMN IF NOT EXISTS section TEXT;

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_exam_type ON sat_question_bank (exam_type);
CREATE INDEX IF NOT EXISTS idx_exam_section ON sat_question_bank (exam_type, section);

-- 3. Relax legacy 'module' NOT NULL constraint
ALTER TABLE sat_question_bank ALTER COLUMN module DROP NOT NULL;

-- 4. Add exam_type check constraint (Safe version)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_exam_type') THEN
        ALTER TABLE sat_question_bank 
        ADD CONSTRAINT valid_exam_type 
        CHECK (exam_type IN ('SAT', 'ACT'));
    END IF;
END $$;

-- 5. Tight Constraint: Data Rules (SAT uses module, ACT uses section)
-- Ensures SAT questions don't have sections and ACT questions don't have modules.
ALTER TABLE sat_question_bank DROP CONSTRAINT IF EXISTS sat_act_data_rules;
ALTER TABLE sat_question_bank 
ADD CONSTRAINT sat_act_data_rules 
CHECK (
    (exam_type = 'SAT' AND module IS NOT NULL AND section IS NULL) OR
    (exam_type = 'ACT' AND section IS NOT NULL AND module IS NULL)
);

-- 6. Update existing views (DROP FIRST to allow column structure changes)
-- MUST drop because SELECT * now includes new columns exam_type and section.

DROP VIEW IF EXISTS view_math_algebra_easy, view_math_algebra_medium, view_math_algebra_hard;
DROP VIEW IF EXISTS view_math_advanced_easy, view_math_advanced_medium, view_math_advanced_hard;
DROP VIEW IF EXISTS view_math_psda_easy, view_math_psda_medium, view_math_psda_hard;
DROP VIEW IF EXISTS view_math_geotrig_easy, view_math_geotrig_medium, view_math_geotrig_hard;
DROP VIEW IF EXISTS view_rw_craft_easy, view_rw_craft_medium, view_rw_craft_hard;
DROP VIEW IF EXISTS view_rw_info_easy, view_rw_info_medium, view_rw_info_hard;
DROP VIEW IF EXISTS view_rw_sec_easy, view_rw_sec_medium, view_rw_sec_hard;
DROP VIEW IF EXISTS view_rw_expression_easy, view_rw_expression_medium, view_rw_expression_hard;
DROP VIEW IF EXISTS view_inventory;
DROP VIEW IF EXISTS sat_only;

-- MATH VIEWS
CREATE OR REPLACE VIEW view_math_algebra_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Algebra' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_algebra_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Algebra' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_algebra_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Algebra' AND difficulty = 'Hard' AND exam_type = 'SAT';

CREATE OR REPLACE VIEW view_math_advanced_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced Math' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_advanced_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced Math' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_advanced_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Advanced Math' AND difficulty = 'Hard' AND exam_type = 'SAT';

CREATE OR REPLACE VIEW view_math_psda_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Problem-solving and Data Analysis' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_psda_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Problem-solving and Data Analysis' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_psda_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Problem-solving and Data Analysis' AND difficulty = 'Hard' AND exam_type = 'SAT';

CREATE OR REPLACE VIEW view_math_geotrig_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry and Trigonometry' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_geotrig_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry and Trigonometry' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_math_geotrig_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Geometry and Trigonometry' AND difficulty = 'Hard' AND exam_type = 'SAT';

-- READING & WRITING VIEWS
CREATE OR REPLACE VIEW view_rw_craft_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Craft and Structure' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_craft_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Craft and Structure' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_craft_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Craft and Structure' AND difficulty = 'Hard' AND exam_type = 'SAT';

CREATE OR REPLACE VIEW view_rw_info_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Information and Ideas' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_info_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Information and Ideas' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_info_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Information and Ideas' AND difficulty = 'Hard' AND exam_type = 'SAT';

CREATE OR REPLACE VIEW view_rw_sec_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Standard English Conventions' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_sec_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Standard English Conventions' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_sec_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Standard English Conventions' AND difficulty = 'Hard' AND exam_type = 'SAT';

CREATE OR REPLACE VIEW view_rw_expression_easy   AS SELECT * FROM sat_question_bank WHERE domain = 'Expression of Ideas' AND difficulty = 'Easy' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_expression_medium AS SELECT * FROM sat_question_bank WHERE domain = 'Expression of Ideas' AND difficulty = 'Medium' AND exam_type = 'SAT';
CREATE OR REPLACE VIEW view_rw_expression_hard   AS SELECT * FROM sat_question_bank WHERE domain = 'Expression of Ideas' AND difficulty = 'Hard' AND exam_type = 'SAT';

-- 7. Create 'sat_only' base view for isolation
CREATE OR REPLACE VIEW sat_only AS
SELECT * FROM sat_question_bank
WHERE exam_type = 'SAT';

-- 8. New ACT-specific views
CREATE OR REPLACE VIEW view_act_math    AS SELECT * FROM sat_question_bank WHERE exam_type = 'ACT' AND section = 'Math';
CREATE OR REPLACE VIEW view_act_english AS SELECT * FROM sat_question_bank WHERE exam_type = 'ACT' AND section = 'English';
CREATE OR REPLACE VIEW view_act_reading AS SELECT * FROM sat_question_bank WHERE exam_type = 'ACT' AND section = 'Reading';
CREATE OR REPLACE VIEW view_act_science AS SELECT * FROM sat_question_bank WHERE exam_type = 'ACT' AND section = 'Science';

-- 9. Inventory View
CREATE OR REPLACE VIEW view_inventory AS
    SELECT
        exam_type,
        COALESCE(module, section) AS group_name,
        domain,
        difficulty,
        COUNT(*) AS question_count,
        SUM(CASE WHEN is_spr THEN 1 ELSE 0 END) AS spr_count
    FROM sat_question_bank
    GROUP BY exam_type, group_name, domain, difficulty
    ORDER BY exam_type, group_name, domain, difficulty;
