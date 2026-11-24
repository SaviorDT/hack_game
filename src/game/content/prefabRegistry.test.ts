import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getAllPrefabs,
  getPrefab,
  getPrefabInstances,
  propagatePrefabChanges,
  resetPrefabs,
  saveActivePrefabs,
  updatePrefab,
} from './prefabRegistry.ts'
import { getRoomObjectConfigs, resetAllRooms } from './roomRegistry.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { ARENA_IDS } from './arena.ts'

describe('Prefab Registry & Propagation', () => {
  beforeEach(() => {
    resetAllRooms()
    resetPrefabs()
  })

  it('lists default prefabs', () => {
    const prefabs = getAllPrefabs()
    expect(prefabs.length).toBeGreaterThanOrEqual(7)
    expect(getPrefab('guard')).toBeDefined()
    expect(getPrefab('boulder')).toBeDefined()
  })

  it('does not resize or re-health the arena Boss when the guard prefab changes', () => {
    const before = getRoomObjectConfigs(ARENA_IDS.room).find((o) => o.kind === 'boss')!
    propagatePrefabChanges('guard', { ...getPrefab('guard')!, maxHealth: 180, displayWidth: 190, displayHeight: 190, colliderWidth: 120 })
    const after = getRoomObjectConfigs(ARENA_IDS.room).find((o) => o.kind === 'boss')!
    expect(after).toMatchObject({
      maxHealth: before.maxHealth,
      displayWidth: before.displayWidth,
      colliderWidth: before.colliderWidth,
    })
  })

  it('updates prefab in registry', () => {
    const updated = updatePrefab('guard', { maxHealth: 160 })
    expect(updated.maxHealth).toBe(160)
    expect(getPrefab('guard')?.maxHealth).toBe(160)
  })

  it('finds instances of a prefab across rooms', () => {
    const guardInstances = getPrefabInstances('guard')
    expect(guardInstances.length).toBeGreaterThan(0)
    const inRoom = guardInstances.filter((m) => m.roomId === ROOM_IDS.main)
    // In room there are guard_a, guard_b, guard_c
    expect(inRoom.length).toBe(3)
  })

  it('propagatePrefabChanges updates all instances across rooms while preserving coordinates and id', () => {
    const guardPrefab = getPrefab('guard')!
    const playerWidthBefore = getRoomObjectConfigs(ROOM_IDS.main).find((o) => o.id === 'player')!.displayWidth
    const updatedPrefab = {
      ...guardPrefab,
      maxHealth: 180,
      displayWidth: 190,
      displayHeight: 190,
      colliderWidth: 120,
    }

    const positionsBefore = Object.fromEntries(
      getRoomObjectConfigs(ROOM_IDS.main)
        .filter((o) => ['guard_a', 'guard_b', 'guard_c'].includes(o.id))
        .map((o) => [o.id, { x: o.x, y: o.y }]),
    )

    const result = propagatePrefabChanges('guard', updatedPrefab)
    expect(result.affectedRooms).toContain(ROOM_IDS.main)
    expect(result.affectedInstanceCount).toBeGreaterThanOrEqual(3)

    // Verify room objects
    const roomObjects = getRoomObjectConfigs(ROOM_IDS.main)
    const g1 = roomObjects.find((o) => o.id === 'guard_a')!
    const g2 = roomObjects.find((o) => o.id === 'guard_b')!
    const g3 = roomObjects.find((o) => o.id === 'guard_c')!

    expect(g1.maxHealth).toBe(180)
    expect(g1.displayWidth).toBe(190)
    expect(g1.colliderWidth).toBe(120)

    expect(g2.maxHealth).toBe(180)
    expect(g2.displayWidth).toBe(190)
    expect(g2.colliderWidth).toBe(120)

    expect(g3.maxHealth).toBe(180)
    expect(g3.displayWidth).toBe(190)
    expect(g3.colliderWidth).toBe(120)

    // Positions should remain unchanged
    expect({ x: g1.x, y: g1.y }).toEqual(positionsBefore.guard_a)
    expect({ x: g2.x, y: g2.y }).toEqual(positionsBefore.guard_b)
    expect({ x: g3.x, y: g3.y }).toEqual(positionsBefore.guard_c)

    // Non-guard objects should NOT be changed
    const player = roomObjects.find((o) => o.id === 'player')!
    expect(player.displayWidth).toBe(playerWidthBefore)
  })

  describe('saveActivePrefabs', () => {
    it('persists serialized prefabs to /api/save-prefabs on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, path: '/fake/Prefab.ts' }),
      })

      const res = await saveActivePrefabs(mockFetch as any)
      expect(res.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/save-prefabs', expect.objectContaining({
        method: 'POST',
      }))
    })

    it('returns error when server returns failure or non-200 status', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const res = await saveActivePrefabs(mockFetch as any)
      expect(res.success).toBe(false)
      expect(res.error).toContain('Server returned 500')
    })
  })
})
