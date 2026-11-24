import type { Box } from '../domain/CollisionWorld.ts'
import type { RoomExit } from '../domain/Room.ts'
import { ARENA_DEFINITION, ARENA_IDS } from './arena.ts'
import { HOME_AREA_ROOMS } from './homeArea.ts'
import { ROOM_OBJECTS, type RoomObjectConfig } from './room.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { ROOM_ENTRY, type RoomDefinition } from './roomPieces.ts'
import { TUTORIAL_ROOMS, TUTORIAL_ROOM_IDS, ROOM_HINT } from './tutorialRooms.ts'
import { TUTORIAL5_DEFINITION } from './tutorial5.ts'
import {
  ACTIVE_ROOM_IDS,
  UNUSED_ROOM_IDS,
  ROOM_CONTENT_SNAPSHOT,
} from './roomSequence.ts'

export const EDITOR_ROOM_IDS = [...ACTIVE_ROOM_IDS] as const

export type EditorRoomId = (typeof EDITOR_ROOM_IDS)[number]
type RoomContentSnapshot = RoomDefinition

export interface EditorRoomDefinition {
  readonly id: string
  readonly title: string
  readonly hint?: string
  readonly goal: string
  readonly walls?: readonly Box[]
  readonly exit: Pick<RoomExit, 'targetRoomId' | 'label' | 'requires' | 'endsGame' | 'hiddenUntilOpen'>
}

// Deep clone snapshots taken at module evaluation for clean test resets
let initialTutorialRoomsSnapshot: string | undefined
let initialHomeAreaRoomsSnapshot: string | undefined
let initialArenaObjectsSnapshot: string | undefined
let initialRoomObjectsSnapshot: string | undefined

let activeRoomIds: string[] = [...ACTIVE_ROOM_IDS]
let unusedRoomIds: string[] = [...UNUSED_ROOM_IDS]
const customRoomDefinitions = new Map<string, RoomDefinition>()
const exitOverrides = new Map<string, EditorRoomDefinition['exit']>()
let roomContentHydrated = false

function hydrateRoomContentSnapshot(): void {
  if (roomContentHydrated) return
  roomContentHydrated = true
  const snapshots = ROOM_CONTENT_SNAPSHOT as Readonly<Record<string, RoomContentSnapshot>>
  for (const [roomId, snapshot] of Object.entries(snapshots)) {
    const source = getSourceRoomDefinition(roomId)
    if (source) {
      setRoomObjectConfigs(roomId, snapshot.objects)
      if (roomId !== ROOM_IDS.main) {
        const existing = getRoomDefinition(roomId)
        if (existing) {
          exitOverrides.set(roomId, snapshot.exit)
        }
      }
      continue
    }
    customRoomDefinitions.set(roomId, {
      id: roomId,
      ...(snapshot.hint ? { hint: snapshot.hint } : {}),
      goal: snapshot.goal,
      objects: [...snapshot.objects],
      ...(snapshot.walls ? { walls: snapshot.walls } : {}),
      exit: snapshot.exit,
    })
  }
  rechainActiveRoomExits()
}

export function getRoomContentSnapshot(): Readonly<Record<string, RoomContentSnapshot>> {
  const snapshot: Record<string, RoomContentSnapshot> = {}
  for (const roomId of getAllRoomIds()) {
    const definition = getRoomDefinition(roomId)
    if (!definition) continue
    snapshot[roomId] = {
      id: roomId,
      ...(definition.hint ? { hint: definition.hint } : {}),
      goal: definition.goal,
      objects: getRoomObjectConfigs(roomId),
      ...(definition.walls ? { walls: definition.walls } : {}),
      exit: definition.exit,
    }
  }
  return snapshot
}

export function getActiveRoomIds(): readonly string[] {
  hydrateRoomContentSnapshot()
  return activeRoomIds
}

export function getUnusedRoomIds(): readonly string[] {
  return unusedRoomIds
}

export function getAllRoomIds(): readonly string[] {
  return [...activeRoomIds, ...unusedRoomIds]
}

export function isRoomUnused(roomId: string): boolean {
  return unusedRoomIds.includes(roomId)
}

export function isActiveRoom(roomId: string): boolean {
  return activeRoomIds.includes(roomId)
}

export function getEditorRoomIds(): readonly string[] {
  return getActiveRoomIds()
}

export function getNextRoomId(currentRoomId: string): string {
  const ids = (isRoomUnused(currentRoomId) ? unusedRoomIds : activeRoomIds) as readonly string[]
  const idx = ids.indexOf(currentRoomId)
  if (ids.length === 0) return currentRoomId
  return idx >= 0 && idx < ids.length - 1 ? ids[idx + 1] : ids[0]
}

