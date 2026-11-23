import type { WorldObject } from './WorldObject.ts'

/** A Boss is the only object that carries a `bossMode`; it has no `kind` in its state. */
export function isBoss(worldObject: WorldObject): boolean {
  return typeof (worldObject.state as { bossMode?: unknown }).bossMode === 'string'
}

/** Whether `acc` may throw the object as its source. A Boss can be a target but never a source. */
export function canBeThrown(worldObject: WorldObject): boolean {
  return !isBoss(worldObject)
}
