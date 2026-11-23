import type { Box } from '../domain/CollisionWorld.ts'
import type { RoomExit } from '../domain/Room.ts'
import { ARENA_DEFINITION, ARENA_IDS } from './arena.ts'
import { HOME_AREA_IDS, HOME_AREA_ROOMS } from './homeArea.ts'
import { ROOM_OBJECTS, type RoomObjectConfig } from './room.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { ROOM_ENTRY, type RoomDefinition } from './roomPieces.ts'
import { TUTORIAL_ROOMS, TUTORIAL_ROOM_IDS, ROOM_HINT } from './tutorialRooms.ts'

export const EDITOR_ROOM_IDS = [
  TUTORIAL_ROOM_IDS.move,
  TUTORIAL_ROOM_IDS.throw,
  TUTORIAL_ROOM_IDS.slowTime,
  TUTORIAL_ROOM_IDS.mouseThrow,
  TUTORIAL_ROOM_IDS.flyAround,
  HOME_AREA_IDS.storage,
  HOME_AREA_IDS.yard,
  HOME_AREA_IDS.lane,
  HOME_AREA_IDS.gate,
  ROOM_IDS.main,
  ARENA_IDS.room,
] as const

export type EditorRoomId = (typeof EDITOR_ROOM_IDS)[number]

export interface EditorRoomDefinition {
  readonly id: string
  readonly title: string
  readonly hint?: string
  readonly goal: string
  readonly walls?: readonly Box[]
  readonly exit: Pick<RoomExit, 'targetRoomId' | 'label' | 'requires' | 'endsGame' | 'hiddenUntilOpen'>
}

// Deep clone snapshots taken at module evaluation for clean test resets
const initialTutorialRoomsSnapshot = JSON.stringify(TUTORIAL_ROOMS)
const initialHomeAreaRoomsSnapshot = JSON.stringify(HOME_AREA_ROOMS)
const initialArenaObjectsSnapshot = JSON.stringify(ARENA_DEFINITION.objects)
const initialRoomObjectsSnapshot = JSON.stringify(ROOM_OBJECTS)

export function getEditorRoomIds(): readonly string[] {
  return EDITOR_ROOM_IDS
}

export function getNextRoomId(currentRoomId: string): string {
  const ids = EDITOR_ROOM_IDS as readonly string[]
  const idx = ids.indexOf(currentRoomId)
  if (idx !== -1 && idx < ids.length - 1) {
    return ids[idx + 1]
  }
  return ids[0]
}

export function getPreviousRoomId(currentRoomId: string): string {
  const ids = EDITOR_ROOM_IDS as readonly string[]
  const idx = ids.indexOf(currentRoomId)
  if (idx > 0) {
    return ids[idx - 1]
  }
  return ids[ids.length - 1]
}

export function getRoomDefinition(roomId: string): EditorRoomDefinition | undefined {
  if (roomId === ROOM_IDS.main) {
    return {
      id: ROOM_IDS.main,
      title: 'room',
      hint: ROOM_HINT,
      goal: 'Reach the exit to the next room.',
      exit: { targetRoomId: ROOM_IDS.end, label: ROOM_IDS.end, endsGame: true },
    }
  }

  const tutorialMatch = TUTORIAL_ROOMS.find((r) => r.id === roomId)
  if (tutorialMatch) {
    return {
      id: tutorialMatch.id,
      title: tutorialMatch.id,
      hint: tutorialMatch.hint,
      goal: tutorialMatch.goal,
      walls: tutorialMatch.walls,
      exit: tutorialMatch.exit,
    }
  }

  const homeMatch = HOME_AREA_ROOMS.find((r) => r.id === roomId)
  if (homeMatch) {
    return {
      id: homeMatch.id,
      title: homeMatch.id,
      hint: homeMatch.hint,
      goal: homeMatch.goal,
      walls: homeMatch.walls,
      exit: homeMatch.exit,
    }
  }

  if (roomId === ARENA_DEFINITION.id) {
    return {
      id: ARENA_DEFINITION.id,
      title: ARENA_DEFINITION.id,
      hint: ARENA_DEFINITION.hint,
      goal: ARENA_DEFINITION.goal,
      walls: ARENA_DEFINITION.walls,
      exit: ARENA_DEFINITION.exit,
    }
  }

  return undefined
}

