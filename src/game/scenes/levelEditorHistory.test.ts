import { describe, expect, it, beforeEach } from 'vitest'
import {
  type EditorChange,
  type MoveChange,
  type PropertyChange,
  type ScalableMovableObject,
  type ScaleChange,
  type ColliderChange,
  EditorHistory,
  applyChange,
  invertChange,
  computeEditorCollisionBox,
  wouldOverlapAnyEditorObject,
  generateNextObjectId,
} from './levelEditorHistory.ts'
import { GAME_WEAPON_CONFIG, resetGameWeaponConfig } from '../content/weaponConstants.ts'

function createTestObject(overrides: Partial<ScalableMovableObject> = {}): ScalableMovableObject {
  return {
    id: 'test-obj',
    x: 100,
    y: 200,
    displayWidth: 176,
    displayHeight: 176,
    baseWidth: 176,
    baseHeight: 176,
    scaleX: 1,
    scaleY: 1,
    ...overrides,
  }
}

describe('levelEditorHistory', () => {
  beforeEach(() => {
    resetGameWeaponConfig()
  })

  describe('invertChange', () => {
    it('defines the reverse of a move change by negating dx and dy and swapping prev/next', () => {
      const move: MoveChange = {
        type: 'move',
        objectId: 'player',
        dx: 10,
        dy: -5,
        prevX: 100,
        prevY: 200,
        nextX: 110,
        nextY: 195,
      }

      const reverse = invertChange(move)

      expect(reverse).toEqual({
        type: 'move',
        objectId: 'player',
        dx: -10,
        dy: 5,
        prevX: 110,
        prevY: 195,
        nextX: 100,
        nextY: 200,
      })
    })

    it('defines the reverse of a scale change by inverting factor and swapping prev/next', () => {
      const scale: ScaleChange = {
        type: 'scale',
        objectId: 'player',
        factor: 1.1,
        prevScaleX: 1.0,
        prevScaleY: 1.0,
        prevDisplayWidth: 176,
        prevDisplayHeight: 176,
        nextScaleX: 1.1,
        nextScaleY: 1.1,
        nextDisplayWidth: 194,
        nextDisplayHeight: 194,
      }

      const reverse = invertChange(scale)

      expect(reverse.type).toBe('scale')
      expect((reverse as ScaleChange).factor).toBeCloseTo(1 / 1.1, 5)
      expect((reverse as ScaleChange).prevDisplayWidth).toBe(194)
      expect((reverse as ScaleChange).nextDisplayWidth).toBe(176)
      expect((reverse as ScaleChange).prevScaleX).toBe(1.1)
      expect((reverse as ScaleChange).nextScaleX).toBe(1.0)
    })

    it('is involutive: inverting twice returns the original move change', () => {
      const move: MoveChange = {
        type: 'move',
        objectId: 'guard',
        dx: -15,
        dy: 20,
        prevX: 300,
        prevY: 400,
        nextX: 285,
        nextY: 420,
      }

      expect(invertChange(invertChange(move))).toEqual(move)
    })

    it('is involutive: inverting twice returns the original scale change', () => {
      const scale: ScaleChange = {
        type: 'scale',
        objectId: 'dagger',
        factor: 2,
        prevScaleX: 1,
        prevScaleY: 1,
        prevDisplayWidth: 72,
        prevDisplayHeight: 72,
        nextScaleX: 2,
        nextScaleY: 2,
        nextDisplayWidth: 144,
        nextDisplayHeight: 144,
      }

      expect(invertChange(invertChange(scale))).toEqual(scale)
    })

    it('defines the reverse of a property change by negating delta and swapping prev/next values', () => {
      const propChange: PropertyChange = {
        type: 'property',
        objectId: 'player',
        property: 'maxHealth',
        delta: 10,
        prevValue: 100,
        nextValue: 110,
      }

      const reverse = invertChange(propChange)

      expect(reverse).toEqual({
        type: 'property',
        objectId: 'player',
        property: 'maxHealth',
        delta: -10,
        prevValue: 110,
        nextValue: 100,
      })
      expect(invertChange(reverse)).toEqual(propChange)
    })

    it('defines the reverse of a collider change by swapping prev/next dimensions', () => {
      const colliderChange: ColliderChange = {
        type: 'collider',
        objectId: 'player',
        prevWidth: 110,
        prevHeight: 160,
        nextWidth: 140,
        nextHeight: 180,
      }

      const reverse = invertChange(colliderChange)

      expect(reverse).toEqual({
        type: 'collider',
        objectId: 'player',
        prevWidth: 140,
        prevHeight: 180,
        nextWidth: 110,
        nextHeight: 160,
      })
      expect(invertChange(reverse)).toEqual(colliderChange)
    })

    it('defines the reverse of a spawn change as despawn change and vice versa', () => {
      const snapshot = createTestObject({ id: 'guard2' })
      const spawnChange = {
        type: 'spawn' as const,
        objectId: 'guard2',
        role: 'enemy' as const,
        snapshot,
      }

      const reverse = invertChange(spawnChange)
      expect(reverse).toEqual({
        type: 'despawn',
        objectId: 'guard2',
        role: 'enemy',
        snapshot,
      })
      expect(invertChange(reverse)).toEqual(spawnChange)
    })
  })

  describe('applyChange', () => {
    it('handles spawn and despawn without throwing or mutating target', () => {
      const obj = createTestObject({ id: 'guard2', x: 100 })
      expect(() => {
        applyChange(obj, {
          type: 'spawn',
          objectId: 'guard2',
          role: 'enemy',
          snapshot: obj,
        })
      }).not.toThrow()
      expect(obj.x).toBe(100)

      expect(() => {
        applyChange(obj, {
          type: 'despawn',
          objectId: 'guard2',
          role: 'enemy',
          snapshot: obj,
        })
      }).not.toThrow()
      expect(obj.x).toBe(100)
    })
    it('applies property change to target object', () => {
      const obj = createTestObject({ maxHealth: 100, speed: 240 })
      applyChange(obj, {
        type: 'property',
        objectId: 'test-obj',
        property: 'maxHealth',
        delta: 20,
        prevValue: 100,
        nextValue: 120,
      })
      expect(obj.maxHealth).toBe(120)

      applyChange(obj, {
        type: 'property',
        objectId: 'test-obj',
        property: 'speed',
        delta: -30,
        prevValue: 240,
        nextValue: 210,
      })
      expect(obj.speed).toBe(210)

      applyChange(obj, {
        type: 'property',
        objectId: 'test-obj',
        property: 'colliderWidth',
        delta: 20,
        prevValue: 100,
        nextValue: 120,
      })
      expect(obj.colliderWidth).toBe(120)

      applyChange(obj, {
        type: 'property',
        objectId: 'test-obj',
        property: 'colliderHeight',
        delta: -15,
        prevValue: 150,
        nextValue: 135,
      })
      expect(obj.colliderHeight).toBe(135)
    })

    it('applies collider change by updating colliderWidth and colliderHeight', () => {
      const obj = createTestObject({ colliderWidth: 100, colliderHeight: 120 })
      applyChange(obj, {
        type: 'collider',
        objectId: 'test-obj',
        prevWidth: 100,
        prevHeight: 120,
        nextWidth: 140,
        nextHeight: 160,
      })
      expect(obj.colliderWidth).toBe(140)
      expect(obj.colliderHeight).toBe(160)
    })

    it('applies weapon property changes to target object and syncs GAME_WEAPON_CONFIG', () => {
      const weaponObj = createTestObject({
        id: 'dagger',
        attackDistance: 30,
        attackDurationMs: 200,
        holdOffsetX: 12,
        holdOffsetY: 6,
      })

      applyChange(weaponObj, {
        type: 'property',
        objectId: 'dagger',
        property: 'attackDistance',
        delta: 20,
        prevValue: 30,
        nextValue: 50,
      })
      expect(weaponObj.attackDistance).toBe(50)
      expect(GAME_WEAPON_CONFIG.attackDistance).toBe(50)

      applyChange(weaponObj, {
        type: 'property',
        objectId: 'dagger',
        property: 'attackDurationMs',
        delta: 50,
        prevValue: 200,
        nextValue: 250,
      })
      expect(weaponObj.attackDurationMs).toBe(250)
      expect(GAME_WEAPON_CONFIG.attackDurationMs).toBe(250)

      applyChange(weaponObj, {
        type: 'property',
        objectId: 'dagger',
        property: 'holdOffsetX',
        delta: 8,
        prevValue: 12,
        nextValue: 20,
      })
      expect(weaponObj.holdOffsetX).toBe(20)
      expect(GAME_WEAPON_CONFIG.holdOffsetX).toBe(20)

      applyChange(weaponObj, {
        type: 'property',
        objectId: 'dagger',
        property: 'holdOffsetY',
        delta: -4,
        prevValue: 6,
        nextValue: 2,
      })
      expect(weaponObj.holdOffsetY).toBe(2)
      expect(GAME_WEAPON_CONFIG.holdOffsetY).toBe(2)
    })
    it('applies move change by delta when exact positions are omitted', () => {
      const obj = createTestObject({ x: 50, y: 50 })
      applyChange(obj, { type: 'move', objectId: 'test-obj', dx: 10, dy: -20 })
      expect(obj.x).toBe(60)
      expect(obj.y).toBe(30)
    })

    it('applies move change by exact next position when provided', () => {
      const obj = createTestObject({ x: 50, y: 50 })
      applyChange(obj, {
        type: 'move',
        objectId: 'test-obj',
        dx: 10,
        dy: -20,
        prevX: 50,
        prevY: 50,
        nextX: 150,
        nextY: 250,
      })
      expect(obj.x).toBe(150)
      expect(obj.y).toBe(250)
    })

    it('applies scale change by factor when exact dimensions are omitted', () => {
      const obj = createTestObject({ baseWidth: 100, baseHeight: 100, scaleX: 1, scaleY: 1 })
      applyChange(obj, { type: 'scale', objectId: 'test-obj', factor: 1.5 })
      expect(obj.scaleX).toBe(1.5)
      expect(obj.scaleY).toBe(1.5)
      expect(obj.displayWidth).toBe(150)
      expect(obj.displayHeight).toBe(150)
    })

    it('applies scale change by exact next dimensions when provided', () => {
      const obj = createTestObject({ displayWidth: 176, displayHeight: 176, scaleX: 1, scaleY: 1 })
      applyChange(obj, {
        type: 'scale',
        objectId: 'test-obj',
        factor: 1.1,
        prevScaleX: 1,
        prevScaleY: 1,
        prevDisplayWidth: 176,
        prevDisplayHeight: 176,
        nextScaleX: 1.1,
        nextScaleY: 1.1,
        nextDisplayWidth: 194,
        nextDisplayHeight: 194,
      })
      expect(obj.scaleX).toBe(1.1)
      expect(obj.displayWidth).toBe(194)
      expect(obj.displayHeight).toBe(194)
    })

    it('throws if target object ID does not match change object ID', () => {
      const obj = createTestObject({ id: 'obj-a' })
      expect(() => {
        applyChange(obj, { type: 'move', objectId: 'obj-b', dx: 5, dy: 5 })
      }).toThrow(/does not match change object id/)
    })
  })

  describe('EditorHistory', () => {
    it('undoes a move change by applying its reverse', () => {
      const history = new EditorHistory()
      const obj = createTestObject({ x: 100, y: 100 })

      // Original move: dx = 10, dy = 5
      const change: EditorChange = {
        type: 'move',
        objectId: 'test-obj',
        dx: 10,
        dy: 5,
        prevX: 100,
        prevY: 100,
        nextX: 110,
        nextY: 105,
      }
      applyChange(obj, change)
      expect(obj.x).toBe(110)
      expect(obj.y).toBe(105)

      history.push(change)
      const reversed = history.undo((id) => (id === obj.id ? obj : undefined))

      expect(reversed).toBeDefined()
      expect(reversed?.type).toBe('move')
      expect(obj.x).toBe(100)
      expect(obj.y).toBe(100)
    })

    it('undoes a scale change by applying its reverse', () => {
      const history = new EditorHistory()
      const obj = createTestObject({
        displayWidth: 176,
        displayHeight: 176,
        scaleX: 1,
        scaleY: 1,
      })

      // Original scale: factor = 1.1
      const change: EditorChange = {
        type: 'scale',
        objectId: 'test-obj',
        factor: 1.1,
        prevScaleX: 1,
        prevScaleY: 1,
        prevDisplayWidth: 176,
        prevDisplayHeight: 176,
        nextScaleX: 1.1,
        nextScaleY: 1.1,
        nextDisplayWidth: 194,
        nextDisplayHeight: 194,
      }
      applyChange(obj, change)
      expect(obj.displayWidth).toBe(194)

      history.push(change)
      history.undo((id) => (id === obj.id ? obj : undefined))

      expect(obj.displayWidth).toBe(176)
      expect(obj.scaleX).toBe(1)
    })

    it('undoes a property change (maxHealth and speed) by applying its reverse', () => {
      const history = new EditorHistory()
      const obj = createTestObject({ maxHealth: 100, speed: 240 })

      const healthChange: PropertyChange = {
        type: 'property',
        objectId: 'test-obj',
        property: 'maxHealth',
        delta: 20,
        prevValue: 100,
        nextValue: 120,
      }
      applyChange(obj, healthChange)
      expect(obj.maxHealth).toBe(120)
      history.push(healthChange)

      const speedChange: PropertyChange = {
        type: 'property',
        objectId: 'test-obj',
        property: 'speed',
        delta: -40,
        prevValue: 240,
        nextValue: 200,
      }
      applyChange(obj, speedChange)
      expect(obj.speed).toBe(200)
      history.push(speedChange)

      // Undo speed change
      const reversedSpeed = history.undo((id) => (id === obj.id ? obj : undefined))
      expect(reversedSpeed?.type).toBe('property')
      expect(obj.speed).toBe(240)
      expect(obj.maxHealth).toBe(120)

      // Undo health change
      const reversedHealth = history.undo((id) => (id === obj.id ? obj : undefined))
      expect(reversedHealth?.type).toBe('property')
      expect(obj.maxHealth).toBe(100)
    })

    it('undoes strikeDamage property changes', () => {
      const history = new EditorHistory()
      const obj = createTestObject({ strikeDamage: 40 })

      const damageChange: PropertyChange = {
        type: 'property',
        objectId: 'test-obj',
        property: 'strikeDamage',
        delta: 10,
        prevValue: 40,
        nextValue: 50,
      }
      applyChange(obj, damageChange)
      expect(obj.strikeDamage).toBe(50)
      history.push(damageChange)

      const reversed = history.undo((id) => (id === obj.id ? obj : undefined))
      expect(reversed?.type).toBe('property')
      expect(obj.strikeDamage).toBe(40)
    })

    it('undoes acceleration, turnaround, and friction acceleration property changes', () => {
      const history = new EditorHistory()
      const speedConfig = {
        acceleration: 800,
        frictionAcceleration: 1200,
        turnaroundAcceleration: 1600,
        maxSpeed: 240,
        [Symbol.iterator]: undefined as any,
      }
      const obj = createTestObject({
        speed: speedConfig,
        acceleration: 800,
        frictionAcceleration: 1200,
        turnaroundAcceleration: 1600,
        maxSpeed: 240,
      })

      const accelChange: PropertyChange = {
        type: 'property',
        objectId: 'test-obj',
        property: 'acceleration',
        delta: 200,
        prevValue: 800,
        nextValue: 1000,
      }
      applyChange(obj, accelChange)
      expect(obj.acceleration).toBe(1000)
      expect(obj.speed && typeof obj.speed === 'object' ? obj.speed.acceleration : 0).toBe(1000)
      history.push(accelChange)

      const turnChange: PropertyChange = {
        type: 'property',
        objectId: 'test-obj',
        property: 'turnaroundAcceleration',
        delta: -400,
        prevValue: 1600,
        nextValue: 1200,
      }
      applyChange(obj, turnChange)
      expect(obj.turnaroundAcceleration).toBe(1200)
      history.push(turnChange)

      history.undo((id) => (id === obj.id ? obj : undefined))
      expect(obj.turnaroundAcceleration).toBe(1600)

      history.undo((id) => (id === obj.id ? obj : undefined))
      expect(obj.acceleration).toBe(800)
      expect(obj.speed && typeof obj.speed === 'object' ? obj.speed.acceleration : 0).toBe(800)
    })

    it('undoes multiple changes across multiple objects in LIFO order', () => {
      const history = new EditorHistory()
      const player = createTestObject({ id: 'player', x: 50, y: 50 })
      const guard = createTestObject({ id: 'guard', x: 200, y: 200 })

      const objects = [player, guard]
      const find = (id: string) => objects.find((o) => o.id === id)

      // Move player +10 x
      const move1: EditorChange = {
        type: 'move',
        objectId: 'player',
        dx: 10,
        dy: 0,
        prevX: 50,
        prevY: 50,
        nextX: 60,
        nextY: 50,
      }
      applyChange(player, move1)
      history.push(move1)

      // Move guard -20 y
      const move2: EditorChange = {
        type: 'move',
        objectId: 'guard',
        dx: 0,
        dy: -20,
        prevX: 200,
        prevY: 200,
        nextX: 200,
        nextY: 180,
      }
      applyChange(guard, move2)
      history.push(move2)

      expect(player.x).toBe(60)
      expect(guard.y).toBe(180)

      // First undo: reverts guard
      history.undo(find)
      expect(guard.y).toBe(200)
      expect(player.x).toBe(60)

      // Second undo: reverts player
      history.undo(find)
      expect(player.x).toBe(50)
      expect(guard.y).toBe(200)

      // Third undo on empty stack does nothing and returns undefined
      const result = history.undo(find)
      expect(result).toBeUndefined()
    })

    it('respects max depth by discarding oldest entries', () => {
      const history = new EditorHistory(2)
      const obj = createTestObject()

      history.push({ type: 'move', objectId: 'test-obj', dx: 1, dy: 0 })
      history.push({ type: 'move', objectId: 'test-obj', dx: 2, dy: 0 })
      history.push({ type: 'move', objectId: 'test-obj', dx: 3, dy: 0 })

      expect(history.depth).toBe(2)
      const u1 = history.undo(() => obj)
      expect(u1?.type === 'move' && u1.dx === -3).toBe(true)
      const u2 = history.undo(() => obj)
      expect(u2?.type === 'move' && u2.dx === -2).toBe(true)
      const u3 = history.undo(() => obj)
      expect(u3).toBeUndefined()
    })

    it('returns DespawnChange when undoing a SpawnChange', () => {
      const history = new EditorHistory()
      const snapshot = createTestObject({ id: 'guard2' })
      history.push({
        type: 'spawn',
        objectId: 'guard2',
        role: 'enemy',
        snapshot,
      })

      const reversed = history.undo(() => snapshot)
      expect(reversed).toEqual({
        type: 'despawn',
        objectId: 'guard2',
        role: 'enemy',
        snapshot,
      })
    })

    it('returns SpawnChange when undoing a DespawnChange', () => {
      const history = new EditorHistory()
      const snapshot = createTestObject({ id: 'guard2' })
      history.push({
        type: 'despawn',
        objectId: 'guard2',
        role: 'enemy',
        snapshot,
      })

      const reversed = history.undo(() => undefined)
      expect(reversed).toEqual({
        type: 'spawn',
        objectId: 'guard2',
        role: 'enemy',
        snapshot,
      })
    })

    it('undoes weapon property changes and restores GAME_WEAPON_CONFIG', () => {
      const history = new EditorHistory()
      const weapon = createTestObject({
        id: 'dagger',
        attackDistance: 30,
        attackDurationMs: 200,
      })

      const change: PropertyChange = {
        type: 'property',
        objectId: 'dagger',
        property: 'attackDistance',
        delta: 20,
        prevValue: 30,
        nextValue: 50,
      }

      applyChange(weapon, change)
      expect(weapon.attackDistance).toBe(50)
      expect(GAME_WEAPON_CONFIG.attackDistance).toBe(50)

      history.push(change)
      const reversed = history.undo((id) => (id === weapon.id ? weapon : undefined))

      expect(reversed?.type).toBe('property')
      expect(weapon.attackDistance).toBe(30)
      expect(GAME_WEAPON_CONFIG.attackDistance).toBe(30)
    })

    it('undoes all weapon property types and keeps GAME_WEAPON_CONFIG synchronized', () => {
      const history = new EditorHistory()
      const weapon = createTestObject({
        id: 'dagger',
        attackDistance: 30,
        attackDurationMs: 200,
        holdOffsetX: 44,
        holdOffsetY: 38,
      })

      const changes: PropertyChange[] = [
        {
          type: 'property',
          objectId: 'dagger',
          property: 'attackDurationMs',
          delta: 100,
          prevValue: 200,
          nextValue: 300,
        },
        {
          type: 'property',
          objectId: 'dagger',
          property: 'holdOffsetX',
          delta: 10,
          prevValue: 44,
          nextValue: 54,
        },
        {
          type: 'property',
          objectId: 'dagger',
          property: 'holdOffsetY',
          delta: -8,
          prevValue: 38,
          nextValue: 30,
        },
      ]

      for (const change of changes) {
        applyChange(weapon, change)
        history.push(change)
      }

      expect(weapon.attackDurationMs).toBe(300)
      expect(weapon.holdOffsetX).toBe(54)
      expect(weapon.holdOffsetY).toBe(30)
      expect(GAME_WEAPON_CONFIG.attackDurationMs).toBe(300)
      expect(GAME_WEAPON_CONFIG.holdOffsetX).toBe(54)
      expect(GAME_WEAPON_CONFIG.holdOffsetY).toBe(30)

      // Undo holdOffsetY
      history.undo((id) => (id === weapon.id ? weapon : undefined))
      expect(weapon.holdOffsetY).toBe(38)
      expect(GAME_WEAPON_CONFIG.holdOffsetY).toBe(38)

      // Undo holdOffsetX
      history.undo((id) => (id === weapon.id ? weapon : undefined))
      expect(weapon.holdOffsetX).toBe(44)
      expect(GAME_WEAPON_CONFIG.holdOffsetX).toBe(44)

      // Undo attackDurationMs
      history.undo((id) => (id === weapon.id ? weapon : undefined))
      expect(weapon.attackDurationMs).toBe(200)
      expect(GAME_WEAPON_CONFIG.attackDurationMs).toBe(200)
    })

    it('preserves weapon properties in snapshot during spawn and despawn undo', () => {
      const history = new EditorHistory()
      const weaponSnapshot = createTestObject({
        id: 'dagger2',
        attackDistance: 45,
        attackDurationMs: 250,
        holdOffsetX: 50,
        holdOffsetY: 35,
      })

      history.push({
        type: 'spawn',
        objectId: 'dagger2',
        role: 'weapon',
        snapshot: weaponSnapshot,
      })

      const despawnReversed = history.undo(() => weaponSnapshot)
      expect(despawnReversed).toEqual({
        type: 'despawn',
        objectId: 'dagger2',
        role: 'weapon',
        snapshot: weaponSnapshot,
      })

      history.push({
        type: 'despawn',
        objectId: 'dagger-2',
        role: 'weapon',
        snapshot: weaponSnapshot,
      })

      const spawnReversed = history.undo(() => undefined)
      expect(spawnReversed).toEqual({
        type: 'spawn',
        objectId: 'dagger-2',
        role: 'weapon',
        snapshot: weaponSnapshot,
      })
      if (spawnReversed && spawnReversed.type === 'spawn') {
        expect(spawnReversed.snapshot.attackDistance).toBe(45)
        expect(spawnReversed.snapshot.attackDurationMs).toBe(250)
        expect(spawnReversed.snapshot.holdOffsetX).toBe(50)
        expect(spawnReversed.snapshot.holdOffsetY).toBe(35)
      }
    })

    it('records and reverses collider box changes', () => {
      const history = new EditorHistory()
      const playerObj = createTestObject({
        id: 'player',
        colliderWidth: 140,
        colliderHeight: 180,
      })

      history.push({
        type: 'collider',
        objectId: 'player',
        prevWidth: 110,
        prevHeight: 160,
        nextWidth: 140,
        nextHeight: 180,
      })

      const reversed = history.undo((id) => (id === 'player' ? playerObj : undefined))
      expect(reversed).toEqual({
        type: 'collider',
        objectId: 'player',
        prevWidth: 140,
        prevHeight: 180,
        nextWidth: 110,
        nextHeight: 160,
      })
      expect(playerObj.colliderWidth).toBe(110)
      expect(playerObj.colliderHeight).toBe(160)
    })
  })

  describe('computeEditorCollisionBox', () => {
    it('returns null for weapon role', () => {
      expect(computeEditorCollisionBox('weapon', 100, 100, 1, 1)).toBeNull()
    })

    it('returns scaled collision box for characters and boulders', () => {
      const enemyBox = computeEditorCollisionBox('enemy', 200, 300, 1, 1)
      expect(enemyBox).toEqual({ x: 200, y: 300, width: 110, height: 160 })

      const scaledEnemy = computeEditorCollisionBox('enemy', 200, 300, 0.5, 0.5)
      expect(scaledEnemy).toEqual({ x: 200, y: 300, width: 55, height: 80 })

      const boulderBox = computeEditorCollisionBox('object', 400, 500, 1, 1)
      expect(boulderBox).toEqual({ x: 400, y: 500, width: 120, height: 120 })
    })

    it('uses explicit colliderWidth and colliderHeight when provided', () => {
      const customBox = computeEditorCollisionBox('enemy', 200, 300, 1, 1, 150, 200)
      expect(customBox).toEqual({ x: 200, y: 300, width: 150, height: 200 })

      const customBoulder = computeEditorCollisionBox('object', 400, 500, 1, 1, 80, 90)
      expect(customBoulder).toEqual({ x: 400, y: 500, width: 80, height: 90 })

      const clampedBox = computeEditorCollisionBox('enemy', 200, 300, 1, 1, 5, 8)
      expect(clampedBox).toEqual({ x: 200, y: 300, width: 16, height: 16 })
    })
  })

  describe('wouldOverlapAnyEditorObject', () => {
    const existing = [
      { id: 'guard1', role: 'enemy' as const, x: 200, y: 200, scaleX: 1, scaleY: 1 },
      { id: 'boulder1', role: 'object' as const, x: 500, y: 200, scaleX: 1, scaleY: 1 },
      { id: 'dagger1', role: 'weapon' as const, x: 300, y: 200, scaleX: 1, scaleY: 1 },
    ]

    it('lets a weapon overlap a character or another weapon, since they pass through each other', () => {
      expect(wouldOverlapAnyEditorObject('dagger2', 'weapon', 200, 200, 1, 1, existing)).toBe(false)
      expect(wouldOverlapAnyEditorObject('dagger2', 'weapon', 300, 200, 1, 1, existing)).toBe(false)
    })

    it('does not let a weapon overlap an obstacle, which it collides with', () => {
      expect(wouldOverlapAnyEditorObject('dagger2', 'weapon', 500, 200, 1, 1, existing)).toBe(true)
    })

    it('does not let an obstacle overlap a weapon', () => {
      expect(wouldOverlapAnyEditorObject('boulder2', 'object', 300, 200, 1, 1, existing)).toBe(true)
    })

    it('returns false when testing against weapons', () => {
      // Placing player at dagger1 position (300, 200). Guard1 is at 200 (distance 100).
      // Guard width 110 (half 55), Player width 110 (half 55). 55+55 = 110 > 100.
      // So place at 350, 200: distance from guard is 150 > 110, distance from boulder is 150 > 115.
      // Dagger is at 300 (distance 50). Dagger does not cause collision!
      const result = wouldOverlapAnyEditorObject('player', 'player', 350, 200, 1, 1, existing)
      expect(result).toBe(false)
    })

    it('returns true when candidate collision box overlaps another non-weapon object', () => {
      // Guard1 is at (200, 200) with width 110, height 160.
      // Test player at (240, 200) -> distance in X is 40 < 110, distance in Y is 0 < 160 -> overlaps!
      const result = wouldOverlapAnyEditorObject('player', 'player', 240, 200, 1, 1, existing)
      expect(result).toBe(true)
    })

    it('returns false when candidate is separated or touching', () => {
      // Guard1 at (200, 200), width 110 (right edge = 255).
      // Candidate at (310, 200), width 110 (left edge = 255). Touching at 255 -> no overlap!
      const touching = wouldOverlapAnyEditorObject('player', 'player', 310, 200, 1, 1, existing)
      expect(touching).toBe(false)

      const separated = wouldOverlapAnyEditorObject('player', 'player', 350, 200, 1, 1, existing)
      expect(separated).toBe(false)
    })

    it('ignores itself by objectId', () => {
      // Testing guard1 at its own position (200, 200)
      const result = wouldOverlapAnyEditorObject('guard1', 'enemy', 200, 200, 1, 1, existing)
      expect(result).toBe(false)
    })

    it('respects custom candidate colliderWidth and colliderHeight', () => {
      // Guard1 at (200, 200), width 110 (right edge = 255).
      // Candidate at (320, 200). With default width 110 (left edge = 265), it does not overlap.
      const noOverlapDefault = wouldOverlapAnyEditorObject('player', 'player', 320, 200, 1, 1, existing)
      expect(noOverlapDefault).toBe(false)

      // With expanded candidate width 150 (half-width = 75):
      // Candidate left edge = 320 - 75 = 245 < 255 (guard right edge) -> overlaps!
      const overlapExpanded = wouldOverlapAnyEditorObject('player', 'player', 320, 200, 1, 1, existing, 150, 160)
      expect(overlapExpanded).toBe(true)
    })

    it('respects custom obstacle colliderWidth and colliderHeight', () => {
      const obstacleWithCustomCollider = [
        { id: 'guard1', role: 'enemy' as const, x: 200, y: 200, scaleX: 1, scaleY: 1, colliderWidth: 200, colliderHeight: 160 },
      ]
      // Guard1 right edge = 200 + 100 = 300.
      // Candidate player at (320, 200) with default width 110 (left edge = 320 - 55 = 265 < 300) -> overlaps!
      const result = wouldOverlapAnyEditorObject('player', 'player', 320, 200, 1, 1, obstacleWithCustomCollider)
      expect(result).toBe(true)
    })
  })

  describe('physics_attr changes', () => {
    it('inverts by swapping prev and next, including "no override"', () => {
      expect(
        invertChange({ type: 'physics_attr', objectId: 'o', key: 'drag', prevValue: undefined, nextValue: 2 }),
      ).toEqual({ type: 'physics_attr', objectId: 'o', key: 'drag', prevValue: 2, nextValue: undefined })
    })

    it('sets a value, then clears it on undo', () => {
      const obj = createTestObject({ id: 'o' })
      const change: EditorChange = {
        type: 'physics_attr',
        objectId: 'o',
        key: 'mass',
        prevValue: undefined,
        nextValue: 3,
      }
      applyChange(obj, change)
      expect(obj.mass).toBe(3)

      applyChange(obj, invertChange(change))
      expect(obj.mass).toBeUndefined()
      expect('mass' in obj).toBe(false)
    })

    it('keeps other values when one is cleared', () => {
      const obj = createTestObject({ id: 'o', drag: 1, mass: 2 })
      applyChange(obj, { type: 'physics_attr', objectId: 'o', key: 'drag', prevValue: 1, nextValue: undefined })
      expect(obj.drag).toBeUndefined()
      expect(obj.mass).toBe(2)
    })

    it('handles restitution like the other values', () => {
      const obj = createTestObject({ id: 'o' })
      applyChange(obj, { type: 'physics_attr', objectId: 'o', key: 'restitution', prevValue: undefined, nextValue: 0.8 })
      expect(obj.restitution).toBe(0.8)
    })

    it('is undone through EditorHistory', () => {
      const obj = createTestObject({ id: 'o' })
      const history = new EditorHistory()
      applyChange(obj, { type: 'physics_attr', objectId: 'o', key: 'max_velocity', prevValue: undefined, nextValue: 80 })
      history.push({ type: 'physics_attr', objectId: 'o', key: 'max_velocity', prevValue: undefined, nextValue: 80 })
      history.undo((id) => (id === 'o' ? obj : undefined))
      expect(obj.max_velocity).toBeUndefined()
    })
  })

  describe('generateNextObjectId', () => {
    it('spawns base name if no instance of the object exists', () => {
      expect(generateNextObjectId('enemy', [])).toBe('guard')
      expect(generateNextObjectId('weapon', [])).toBe('dagger')
      expect(generateNextObjectId('object', [])).toBe('boulder')
    })

    it('uses <name><num> starting at 2 as default way to spawn multi-instances', () => {
      const roomObjects = [
        { id: 'player' },
        { id: 'boulder' },
        { id: 'dagger' },
        { id: 'guard' },
        { id: 'guard2' },
        { id: 'guard3' },
      ]

      expect(generateNextObjectId('enemy', roomObjects)).toBe('guard4')
      expect(generateNextObjectId('weapon', roomObjects)).toBe('dagger2')
      expect(generateNextObjectId('object', roomObjects)).toBe('boulder2')
    })

    it('fills lowest available index when an intermediate multi-instance was deleted', () => {
      const roomObjects = [
        { id: 'guard' },
        { id: 'guard3' },
      ]
      expect(generateNextObjectId('enemy', roomObjects)).toBe('guard2')
    })

    it('supports customPrefix for arbitrary world objects', () => {
      expect(generateNextObjectId('object', [{ id: 'chest' }], 'chest')).toBe('chest2')
      expect(generateNextObjectId('object', [], 'chest')).toBe('chest')
    })
  })
})
