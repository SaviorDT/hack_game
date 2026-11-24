/**
 * Glitch effect shader tuning constants for Command Mode time dilation.
 * Tuned conservatively so the command prompt and battlefield remain legible.
 * Human-adjustable parameters for visual tuning.
 */

/** Horizontal pixel displacement strength (0.0 = none, 0.012 = subtle cyber jitter, 0.05 = heavy glitch). */
export const DEFAULT_GLITCH_SHAKE_POWER = 0.0

/** Probability of jitter activation per block slice cycle (0.0 to 1.0). */
export const DEFAULT_GLITCH_SHAKE_RATE = 1.0

/** Temporal oscillation speed of the glitch jitter. */
export const DEFAULT_GLITCH_SHAKE_SPEED = 0.001

/** Vertical granularity of glitch blocks (larger number = thinner horizontal slices). */
export const DEFAULT_GLITCH_SHAKE_BLOCK_SIZE = 64.0

/** Chromatic aberration offset distance for red and blue channel separation. */
export const DEFAULT_GLITCH_SHAKE_COLOR_RATE = 0.0

/** Duration in milliseconds for the shader shake_power to fade in when entering Command Mode. */
export const GLITCH_FADE_IN_MS = 100

/** Duration in milliseconds for the shader shake_power to fade out when leaving Command Mode. */
export const GLITCH_FADE_OUT_MS = 80
