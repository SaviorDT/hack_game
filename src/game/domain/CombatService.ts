import { ShapeCollisionWorld, boxFromState } from './CollisionWorld.ts'
import type { CollisionWorld } from './CollisionWorld.ts'
import { CHARACTER_ROLES, isHostileRole } from './CharacterState.ts'
import type { CharacterCombatState } from './CharacterState.ts'
import { weaponFor } from './WeaponDefinition.ts'
import type { WorldObject } from './WorldObject.ts'
import { getMutableWorldObjectState } from './WorldObjectState.ts'
import type { WorldState } from './WorldState.ts'

export type AttackResult =
  | { readonly status: 'hit'; readonly targetId: string; readonly damage: number }
  | { readonly status: 'no-target' }
  | { readonly status: 'cooling-down' }

function characterState(worldObject: WorldObject): CharacterCombatState {
  return getMutableWorldObjectState<CharacterCombatState>(worldObject)
}

function boxOf(worldObject: WorldObject) {
  return boxFromState(characterState(worldObject))
}

export class CombatService {
  private readonly collision: CollisionWorld

  constructor(collision: CollisionWorld = new ShapeCollisionWorld()) {
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
    const attackerIsHostile = isHostileRole(attacker.metadata.role)
    const candidates = state.worldObjects
      .filter(
        (worldObject) =>
          worldObject !== attacker &&
          worldObject.roomId === state.currentRoomId &&
          CHARACTER_ROLES.includes(String(worldObject.metadata.role)) &&
          characterState(worldObject).alive &&
          // A Hostile Character never attacks another Hostile Character.
          !(attackerIsHostile && isHostileRole(worldObject.metadata.role)),
      )
      .map((worldObject) => ({ worldObject, box: boxOf(worldObject) }))

    const target = this.collision.nearestWithin(boxOf(attacker), candidates, weapon.reach)
    if (!target) {
      return { status: 'no-target' }
    }

    const targetState = characterState(target.worldObject)
    const damage = attackerState.strikeDamage ?? weapon.damage
    targetState.health = Math.max(0, targetState.health - damage)
    targetState.alive = targetState.health > 0
    targetState.discovered = true
    attackerState.attackCooldownMs = weapon.cooldownMs
    attackerState.attackSequence = (attackerState.attackSequence ?? 0) + 1
    attackerState.facing = targetState.x < attackerState.x ? 'left' : 'right'
    targetState.damageSequence = (targetState.damageSequence ?? 0) + 1
    targetState.lastDamageFromX = attackerState.x
    return { status: 'hit', targetId: target.worldObject.id, damage }
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
