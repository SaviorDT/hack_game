import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import type { Room } from '../domain/Room.ts'
import { assertValidRoom } from '../domain/Room.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { defaultColliderTags } from '../domain/ColliderTag.ts'
import { PHYSICS_ATTR_KEYS, type PhysicsAttrOverride } from '../domain/PhysicsAttr.ts'
import { ALWAYS_ACTIVE_BEHAVIOR } from '../processes/BehaviorRule.ts'
import {
  ROOM_IDS,
  ROOM_NAMES,
  PROCESS_IDS,
  ROOM_LAYOUT,
  CHARACTER_SIZE,
  CHARACTER_BASE_SIZE,
  DAGGER_SIZE,
  BOULDER_SIZE,
  BOULDER_BASE_SIZE,
  MAX_HEALTH,
  GAME_WEAPON_CONFIG,
} from './room1Constants.ts'
import { ROOM1_OBJECTS, type RoomObjectConfig, type WorldObjectRole } from './room1.ts'
import { ARCHER_CONFIG, arrowIdsFor } from './archerConstants.ts'

const ROOM_BOUNDS = {
  left: ROOM_LAYOUT.left,
  top: ROOM_LAYOUT.top,
  right: ROOM_LAYOUT.right,
  bottom: ROOM_LAYOUT.bottom,
}

const alwaysActiveRule = (processDefinitionId: string) => ({
  condition: ALWAYS_ACTIVE_BEHAVIOR,
  processDefinitionId,
})

function createRoomWorldObject(
  roomId: string,
  id: string,
  metadata: WorldObject['metadata'],
  behaviorRules: WorldObject['behaviorRules'],
  state: WorldObject['state'],
): WorldObject {
  return new BasicWorldObject(id, roomId, metadata, behaviorRules, state)
}

function physicsAttrState(obj: RoomObjectConfig): PhysicsAttrOverride {
  const attrs: PhysicsAttrOverride = {}
  for (const key of PHYSICS_ATTR_KEYS) {
    const value = obj[key]
    if (typeof value === 'number') {
      attrs[key] = value
    }
  }
  return attrs
}

export function resolveScale(
  obj: RoomObjectConfig,
  baseDisplayWidth: number,
  baseDisplayHeight: number,
): { scaleX: number; scaleY: number } {
  const scaleX =
    obj.scaleX ?? (typeof obj.displayWidth === 'number' ? obj.displayWidth / baseDisplayWidth : 1)
  const scaleY =
    obj.scaleY ?? (typeof obj.displayHeight === 'number' ? obj.displayHeight / baseDisplayHeight : 1)
  return { scaleX, scaleY }
}

export function computeCollisionSize(
  role: WorldObjectRole,
  scaleX: number,
  scaleY: number,
  explicitWidth?: number,
  explicitHeight?: number,
): { width: number; height: number } {
  const minSize = role === 'weapon' ? 12 : 16

  if (typeof explicitWidth === 'number' && typeof explicitHeight === 'number') {
    return {
      width: Math.max(minSize, Math.round(explicitWidth)),
      height: Math.max(minSize, Math.round(explicitHeight)),
    }
  }

  if (role === 'weapon') {
    return {
      width: Math.max(minSize, Math.round(DAGGER_SIZE.width * scaleX)),
      height: Math.max(minSize, Math.round(DAGGER_SIZE.height * scaleY)),
    }
  }

  if (role === 'object') {
    return {
      width: Math.max(16, Math.round(BOULDER_SIZE.width * scaleX)),
      height: Math.max(16, Math.round(BOULDER_SIZE.height * scaleY)),
    }
  }

  return {
    width: Math.max(16, Math.round(CHARACTER_SIZE.width * scaleX)),
    height: Math.max(16, Math.round(CHARACTER_SIZE.height * scaleY)),
  }
}

/**
 * The collider size an object gets in the world. A circle uses `colliderWidth` as its diameter, so its
 * box is square; everything else is `computeCollisionSize`.
 */
export function computeColliderSize(
  role: WorldObjectRole,
  scaleX: number,
  scaleY: number,
  obj: Pick<RoomObjectConfig, 'colliderShape' | 'colliderWidth' | 'colliderHeight'>,
): { width: number; height: number } {
  const size = computeCollisionSize(role, scaleX, scaleY, obj.colliderWidth, obj.colliderHeight)
  return obj.colliderShape === 'circle' ? { width: size.width, height: size.width } : size
}

/** State fields for a collider; `shape` is only stored for non-box shapes so box objects keep their saved form. */
function colliderState(obj: RoomObjectConfig, width: number, height: number) {
  return {
    width,
    height,
    ...(obj.colliderShape === 'circle' ? { shape: 'circle' as const } : {}),
    collisionBox: { width, height },
    colliderWidth: obj.colliderWidth ?? width,
    colliderHeight: obj.colliderShape === 'circle' ? (obj.colliderWidth ?? width) : (obj.colliderHeight ?? height),
  }
}

