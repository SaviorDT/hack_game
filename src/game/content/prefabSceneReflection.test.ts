import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PREFABS } from '../domain/Prefab.ts'
import { ROOM_OBJECTS } from './room.ts'
import { guard, dagger, boulder, crate } from './roomPieces.ts'
import { createGameWorldState } from './tutorialRooms.ts'
import { getRoomObjectConfigs, resetAllRooms } from './roomRegistry.ts'
import { resetPrefabs, saveActivePrefabs, updatePrefab } from './prefabRegistry.ts'

describe('Prefab Scene Reflection', () => {
  beforeEach(() => {
    resetAllRooms()
    resetPrefabs()
  })

  it('ROOM_OBJECTS dynamically reflects properties from DEFAULT_PREFABS on load', () => {
    const guardPrefab = DEFAULT_PREFABS.find((p) => p.id === 'guard')!
    const roomGuards = ROOM_OBJECTS.filter((o) => o.role === 'enemy' && !o.kind)

    expect(roomGuards.length).toBeGreaterThan(0)
    for (const g of roomGuards) {
      expect(g.displayWidth).toBe(guardPrefab.displayWidth)
      expect(g.displayHeight).toBe(guardPrefab.displayHeight)
      expect(g.maxHealth).toBe(guardPrefab.maxHealth)
    }
  })

  it('roomPieces presets dynamically derive properties from DEFAULT_PREFABS', () => {
    const daggerPrefab = DEFAULT_PREFABS.find((p) => p.id === 'dagger')!
    const testDagger = dagger('d1', 10, 20)
    expect(testDagger.displayWidth).toBe(daggerPrefab.displayWidth)
    expect(testDagger.attackDistance).toBe(daggerPrefab.attackDistance)

    const boulderPrefab = DEFAULT_PREFABS.find((p) => p.id === 'boulder')!
    const testBoulder = boulder('b1', 30, 40)
    expect(testBoulder.displayWidth).toBe(boulderPrefab.displayWidth)
    expect(testBoulder.mass).toBe(boulderPrefab.mass)

    const cratePrefab = DEFAULT_PREFABS.find((p) => p.id === 'crate')!
    const testCrate = crate('c1', 50, 60)
    expect(testCrate.displayWidth).toBe(cratePrefab.displayWidth)
    expect(testCrate.mass).toBe(cratePrefab.mass)

    const guardPrefab = DEFAULT_PREFABS.find((p) => p.id === 'guard')!
    const testGuard = guard('g1', 70, 80)
    expect(testGuard.displayWidth).toBe(guardPrefab.displayWidth)
    expect(testGuard.maxHealth).toBe(guardPrefab.maxHealth)
  })

  it('createGameWorldState applies prefab configurations to world objects across rooms', () => {
    const worldState = createGameWorldState(ROOM_OBJECTS)
    const guardObj = worldState.worldObjects.find((wo) => wo.id === 'guard_a')
    expect(guardObj).toBeDefined()

    const guardPrefab = DEFAULT_PREFABS.find((p) => p.id === 'guard')!
    const state = guardObj!.state as Record<string, unknown>
    expect(state.displayWidth).toBe(guardPrefab.displayWidth)
    expect(state.maxHealth).toBe(guardPrefab.maxHealth)
  })

  it('saveActivePrefabs persists single source of truth to /api/save-prefabs and propagates in-memory', async () => {
    updatePrefab('guard', { displayWidth: 230, maxHealth: 175 })

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, path: '/fake/Prefab.ts' }),
    })

    const result = await saveActivePrefabs(mockFetch as any)
    expect(result.success).toBe(true)

    // Only /api/save-prefabs is called (single source of truth)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/save-prefabs', expect.anything())

    // In-memory rooms are updated immediately
    const roomGuards = getRoomObjectConfigs('room').filter((o) => o.role === 'enemy' && !o.kind)
    for (const g of roomGuards) {
      expect(g.displayWidth).toBe(230)
      expect(g.maxHealth).toBe(175)
    }
  })
})
