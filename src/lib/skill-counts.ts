/**
 * How many drills each Skills Lab section has, without loading any of them: the front page and the profile only need the
 * numbers, and the banks are large. tests/skill-counts.test.ts keeps these true.
 */
export const SKILL_COUNTS = { spot: 387, sounds: 263, antidotes: 85, algorithms: 92, calculations: 50 } as const;
