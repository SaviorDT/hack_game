import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockScene {
    scene: { key: string }
    constructor(config?: { key: string }) {
      this.scene = { key: config?.key ?? 'mock-scene' }
    }
  }

  return {
    default: {
      Scene: MockScene,
      Scenes: {
        Events: {
          SHUTDOWN: 'shutdown',
        },
      },
      Display: {
        Color: {
          HexStringToColor: () => ({ color: 0 }),
        },
      },
    },
  }
})

import {
  getEditorRoomIds,
  getRoomDefinition,
  getRoomObjectConfigs,
  setRoomObjectConfigs,
  resetAllRooms,
  getNextRoomId,
  getPreviousRoomId,
} from '../content/roomRegistry.ts'
import { ROOM_IDS } from '../content/roomConstants.ts'
import { TUTORIAL_ROOM_IDS } from '../content/tutorialRooms.ts'
import { HOME_AREA_IDS } from '../content/homeArea.ts'
import { wouldOverlapAnyEditorObject } from './levelEditorHistory.ts'
import { LevelEditorScene } from './LevelEditorScene.ts'
import { SceneManager } from './SceneManager.ts'
import type { RoomObjectConfig } from '../content/room.ts'

describe('LevelEditorScene & Room Registry', () => {
  beforeEach(() => {
    resetAllRooms()
  })

  describe('room registry enumeration and metadata', () => {
    it('enumerates all tutorial rooms, home area rooms and room in progression order', () => {
      const roomIds = getEditorRoomIds()
      expect(roomIds).toEqual([
        TUTORIAL_ROOM_IDS.move,       // tutorial1
        TUTORIAL_ROOM_IDS.throw,      // tutorial2
        TUTORIAL_ROOM_IDS.slowTime,   // tutorial3
        TUTORIAL_ROOM_IDS.mouseThrow, // tutorial4
        TUTORIAL_ROOM_IDS.flyAround,  // tutorial5
        HOME_AREA_IDS.storage,        // storage
        HOME_AREA_IDS.yard,           // yard
        HOME_AREA_IDS.lane,           // lane
        HOME_AREA_IDS.gate,           // gate
        ROOM_IDS.main,                // room
      ])
      expect(roomIds.length).toBe(10)
    })

    it('returns valid room definitions for all editor rooms', () => {
      for (const roomId of getEditorRoomIds()) {
        const def = getRoomDefinition(roomId)
        expect(def, `Room definition should exist for ${roomId}`).toBeDefined()
        expect(def!.id).toBe(roomId)
        expect(def!.title).toBeDefined()
        expect(def!.goal).toBeDefined()
        expect(def!.exit).toBeDefined()
        expect(def!.exit.targetRoomId).toBeDefined()
      }
    })

    it('returns wall definitions for home area rooms with walls', () => {
      const homeDef = getRoomDefinition(TUTORIAL_ROOM_IDS.mouseThrow)
      expect(homeDef?.walls).toBeDefined()
      expect(homeDef!.walls!.length).toBeGreaterThan(0)

      const storageDef = getRoomDefinition(HOME_AREA_IDS.storage)
      expect(storageDef?.walls).toBeDefined()
      expect(storageDef!.walls!.length).toBeGreaterThan(0)

      const yardDef = getRoomDefinition(HOME_AREA_IDS.yard)
      expect(yardDef?.walls).toBeDefined()
      expect(yardDef!.walls!.length).toBeGreaterThan(0)

      const laneDef = getRoomDefinition(HOME_AREA_IDS.lane)
      expect(laneDef?.walls).toBeDefined()
      expect(laneDef!.walls!.length).toBeGreaterThan(0)

      const gateDef = getRoomDefinition(HOME_AREA_IDS.gate)
      expect(gateDef?.walls).toBeDefined()
      expect(gateDef!.walls!.length).toBeGreaterThan(0)
    })

    it('returns hints for tutorial rooms and room', () => {
      expect(getRoomDefinition(TUTORIAL_ROOM_IDS.move)?.hint).toContain('WASD')
      expect(getRoomDefinition(ROOM_IDS.main)?.hint).toContain('reach the next room')
    })
  })

  describe('room progression navigation (getNextRoomId & getPreviousRoomId)', () => {
    it('navigates sequentially forward through all rooms and wraps around', () => {
      let current: string = TUTORIAL_ROOM_IDS.move
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.throw)
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.slowTime)
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.mouseThrow)
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.flyAround)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.storage)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.yard)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.lane)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.gate)
      current = getNextRoomId(current)
      expect(current).toBe(ROOM_IDS.main)
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.move)
    })

    it('navigates sequentially backward through all rooms and wraps around', () => {
      let current: string = TUTORIAL_ROOM_IDS.move
      current = getPreviousRoomId(current)
      expect(current).toBe(ROOM_IDS.main)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.gate)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.lane)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.yard)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.storage)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.flyAround)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.mouseThrow)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.slowTime)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.throw)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.move)
    })
  })

  describe('room object configurations and syncing', () => {
    it('returns initial objects for all rooms', () => {
      // tutorial1 includes player + doorway
      const tut1Objs = getRoomObjectConfigs(TUTORIAL_ROOM_IDS.move)
      expect(tut1Objs.some((o) => o.role === 'player')).toBe(true)

      // tutorial2 includes dagger and sentry
      const tut2Objs = getRoomObjectConfigs(TUTORIAL_ROOM_IDS.throw)
      expect(tut2Objs.some((o) => o.role === 'weapon')).toBe(true)
      expect(tut2Objs.some((o) => o.role === 'enemy' || o.role === 'guard')).toBe(true)

      // storage includes crate and plate
      const storageObjs = getRoomObjectConfigs(HOME_AREA_IDS.storage)
      expect(storageObjs.some((o) => o.kind === 'crate')).toBe(true)
      expect(storageObjs.some((o) => o.kind === 'plate')).toBe(true)

      // yard includes crate, plate (or archer) and dagger
      const yardObjs = getRoomObjectConfigs(HOME_AREA_IDS.yard)
      expect(yardObjs.some((o) => o.role === 'weapon')).toBe(true)

      // room includes player, guard, and dagger
      const roomObjs = getRoomObjectConfigs(ROOM_IDS.main)
      expect(roomObjs.some((o) => o.role === 'player')).toBe(true)
      expect(roomObjs.some((o) => o.role === 'enemy' || o.role === 'guard')).toBe(true)
      expect(roomObjs.some((o) => o.role === 'weapon')).toBe(true)
    })

    it('serves tutorial5 from its definition: a dagger and a Target Dummy, and a Hidden Exit', () => {
      const objects = getRoomObjectConfigs(TUTORIAL_ROOM_IDS.flyAround)
      expect(objects.map((o) => o.kind ?? o.role).sort()).toEqual(['dummy', 'weapon'])
      expect(objects.find((o) => o.kind === 'dummy')?.maxHealth).toBe(1000)
      expect(getRoomDefinition(TUTORIAL_ROOM_IDS.flyAround)?.exit).toMatchObject({ targetRoomId: HOME_AREA_IDS.storage, hiddenUntilOpen: true })

      setRoomObjectConfigs(TUTORIAL_ROOM_IDS.flyAround, [])
      expect(getRoomObjectConfigs(TUTORIAL_ROOM_IDS.flyAround)).toHaveLength(0)
      resetAllRooms()
      expect(getRoomObjectConfigs(TUTORIAL_ROOM_IDS.flyAround)).toHaveLength(2)
    })

    it('persists modified object configurations in memory with setRoomObjectConfigs', () => {
      const customStorageObjs: RoomObjectConfig[] = [
        {
          id: 'custom-crate-1',
          role: 'object',
          kind: 'crate',
          x: 400,
          y: 400,
          displayWidth: 80,
          displayHeight: 80,
        },
      ]

      setRoomObjectConfigs(HOME_AREA_IDS.storage, customStorageObjs)
      const updated = getRoomObjectConfigs(HOME_AREA_IDS.storage)
      expect(updated).toEqual(customStorageObjs)
    })

    it('resets all mutated room configurations cleanly with resetAllRooms', () => {
      const originalStorage = [...getRoomObjectConfigs(HOME_AREA_IDS.storage)]
      const originalRoom = [...getRoomObjectConfigs(ROOM_IDS.main)]

      setRoomObjectConfigs(HOME_AREA_IDS.storage, [])
      setRoomObjectConfigs(ROOM_IDS.main, [])

      expect(getRoomObjectConfigs(HOME_AREA_IDS.storage)).toHaveLength(0)
      expect(getRoomObjectConfigs(ROOM_IDS.main)).toHaveLength(0)

      resetAllRooms()

      expect(getRoomObjectConfigs(HOME_AREA_IDS.storage)).toEqual(originalStorage)
      expect(getRoomObjectConfigs(ROOM_IDS.main)).toEqual(originalRoom)
    })
  })

  describe('level editor collision with pressure plates', () => {
    it('allows candidates to overlap pressure plates without collision conflicts', () => {
      const existing = [
        { id: 'plate1', role: 'object' as const, kind: 'plate', x: 400, y: 400, scaleX: 1, scaleY: 1 },
      ]

      // Placing a crate over the plate
      const crateOverPlate = wouldOverlapAnyEditorObject('crate1', 'object', 400, 400, 1, 1, existing)
      expect(crateOverPlate).toBe(false)

      // Placing a player over the plate
      const playerOverPlate = wouldOverlapAnyEditorObject('player', 'player', 400, 400, 1, 1, existing)
      expect(playerOverPlate).toBe(false)
    })

    it('allows candidate pressure plates to be placed over existing solid objects', () => {
      const existing = [
        { id: 'crate1', role: 'object' as const, kind: 'crate', x: 400, y: 400, scaleX: 1, scaleY: 1 },
      ]

      // Candidate is a plate at the same position
      const plateOverCrate = wouldOverlapAnyEditorObject(
        'plate1',
        'object',
        400,
        400,
        1,
        1,
        existing,
        undefined,
        undefined,
        undefined,
        'plate',
      )
      expect(plateOverCrate).toBe(false)
    })

    it('still detects collision between two solid obstacles (e.g. crate over boulder)', () => {
      const existing = [
        { id: 'boulder1', role: 'object' as const, kind: 'boulder', x: 400, y: 400, scaleX: 1, scaleY: 1 },
      ]

      const crateOverBoulder = wouldOverlapAnyEditorObject('crate1', 'object', 400, 400, 1, 1, existing)
      expect(crateOverBoulder).toBe(true)
    })
  })

  describe('LevelEditorScene initialization', () => {
    it('instantiates LevelEditorScene with level-editor key and default room', () => {
      const scene = new LevelEditorScene()
      expect(scene.scene.key).toBe('level-editor')
      expect(scene.getCurrentRoomId()).toBe(ROOM_IDS.main)
    })

    it('initializes currentRoomId when passed via init({ roomId })', () => {
      const scene = new LevelEditorScene()
      scene.init({ roomId: HOME_AREA_IDS.storage })
      expect(scene.getCurrentRoomId()).toBe(HOME_AREA_IDS.storage)
    })

    it('ignores invalid roomId in init() and falls back to default room', () => {
      const scene = new LevelEditorScene()
      scene.init({ roomId: 'non-existent-room-99' })
      expect(scene.getCurrentRoomId()).toBe(ROOM_IDS.main)
    })

    it('returnToGame() starts game with currentRoomId when SceneManager is not bound', () => {
      const scene = new LevelEditorScene()
      scene.init({ roomId: HOME_AREA_IDS.yard })
      const startMock = vi.fn()
        ; (scene as any).scene = { key: 'level-editor', start: startMock }

      scene.returnToGame()
      expect(startMock).toHaveBeenCalledWith('game', { startingRoomId: HOME_AREA_IDS.yard })
    })

    it('returnToGame() calls SceneManager.exitEditor with startingRoomId when SceneManager exists', () => {
      const scene = new LevelEditorScene()
      scene.init({ roomId: HOME_AREA_IDS.storage })
      const exitEditorMock = vi.fn()
      const getSpy = vi.spyOn(SceneManager, 'get').mockReturnValue({ exitEditor: exitEditorMock } as unknown as SceneManager)

      scene.returnToGame()
      expect(exitEditorMock).toHaveBeenCalledWith({ startingRoomId: HOME_AREA_IDS.storage })
      getSpy.mockRestore()
    })
  })
})
