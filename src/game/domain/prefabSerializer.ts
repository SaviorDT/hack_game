import type { PrefabDefinition } from './Prefab.ts'

/**
 * Serializes an array of PrefabDefinition templates into valid TypeScript source code
 * suitable for writing directly to src/game/domain/Prefab.ts.
 */
export function generatePrefabSource(prefabs: readonly PrefabDefinition[]): string {
  const serializedItems = prefabs.map((p) => {
    const rows: string[] = [
      `    id: ${JSON.stringify(p.id)},`,
      `    name: ${JSON.stringify(p.name)},`,
      `    role: ${JSON.stringify(p.role)},`,
    ]

    if (p.kind !== undefined) {
      rows.push(`    kind: ${JSON.stringify(p.kind)},`)
    }

    rows.push(`    displayWidth: ${Math.round(p.displayWidth)},`)
    rows.push(`    displayHeight: ${Math.round(p.displayHeight)},`)
    rows.push(`    scaleX: ${p.scaleX},`)
    rows.push(`    scaleY: ${p.scaleY},`)

    if (p.speed !== undefined) {
      if (typeof p.speed === 'number') {
        rows.push(`    speed: ${p.speed},`)
      } else {
        const s = p.speed
        rows.push('    speed: {')
        rows.push(`      acceleration: ${s.acceleration},`)
        rows.push(`      frictionAcceleration: ${s.frictionAcceleration},`)
        rows.push(`      turnaroundAcceleration: ${s.turnaroundAcceleration},`)
        rows.push(`      maxSpeed: ${s.maxSpeed},`)
        rows.push('    },')
      }
    }

    if (p.maxHealth !== undefined) rows.push(`    maxHealth: ${p.maxHealth},`)
    if (p.attackDistance !== undefined) rows.push(`    attackDistance: ${p.attackDistance},`)
    if (p.attackDurationMs !== undefined) rows.push(`    attackDurationMs: ${p.attackDurationMs},`)
    if (p.holdOffsetX !== undefined) rows.push(`    holdOffsetX: ${p.holdOffsetX},`)
    if (p.holdOffsetY !== undefined) rows.push(`    holdOffsetY: ${p.holdOffsetY},`)
    if (p.colliderWidth !== undefined) rows.push(`    colliderWidth: ${Math.round(p.colliderWidth)},`)
    if (p.colliderHeight !== undefined) rows.push(`    colliderHeight: ${Math.round(p.colliderHeight)},`)
    if (p.colliderShape !== undefined) rows.push(`    colliderShape: ${JSON.stringify(p.colliderShape)},`)
    if (p.passive !== undefined) rows.push(`    passive: ${p.passive},`)
    if (p.mass !== undefined) rows.push(`    mass: ${p.mass},`)
    if (p.drag !== undefined) rows.push(`    drag: ${p.drag},`)
    if (p.friction !== undefined) rows.push(`    friction: ${p.friction},`)
    if (p.max_velocity !== undefined) rows.push(`    max_velocity: ${p.max_velocity},`)
    if (p.restitution !== undefined) rows.push(`    restitution: ${p.restitution},`)

    return `  {\n${rows.join('\n')}\n  },`
  })

  return `import type { ColliderShape } from './CollisionWorld.ts'
import type {
  PhysicsAttrConfig,
  PlayerSpeedConfig,
  RoomObjectConfig,
  WorldObjectRole,
} from '../content/room1.ts'

export interface PrefabDefinition extends PhysicsAttrConfig {
  id: string
  name: string
  role: WorldObjectRole
  kind?: 'crate' | 'plate' | 'archer'
  displayWidth: number
  displayHeight: number
  scaleX: number
  scaleY: number
  colliderWidth?: number
  colliderHeight?: number
  colliderShape?: ColliderShape
  maxHealth?: number
  speed?: number | PlayerSpeedConfig
  attackDistance?: number
  attackDurationMs?: number
  holdOffsetX?: number
  holdOffsetY?: number
  passive?: boolean
}

export const DEFAULT_PREFABS: readonly PrefabDefinition[] = [
${serializedItems.join('\n')}
]

/**
 * Infers the matching prefab identifier for any room object configuration.
 */
export function inferPrefabId(obj: RoomObjectConfig): string {
  if (obj.prefabId) {
    return obj.prefabId
  }
  if (obj.kind === 'crate') return 'crate'
  if (obj.kind === 'plate') return 'plate'
  if (obj.kind === 'archer') return 'archer'
  if (obj.role === 'weapon') return 'dagger'
  if (obj.role === 'player' || obj.id === 'player') return 'player'
  if (
    obj.role === 'object' &&
    (obj.colliderShape === 'circle' || obj.name === 'boulder' || obj.id.startsWith('boulder'))
  ) {
    return 'boulder'
  }
  if (obj.role === 'enemy' || obj.role === 'guard') {
    return 'guard'
  }
  return obj.kind ?? obj.role
}

/**
 * Applies prefab template properties to a target object while preserving instance-specific fields
 * (id, x, y, custom display name).
 */
export function applyPrefabToObject(
  target: RoomObjectConfig,
  prefab: PrefabDefinition,
): RoomObjectConfig {
  const result: RoomObjectConfig = {
    ...target,
    role: prefab.role,
    displayWidth: prefab.displayWidth,
    displayHeight: prefab.displayHeight,
    scaleX: prefab.scaleX,
    scaleY: prefab.scaleY,
    prefabId: prefab.id,
  }

  if (prefab.kind !== undefined) {
    result.kind = prefab.kind
  }
  if (prefab.colliderWidth !== undefined) {
    result.colliderWidth = prefab.colliderWidth
  }
  if (prefab.colliderHeight !== undefined) {
    result.colliderHeight = prefab.colliderHeight
  }
  if (prefab.colliderShape !== undefined) {
    result.colliderShape = prefab.colliderShape
  }
  if (prefab.maxHealth !== undefined) {
    result.maxHealth = prefab.maxHealth
  }
  if (prefab.speed !== undefined) {
    result.speed = typeof prefab.speed === 'object' ? { ...prefab.speed } : prefab.speed
  }
  if (prefab.attackDistance !== undefined) {
    result.attackDistance = prefab.attackDistance
  }
  if (prefab.attackDurationMs !== undefined) {
    result.attackDurationMs = prefab.attackDurationMs
  }
  if (prefab.holdOffsetX !== undefined) {
    result.holdOffsetX = prefab.holdOffsetX
  }
  if (prefab.holdOffsetY !== undefined) {
    result.holdOffsetY = prefab.holdOffsetY
  }
  if (prefab.passive !== undefined) {
    result.passive = prefab.passive
  }

  const physicsKeys: (keyof PhysicsAttrConfig)[] = [
    'mass',
    'drag',
    'friction',
    'max_velocity',
    'restitution',
  ]
  for (const key of physicsKeys) {
    if (prefab[key] !== undefined) {
      result[key] = prefab[key]
    }
  }

  return result
}
`
}
