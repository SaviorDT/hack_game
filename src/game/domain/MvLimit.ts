import type { WorldObject } from './WorldObject.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from './WorldObjectState.ts'
import type { WorldState } from './WorldState.ts'

/** An `mvLimit` of `-1` means the object can be thrown with `acc` without limit and the count never changes. */
export const UNLIMITED_MV_LIMIT = -1

/** A Weapon can be thrown once, everything else without limit. */
export function defaultMvLimit(role: string | undefined): number {
  return role === 'weapon' ? 1 : UNLIMITED_MV_LIMIT
}

/** The object's Mv Limit; an object without one (an arrow, an old save) is unlimited. */
export function mvLimitOf(worldObject: WorldObject): number {
  const limit = (worldObject.state as { mvLimit?: unknown }).mvLimit
  return typeof limit === 'number' ? limit : UNLIMITED_MV_LIMIT
}

export function isDestroyed(worldObject: WorldObject): boolean {
  return (worldObject.state as { destroyed?: unknown }).destroyed === true
}

/**
 * Removes the object from play for good: it is no longer alive, drawn or named. A Weapon held by a
 * Character is let go first, so nobody keeps holding something that is gone.
 */
export function destroyWorldObject(state: WorldState, worldObject: WorldObject): void {
  const body = getMutableWorldObjectState<MutableWorldObjectState>(worldObject)
  const holderId = body.equippedBy
  if (typeof holderId === 'string') {
    const holder = state.worldObjects.find((candidate) => candidate.id === holderId)
    if (holder) {
      getMutableWorldObjectState<MutableWorldObjectState>(holder).weaponId = null
    }
  }
  body.equippedBy = null
  body.destroyed = true
  body.alive = false
  body.thrown = null
  body.vx = 0
  body.vy = 0
}

/**
 * Called when `acc` is about to throw the object. An object whose Mv Limit is 0 is destroyed instead
 * (returns `false`, nothing is thrown); otherwise a limited object uses one up (returns `true`).
 */
export function spendMvLimit(state: WorldState, worldObject: WorldObject): boolean {
  const limit = mvLimitOf(worldObject)
  if (limit === UNLIMITED_MV_LIMIT) {
    return true
  }
  if (limit <= 0) {
    destroyWorldObject(state, worldObject)
    return false
  }
  getMutableWorldObjectState<MutableWorldObjectState>(worldObject).mvLimit = limit - 1
  return true
}

/** Whether the object has no throws left and is not in the middle of one, so it is to be destroyed. */
export function isSpent(worldObject: WorldObject): boolean {
  const body = worldObject.state as { alive?: unknown; thrown?: unknown }
  return mvLimitOf(worldObject) === 0 && body.alive !== false && !body.thrown
}
