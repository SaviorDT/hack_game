import { AabbCollisionWorld } from './CollisionWorld.ts'
import type { CollisionWorld } from './CollisionWorld.ts'
import { CHARACTER_ROLES } from './CharacterState.ts'
import type { CharacterState } from './CharacterState.ts'
import { weaponFor } from './WeaponDefinition.ts'
import type { WorldObject } from './WorldObject.ts'
import { getMutableWorldObjectState } from './WorldObjectState.ts'
import type { WorldState } from './WorldState.ts'

export type AttackResult =
  | { readonly status: 'hit'; readonly targetId: string; readonly damage: number }
  | { readonly status: 'no-target' }
  | { readonly status: 'cooling-down' }

function characterState(worldObject: WorldObject): CharacterState {
  return getMutableWorldObjectState<CharacterState>(worldObject)
}

function boxOf(worldObject: WorldObject) {
  const { x, y, width, height } = characterState(worldObject)
  return { x, y, width, height }
}

export class CombatService {
  private readonly collision: CollisionWorld

  constructor(collision: CollisionWorld = new AabbCollisionWorld()) {
    this.collision = collision
  }

  attack(state: WorldState, attackerId: string): AttackResult {
    const attacker = state.worldObjects.find((worldObject) => worldObject.id === attackerId)
    if (!attacker) {
      throw new Error(`Unknown attacker "${attackerId}".`)
    }

    const attackerState = characterState(attacker)
    if (attackerState.attackCooldownMs > 0) {
      return { status: 'cooling-down' }
    }

    const weapon = weaponFor(attackerState.weaponId)
    const candidates = state.worldObjects
      .filter(
        (worldObject) =>
          worldObject !== attacker &&
          worldObject.roomId === state.currentRoomId &&
          CHARACTER_ROLES.includes(String(worldObject.metadata.role)) &&
          characterState(worldObject).alive,
      )
      .map((worldObject) => ({ worldObject, box: boxOf(worldObject) }))

    const target = this.collision.nearestWithin(boxOf(attacker), candidates, weapon.reach)
    if (!target) {
      return { status: 'no-target' }
    }

    const targetState = characterState(target.worldObject)
    targetState.health = Math.max(0, targetState.health - weapon.damage)
    targetState.alive = targetState.health > 0
    targetState.discovered = true
    attackerState.attackCooldownMs = weapon.cooldownMs
    return { status: 'hit', targetId: target.worldObject.id, damage: weapon.damage }
  }

  advanceCooldowns(state: WorldState, elapsedMs: number): void {
    for (const worldObject of state.worldObjects) {
      if (CHARACTER_ROLES.includes(String(worldObject.metadata.role))) {
        const character = characterState(worldObject)
        character.attackCooldownMs = Math.max(0, character.attackCooldownMs - elapsedMs)
      }
    }
  }
}
