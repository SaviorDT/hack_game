import { PHYSICS_ATTR_KEYS } from '../domain/PhysicsAttr.ts'
import type { RoomObjectConfig } from './room1.ts'

/**
 * Serializes an array of RoomObjectConfig items into valid TypeScript source code
 * suitable for writing directly to src/game/content/room1.ts.
 */
export function generateRoom1Source(objects: RoomObjectConfig[]): string {
  const serializedObjects = objects.map((obj) => {
    const lines = [
      `    id: ${JSON.stringify(obj.id)},`,
      `    role: ${JSON.stringify(obj.role)},`,
      `    x: ${Math.round(obj.x)},`,
      `    y: ${Math.round(obj.y)},`,
      `    displayWidth: ${Math.round(obj.displayWidth)},`,
      `    displayHeight: ${Math.round(obj.displayHeight)},`,
    ]
    if (obj.scaleX !== undefined) {
      lines.push(`    scaleX: ${obj.scaleX},`)
    }
    if (obj.scaleY !== undefined) {
      lines.push(`    scaleY: ${obj.scaleY},`)
    }
    if (obj.speed !== undefined) {
      if (typeof obj.speed === 'number') {
        lines.push(`    speed: ${obj.speed},`)
      } else {
        const speed = obj.speed
        lines.push('    speed: {')
        lines.push(`      acceleration: ${speed.acceleration},`)
        lines.push(`      frictionAcceleration: ${speed.frictionAcceleration},`)
        lines.push(`      turnaroundAcceleration: ${speed.turnaroundAcceleration},`)
        lines.push(`      maxSpeed: ${speed.maxSpeed},`)
        lines.push('    },')
      }
    }
    if (obj.maxHealth !== undefined) {
      lines.push(`    maxHealth: ${obj.maxHealth},`)
    }
    if (obj.attackDistance !== undefined) {
      lines.push(`    attackDistance: ${obj.attackDistance},`)
    }
    if (obj.attackDurationMs !== undefined) {
      lines.push(`    attackDurationMs: ${obj.attackDurationMs},`)
    }
    if (obj.holdOffsetX !== undefined) {
      lines.push(`    holdOffsetX: ${obj.holdOffsetX},`)
    }
    if (obj.holdOffsetY !== undefined) {
      lines.push(`    holdOffsetY: ${obj.holdOffsetY},`)
    }
    if (obj.colliderWidth !== undefined) {
      lines.push(`    colliderWidth: ${Math.round(obj.colliderWidth)},`)
    }
    if (obj.colliderHeight !== undefined) {
      lines.push(`    colliderHeight: ${Math.round(obj.colliderHeight)},`)
    }
    if (obj.name !== undefined) {
      lines.push(`    name: ${JSON.stringify(obj.name)},`)
    }
    if (obj.passive) {
      lines.push(`    passive: true,`)
    }
    if (obj.mvLimit !== undefined) {
      lines.push(`    mvLimit: ${obj.mvLimit},`)
    }
    if (obj.kind !== undefined) {
      lines.push(`    kind: ${JSON.stringify(obj.kind)},`)
    }
    if (obj.prefabId !== undefined) {
      lines.push(`    prefabId: ${JSON.stringify(obj.prefabId)},`)
    }
    if (obj.colliderShape !== undefined && obj.colliderShape !== 'box') {
      lines.push(`    colliderShape: ${JSON.stringify(obj.colliderShape)},`)
    }
    for (const key of PHYSICS_ATTR_KEYS) {
      if (obj[key] !== undefined) {
        lines.push(`    ${key}: ${obj[key]},`)
      }
    }
    return `  {\n${lines.join('\n')}\n  },`
  })

  return `import {
  DEFAULT_PREFABS,
  applyPrefabToObject,
  inferPrefabId,
} from '../domain/Prefab.ts'

export interface PlayerSpeedConfig {
  acceleration: number
  frictionAcceleration: number
  turnaroundAcceleration: number
  maxSpeed: number
  [key: string]: number
}

/** Per-object physics values; unset fields fall back to the global defaults. */
export interface PhysicsAttrConfig {
  drag?: number
  mass?: number
  max_velocity?: number
  restitution?: number
  friction?: number
}

export type WorldObjectRole = 'player' | 'enemy' | 'weapon' | 'object' | 'guard'

export interface RoomObjectConfig extends PhysicsAttrConfig {
  id: string
  role: WorldObjectRole
  x: number
  y: number
  displayWidth: number
  displayHeight: number
  scaleX?: number
  scaleY?: number
  speed?: number | PlayerSpeedConfig
  maxHealth?: number
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
  colliderWidth?: number
  colliderHeight?: number
  /** Outline of the collider; a \`circle\` uses \`colliderWidth\` as its diameter. Defaults to \`box\`. */
  colliderShape?: 'box' | 'circle'
  /** Shown and typed name when it differs from \`id\` (ids are unique across all rooms). */
  name?: string
  /** An enemy that never moves or attacks, such as a training dummy. */
  passive?: boolean
  /** How many more times it can be the source of an \`acc\` Throw; \`-1\` is unlimited. Defaults: 1 for a Weapon, else -1. */
  mvLimit?: number
  /** A special object: a pushable \`crate\`, a pressure \`plate\`, an \`archer\` enemy, or a Target \`dummy\`. */
  kind?: 'crate' | 'plate' | 'archer' | 'dummy'
  /** The prefab template ID this object was instantiated from. */
  prefabId?: string
}

export const ROOM1_OBJECTS: RoomObjectConfig[] = ([
${serializedObjects.join('\n')}
] as RoomObjectConfig[]).map((obj) => {
  const prefab = DEFAULT_PREFABS.find((p) => p.id === inferPrefabId(obj))
  return prefab ? applyPrefabToObject(obj, prefab) : obj
})
`
}