export function getPreviousRoomId(currentRoomId: string): string {
  const ids = (isRoomUnused(currentRoomId) ? unusedRoomIds : activeRoomIds) as readonly string[]
  const idx = ids.indexOf(currentRoomId)
  if (ids.length === 0) return currentRoomId
  return idx > 0 ? ids[idx - 1] : ids[ids.length - 1]
}

function getSourceRoomDefinition(roomId: string): RoomDefinition | undefined {
  const custom = customRoomDefinitions.get(roomId)
  if (custom) return custom
  if (roomId === TUTORIAL5_DEFINITION.id) return TUTORIAL5_DEFINITION

  const tutorial = TUTORIAL_ROOMS.find((room) => room.id === roomId)
  if (tutorial) return tutorial
  const home = HOME_AREA_ROOMS.find((room) => room.id === roomId)
  if (home) return home
  if (roomId === ARENA_DEFINITION.id) return ARENA_DEFINITION
  if (roomId === ROOM_IDS.main) {
    return {
      id: ROOM_IDS.main,
      title: 'room',
      hint: ROOM_HINT,
      goal: 'Reach the exit to the next room.',
      objects: [...ROOM_OBJECTS],
      exit: { targetRoomId: ARENA_IDS.room, label: ARENA_IDS.room },
    } as RoomDefinition
  }
  return undefined
}

export function getActiveRoomDefinitions(): RoomDefinition[] {
  return activeRoomIds
    .map((roomId) => getSourceRoomDefinition(roomId))
    .filter((definition): definition is RoomDefinition => definition !== undefined)
    .map((definition) => ({
      ...definition,
      objects: [...definition.objects],
      ...(definition.walls ? { walls: [...definition.walls] } : {}),
      exit: { ...definition.exit, ...exitOverrides.get(definition.id) },
    }))
}

export function removeRoomToUnused(roomId: string): boolean {
  if (activeRoomIds.length <= 1 || !activeRoomIds.includes(roomId)) return false
  activeRoomIds = activeRoomIds.filter((id) => id !== roomId)
  if (!unusedRoomIds.includes(roomId)) unusedRoomIds.push(roomId)
  rechainActiveRoomExits()
  return true
}

export function insertRoomFromUnused(roomId: string, insertAfterRoomId?: string): boolean {
  if (!unusedRoomIds.includes(roomId) || !getSourceRoomDefinition(roomId)) return false
  unusedRoomIds = unusedRoomIds.filter((id) => id !== roomId)
  const insertIndex = insertAfterRoomId
    ? activeRoomIds.indexOf(insertAfterRoomId) + 1
    : activeRoomIds.length
  activeRoomIds.splice(insertIndex >= 0 ? insertIndex : activeRoomIds.length, 0, roomId)
  rechainActiveRoomExits()
  return true
}

export function insertNewRoom(definition: RoomDefinition, insertAfterRoomId?: string): boolean {
  if (!definition.id || activeRoomIds.includes(definition.id) || unusedRoomIds.includes(definition.id)) return false
  customRoomDefinitions.set(definition.id, definition)
  const insertIndex = insertAfterRoomId ? activeRoomIds.indexOf(insertAfterRoomId) + 1 : activeRoomIds.length
  activeRoomIds.splice(insertIndex >= 0 ? insertIndex : activeRoomIds.length, 0, definition.id)
  rechainActiveRoomExits()
  return true
}

export function createDefaultRoomDefinition(id: string): RoomDefinition {
  const daggerId = `${id}-dagger`
  return {
    id,
    goal: 'Reach the exit.',
    objects: [
      {
        id: daggerId,
        role: 'weapon',
        name: 'dagger',
        x: 640,
        y: 560,
        displayWidth: 49,
        displayHeight: 49,
        mvLimit: 1,
      },
    ],
    exit: {
      targetRoomId: ROOM_IDS.end,
      label: ROOM_IDS.end,
      endsGame: true,
    },
  }
}

export function rechainActiveRoomExits(): void {
  exitOverrides.clear()
  for (let i = 0; i < activeRoomIds.length; i++) {
    const roomId = activeRoomIds[i]
    const definition = getSourceRoomDefinition(roomId)
    if (!definition) continue
    const currentExit = exitOverrides.get(roomId) ?? definition.exit
    if (i < activeRoomIds.length - 1) {
      const nextId = activeRoomIds[i + 1]
      exitOverrides.set(roomId, {
        ...currentExit,
        targetRoomId: nextId,
        label: nextId,
        endsGame: false,
      })
    } else {
      exitOverrides.set(roomId, {
        ...currentExit,
        targetRoomId: ROOM_IDS.end,
        label: ROOM_IDS.end,
        endsGame: true,
      })
    }
  }
}

