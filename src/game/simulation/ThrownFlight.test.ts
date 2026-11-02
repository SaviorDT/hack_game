import { describe, expect, it } from 'vitest'
import { GAME_MV_CONFIG, type MvConfig } from '../commands/mvConstants.ts'
import { createInitialWorldState } from '../content/room1WorldState.ts'
import { WORLD_OBJECT_IDS } from '../content/room1Constants.ts'
import { resolveMvAttr } from '../domain/MvAttr.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { ARRIVAL_RADIUS, ThrownFlight } from './ThrownFlight.ts'

const TICK_MS = 1000 / 60
const DT = TICK_MS / 1000

type Body = { x: number; y: number; vx?: number; vy?: number; thrown?: unknown; mv_attr?: unknown; [key: string]: unknown }

function setup(config: Partial<Record<"mv_force" | "drag" | "mass" | "max_velocity", number>> = {}) {
  const state = createInitialWorldState()
  const flight = new ThrownFlight(() => ({ ...GAME_MV_CONFIG, ...config } as MvConfig))
  const body = (id: string) =>
    getMutableWorldObjectState(state.worldObjects.find((o) => o.id === id)!) as unknown as Body
  return { state, flight, body }
}

function throwTo(body: Body, targetX: number, targetY: number): void {
  body.thrown = { targetX, targetY, targetObjectId: null, hitIds: [] }
}

function tick(flight: ThrownFlight, state: WorldState): void {
  const arrived = flight.move(state, TICK_MS)
  flight.accelerate(state, TICK_MS, arrived)
}

describe('ThrownFlight', () => {
  it('starts at rest and accelerates toward the target by force / mass', () => {
    const { state, flight, body } = setup({ mv_force: 1000, drag: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    throwTo(dagger, 1000, 500)

    tick(flight, state)
    expect(dagger.x).toBe(500) // moved with the rest velocity
    expect(dagger.vx).toBeCloseTo(1000 * DT, 6)
    expect(dagger.vy).toBeCloseTo(0, 6)

    tick(flight, state)
    expect(dagger.x).toBeCloseTo(500 + 1000 * DT * DT, 6) // moved with last tick's velocity
    expect(dagger.vx).toBeCloseTo(2000 * DT, 6)
  })

  it('divides the force by the object mass, using mv_attr over the default', () => {
    const { state, flight, body } = setup({ mv_force: 1000, drag: 0, mass: 1 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.mv_attr = { mass: 4 }
    throwTo(dagger, 1000, 500)

    tick(flight, state)
    expect(dagger.vx).toBeCloseTo((1000 / 4) * DT, 6)
  })

  it('applies drag to the existing velocity before adding the pull', () => {
    const { state, flight, body } = setup({ mv_force: 0, drag: 0.5 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.vx = 0
    dagger.vy = 300
    throwTo(dagger, 1000, 500)

    tick(flight, state)
    expect(dagger.vy).toBeCloseTo(300 * (1 - 0.5 * DT), 6)
  })

  it('does not let a huge drag reverse the velocity', () => {
    const { state, flight, body } = setup({ mv_force: 0, drag: 1000 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.vx = 100
    dagger.vy = 0
    throwTo(dagger, 1000, 500)

    tick(flight, state)
    expect(dagger.vx).toBe(0)
  })

  it('caps speed at max_velocity, preferring the object override', () => {
    const { state, flight, body } = setup({ mv_force: 100000, drag: 0, max_velocity: 500 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 200
    dagger.y = 500
    dagger.mv_attr = { max_velocity: 80 }
    throwTo(dagger, 1700, 500)

    for (let i = 0; i < 10; i++) tick(flight, state)
    expect(Math.hypot(dagger.vx ?? 0, dagger.vy ?? 0)).toBeCloseTo(80, 6)

    delete dagger.mv_attr
    tick(flight, state)
    expect(Math.hypot(dagger.vx ?? 0, dagger.vy ?? 0)).toBeCloseTo(500, 6)
  })

  it('keeps inertia when re-aimed: velocity is a vector, not snapped to the target', () => {
    const { state, flight, body } = setup({ mv_force: 1000, drag: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 800
    dagger.y = 500
    dagger.vx = 400
    dagger.vy = 0
    throwTo(dagger, 100, 500) // target behind the direction of travel

    tick(flight, state)
    expect(dagger.x).toBeGreaterThan(800) // still moving right
    expect(dagger.vx).toBeCloseTo(400 - 1000 * DT, 6) // decelerating
  })

  it('snaps to the target, stops at once and clears the throw on arrival', () => {
    const { state, flight, body } = setup({ mv_force: 0, drag: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.vx = 300
    dagger.vy = 0
    throwTo(dagger, 500 + ARRIVAL_RADIUS - 1, 500)

    tick(flight, state)
    expect(dagger.x).toBe(500 + ARRIVAL_RADIUS - 1)
    expect(dagger.vx).toBe(0)
    expect(dagger.vy).toBe(0)
    expect(dagger.thrown).toBeNull()
  })

  it('reports arrival from move() so contacts still see the pre-stop speed', () => {
    const { state, flight, body } = setup({ mv_force: 0, drag: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.vx = 300
    throwTo(dagger, 505, 500)

    const arrived = flight.move(state, TICK_MS)
    expect(arrived.has(WORLD_OBJECT_IDS.dagger)).toBe(true)
    expect(dagger.vx).toBe(300)
    flight.accelerate(state, TICK_MS, arrived)
    expect(dagger.vx).toBe(0)
  })

  it('tracks a moving target object and marks it discovered on arrival', () => {
    const { state, flight, body } = setup({ mv_force: 0, drag: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    const guard = body(WORLD_OBJECT_IDS.guard)
    dagger.x = 500
    dagger.y = 500
    guard.x = 508
    guard.y = 500
    guard.discovered = false
    dagger.thrown = { targetX: 0, targetY: 0, targetObjectId: WORLD_OBJECT_IDS.guard, hitIds: [] }

    tick(flight, state)
    expect(dagger.x).toBe(508)
    expect(guard.discovered).toBe(true)
  })

  it('ignores objects that are not thrown and dead ones', () => {
    const { state, flight, body } = setup({ mv_force: 1000, drag: 0 })
    const guard = body(WORLD_OBJECT_IDS.guard)
    const x = guard.x
    tick(flight, state)
    expect(guard.x).toBe(x)

    guard.alive = false
    throwTo(guard, 0, 0)
    tick(flight, state)
    expect(guard.x).toBe(x)
  })
})

describe('resolveMvAttr', () => {
  it('falls back to the global defaults for unset fields', () => {
    const { state } = setup()
    const dagger = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    expect(resolveMvAttr(dagger, { ...GAME_MV_CONFIG, drag: 2, mass: 3, max_velocity: 7 })).toEqual({
      drag: 2,
      mass: 3,
      max_velocity: 7,
    })
    ;(dagger.state as Record<string, unknown>).mv_attr = { drag: 9 }
    expect(resolveMvAttr(dagger, { ...GAME_MV_CONFIG, drag: 2, mass: 3, max_velocity: 7 })).toEqual({
      drag: 9,
      mass: 3,
      max_velocity: 7,
    })
  })

  it('floors mass at 0.001 and leaves other values unrestricted', () => {
    const { state } = setup()
    const dagger = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    ;(dagger.state as Record<string, unknown>).mv_attr = { mass: 0, drag: -3, max_velocity: 0 }
    expect(resolveMvAttr(dagger)).toEqual({ drag: -3, mass: 0.001, max_velocity: 0 })
  })
})
