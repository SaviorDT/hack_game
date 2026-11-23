import type { MutableWorldObjectState } from './WorldObjectState.ts'

export interface CharacterState extends MutableWorldObjectState {
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
  facing: 'left' | 'right'
}

export const CHARACTER_ROLES: readonly string[] = ['player', 'enemy', 'guard']

/** Roles of Hostile Characters (`guard` is the legacy name of `enemy`). */
export const HOSTILE_ROLES: readonly string[] = ['enemy', 'guard']

export function isHostileRole(role: unknown): boolean {
  return HOSTILE_ROLES.includes(String(role))
}

export type CharacterCombatState = CharacterState & {
  /** Overrides the equipped weapon's damage for this Character's attacks (Strike Damage). */
  strikeDamage?: number
  attackSequence?: number
  damageSequence?: number
  lastDamageFromX?: number
}
