import type { JsonValue } from './JsonValue.ts'
import type { WorldObject } from './WorldObject.ts'

export const WEAPON_IMPACT_DAMAGE_RATE = 0.05

export type WeaponColliderTag = {
  readonly class: 'weapon'
  /** Health lost per px/s of the weapon's speed when it touches a character during a throw. */
  readonly impactDamageRate: number
}

export type CharacterColliderTag = {
  readonly class: 'character'
}

export type ObstacleColliderTag = {
  readonly class: 'obstacle'
}

/** Something lying flat on the floor, such as a pressure plate: everything passes over it. */
export type FloorColliderTag = {
  readonly class: 'floor'
}

/** Something a Weapon in flight can hurt that nothing Collides with, such as a Target Dummy. */
export type TargetColliderTag = {
  readonly class: 'target'
}

export type ColliderTag =
  | WeaponColliderTag
  | CharacterColliderTag
  | ObstacleColliderTag
  | FloorColliderTag
  | TargetColliderTag

/** Players and enemies are Characters, weapons are Weapons, other objects (the boulder) are Obstacles. */
export function defaultColliderTags(role: 'player' | 'enemy' | 'weapon' | 'object'): ColliderTag[] {
  switch (role) {
    case 'weapon':
      return [{ class: 'weapon', impactDamageRate: WEAPON_IMPACT_DAMAGE_RATE }]
    case 'player':
    case 'enemy':
      return [{ class: 'character' }]
    case 'object':
      return [{ class: 'obstacle' }]
  }
}

function parseTag(raw: JsonValue): ColliderTag | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined
  }
  const record = raw as { readonly [key: string]: JsonValue }
  if (record.class === 'character') {
    return { class: 'character' }
  }
  if (record.class === 'obstacle') {
    return { class: 'obstacle' }
  }
  if (record.class === 'floor') {
    return { class: 'floor' }
  }
  if (record.class === 'target') {
    return { class: 'target' }
  }
  if (record.class === 'weapon' && typeof record.impactDamageRate === 'number') {
    return { class: 'weapon', impactDamageRate: record.impactDamageRate }
  }
  return undefined
}

export function colliderTagsOf(worldObject: WorldObject): ColliderTag[] {
  const raw = worldObject.metadata.colliderTags
  if (!Array.isArray(raw)) {
    return []
  }
  return (raw as readonly JsonValue[]).flatMap((entry) => {
    const tag = parseTag(entry)
    return tag ? [tag] : []
  })
}

/** Whether the tags make an object take part in the physics' walls and bounds: floor and target objects pass through. */
export function isSolidTagged(tags: readonly ColliderTag[]): boolean {
  return tags.some((tag) => tag.class !== 'floor' && tag.class !== 'target')
}

/** Pairs of tag classes that push each other apart. A Weapon passes through Characters and Weapons. */
const PHYSICAL_COLLISIONS: ReadonlySet<string> = new Set([
  'character|character',
  'character|obstacle',
  'obstacle|obstacle',
  'obstacle|weapon',
])

function pairKey(first: ColliderTag['class'], second: ColliderTag['class']): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`
}

function tagsCollide(tagsA: readonly ColliderTag[], tagsB: readonly ColliderTag[]): boolean {
  return tagsA.some((tagA) => tagsB.some((tagB) => PHYSICAL_COLLISIONS.has(pairKey(tagA.class, tagB.class))))
}

/** Whether two objects collide, decided by their Collider Tags alone. */
export function collidesPhysically(a: WorldObject, b: WorldObject): boolean {
  return tagsCollide(colliderTagsOf(a), colliderTagsOf(b))
}

type TaggedRole = Parameters<typeof defaultColliderTags>[0]

/** Whether objects built from these roles (a `guard` is an `enemy`) would collide. */
export function rolesCollide(roleA: TaggedRole | 'guard', roleB: TaggedRole | 'guard'): boolean {
  const asRole = (role: TaggedRole | 'guard'): TaggedRole => (role === 'guard' ? 'enemy' : role)
  return tagsCollide(defaultColliderTags(asRole(roleA)), defaultColliderTags(asRole(roleB)))
}
