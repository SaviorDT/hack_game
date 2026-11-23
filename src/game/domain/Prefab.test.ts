import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PREFABS,
  inferPrefabId,
  applyPrefabToObject,
  type PrefabDefinition,
} from './Prefab.ts'
import type { RoomObjectConfig } from '../content/room.ts'

describe('Prefab Domain', () => {
  describe('DEFAULT_PREFABS', () => {
    it('defines standard prefabs: guard, dagger, boulder, crate, plate, archer, player', () => {
      const ids = DEFAULT_PREFABS.map((p) => p.id)
      expect(ids).toContain('guard')
      expect(ids).toContain('dagger')
      expect(ids).toContain('boulder')
      expect(ids).toContain('crate')
      expect(ids).toContain('plate')
      expect(ids).toContain('archer')
      expect(ids).toContain('player')
    })
  })

  describe('inferPrefabId', () => {
    it('returns explicit prefabId when present', () => {
      const obj: RoomObjectConfig = {
        id: 'custom1',
        role: 'enemy',
        x: 10,
        y: 20,
        displayWidth: 100,
        displayHeight: 100,
        prefabId: 'elite-guard',
      }
      expect(inferPrefabId(obj)).toBe('elite-guard')
    })

    it('infers prefab from kind when present', () => {
      expect(
        inferPrefabId({ id: 'c1', role: 'object', kind: 'crate', x: 0, y: 0, displayWidth: 88, displayHeight: 88 }),
      ).toBe('crate')
      expect(
        inferPrefabId({ id: 'p1', role: 'object', kind: 'plate', x: 0, y: 0, displayWidth: 96, displayHeight: 96 }),
      ).toBe('plate')
      expect(
        inferPrefabId({ id: 'a1', role: 'enemy', kind: 'archer', x: 0, y: 0, displayWidth: 176, displayHeight: 176 }),
      ).toBe('archer')
    })

    it('infers boulder from circular object role', () => {
      expect(
        inferPrefabId({
          id: 'rock',
          role: 'object',
          colliderShape: 'circle',
          x: 0,
          y: 0,
          displayWidth: 154,
          displayHeight: 154,
        }),
      ).toBe('boulder')
    })

    it('infers guard from enemy or guard role', () => {
      expect(
        inferPrefabId({ id: 'g2', role: 'enemy', x: 0, y: 0, displayWidth: 176, displayHeight: 176 }),
      ).toBe('guard')
      expect(
        inferPrefabId({ id: 'g3', role: 'guard', x: 0, y: 0, displayWidth: 176, displayHeight: 176 }),
      ).toBe('guard')
    })

    it('infers dagger from weapon role', () => {
      expect(
        inferPrefabId({ id: 'w1', role: 'weapon', x: 0, y: 0, displayWidth: 72, displayHeight: 72 }),
      ).toBe('dagger')
    })

    it('infers player from player role or id', () => {
      expect(
        inferPrefabId({ id: 'player', role: 'player', x: 0, y: 0, displayWidth: 125, displayHeight: 125 }),
      ).toBe('player')
    })
  })

  describe('applyPrefabToObject', () => {
    it('applies prefab properties while preserving instance coordinates, id, and custom name', () => {
      const instance: RoomObjectConfig = {
        id: 'sentry',
        name: 'sentry',
        role: 'enemy',
        x: 500,
        y: 600,
        displayWidth: 176,
        displayHeight: 176,
        maxHealth: 40,
      }

      const guardPrefab: PrefabDefinition = {
        id: 'guard',
        name: 'Guard',
        role: 'enemy',
        displayWidth: 200,
        displayHeight: 200,
        scaleX: 1.14,
        scaleY: 1.14,
        speed: 250,
        maxHealth: 150,
        colliderWidth: 120,
        colliderHeight: 170,
        colliderShape: 'box',
        mass: 5,
      }

      const updated = applyPrefabToObject(instance, guardPrefab)

      // Preserved fields
      expect(updated.id).toBe('sentry')
      expect(updated.name).toBe('sentry')
      expect(updated.x).toBe(500)
      expect(updated.y).toBe(600)

      // Propagated fields
      expect(updated.displayWidth).toBe(200)
      expect(updated.displayHeight).toBe(200)
      expect(updated.scaleX).toBe(1.14)
      expect(updated.scaleY).toBe(1.14)
      expect(updated.maxHealth).toBe(150)
      expect(updated.speed).toBe(250)
      expect(updated.colliderWidth).toBe(120)
      expect(updated.colliderHeight).toBe(170)
      expect(updated.mass).toBe(5)
      expect(updated.prefabId).toBe('guard')
    })
  })
})
