/**
 * SAT-style adaptive scoring model logic.
 * Weights: Easy = 1.0, Medium = 1.5, Hard = 2.0.
 * Calculation: Sums correct weighted answers for the first 22 questions.
 * Scales to a 200-800 section score.
 */

export const DIFFICULTY_WEIGHTS = {
  Easy: 1.0,
  Medium: 1.5,
  Hard: 2.0,
};

// Max potential weighted scores (based on difficulty distributions per user instructions)
// Module 1 (22 questions): 30% Easy (6.6), 40% Med (8.8), 30% Hard (6.6)
// Raw: 6.6*1.0 + 8.8*1.5 + 6.6*2.0 = 6.6 + 13.2 + 13.2 = 33.0
export const MAX_M1_RAW_WEIGHTED = 33.0;

// Module 2 Higher (22 questions): 15% Easy (3.3), 35% Med (7.7), 50% Hard (11)
// Raw: 3.3*1.0 + 7.7*1.5 + 11*2.0 = 3.3 + 11.55 + 22.0 = 36.85
export const MAX_M2_HIGHER_RAW_WEIGHTED = 36.85;

// Module 2 Lower (22 questions): 45% Easy (9.9), 40% Med (8.8), 15% Hard (3.3)
// Raw: 9.9*1.0 + 8.8*1.5 + 3.3*2.0 = 9.9 + 13.2 + 6.6 = 29.7
export const MAX_M2_LOWER_RAW_WEIGHTED = 29.7;


/**
 * Calculates raw weighted score for the first 22 questions of a module.
 * Skips pretest questions (23 and 24).
 */
export function calculateModuleWeightedScore(questions: any[], answers: Record<number, string>, freeText: Record<number, string>): number {
  let score = 0;
  // Scored questions are standard the first 22
  for (let i = 0; i < Math.min(questions.length, 22); i++) {
    const q = questions[i];
    const userAns = (answers[i] || freeText[i] || "").trim().toLowerCase();
    const correctAns = (q.correct_answer || "").trim().toLowerCase();

    if (userAns === correctAns && userAns !== "") {
      const difficulty = (q.difficulty || "Medium") as keyof typeof DIFFICULTY_WEIGHTS;
      score += DIFFICULTY_WEIGHTS[difficulty] || 1.5;
    }
  }
  return score;
}

/**
 * Combines submodule weighted scores and scales to the SAT 200-800 range.
 * Scores are rounded to the nearest 10 as per traditional SAT standards.
 */
export function calculateSectionScaledScore(m1Raw: number, m2Raw: number, isHigherPath: boolean): number {
  const totalRaw = m1Raw + m2Raw;
  let finalScore: number;
  
  if (isHigherPath) {
    // Scaling for Higher Path: 200 to 800
    const maxTotalCombined = MAX_M1_RAW_WEIGHTED + MAX_M2_HIGHER_RAW_WEIGHTED;
    const scaled = 200 + (totalRaw / maxTotalCombined) * 600;
    finalScore = scaled;
  } else {
    // Scaling for Lower Path: 200 to 600 (Benchmark goal)
    const maxTotalCombined = MAX_M1_RAW_WEIGHTED + MAX_M2_LOWER_RAW_WEIGHTED;
    const scaled = 200 + (totalRaw / maxTotalCombined) * 400;
    finalScore = scaled;
  }

  // Round to nearest 10
  const rounded = Math.round(finalScore / 10) * 10;
  return Math.min(800, Math.max(200, rounded));
}
