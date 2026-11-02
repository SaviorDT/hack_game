import { AabbCollisionWorld } from '../domain/CollisionWorld.ts'
import type { CollisionWorld } from '../domain/CollisionWorld.ts'
import { colliderTagsOf, type ColliderTag, type WeaponColliderTag } from '../domain/ColliderTag.ts'
import type { CharacterState } from '../domain/CharacterState.ts'
import { applyPlayerDefeat } from '../domain/PlayerDefeat.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import type { ThrownState } from './ThrownFlight.ts'

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

export interface ContactRule<A extends ColliderTag, S extends ColliderTag> {
  readonly actorClass: A['class']
  readonly subjectClass: S['class']
  apply(actor: WorldObject, actorTag: A, subject: WorldObject, subjectTag: S): void
}

function bodyOf(worldObject: WorldObject): BodyState {
  return getMutableWorldObjectState(worldObject) as unknown as BodyState
}

/** A Thrown Weapon touching an alive Character hurts it once per Throw; nothing else changes. */
export const weaponHitsCharacter: ContactRule<WeaponColliderTag, ColliderTag> = {
  actorClass: 'weapon',
  subjectClass: 'character',
  apply(actor, actorTag, subject) {
    const actorState = bodyOf(actor)
    const thrown = actorState.thrown
    const character = getMutableWorldObjectState<CharacterState>(subject)
    if (!thrown || !character.alive || thrown.hitIds.includes(subject.id)) {
      return
    }
    thrown.hitIds.push(subject.id)
    const speed = Math.hypot(actorState.vx ?? 0, actorState.vy ?? 0)
    character.health = Math.max(0, character.health - actorTag.impactDamageRate * speed)
    character.alive = character.health > 0
  },
}

/**
 * Finds Thrown objects touching other objects and dispatches the rule registered for each
 * pair of Collider Tag classes. Objects only carry tags; the rules live here.
 */
export class ContactResolver {
  private readonly collision: CollisionWorld
  private readonly rules: readonly ContactRule<never, never>[]

  constructor(
    collision: CollisionWorld = new AabbCollisionWorld(),
    rules: readonly ContactRule<never, never>[] = [weaponHitsCharacter as ContactRule<never, never>],
  ) {
    this.collision = collision
    this.rules = rules
  }

  resolve(state: WorldState): void {
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
            ;(rule as ContactRule<ColliderTag, ColliderTag>).apply(actor, actorTag, subject, subjectTag)
          }
        }
      }
    }

    applyPlayerDefeat(state)
  }
}
