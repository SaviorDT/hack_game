import { GAME_MV_CONFIG, MIN_MV_MASS, type MvConfig } from '../commands/mvConstants.ts'
import type { WorldObject } from './WorldObject.ts'

export interface MvAttr {
  drag: number
  mass: number
  max_velocity: number
}

export type MvAttrOverride = Partial<MvAttr>

const MV_ATTR_KEYS: readonly (keyof MvAttr)[] = ['drag', 'mass', 'max_velocity']

export function readMvAttrOverride(state: unknown): MvAttrOverride {
  if (typeof state !== 'object' || state === null) {
    return {}
  }
  const raw = (state as Record<string, unknown>).mv_attr
  if (typeof raw !== 'object' || raw === null) {
    return {}
  }
  const override: MvAttrOverride = {}
  for (const key of MV_ATTR_KEYS) {
    const value = (raw as Record<string, unknown>)[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      override[key] = value
    }
  }
  return override
}

/** The object's own `mv_attr` values, falling back to the global defaults for unset fields. */
export function resolveMvAttr(worldObject: WorldObject, config: MvConfig = GAME_MV_CONFIG): MvAttr {
  const override = readMvAttrOverride(worldObject.state)
  return {
    drag: override.drag ?? config.drag,
    mass: Math.max(MIN_MV_MASS, override.mass ?? config.mass),
    max_velocity: override.max_velocity ?? config.max_velocity,
  }
}
