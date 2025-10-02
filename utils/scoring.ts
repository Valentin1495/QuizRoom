/**
 * Calculates the score for a single question.
 * @param base - The base score for a correct answer.
 * @param msLeft - The milliseconds left on the timer.
 * @param streak - The current correct answer streak.
 * @returns The calculated score.
 */
export const calcScore = (base = 100, msLeft: number, streak: number) => {
  if (msLeft <= 0) return 0; // Incorrect or timed out

  // Time bonus: max +50 points, scaled by time left (e.g., 20s timer -> msLeft/400)
  const timeBonus = Math.round(Math.min(50, msLeft / 400));

  // Streak bonus: 1.1x, 1.2x, ..., max 1.5x
  const streakMultiplier = Math.min(1.5, 1 + 0.1 * Math.max(0, streak - 1));

  return Math.round((base + timeBonus) * streakMultiplier);
};
