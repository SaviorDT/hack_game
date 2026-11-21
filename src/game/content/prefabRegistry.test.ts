import { beforeEach, describe, expect, it } from 'vitest'
import {
  getAllPrefabs,
  getPrefab,
  getPrefabInstances,
  propagatePrefabChanges,
  resetPrefabs,
  updatePrefab,
} from './prefabRegistry.ts'
import { getRoomObjectConfigs, resetAllRooms } from './roomRegistry.ts'
import { ROOM_IDS } from './room1Constants.ts'

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

  it('updates prefab in registry', () => {
    const updated = updatePrefab('guard', { maxHealth: 160 })
    expect(updated.maxHealth).toBe(160)
    expect(getPrefab('guard')?.maxHealth).toBe(160)
  })

  it('finds instances of a prefab across rooms', () => {
    const guardInstances = getPrefabInstances('guard')
    expect(guardInstances.length).toBeGreaterThan(0)
    const inRoom1 = guardInstances.filter((m) => m.roomId === ROOM_IDS.first)
    // In room1 there are guard, guard2, guard3
    expect(inRoom1.length).toBe(3)
  })

  it('propagatePrefabChanges updates all instances across rooms while preserving coordinates and id', () => {
    const guardPrefab = getPrefab('guard')!
    const updatedPrefab = {
      ...guardPrefab,
      maxHealth: 180,
      displayWidth: 190,
      displayHeight: 190,
      colliderWidth: 120,
    }

    const result = propagatePrefabChanges('guard', updatedPrefab)

    expect(result.affectedRooms).toContain(ROOM_IDS.first)
    expect(result.affectedInstanceCount).toBeGreaterThanOrEqual(3)

    // Verify room1 objects
    const room1Objects = getRoomObjectConfigs(ROOM_IDS.first)
    const g1 = room1Objects.find((o) => o.id === 'guard')!
    const g2 = room1Objects.find((o) => o.id === 'guard2')!
    const g3 = room1Objects.find((o) => o.id === 'guard3')!

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
    expect(g1.x).toBe(1490)
    expect(g2.x).toBe(1012)
    expect(g3.x).toBe(1160)

    // Non-guard objects should NOT be changed
    const player = room1Objects.find((o) => o.id === 'player')!
    expect(player.displayWidth).toBe(125)
  })
})
