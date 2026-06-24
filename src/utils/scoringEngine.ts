/**
 * Dynamic Scoring Engine
 * Calculates score or points for correct/incorrect questions based on quiz configuration, 
 * time taken, and decay curve.
 */

interface CalculatePointsParams {
  isCorrect: boolean;
  timeTakenSec: number; // in seconds
  timeLimitSec: number; // in seconds
  scoringMode?: "fixed" | "dynamic";
  maxPoints?: number;
  minPoints?: number;
  scoringCurve?: "linear" | "exponential";
  questionMarks: number; // fallback/fixed marks
  negativeMarkingEnabled: boolean;
  negativeFraction: number; // e.g. 0.25 (1/4 of marks)
}

export interface CalculatedScoreResult {
  awardedPoints: number; // points rounded to nearest integer
  responseTimeMs: number;
  remainingTimeMs: number;
  maxPointsPossible: number;
}

export function calculatePoints({
  isCorrect,
  timeTakenSec,
  timeLimitSec,
  scoringMode = "fixed",
  maxPoints = 1000,
  minPoints = 0,
  scoringCurve = "linear",
  questionMarks,
  negativeMarkingEnabled,
  negativeFraction,
}: CalculatePointsParams): CalculatedScoreResult {
  const timeTaken = Math.max(0, timeTakenSec);
  const totalLimit = Math.max(1, timeLimitSec);
  
  const responseTimeMs = Math.round(timeTaken * 1000);
  const remainingTimeMs = Math.round(Math.max(0, totalLimit - timeTaken) * 1000);

  // 1. Incorrect or skipped questions award 0 points (or deduction if negative marking is on)
  if (!isCorrect) {
    let penalty = 0;
    if (negativeMarkingEnabled) {
      const baseMarks = scoringMode === "dynamic" ? maxPoints : questionMarks;
      penalty = -Math.round(baseMarks * negativeFraction);
    }
    return {
      awardedPoints: penalty,
      responseTimeMs,
      remainingTimeMs,
      maxPointsPossible: scoringMode === "dynamic" ? maxPoints : questionMarks,
    };
  }

  // 2. Fixed Marks scoring mode
  if (scoringMode !== "dynamic") {
    return {
      awardedPoints: questionMarks,
      responseTimeMs,
      remainingTimeMs,
      maxPointsPossible: questionMarks,
    };
  }

  // 3. Dynamic Time-Based Points scoring mode
  const ratio = Math.max(0, Math.min(1, (totalLimit - timeTaken) / totalLimit));

  let factor = ratio;
  if (scoringCurve === "exponential") {
    factor = Math.pow(ratio, 2); // Elegant decay curve favoring faster speed
  }

  const basePoints = minPoints + (maxPoints - minPoints) * factor;
  const finalPoints = Math.min(maxPoints, Math.max(minPoints, Math.round(basePoints)));

  return {
    awardedPoints: finalPoints,
    responseTimeMs,
    remainingTimeMs,
    maxPointsPossible: maxPoints,
  };
}
