import type { WorldState } from '../domain/WorldState.ts'
import { HOME_AREA_IDS, HOME_AREA_ROOMS } from './homeArea.ts'
import { ROOM1_OBJECTS, type RoomObjectConfig } from './room1.ts'
import { ROOM_IDS } from './room1Constants.ts'
import { createInitialWorldState } from './room1WorldState.ts'
import { boulder, buildRooms, dagger, guard, ROOM_ENTRY, STANDS_FIRM, type RoomDefinition } from './roomPieces.ts'

/**
 * Tutorial rooms played first, one per mechanic: tutorial1 → tutorial2 → tutorial3 → tutorial4, then the
 * home area (`homeArea.ts`) and room1. Each Exit stays locked until the room's goal is met.
 */
export const TUTORIAL_ROOM_IDS = {
  move: 'tutorial1',
  discover: 'tutorial2',
  throw: 'tutorial3',
  slowTime: 'tutorial4',
} as const

export const TUTORIAL_ROOMS: RoomDefinition[] = [
  {
    id: TUTORIAL_ROOM_IDS.move,
    hint:
      'Move with WASD. Walk over the dagger to pick it up, then attack with SPACE. ' +
      'Defeat the training dummy to open the exit, then walk into it.',
    goal: 'Defeat the dummy, then walk into the exit.',
    objects: [
      dagger('tutorial1dagger', 640, 560),
      guard('dummy', 1250, 420, { name: 'dummy', speed: 0, maxHealth: 60, passive: true, mass: STANDS_FIRM }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.discover,
      label: TUTORIAL_ROOM_IDS.discover,
      requires: { kind: 'defeat', objectIds: ['dummy'] },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.discover,
    hint:
      'Things you have not identified are marked ?. Hold SHIFT to open the command line, type ls and ' +
      'press ENTER: it lists everything here and reveals names. TAB completes names; release SHIFT to cancel.',
    goal: 'Reveal everything in this room (ls).',
    objects: [
      boulder('tutorial2boulder', 900, 330),
      dagger('tutorial2dagger', 1150, 600),
      guard('tutorial2guard', 1450, 420, { speed: 0, passive: true, mass: STANDS_FIRM }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.throw,
      label: TUTORIAL_ROOM_IDS.throw,
      requires: { kind: 'discover-all' },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.throw,
    hint:
      'mv <thing> <target> throws a thing at a target. This guard hits hard up close, so pick up the dagger and ' +
      'throw it from a distance: mv dagger guard. mv boulder hacker pulls the boulder over to you.',
    goal: 'Defeat the guard. Try throwing the dagger with mv.',
    objects: [
      dagger('tutorial3dagger', 420, 600),
      boulder('tutorial3boulder', 760, 300),
      guard('sentry', 1500, 420, { speed: 0, maxHealth: 40, mass: STANDS_FIRM }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.slowTime,
      label: TUTORIAL_ROOM_IDS.slowTime,
      requires: { kind: 'defeat', objectIds: ['sentry'] },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.slowTime,
    hint:
      'Typing a command slows time, but it never stops. This guard is faster than you and charges once ' +
      'you cross the middle of the room. Grab the dagger, and when the guard comes, type mv dagger guard.',
    goal: 'Defeat the fast guard.',
    objects: [
      dagger('tutorial4dagger', 430, 600),
      guard('runner', 1550, 420, { speed: 380, maxHealth: 40 }),
    ],
    exit: {
      targetRoomId: HOME_AREA_IDS.home,
      label: HOME_AREA_IDS.home,
      requires: { kind: 'defeat', objectIds: ['runner'] },
    },
  },
]

export const ROOM1_HINT =
  'The real thing: guards rush you once you cross the middle of the room. Use ls, mv and your dagger to reach room2.'

/**
 * The whole game: the tutorial rooms, the home area, then room1 (and the room2 ending). The Player Character
 * starts in tutorial1 with the stats configured for room1's player.
 */
export function createGameWorldState(
  room1Objects: readonly RoomObjectConfig[] = ROOM1_OBJECTS,
  startingRoomId?: string,
): WorldState {
  const room1 = createInitialWorldState([...room1Objects])
  const playerConfig = room1Objects.find((obj) => obj.role === 'player')
  const playerId = playerConfig?.id ?? 'player'
  const built = buildRooms([...TUTORIAL_ROOMS, ...HOME_AREA_ROOMS], playerConfig)

  const room1Rooms = room1.rooms.map((room) =>
    room.id === ROOM_IDS.first
      ? {
          ...room,
          objectIds: room.objectIds.filter((id) => id !== playerId),
          entry: playerConfig ? { x: playerConfig.x, y: playerConfig.y } : ROOM_ENTRY,
          hint: ROOM1_HINT,
          goal: 'Reach the exit to room2.',
          restoresHealth: true,
        }
      : room,
  )

  const allRooms = [...built.rooms, ...room1Rooms]
  const allWorldObjects = [
    ...built.worldObjects,
    ...room1.worldObjects.filter((worldObject) => worldObject.id !== playerId),
  ]

  const effectiveStartingRoomId =
    startingRoomId && allRooms.some((r) => r.id === startingRoomId)
      ? startingRoomId
      : TUTORIAL_ROOM_IDS.move

  const playerObject = allWorldObjects.find((wo) => wo.id === playerId)

  if (playerObject) {
    const targetRoom = allRooms.find((r) => r.id === effectiveStartingRoomId)
    playerObject.roomId = effectiveStartingRoomId

    let startPos = targetRoom?.entry ?? ROOM_ENTRY
    if (effectiveStartingRoomId === ROOM_IDS.first && playerConfig) {
      startPos = { x: playerConfig.x, y: playerConfig.y }
    } else {
      const allDefs = [...TUTORIAL_ROOMS, ...HOME_AREA_ROOMS]
      const roomDef = allDefs.find((d) => d.id === effectiveStartingRoomId)
      const defPlayer = roomDef?.objects.find((o) => o.role === 'player' || o.id === playerId)
      if (defPlayer) {
        startPos = { x: defPlayer.x, y: defPlayer.y }
      }
    }

    const playerState = playerObject.state as Record<string, unknown>
    playerState.x = startPos.x
    playerState.y = startPos.y
    playerState.vx = 0
    playerState.vy = 0
    playerState.forceX = 0
    playerState.forceY = 0
    playerState.alive = true
    if (typeof playerState.maxHealth === 'number') {
      playerState.health = playerState.maxHealth
    }
    playerState.weaponId = null
  }

  const finalRooms = allRooms.map((room) => {
    if (room.id === effectiveStartingRoomId) {
      return {
        ...room,
        objectIds: room.objectIds.includes(playerId) ? room.objectIds : [...room.objectIds, playerId],
      }
    } else {
      return {
        ...room,
        objectIds: room.objectIds.filter((id) => id !== playerId),
      }
    }
  })

  return {
    ...room1,
    rooms: finalRooms,
    worldObjects: allWorldObjects,
    currentRoomId: effectiveStartingRoomId,
  }
}
