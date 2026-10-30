import { describe, expect, it } from 'vitest'
import {
  type EditorChange,
  type MoveChange,
  type ScalableMovableObject,
  type ScaleChange,
  EditorHistory,
  applyChange,
  invertChange,
} from './levelEditorHistory.ts'

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
  })

  describe('applyChange', () => {
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
  })
})

