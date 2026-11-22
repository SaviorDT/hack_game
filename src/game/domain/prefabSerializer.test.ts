import { describe, expect, it } from 'vitest'
import { generatePrefabSource } from './prefabSerializer.ts'
import { DEFAULT_PREFABS } from './Prefab.ts'

describe('prefabSerializer', () => {
  it('generates valid TypeScript output matching DEFAULT_PREFABS', () => {
    const source = generatePrefabSource(DEFAULT_PREFABS)

    expect(source).toContain("export interface PrefabDefinition extends PhysicsAttrConfig")
    expect(source).toContain("export const DEFAULT_PREFABS: readonly PrefabDefinition[] = [")
    expect(source).toContain("export function inferPrefabId(")
    expect(source).toContain("export function applyPrefabToObject(")

    for (const prefab of DEFAULT_PREFABS) {
      expect(source).toContain(`id: "${prefab.id}"`)
      expect(source).toContain(`name: "${prefab.name}"`)
      expect(source).toContain(`role: "${prefab.role}"`)
    }
  })

  it('serializes updated values accurately', () => {
    const customPrefabs = [
      {
        id: 'guard',
        name: 'Elite Guard',
        role: 'enemy' as const,
        displayWidth: 200,
        displayHeight: 200,
        scaleX: 1.15,
        scaleY: 1.15,
        speed: 260,
        maxHealth: 150,
        colliderWidth: 120,
        colliderHeight: 180,
        colliderShape: 'box' as const,
        mass: 5,
      },
    ]

    const source = generatePrefabSource(customPrefabs)
    expect(source).toContain('id: "guard"')
    expect(source).toContain('name: "Elite Guard"')
    expect(source).toContain('displayWidth: 200')
    expect(source).toContain('scaleX: 1.15')
    expect(source).toContain('speed: 260')
    expect(source).toContain('maxHealth: 150')
    expect(source).toContain('mass: 5')
  })

  it('serializes structured player speed with nested acceleration values', () => {
    const playerPrefab = [
      {
        id: 'player',
        name: 'Player',
        role: 'player' as const,
        displayWidth: 125,
        displayHeight: 125,
        scaleX: 0.71,
        scaleY: 0.71,
        speed: {
          acceleration: 2700,
          frictionAcceleration: 3200,
          turnaroundAcceleration: 1800,
          maxSpeed: 320,
        },
        maxHealth: 120,
      },
    ]

    const source = generatePrefabSource(playerPrefab)
    expect(source).toContain('acceleration: 2700')
    expect(source).toContain('frictionAcceleration: 3200')
    expect(source).toContain('turnaroundAcceleration: 1800')
    expect(source).toContain('maxSpeed: 320')
  })
})
