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
import { ROOM_IDS } from '../content/room1Constants.ts'
import { TUTORIAL_ROOM_IDS } from '../content/tutorialRooms.ts'
import { HOME_AREA_IDS } from '../content/homeArea.ts'
import { wouldOverlapAnyEditorObject } from './levelEditorHistory.ts'
import { LevelEditorScene } from './LevelEditorScene.ts'
import { SceneManager } from './SceneManager.ts'
import type { RoomObjectConfig } from '../content/room1.ts'

describe('LevelEditorScene & Room Registry', () => {
  beforeEach(() => {
    resetAllRooms()
  })

  describe('room registry enumeration and metadata', () => {
    it('enumerates all tutorial rooms, home area rooms, room1, and room2 in progression order', () => {
      const roomIds = getEditorRoomIds()
      expect(roomIds).toEqual([
        TUTORIAL_ROOM_IDS.move,       // tutorial1
        TUTORIAL_ROOM_IDS.discover,   // tutorial2
        TUTORIAL_ROOM_IDS.throw,      // tutorial3
        TUTORIAL_ROOM_IDS.slowTime,   // tutorial4
        HOME_AREA_IDS.home,           // home
        HOME_AREA_IDS.storage,        // storage
        HOME_AREA_IDS.yard,           // yard
        HOME_AREA_IDS.lane,           // lane
        HOME_AREA_IDS.gate,           // gate
        ROOM_IDS.first,               // room1
        ROOM_IDS.second,              // room2
      ])
      expect(roomIds.length).toBe(11)
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
      const homeDef = getRoomDefinition(HOME_AREA_IDS.home)
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

    it('returns hints for tutorial rooms and room1', () => {
      expect(getRoomDefinition(TUTORIAL_ROOM_IDS.move)?.hint).toContain('WASD')
      expect(getRoomDefinition(TUTORIAL_ROOM_IDS.discover)?.hint).toContain('ls')
      expect(getRoomDefinition(TUTORIAL_ROOM_IDS.throw)?.hint).toContain('mv dagger guard')
      expect(getRoomDefinition(TUTORIAL_ROOM_IDS.slowTime)?.hint).toContain('slows time')
      expect(getRoomDefinition(ROOM_IDS.first)?.hint).toContain('reach room2')
    })
  })

  describe('room progression navigation (getNextRoomId & getPreviousRoomId)', () => {
    it('navigates sequentially forward through all rooms and wraps around', () => {
      let current: string = TUTORIAL_ROOM_IDS.move
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.discover)
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.throw)
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.slowTime)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.home)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.storage)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.yard)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.lane)
      current = getNextRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.gate)
      current = getNextRoomId(current)
      expect(current).toBe(ROOM_IDS.first)
      current = getNextRoomId(current)
      expect(current).toBe(ROOM_IDS.second)
      current = getNextRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.move)
    })

    it('navigates sequentially backward through all rooms and wraps around', () => {
      let current: string = TUTORIAL_ROOM_IDS.move
      current = getPreviousRoomId(current)
      expect(current).toBe(ROOM_IDS.second)
      current = getPreviousRoomId(current)
      expect(current).toBe(ROOM_IDS.first)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.gate)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.lane)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.yard)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.storage)
      current = getPreviousRoomId(current)
      expect(current).toBe(HOME_AREA_IDS.home)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.slowTime)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.throw)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.discover)
      current = getPreviousRoomId(current)
      expect(current).toBe(TUTORIAL_ROOM_IDS.move)
    })
  })

  describe('room object configurations and syncing', () => {
    it('returns initial objects for all rooms', () => {
      // tutorial1 includes player + doorway
      const tut1Objs = getRoomObjectConfigs(TUTORIAL_ROOM_IDS.move)
      expect(tut1Objs.some((o) => o.role === 'player')).toBe(true)

      // tutorial2 includes dagger and guard
      const tut2Objs = getRoomObjectConfigs(TUTORIAL_ROOM_IDS.discover)
      expect(tut2Objs.some((o) => o.role === 'weapon')).toBe(true)
      expect(tut2Objs.some((o) => o.role === 'enemy' || o.role === 'guard')).toBe(true)

      // storage includes crate and plate
      const storageObjs = getRoomObjectConfigs(HOME_AREA_IDS.storage)
      expect(storageObjs.some((o) => o.kind === 'crate')).toBe(true)
      expect(storageObjs.some((o) => o.kind === 'plate')).toBe(true)

      // yard includes crate, plate (or archer) and dagger
      const yardObjs = getRoomObjectConfigs(HOME_AREA_IDS.yard)
      expect(yardObjs.some((o) => o.role === 'weapon')).toBe(true)

      // room1 includes player, guard, and dagger
      const room1Objs = getRoomObjectConfigs(ROOM_IDS.first)
      expect(room1Objs.some((o) => o.role === 'player')).toBe(true)
      expect(room1Objs.some((o) => o.role === 'enemy' || o.role === 'guard')).toBe(true)
      expect(room1Objs.some((o) => o.role === 'weapon')).toBe(true)
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
      const originalRoom1 = [...getRoomObjectConfigs(ROOM_IDS.first)]

      setRoomObjectConfigs(HOME_AREA_IDS.storage, [])
      setRoomObjectConfigs(ROOM_IDS.first, [])

      expect(getRoomObjectConfigs(HOME_AREA_IDS.storage)).toHaveLength(0)
      expect(getRoomObjectConfigs(ROOM_IDS.first)).toHaveLength(0)

      resetAllRooms()

      expect(getRoomObjectConfigs(HOME_AREA_IDS.storage)).toEqual(originalStorage)
      expect(getRoomObjectConfigs(ROOM_IDS.first)).toEqual(originalRoom1)
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
    it('instantiates LevelEditorScene with level-editor key and default room1', () => {
      const scene = new LevelEditorScene()
      expect(scene.scene.key).toBe('level-editor')
      expect(scene.getCurrentRoomId()).toBe(ROOM_IDS.first)
    })

    it('initializes currentRoomId when passed via init({ roomId })', () => {
      const scene = new LevelEditorScene()
      scene.init({ roomId: HOME_AREA_IDS.storage })
      expect(scene.getCurrentRoomId()).toBe(HOME_AREA_IDS.storage)
    })

    it('ignores invalid roomId in init() and falls back to default room1', () => {
      const scene = new LevelEditorScene()
      scene.init({ roomId: 'non-existent-room-99' })
      expect(scene.getCurrentRoomId()).toBe(ROOM_IDS.first)
    })

    it('returnToGame() starts game with currentRoomId when SceneManager is not bound', () => {
      const scene = new LevelEditorScene()
      scene.init({ roomId: HOME_AREA_IDS.yard })
      const startMock = vi.fn()
      ;(scene as any).scene = { key: 'level-editor', start: startMock }

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