/** Builds the World Objects described by `objects`, all placed in `roomId`. */
/** The arrows an archer shoots, kept out of sight (not alive) until fired. */
function createArrows(archer: RoomObjectConfig, roomId: string): WorldObject[] {
  const { width, height } = ARCHER_CONFIG.arrowSize
  return arrowIdsFor(archer.id).map((id) =>
    createRoomWorldObject(
      roomId,
      id,
      // No collider tags: an arrow takes no part in the physics, `ArrowFlightProcess` moves it.
      { name: id, role: 'object', kind: 'arrow', hidden: true, discoverable: false, colliderTags: [] },
      [alwaysActiveRule(PROCESS_IDS.arrow)],
      {
        x: archer.x,
        y: archer.y,
        width,
        height,
        displayWidth: 64,
        displayHeight: 64,
        alive: false,
        flightVx: 0,
        flightVy: 0,
        angle: 0,
        travelled: 0,
        shooterId: archer.id,
      },
    ),
  )
}

/** Builds the World Objects described by `objects`, all placed in `roomId`; archers bring their arrows. */
export function createRoomObjects(objects: readonly RoomObjectConfig[], roomId: string): WorldObject[] {
  return objects.flatMap((obj) => (obj.kind === 'archer' ? [createRoomObject(obj, roomId), ...createArrows(obj, roomId)] : [createRoomObject(obj, roomId)]))
}

