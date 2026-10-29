import { describe, expect, it } from 'vitest'
import { AabbCollisionWorld } from './CollisionWorld.ts'

const world = new AabbCollisionWorld()

describe('gap', () => {
  it('is the edge-to-edge distance between horizontally separated boxes', () => {
    const left = { x: 0, y: 0, width: 10, height: 10 }
    const right = { x: 25, y: 0, width: 10, height: 10 }

    expect(world.gap(left, right)).toBe(15)
  })

  it('is zero when boxes overlap or touch', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }

    expect(world.gap(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(0)
    expect(world.gap(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(0)
  })

  it('is the straight-line distance between nearest corners for diagonal boxes', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 }
    const b = { x: 13, y: 14, width: 10, height: 10 }

    expect(world.gap(a, b)).toBe(5)
  })
})

describe('clampToBounds', () => {
  const bounds = { left: 0, top: 0, right: 100, bottom: 50 }

  it('keeps a box fully inside the bounds', () => {
    const box = { x: 98, y: -4, width: 10, height: 10 }

    expect(world.clampToBounds(box, bounds)).toEqual({ x: 95, y: 5 })
  })

  it('leaves a box that is already inside unchanged', () => {
    const box = { x: 40, y: 20, width: 10, height: 10 }

    expect(world.clampToBounds(box, bounds)).toEqual({ x: 40, y: 20 })
  })
})

describe('nearestWithin', () => {
  const origin = { x: 0, y: 0, width: 10, height: 10 }
  const candidate = (id: string, x: number) => ({ id, box: { x, y: 0, width: 10, height: 10 } })

  it('returns the candidate with the smallest gap within the maximum gap', () => {
    const far = candidate('far', 30)
    const near = candidate('near', 14)

    expect(world.nearestWithin(origin, [far, near], 5)).toBe(near)
  })

  it('returns undefined when every candidate is beyond the maximum gap', () => {
    expect(world.nearestWithin(origin, [candidate('far', 30)], 5)).toBeUndefined()
  })

  it('accepts a candidate whose gap equals the maximum gap', () => {
    const edge = candidate('edge', 15)

    expect(world.nearestWithin(origin, [edge], 5)).toBe(edge)
  })
})
