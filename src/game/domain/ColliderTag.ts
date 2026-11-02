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

export type ColliderTag = WeaponColliderTag | CharacterColliderTag

export function defaultColliderTags(role: 'player' | 'guard' | 'weapon'): ColliderTag[] {
  return role === 'weapon'
    ? [{ class: 'weapon', impactDamageRate: WEAPON_IMPACT_DAMAGE_RATE }]
    : [{ class: 'character' }]
}

function parseTag(raw: JsonValue): ColliderTag | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return undefined
  }
  const record = raw as { readonly [key: string]: JsonValue }
  if (record.class === 'character') {
    return { class: 'character' }
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
