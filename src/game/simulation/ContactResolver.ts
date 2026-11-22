import { ShapeCollisionWorld } from '../domain/CollisionWorld.ts'
import type { CollisionWorld } from '../domain/CollisionWorld.ts'
import { colliderTagsOf, type ColliderTag, type WeaponColliderTag } from '../domain/ColliderTag.ts'
import type { CharacterState } from '../domain/CharacterState.ts'
import { applyPlayerDefeat } from '../domain/PlayerDefeat.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { ThrownState } from './MvDrive.ts'
import { SIMULATION_TICK_MS } from './tickConstants.ts'

interface BodyState {
  x: number
  y: number
  width: number
  height: number
  vx?: number
  vy?: number
  thrown?: ThrownState | null
  [key: string]: unknown
}

/** What a rule may need to know about the moment of the contact. */
export interface ContactContext {
  readonly simulationTick: number
}

export interface ContactRule<A extends ColliderTag, S extends ColliderTag> {
  readonly actorClass: A['class']
  readonly subjectClass: S['class']
  apply(actor: WorldObject, actorTag: A, subject: WorldObject, subjectTag: S, context: ContactContext): void
}

/** The game time a target is spared after taking Impact Damage; the same target can then take it again. */
export const IMPACT_COOLDOWN_MS = 500

const IMPACT_COOLDOWN_TICKS = Math.ceil(IMPACT_COOLDOWN_MS / SIMULATION_TICK_MS)

function bodyOf(worldObject: WorldObject): BodyState {
  return getMutableWorldObjectState(worldObject) as unknown as BodyState
}

/**
 * A Weapon in flight hurts an alive target (a Character or a Target Dummy) in proportion to its speed, unless
 * the target took Impact Damage within the Impact Cooldown. A touch that does no damage starts no cooldown.
 */
function applyImpactDamage(actor: WorldObject, actorTag: WeaponColliderTag, subject: WorldObject, context: ContactContext): void {
  const actorState = bodyOf(actor)
  const target = getMutableWorldObjectState<CharacterState>(subject)
  if (!actorState.thrown || !target.alive) {
    return
  }
  // `lastImpactTick` is the simulation tick of the last Impact Damage taken; unset until the first.
  const last = target.lastImpactTick
  if (typeof last === 'number' && context.simulationTick - last < IMPACT_COOLDOWN_TICKS) {
    return
  }
  const damage = actorTag.impactDamageRate * Math.hypot(actorState.vx ?? 0, actorState.vy ?? 0)
  if (damage <= 0) {
    return
  }
  target.lastImpactTick = context.simulationTick
  target.health = Math.max(0, target.health - damage)
  target.alive = target.health > 0
}

/** A Thrown Weapon touching an alive Character hurts it; nothing else changes. */
export const weaponHitsCharacter: ContactRule<WeaponColliderTag, ColliderTag> = {
  actorClass: 'weapon',
  subjectClass: 'character',
  apply: (actor, actorTag, subject, _subjectTag, context) => applyImpactDamage(actor, actorTag, subject, context),
}

/** A Thrown Weapon touching an alive Target Dummy hurts it, exactly as it hurts a Character. */
export const weaponHitsTarget: ContactRule<WeaponColliderTag, ColliderTag> = {
  actorClass: 'weapon',
  subjectClass: 'target',
  apply: (actor, actorTag, subject, _subjectTag, context) => applyImpactDamage(actor, actorTag, subject, context),
}

/**
 * Finds Thrown objects touching other objects and dispatches the rule registered for each
 * pair of Collider Tag classes. Objects only carry tags; the rules live here.
 */
export class ContactResolver {
  private readonly collision: CollisionWorld
  private readonly rules: readonly ContactRule<never, never>[]

  constructor(
    collision: CollisionWorld = new ShapeCollisionWorld(),
    rules: readonly ContactRule<never, never>[] = [
      weaponHitsCharacter as ContactRule<never, never>,
      weaponHitsTarget as ContactRule<never, never>,
    ],
  ) {
    this.collision = collision
    this.rules = rules
  }

  resolve(state: WorldState): void {
    const context: ContactContext = { simulationTick: state.simulationTick }
    const inRoom = state.worldObjects.filter((worldObject) => worldObject.roomId === state.currentRoomId)

    for (const actor of inRoom) {
      const actorBody = bodyOf(actor)
      if (!actorBody.thrown) {
        continue
      }
      const actorTags = colliderTagsOf(actor)

      for (const subject of inRoom) {
        if (subject === actor || this.collision.gap(actorBody, bodyOf(subject)) > 0) {
          continue
        }
        const subjectTags = colliderTagsOf(subject)

        for (const rule of this.rules) {
          const actorTag = actorTags.find((tag) => tag.class === rule.actorClass)
          const subjectTag = subjectTags.find((tag) => tag.class === rule.subjectClass)
          if (actorTag && subjectTag) {
            ;(rule as ContactRule<ColliderTag, ColliderTag>).apply(actor, actorTag, subject, subjectTag, context)
          }
        }
      }
    }

    applyPlayerDefeat(state)
  }
}