export function getRoomObjectConfigs(roomId: string): RoomObjectConfig[] {
  if (roomId === ROOM_IDS.main) {
    return [...ROOM_OBJECTS]
  }

  if (roomId === TUTORIAL_ROOM_IDS.move) {
    const def = TUTORIAL_ROOMS[0]
    const defObjects = def ? def.objects : []
    const hasPlayer = defObjects.some((o) => o.role === 'player' || o.id === 'player')
    if (hasPlayer) {
      return [...defObjects]
    }
    const playerConfig = ROOM_OBJECTS.find((o) => o.role === 'player')
    const playerObj: RoomObjectConfig = playerConfig
      ? { ...playerConfig, ...ROOM_ENTRY }
      : {
          id: 'player',
          role: 'player',
          ...ROOM_ENTRY,
          displayWidth: 125,
          displayHeight: 125,
          scaleX: 0.71,
          scaleY: 0.71,
          maxHealth: 100,
        }
    return [playerObj, ...defObjects]
  }

  const tutorialMatch = TUTORIAL_ROOMS.find((r) => r.id === roomId)
  if (tutorialMatch) {
    return [...tutorialMatch.objects]
  }

  const homeMatch = HOME_AREA_ROOMS.find((r) => r.id === roomId)
  if (homeMatch) {
    return [...homeMatch.objects]
  }

  if (roomId === ARENA_DEFINITION.id) {
    return [...ARENA_DEFINITION.objects]
  }

  return []
}

export function setRoomObjectConfigs(roomId: string, objects: readonly RoomObjectConfig[]): void {
  if (roomId === ROOM_IDS.main) {
    ROOM_OBJECTS.length = 0
    ROOM_OBJECTS.push(...objects)
    return
  }

  if (roomId === TUTORIAL_ROOM_IDS.move) {
    const playerObj = objects.find((o) => o.role === 'player' || o.id === 'player')
    if (playerObj) {
      const pIdx = ROOM_OBJECTS.findIndex((o) => o.role === 'player')
      if (pIdx !== -1) {
        ROOM_OBJECTS[pIdx] = { ...ROOM_OBJECTS[pIdx], ...playerObj }
      }
    }
    const nonPlayerObjs = objects.filter((o) => o.role !== 'player' && o.id !== 'player')
    if (TUTORIAL_ROOMS[0]) {
      TUTORIAL_ROOMS[0].objects = nonPlayerObjs
    }
    return
  }

  const tutorialMatch = TUTORIAL_ROOMS.find((r) => r.id === roomId)
  if (tutorialMatch) {
    tutorialMatch.objects = [...objects]
    return
  }

  const homeMatch = HOME_AREA_ROOMS.find((r) => r.id === roomId)
  if (homeMatch) {
    homeMatch.objects = [...objects]
    return
  }

  if (roomId === ARENA_DEFINITION.id) {
    ARENA_DEFINITION.objects = [...objects]
  }
}

export function resetAllRooms(): void {
  const parsedTutorials: RoomDefinition[] = JSON.parse(initialTutorialRoomsSnapshot)
  for (let i = 0; i < TUTORIAL_ROOMS.length; i++) {
    if (parsedTutorials[i]) {
      TUTORIAL_ROOMS[i].objects = parsedTutorials[i].objects
    }
  }

  const parsedHome: RoomDefinition[] = JSON.parse(initialHomeAreaRoomsSnapshot)
  for (let i = 0; i < HOME_AREA_ROOMS.length; i++) {
    if (parsedHome[i]) {
      HOME_AREA_ROOMS[i].objects = parsedHome[i].objects
    }
  }

  ARENA_DEFINITION.objects = JSON.parse(initialArenaObjectsSnapshot)

  const parsedRoom: RoomObjectConfig[] = JSON.parse(initialRoomObjectsSnapshot)
  ROOM_OBJECTS.length = 0
  ROOM_OBJECTS.push(...parsedRoom)
}
