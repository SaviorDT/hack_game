import { wallFromEdges } from '../domain/Room.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { HOME_AREA_ROOMS } from './homeArea.ts'
import { ROOM_OBJECTS, type RoomObjectConfig } from './room.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { TUTORIAL5_DEFINITION } from './tutorial5.ts'
import { TUTORIAL_ROOM_IDS } from './tutorialRoomIds.ts'
import { createInitialWorldState } from './roomWorldState.ts'
import { boulder, buildRooms, dagger, guard, ROOM_ENTRY, STANDS_FIRM, type RoomDefinition } from './roomPieces.ts'

/**
 * Tutorial rooms played first, one per mechanic: tutorial1 → … → tutorial5, then the
 * home area (`homeArea.ts`) and room. Each Exit stays locked until the room's goal is met.
 */
export { TUTORIAL_ROOM_IDS }

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
      targetRoomId: TUTORIAL_ROOM_IDS.throw,
      label: TUTORIAL_ROOM_IDS.throw,
      requires: { kind: 'defeat', objectIds: ['dummy'] },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.throw,
    hint: 'type: acc dagger guard',
    goal: 'Defeat the guard. Try throwing the dagger with acc.',
    objects: [
      dagger('tutorial2dagger', 420, 600),
      boulder('tutorial2boulder', 760, 300),
      guard('sentry', 1500, 420, { speed: 0, maxHealth: 30, mass: STANDS_FIRM }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.slowTime,
      label: TUTORIAL_ROOM_IDS.slowTime,
      requires: { kind: 'defeat', objectIds: ['sentry'] },
    },
  },
  {
    id: TUTORIAL_ROOM_IDS.slowTime,
    hint: '<Hold 8,9,0> record command. Press 8, 9, 0 to replay command. Press R to Room Reset.',
    goal: 'Defeat the fast guard.',
    objects: [
      dagger('tutorial3dagger', 430, 600),
      guard('runner', 1550, 420, { speed: 380, maxHealth: 30 }),
    ],
    exit: {
      targetRoomId: TUTORIAL_ROOM_IDS.mouseThrow,
      label: TUTORIAL_ROOM_IDS.mouseThrow,
      requires: { kind: 'defeat', objectIds: ['runner'] },
    },
  },
  {
    // A wall splits the room; the only gap is plugged by a boulder. Throw it out of the way with `acc`.
    id: TUTORIAL_ROOM_IDS.mouseThrow,
    hint: 'move your mouse and type: acc boulder $mouse',
    goal: 'Get through to the far side.',
    walls: [wallFromEdges(880, 80, 940, 330), wallFromEdges(880, 470, 940, 700)],
    objects: [boulder('tutorial4boulder', 910, 400)],
    exit: { targetRoomId: TUTORIAL_ROOM_IDS.flyAround, label: TUTORIAL_ROOM_IDS.flyAround },
  },
  TUTORIAL5_DEFINITION,
]

export const ROOM_HINT =
  'The real thing: guards rush you once you cross the middle of the room. Use acc and your dagger to reach the next room.'

/**
 * The whole game: the tutorial rooms, the home area, then room (whose Exit ends the game until a next room
 * exists). The Player Character starts in tutorial1 with the stats configured for room's player.
 */
export function createGameWorldState(
  roomObjects: readonly RoomObjectConfig[] = ROOM_OBJECTS,
  startingRoomId?: string,
): WorldState {
  const room = createInitialWorldState([...roomObjects])
  const playerConfig = roomObjects.find((obj) => obj.role === 'player')
  const playerId = playerConfig?.id ?? 'player'
  const built = buildRooms([...TUTORIAL_ROOMS, ...HOME_AREA_ROOMS], playerConfig)

  // room only: `createInitialWorldState` also holds an empty `end` room, which the game does not use.
  const roomRooms = room.rooms
    .filter((room) => room.id === ROOM_IDS.main)
    .map((room) => ({
      ...room,
      objectIds: room.objectIds.filter((id) => id !== playerId),
      entry: playerConfig ? { x: playerConfig.x, y: playerConfig.y } : ROOM_ENTRY,
      hint: ROOM_HINT,
      goal: 'Reach the exit to the next room.',
      restoresHealth: true,
    }))

  const allRooms = [...built.rooms, ...roomRooms]
  const allWorldObjects = [
    ...built.worldObjects,
    ...room.worldObjects.filter((worldObject) => worldObject.id !== playerId),
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
    if (effectiveStartingRoomId === ROOM_IDS.main && playerConfig) {
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
    ...room,
    rooms: finalRooms,
    worldObjects: allWorldObjects,
    currentRoomId: effectiveStartingRoomId,
  }
}
