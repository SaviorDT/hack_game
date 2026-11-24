/** Tuning for archers and their arrows. */
export const ARCHER_CONFIG = {
  /** Arrows each archer owns; a fired arrow is reused once it has landed. */
  arrowsPerArcher: 3,
  /** Time between shots, in game time (so Command Mode slows it too). */
  cooldownMs: 1500,
  /** The archer only shoots at a player within this distance (centre to centre); room entrances stay out of reach. */
  rangePx: 1300,
  /** Arrow flight speed. */
  arrowSpeed: 650,
  /** Health an arrow takes from the Character it hits. */
  arrowDamage: 30,
  /** An arrow's collider, pointing along its flight. */
  arrowSize: { width: 28, height: 10 },
} as const

export function arrowIdsFor(archerId: string): string[] {
  return Array.from({ length: ARCHER_CONFIG.arrowsPerArcher }, (_, index) => `${archerId}arrow${index + 1}`)
}
