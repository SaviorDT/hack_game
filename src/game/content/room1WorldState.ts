import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import type { Room } from '../domain/Room.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { ALWAYS_ACTIVE_BEHAVIOR } from '../processes/BehaviorRule.ts'
import {
  ROOM_IDS,
  ROOM_NAMES,
  PROCESS_IDS,
  ROOM_LAYOUT,
  CHARACTER_SIZE,
  CHARACTER_BASE_SIZE,
  DAGGER_SIZE,
  MAX_HEALTH,
} from './room1Constants.ts'
import { ROOM1_OBJECTS, type RoomObjectConfig } from './room1.ts'

const alwaysActiveRule = (processDefinitionId: string) => ({
  condition: ALWAYS_ACTIVE_BEHAVIOR,
  processDefinitionId,
})

function createRoomWorldObject(
  id: string,
  metadata: Readonly<Record<string, string | boolean>>,
  behaviorRules: WorldObject['behaviorRules'],
  state: WorldObject['state'],
): WorldObject {
  return new BasicWorldObject(id, ROOM_IDS.first, metadata, behaviorRules, state)
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
  role: 'player' | 'guard' | 'weapon',
  scaleX: number,
  scaleY: number,
): { width: number; height: number } {
  if (role === 'weapon') {
    return {
      width: Math.max(12, Math.round(DAGGER_SIZE.width * scaleX)),
      height: Math.max(12, Math.round(DAGGER_SIZE.height * scaleY)),
    }
  }

  return {
    width: Math.max(16, Math.round(CHARACTER_SIZE.width * scaleX)),
    height: Math.max(16, Math.round(CHARACTER_SIZE.height * scaleY)),
  }
}

export function createInitialWorldState(objects: RoomObjectConfig[] = ROOM1_OBJECTS): WorldState {
  const worldObjects: WorldObject[] = objects.map((obj) => {
    if (obj.role === 'player') {
      const { scaleX, scaleY } = resolveScale(obj, CHARACTER_BASE_SIZE.width, CHARACTER_BASE_SIZE.height)
      const { width, height } = computeCollisionSize('player', scaleX, scaleY)
      return createRoomWorldObject(
        obj.id,
        { name: 'hacker', role: 'player', discoverable: false },
        [alwaysActiveRule(PROCESS_IDS.player)],
        {
          x: obj.x,
          y: obj.y,
          width,
          height,
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
        },
      )
    }

    if (obj.role === 'weapon') {
      const { scaleX, scaleY } = resolveScale(obj, DAGGER_SIZE.width, DAGGER_SIZE.height)
      const { width, height } = computeCollisionSize('weapon', scaleX, scaleY)
      return createRoomWorldObject(
        obj.id,
        { name: obj.id, role: 'weapon', weaponId: 'dagger', discoverable: true },
        [alwaysActiveRule(PROCESS_IDS.dagger)],
        {
          x: obj.x,
          y: obj.y,
          width,
          height,
          displayWidth: obj.displayWidth,
          displayHeight: obj.displayHeight,
          scaleX,
          scaleY,
          discovered: false,
          equippedBy: null,
        },
      )
    }

    // Default to guard
    const { scaleX, scaleY } = resolveScale(obj, CHARACTER_BASE_SIZE.width, CHARACTER_BASE_SIZE.height)
    const { width, height } = computeCollisionSize('guard', scaleX, scaleY)
    return createRoomWorldObject(
      obj.id,
      { name: obj.id, role: 'guard', discoverable: true },
      [alwaysActiveRule(PROCESS_IDS.guard)],
      {
        x: obj.x,
        y: obj.y,
        width,
        height,
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
      },
    )
  })

  const firstRoom: Room = {
    id: ROOM_IDS.first,
    objectIds: worldObjects.map((o) => o.id),
    exits: [{ targetRoomId: ROOM_IDS.second, label: ROOM_NAMES[ROOM_IDS.second], ...ROOM_LAYOUT.exit }],
    state: { name: ROOM_NAMES[ROOM_IDS.first], width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
  }

  const secondRoom: Room = {
    id: ROOM_IDS.second,
    objectIds: [],
    exits: [],
    state: { name: ROOM_NAMES[ROOM_IDS.second], width: ROOM_LAYOUT.width, height: ROOM_LAYOUT.height },
  }

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

