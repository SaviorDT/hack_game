export interface CharacterState extends Record<string, string | number | boolean | null> {
  x: number
  y: number
  width: number
  height: number
  health: number
  maxHealth: number
  alive: boolean
  discovered: boolean
  weaponId: string | null
  attackCooldownMs: number
}

export const CHARACTER_ROLES: readonly string[] = ['player', 'guard']
