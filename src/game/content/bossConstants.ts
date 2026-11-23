/** Tuning for the Boss and its Blades. Times are game time, so Command Mode slows them too. */
export const BOSS_CONFIG = {
  maxHealth: 300,
  /** Top speed while chasing. */
  chaseSpeed: 200,
  /** Health a melee hit takes from its target. */
  strikeDamage: 40,
  /** Each tick, the chance of starting the Blade volley, and (on top of it) of starting the retreat and dash. */
  volleyChancePerTick: 0.001,
  retreatChancePerTick: 0.001,
  /** Volley: the Boss stands still this long, then fires `waves` waves `waveIntervalMs` apart. */
  volleyWindUpMs: 1500,
  waves: 3,
  waveIntervalMs: 500,
  /** One Blade per angle, from `-fanHalfAngleDeg` to `+fanHalfAngleDeg` around the line to the player. */
  fanHalfAngleDeg: 60,
  fanStepDeg: 10,
  bladeSpeed: 500,
  /** Blades start this far from the Boss's centre, along their direction. */
  bladeSpawnDistance: 40,
  /** Health a Blade takes per px/s of speed, a third of a dagger's 0.05. */
  bladeImpactDamageRate: 0.017,
  bladeSize: { width: 24, height: 24 },
  bladeDisplaySize: 56,
  /** Retreat: back away from the player, then dash. */
  retreatSpeed: 80,
  retreatMs: 1000,
  dashSpeed: 800,
  /** How fast the dash reaches its speed, px/s². */
  dashAcceleration: 12000,
  /** Touching the player during a dash deals this much. */
  dashDamage: 999,
  /** A dash ends once the Boss is this much slower than its dash speed (a wall or Obstacle stopped it). */
  dashStalledShare: 0.5,
  /** A dash is not judged stalled before it has had this long to get up to speed. */
  dashGraceMs: 150,
  /** The gap (px) at which the Boss counts as touching the player. */
  dashTouchGap: 4,
  /** How long the Boss is stunned after its dash hit a wall or Obstacle. */
  recoverMs: 1500,
} as const

/** The four naming rules of Blades; each wave of a volley uses a different one, numbered from 1. */
export const BLADE_NAME_RULES = ['dagger', 'knife', 'blade', 'shiv'] as const

/** Blades fired per wave: one per fan step, ends included. */
export const BLADES_PER_WAVE = Math.round((2 * BOSS_CONFIG.fanHalfAngleDeg) / BOSS_CONFIG.fanStepDeg) + 1

export const BLADES_PER_BOSS = BLADES_PER_WAVE * BOSS_CONFIG.waves

export function bladeIdsFor(bossId: string): string[] {
  return Array.from({ length: BLADES_PER_BOSS }, (_, index) => `${bossId}blade${index + 1}`)
}