export function getRoomDefinition(roomId: string): EditorRoomDefinition | undefined {
  const custom = customRoomDefinitions.get(roomId)
  if (custom) {
    const exitOverride = exitOverrides.get(roomId)
    return {
      id: custom.id,
      title: custom.id,
      hint: custom.hint,
      goal: custom.goal,
      walls: custom.walls,
      exit: { ...custom.exit, ...exitOverride },
    }
  }

  if (roomId === ROOM_IDS.main) {
    const exitOverride = exitOverrides.get(roomId)
    return {
      id: ROOM_IDS.main,
      title: 'room',
      hint: ROOM_HINT,
      goal: 'Reach the exit to the next room.',
      exit: { targetRoomId: ROOM_IDS.end, label: ROOM_IDS.end, endsGame: true, ...exitOverride },
    }
  }

  const tutorialMatch = TUTORIAL_ROOMS.find((r) => r.id === roomId)
  if (tutorialMatch) {
    const exitOverride = exitOverrides.get(roomId)
    return {
      id: tutorialMatch.id,
      title: tutorialMatch.id,
      hint: tutorialMatch.hint,
      goal: tutorialMatch.goal,
      walls: tutorialMatch.walls,
      exit: { ...tutorialMatch.exit, ...exitOverride },
    }
  }

  const homeMatch = HOME_AREA_ROOMS.find((r) => r.id === roomId)
  if (homeMatch) {
    const exitOverride = exitOverrides.get(roomId)
    return {
      id: homeMatch.id,
      title: homeMatch.id,
      hint: homeMatch.hint,
      goal: homeMatch.goal,
      walls: homeMatch.walls,
      exit: { ...homeMatch.exit, ...exitOverride },
    }
  }

  if (roomId === ARENA_DEFINITION.id) {
    const exitOverride = exitOverrides.get(roomId)
    return {
      id: ARENA_DEFINITION.id,
      title: ARENA_DEFINITION.id,
      hint: ARENA_DEFINITION.hint,
      goal: ARENA_DEFINITION.goal,
      walls: ARENA_DEFINITION.walls,
      exit: { ...ARENA_DEFINITION.exit, ...exitOverride },
    }
  }

  return undefined
}

export function getRoomObjectConfigs(roomId: string): RoomObjectConfig[] {
  const custom = customRoomDefinitions.get(roomId)
  if (custom) {
    const player = ROOM_OBJECTS.find((object) => object.role === 'player')
    return player
      ? [ { ...player, ...ROOM_ENTRY }, ...custom.objects.filter((object) => object.role !== 'player') ]
      : [...custom.objects]
  }

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
  const custom = customRoomDefinitions.get(roomId)
  if (custom) {
    customRoomDefinitions.set(roomId, { ...custom, objects: [...objects] })
    return
  }

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
  if (initialTutorialRoomsSnapshot === undefined) {
    initialTutorialRoomsSnapshot = JSON.stringify(TUTORIAL_ROOMS)
    initialHomeAreaRoomsSnapshot = JSON.stringify(HOME_AREA_ROOMS)
    initialArenaObjectsSnapshot = JSON.stringify(ARENA_DEFINITION.objects)
    initialRoomObjectsSnapshot = JSON.stringify(ROOM_OBJECTS)
  }

  const parsedTutorials: RoomDefinition[] = JSON.parse(initialTutorialRoomsSnapshot!)
  for (let i = 0; i < TUTORIAL_ROOMS.length; i++) {
    if (parsedTutorials[i]) {
      TUTORIAL_ROOMS[i].objects = parsedTutorials[i].objects
    }
  }

  const parsedHome: RoomDefinition[] = JSON.parse(initialHomeAreaRoomsSnapshot!)
  for (let i = 0; i < HOME_AREA_ROOMS.length; i++) {
    if (parsedHome[i]) {
      HOME_AREA_ROOMS[i].objects = parsedHome[i].objects
    }
  }

  ARENA_DEFINITION.objects = JSON.parse(initialArenaObjectsSnapshot!)

  const parsedRoom: RoomObjectConfig[] = JSON.parse(initialRoomObjectsSnapshot!)
  ROOM_OBJECTS.length = 0
  ROOM_OBJECTS.push(...parsedRoom)

  activeRoomIds = [...ACTIVE_ROOM_IDS]
  unusedRoomIds = [...UNUSED_ROOM_IDS]
  customRoomDefinitions.clear()
  rechainActiveRoomExits()
}
