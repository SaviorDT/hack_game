import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import {
  accelerateToward,
  brake,
  desiredApproachVelocity,
  steerAway,
  steerToward,
} from './Drive.ts'

const TICK_MS = 1000 / 60
const DT = TICK_MS / 1000

function bodyAt(x: number, y: number, fields: Record<string, unknown> = {}) {
  const object = new BasicWorldObject('body', 'room1', { name: 'body', role: 'enemy' }, [], {
    x,
    y,
    width: 100,
    height: 100,
    vx: 0,
    vy: 0,
    friction: 0,
    ...fields,
  })
  return { object, state: object.state as unknown as Record<string, number> }
}

describe('accelerateToward', () => {
  it('pushes with mass times the acceleration limit while far from the target velocity', () => {
    const { object, state } = bodyAt(0, 0, { mass: 3 })

    accelerateToward(object, 300, 0, 2500, TICK_MS)

    expect(state.forceX).toBeCloseTo(3 * 2500, 6)
    expect(state.forceY).toBeCloseTo(0, 6)
  })

  it('only closes the remaining difference when it is smaller than one tick of acceleration', () => {
    const { object, state } = bodyAt(0, 0, { vx: 290, drag: 0 })

    accelerateToward(object, 300, 0, 2500, TICK_MS)

    expect(state.forceX).toBeCloseTo(10 / DT, 6)
  })

  it('aims for the velocity the body has after drag, so that it really reaches the target speed', () => {
    const { object, state } = bodyAt(0, 0, { vx: 290, drag: 0.5 })

    accelerateToward(object, 300, 0, 2500, TICK_MS)

    // the physics step adds the Force, then applies drag
    const velocityAfterStep = (290 + state.forceX * DT) * (1 - 0.5 * DT)
    expect(velocityAfterStep).toBeCloseTo(300, 6)
  })

  it('also makes up for ground friction, but not while Thrown', () => {
    const grounded = bodyAt(0, 0, { vx: 290, drag: 0, friction: 5 })
    accelerateToward(grounded.object, 300, 0, 2500, TICK_MS)
    expect((290 + grounded.state.forceX * DT) * (1 - 5 * DT)).toBeCloseTo(300, 6)

    const thrown = bodyAt(0, 0, { vx: 290, drag: 0, friction: 5, thrown: { targetX: 1, targetY: 1 } })
    accelerateToward(thrown.object, 300, 0, 2500, TICK_MS)
    expect(290 + thrown.state.forceX * DT).toBeCloseTo(300, 6)
  })

  it('does nothing while the body is faster than the speed gate, since it cannot slow it down', () => {
    const { object, state } = bodyAt(0, 0, { vx: 500, drag: 0 })

    accelerateToward(object, 0, 0, 2500, TICK_MS, 300)

    expect(state.forceX).toBeUndefined()
  })

  it('works below the speed gate and at exactly the gate speed', () => {
    const slow = bodyAt(0, 0, { vx: 100, drag: 0 })
    accelerateToward(slow.object, 0, 0, 2500, TICK_MS, 300)
    expect(slow.state.forceX).toBeLessThan(0)

    const exactly = bodyAt(0, 0, { vx: 300, drag: 0 })
    accelerateToward(exactly.object, 300, 0, 2500, TICK_MS, 300)
    expect(exactly.state.forceX).toBeCloseTo(0, 6)
  })

  it('brakes towards a standstill', () => {
    const { object, state } = bodyAt(0, 0, { vx: 100, vy: -100, drag: 0 })

    accelerateToward(object, 0, 0, 100, TICK_MS)

    expect(state.forceX).toBeLessThan(0)
    expect(state.forceY).toBeGreaterThan(0)
    expect(Math.hypot(state.forceX, state.forceY)).toBeCloseTo(100, 6)
  })
})

describe('desiredApproachVelocity', () => {
  it('runs at full speed towards a faraway target', () => {
    const velocity = desiredApproachVelocity({ x: 0, y: 0 }, { x: 1000, y: 0 }, 200, 2500)

    expect(velocity.vx).toBeCloseTo(200, 6)
    expect(velocity.vy).toBeCloseTo(0, 6)
  })

  it('slows down so that it can stop on the target', () => {
    const velocity = desiredApproachVelocity({ x: 0, y: 0 }, { x: 0, y: 5 }, 200, 2500)

    // the speed from which it can brake in exactly 5 px with 2500 px/s²
    expect(velocity.vy).toBeCloseTo(Math.sqrt(2 * 2500 * 5), 6)
  })

  it('wants to stand still once it is within the stop distance', () => {
    expect(desiredApproachVelocity({ x: 0, y: 0 }, { x: 5, y: 0 }, 200, 2500, 8)).toEqual({ vx: 0, vy: 0 })
  })
})

describe('steerToward and steerAway', () => {
  it('steerToward pushes towards the target', () => {
    const { object, state } = bodyAt(0, 0)

    steerToward(object, { x: 500, y: 0 }, 200, 2500, TICK_MS)

    expect(state.forceX).toBeGreaterThan(0)
  })

  it('steerAway pushes away from the point', () => {
    const { object, state } = bodyAt(0, 0)

    steerAway(object, { x: 500, y: 0 }, 200, 2500, TICK_MS)

    expect(state.forceX).toBeLessThan(0)
  })
})

describe('brake', () => {
  it('slows a body that is below its top speed', () => {
    const { object, state } = bodyAt(0, 0, { vx: 100, drag: 0 })

    brake(object, 200, 2500, TICK_MS)

    expect(state.forceX).toBeLessThan(0)
  })

  it('leaves a body that was knocked beyond its top speed alone', () => {
    const { object, state } = bodyAt(0, 0, { vx: 900, drag: 0 })

    brake(object, 200, 2500, TICK_MS)

    expect(state.forceX).toBeUndefined()
  })
})