function createRoomObject(obj: RoomObjectConfig, roomId: string): WorldObject {
  if (obj.role === 'player') {
    const { scaleX, scaleY } = resolveScale(obj, CHARACTER_BASE_SIZE.width, CHARACTER_BASE_SIZE.height)
    const { width, height } = computeColliderSize('player', scaleX, scaleY, obj)
    return createRoomWorldObject(
      roomId,
      obj.id,
      { name: 'hacker', role: 'player', discoverable: false, colliderTags: defaultColliderTags('player') },
      [alwaysActiveRule(PROCESS_IDS.player)],
      {
        x: obj.x,
        y: obj.y,
        ...physicsAttrState(obj),
        ...colliderState(obj, width, height),
        displayWidth: obj.displayWidth,
        displayHeight: obj.displayHeight,
        scaleX,
        scaleY,
        speed: typeof obj.speed === 'object' && obj.speed !== null
          ? {
            acceleration: obj.speed.acceleration,
            frictionAcceleration: obj.speed.frictionAcceleration ?? 1200,
            turnaroundAcceleration: obj.speed.turnaroundAcceleration,
            maxSpeed: obj.speed.maxSpeed,
          }
          : obj.speed !== undefined
            ? obj.speed
            : {
              acceleration: 800,
              frictionAcceleration: 1200,
              turnaroundAcceleration: 1600,
              maxSpeed: 240,
            },
        maxSpeed: typeof obj.speed === 'object' && obj.speed !== null
          ? obj.speed.maxSpeed
          : (typeof obj.speed === 'number' ? obj.speed : 240),
        acceleration: typeof obj.speed === 'object' && obj.speed !== null ? obj.speed.acceleration : 800,
        frictionAcceleration: typeof obj.speed === 'object' && obj.speed !== null
          ? (obj.speed.frictionAcceleration ?? 1200)
          : 1200,
        turnaroundAcceleration: typeof obj.speed === 'object' && obj.speed !== null ? obj.speed.turnaroundAcceleration : 1600,
        vx: 0,
        vy: 0,
        health: obj.maxHealth ?? MAX_HEALTH,
        maxHealth: obj.maxHealth ?? MAX_HEALTH,
        alive: true,
        discovered: true,
        weaponId: null,
        attackCooldownMs: 0,
        moveX: 0,
        moveY: 0,
        facing: 'right',
      },
    )
  }

  if (obj.role === 'weapon') {
    const { scaleX, scaleY } = resolveScale(obj, DAGGER_SIZE.width, DAGGER_SIZE.height)
    const { width, height } = computeCollisionSize('weapon', scaleX, scaleY, obj.colliderWidth, obj.colliderHeight)
    return createRoomWorldObject(
      roomId,
      obj.id,
      { name: obj.name ?? obj.id, role: 'weapon', weaponId: 'dagger', discoverable: true, colliderTags: defaultColliderTags('weapon') },
      [alwaysActiveRule(PROCESS_IDS.dagger)],
      {
        x: obj.x,
        y: obj.y,
        ...physicsAttrState(obj),
        ...colliderState(obj, width, height),
        displayWidth: obj.displayWidth,
        displayHeight: obj.displayHeight,
        scaleX,
        scaleY,
        discovered: false,
        equippedBy: null,
        attackDurationMs: 0,
        attackElapsedMs: 0,
        attackOffsetX: 0,
        weaponAttackDistance: obj.attackDistance ?? GAME_WEAPON_CONFIG.attackDistance,
        weaponAttackDurationMs: obj.attackDurationMs ?? GAME_WEAPON_CONFIG.attackDurationMs,
        holdOffsetX: obj.holdOffsetX ?? GAME_WEAPON_CONFIG.holdOffsetX,
        holdOffsetY: obj.holdOffsetY ?? GAME_WEAPON_CONFIG.holdOffsetY,
      },
    )
  }

  if (obj.role === 'object') {
    const { scaleX, scaleY } = resolveScale(obj, BOULDER_BASE_SIZE.width, BOULDER_BASE_SIZE.height)
    const { width, height } = computeColliderSize('object', scaleX, scaleY, obj)
    return createRoomWorldObject(
      roomId,
      obj.id,
      {
        name: obj.name ?? obj.id,
        role: 'object',
        discoverable: true,
        ...(obj.kind ? { kind: obj.kind } : {}),
        // A pressure plate lies flat: everything passes over it.
        colliderTags: obj.kind === 'plate' ? [{ class: 'floor' }] : defaultColliderTags('object'),
      },
      obj.kind === 'plate' ? [] : [alwaysActiveRule(PROCESS_IDS.boulder)],
      {
        x: obj.x,
        y: obj.y,
        ...physicsAttrState(obj),
        ...colliderState(obj, width, height),
        displayWidth: obj.displayWidth,
        displayHeight: obj.displayHeight,
        scaleX,
        scaleY,
        discovered: false,
        alive: true,
      },
    )
  }

  // Default to enemy/guard
  const { scaleX, scaleY } = resolveScale(obj, CHARACTER_BASE_SIZE.width, CHARACTER_BASE_SIZE.height)
  const resolvedRole = obj.role === 'guard' ? 'enemy' : (obj.role ?? 'enemy')
  const { width, height } = computeColliderSize(resolvedRole, scaleX, scaleY, obj)
  return createRoomWorldObject(
    roomId,
    obj.id,
    {
      name: obj.name ?? obj.id,
      role: resolvedRole,
      discoverable: true,
      ...(obj.kind ? { kind: obj.kind } : {}),
      colliderTags: defaultColliderTags('enemy'),
    },
    [alwaysActiveRule(obj.kind === 'archer' ? PROCESS_IDS.archer : PROCESS_IDS.guard)],
    {
      x: obj.x,
      y: obj.y,
      ...physicsAttrState(obj),
      ...colliderState(obj, width, height),
      displayWidth: obj.displayWidth,
      displayHeight: obj.displayHeight,
      scaleX,
      scaleY,
      speed: obj.speed ?? 210,
      health: obj.maxHealth ?? MAX_HEALTH,
      maxHealth: obj.maxHealth ?? MAX_HEALTH,
      alive: true,
      discovered: false,
      weaponId: 'guard-strike',
      attackCooldownMs: 0,
      alerted: false,
      chasing: false,
      attacking: false,
      facing: 'right',
      ...(obj.passive ? { passive: true } : {}),
      ...(obj.kind === 'archer' ? { arrowIds: arrowIdsFor(obj.id) } : {}),
    },
  )
}

export function createInitialWorldState(objects: RoomObjectConfig[] = ROOM1_OBJECTS): WorldState {
  const worldObjects = createRoomObjects(objects, ROOM_IDS.first)

  const firstRoom: Room = {
    id: ROOM_IDS.first,
    objectIds: worldObjects.map((o) => o.id),
    exits: [{ targetRoomId: ROOM_IDS.second, label: ROOM_NAMES[ROOM_IDS.second], ...ROOM_LAYOUT.exit, endsGame: true }],
    state: { name: ROOM_NAMES[ROOM_IDS.first], width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
    bounds: ROOM_BOUNDS,
  }

  const secondRoom: Room = {
    id: ROOM_IDS.second,
    objectIds: [],
    exits: [],
    state: { name: ROOM_NAMES[ROOM_IDS.second], width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
    bounds: ROOM_BOUNDS,
  }

  assertValidRoom(firstRoom)
  assertValidRoom(secondRoom)

  return {
    rooms: [firstRoom, secondRoom],
    worldObjects,
    processInstances: [],
    currentRoomId: ROOM_IDS.first,
    commandHistory: [],
    simulationTick: 0,
    outcome: 'playing',
  }
}

