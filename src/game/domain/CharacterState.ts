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
}

export const CHARACTER_ROLES: readonly string[] = ['player', 'guard']
