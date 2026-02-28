/**
 * SAT Scoring Logic - Multistage Adaptive Model
 * Weighted scoring based on question difficulty:
 * Easy: 1.0, Medium: 1.5, Hard: 2.0
 */

export const WEIGHTS = {
  Easy: 1.0,
  Medium: 1.5,
  Hard: 2.0,
};

export const MAX_RAW_M1 = 33.0; // (0.3*22*1 + 0.4*22*1.5 + 0.3*22*2)
export const MAX_RAW_M2_HIGHER = 36.85; // (0.15*22*1 + 0.35*22*1.5 + 0.5*22*2)
export const MAX_RAW_M2_LOWER = 29.7; // (0.45*22*1 + 0.4*22*1.5 + 0.15*22*2)

export interface Question {
  id: string;
  difficulty?: string;
  correct_answer: string;
  [key: string]: any;
}

/**
 * Calculates raw weighted score for a set of questions
 * Pretest questions (last 2) are ignored.
 */
export function calculateWeightedScore(questions: Question[], answers: Record<number, string>, freeText: Record<number, string>): number {
  let score = 0;
  // Iterate through the first 22 questions (scored)
  for (let i = 0; i < Math.min(questions.length, 22); i++) {
    const q = questions[i];
    const userAns = (answers[i] || freeText[i] || "").trim().toLowerCase();
    const correctAns = (q.correct_answer || "").trim().toLowerCase();

    if (userAns === correctAns && userAns !== "") {
      const difficulty = (q.difficulty as keyof typeof WEIGHTS) || "Medium";
      score += WEIGHTS[difficulty] || 1.5;
    }
  }
  return score;
}

/**
 * Scales raw weighted scores to 200-800 per section
 * @param m1Raw Raw weighted score from Module 1
 * @param m2Raw Raw weighted score from Module 2
 * @param isHigherPath Whether the user was routed to the higher difficulty module
 */
export function calculateSectionScore(m1Raw: number, m2Raw: number, isHigherPath: boolean): number {
  const totalRaw = m1Raw + m2Raw;
  
  if (isHigherPath) {
    // Scaling for Higher Path: 200 to 800
    // Max raw possible: 33 + 36.85 = 69.85
    const maxTotal = MAX_RAW_M1 + MAX_RAW_M2_HIGHER;
    const scaled = 200 + (totalRaw / maxTotal) * 600;
    return Math.round(Math.min(800, Math.max(200, scaled)));
  } else {
    // Scaling for Lower Path: 200 to 600 (Benchmark)
    // Max raw possible: 33 + 29.7 = 62.7
    const maxTotal = MAX_RAW_M1 + MAX_RAW_M2_LOWER;
    const scaled = 200 + (totalRaw / maxTotal) * 400;
    return Math.round(Math.min(600, Math.max(200, scaled)));
  }
}

/**
 * Routing logic based on Module 1 percentage correct
 */
export function shouldRouteToHigher(module1Raw: number, maxM1Raw: number): boolean {
    // User requested: routing based on accuracy (correct count / scored count)
    // scoredCount is 22.
    // However, they also provided weighted scores. 
    // Usually "accuracy" refers to raw count (e.g. 15/22).
    // Let's assume raw correct count since they said "≥ 70% correct".
    return false; // This helper might be redundant if we just check count in the component.
}
