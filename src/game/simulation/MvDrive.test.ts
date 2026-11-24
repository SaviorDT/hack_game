import { describe, expect, it } from 'vitest'
import { GAME_MV_CONFIG, type MvConfig } from '../commands/mvConstants.ts'
import { createInitialWorldState } from '../content/roomWorldState.ts'
import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../content/roomConstants.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { ARRIVAL_RADIUS, MvDrive } from './MvDrive.ts'
import { GAME_PHYSICS_CONFIG, type PhysicsConfig } from './physicsConstants.ts'
import { PhysicsWorld } from './PhysicsWorld.ts'

const TICK_MS = 1000 / 60
const DT = TICK_MS / 1000

type Body = { x: number; y: number; vx?: number; vy?: number; thrown?: unknown; [key: string]: unknown }

function setup(mv: Partial<MvConfig> = {}, physics: Partial<PhysicsConfig> = {}) {
  const state = createInitialWorldState()
  const physicsConfig = { ...GAME_PHYSICS_CONFIG, drag: 0, friction: 0, ...physics } as PhysicsConfig
  const world = new PhysicsWorld(() => physicsConfig)
  const drive = new MvDrive(() => ({ ...GAME_MV_CONFIG, ...mv }) as MvConfig, () => physicsConfig)
  drive.attach(world)
  const body = (id: string) =>
    getMutableWorldObjectState(state.worldObjects.find((o) => o.id === id)!) as unknown as Body
  const tick = () => {
    drive.drive(state, TICK_MS)
    world.step(state, TICK_MS)
    drive.settle(state)
  }
  return { state, drive, world, body, tick }
}

function throwTo(body: Body, targetX: number, targetY: number, targetObjectId: string | null = null): void {
  body.thrown = { targetX, targetY, targetObjectId }
}

/** x at which `blocker` sits 5 px in front of the boulder's leading edge, whatever the boulder's size. */
function blockerFiveAhead(boulder: Body, blocker: Body): number {
  return boulder.x + (boulder.width as number) / 2 + 5 + (blocker.width as number) / 2
}

/** Boulder at (500, 500) with only `guard_b` left alive as an obstacle at (700, 500). */
function boulderSetup(targetId: string) {
  const ctx = setup({ mv_acceleration: 1000 })
  for (const id of ['player', 'guard_a', 'guard_b', 'guard_c']) {
    ctx.body(id).alive = false
  }
  const boulder = ctx.body(WORLD_OBJECT_IDS.boulder)
  boulder.x = 500
  boulder.y = 500
  boulder.vx = 400
  boulder.vy = 0
  const blocker = ctx.body('guard_b')
  blocker.alive = true
  blocker.x = 700
  blocker.y = 500
  blocker.discovered = false
  const target = ctx.body(targetId)
  boulder.thrown = { targetX: target.x, targetY: target.y, targetObjectId: targetId }
  return { ...ctx, boulder, blocker }
}

describe('MvDrive', () => {
  it('starts at rest and accelerates toward the target by force / mass', () => {
    const { tick, body } = setup({ mv_acceleration: 1000 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    throwTo(dagger, 1000, 500)

    tick()
    expect(dagger.vx).toBeCloseTo(1000 * DT, 6)
    expect(dagger.vy).toBeCloseTo(0, 6)
    expect(dagger.x).toBeCloseTo(500 + 1000 * DT * DT, 6)

    tick()
    expect(dagger.vx).toBeCloseTo(2000 * DT, 6)
  })

  it('accelerates by mv_acceleration whatever the mass, so mass only matters in Collisions', () => {
    const { tick, body } = setup({ mv_acceleration: 1000 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.mass = 4
    throwTo(dagger, 1000, 500)

    tick()
    expect(dagger.vx).toBeCloseTo(1000 * DT, 6)
  })

  it('keeps inertia when re-aimed: velocity is a vector, not snapped to the target', () => {
    const { tick, body } = setup({ mv_acceleration: 1000 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 800
    dagger.y = 500
    dagger.vx = 400
    dagger.vy = 0
    throwTo(dagger, 100, 500)

    tick()
    expect(dagger.x).toBeGreaterThan(800)
    expect(dagger.vx).toBeCloseTo(400 - 1000 * DT, 6)
  })

  it('snaps to the target, stops at once and clears the throw on arrival', () => {
    const { tick, body } = setup({ mv_acceleration: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.vx = 300
    dagger.vy = 0
    throwTo(dagger, 500 + ARRIVAL_RADIUS - 1, 500)

    tick()
    expect(dagger.x).toBe(500 + ARRIVAL_RADIUS - 1)
    expect(dagger.vx).toBe(0)
    expect(dagger.vy).toBe(0)
    expect(dagger.thrown).toBeNull()
  })

  it('keeps the arriving speed until contacts have been resolved', () => {
    const { drive, world, state, body } = setup({ mv_acceleration: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    dagger.vx = 300
    throwTo(dagger, 505, 500)

    drive.drive(state, TICK_MS)
    world.step(state, TICK_MS)
    expect(dagger.x).toBe(505)
    expect(dagger.vx).toBe(300)
    expect(dagger.thrown).not.toBeNull()

    drive.settle(state)
    expect(dagger.vx).toBe(0)
    expect(dagger.thrown).toBeNull()
  })

  it('tracks a moving target object and marks it discovered on arrival', () => {
    const { tick, body } = setup({ mv_acceleration: 0 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    const guard = body(WORLD_OBJECT_IDS.guard)
    dagger.x = 500
    dagger.y = 500
    guard.x = 508
    guard.y = 500
    guard.discovered = false
    throwTo(dagger, 0, 0, WORLD_OBJECT_IDS.guard)

    tick()
    expect(dagger.x).toBe(508)
    expect(guard.discovered).toBe(true)
  })

  it('ignores objects that are not thrown and dead ones', () => {
    const { tick, body } = setup({ mv_acceleration: 1000 })
    const guard = body(WORLD_OBJECT_IDS.guard)
    const x = guard.x
    tick()
    expect(guard.x).toBe(x)

    guard.alive = false
    throwTo(guard, 0, 0)
    tick()
    expect(guard.x).toBe(x)
  })

  it('does not pull an object any more once its Throw has ended', () => {
    const { tick, body } = setup({ mv_acceleration: 1000 })
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 500
    dagger.y = 500
    throwTo(dagger, 1000, 500)
    tick()
    dagger.thrown = null
    const vx = dagger.vx

    tick()
    expect(dagger.vx).toBe(vx)
  })

  it('lets a thrown Weapon fly through a Character', () => {
    const { tick, body } = setup({ mv_acceleration: 0 })
    for (const id of ['player', 'guard_b', 'guard_c', 'boulder']) {
      body(id).alive = false
    }
    const guard = body('guard_a')
    guard.x = 700
    guard.y = 500
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.x = 650
    dagger.y = 500
    dagger.vx = 600
    throwTo(dagger, 1000, 500)

    tick()
    expect(dagger.x).toBeCloseTo(650 + 600 * DT, 6)
    expect(dagger.thrown).not.toBeNull()
  })
})

describe('MvDrive collisions', () => {
  it('ends the Throw at the first Collision and keeps the speed for the physics step', () => {
    const { tick, boulder, blocker } = boulderSetup('guard_b')
    blocker.x = blockerFiveAhead(boulder, blocker)

    tick()
    expect(boulder.thrown).toBeNull()
    expect(boulder.vx).not.toBe(0)
    expect(boulder.x).toBeLessThan(blocker.x)
  })

  it('marks the target discovered when the Collision is with the target itself', () => {
    const { tick, boulder, blocker } = boulderSetup('guard_b')
    blocker.x = blockerFiveAhead(boulder, blocker)

    tick()
    expect(boulder.thrown).toBeNull()
    expect(blocker.discovered).toBe(true)
  })

  it('does not discover the target when another object is hit first', () => {
    const { tick, boulder, blocker, body } = boulderSetup('guard_a')
    const target = body('guard_a')
    target.x = 1200
    target.y = 500
    target.discovered = false
    boulder.thrown = { targetX: 1200, targetY: 500, targetObjectId: 'guard_a' }
    blocker.x = blockerFiveAhead(boulder, blocker)

    tick()
    expect(boulder.thrown).toBeNull()
    expect(target.discovered).toBe(false)
  })

  it('never reaches a target it would collide with first: a thrown boulder stops short of a guard', () => {
    const { tick, boulder, blocker } = boulderSetup('guard_b')
    boulder.vx = 0

    for (let i = 0; i < 600 && boulder.thrown; i++) tick()

    expect(boulder.thrown).toBeNull()
    expect(Math.abs(boulder.x - blocker.x)).toBeGreaterThanOrEqual(
      ((boulder.width as number) + (blocker.width as number)) / 2 - 1e-6,
    )
  })
})

describe('MvDrive and the room', () => {
  it('uses room bounds from the world state', () => {
    const state: WorldState = createInitialWorldState()
    expect(state.rooms[0].bounds).toEqual({
      left: ROOM_LAYOUT.left,
      top: ROOM_LAYOUT.top,
      right: ROOM_LAYOUT.right,
      bottom: ROOM_LAYOUT.bottom,
    })
  })

  it('ends a Throw whose target lies outside the room once the room edge stops the object', () => {
    const { body, tick } = setup()
    for (const id of ['player', 'guard_a', 'guard_b', 'guard_c']) {
      body(id).alive = false
    }
    const boulder = body(WORLD_OBJECT_IDS.boulder)
    boulder.x = ROOM_LAYOUT.right - 200
    boulder.y = (ROOM_LAYOUT.top + ROOM_LAYOUT.bottom) / 2
    throwTo(boulder, ROOM_LAYOUT.right + 500, boulder.y)
    for (let i = 0; i < 600 && boulder.thrown; i++) {
      tick()
    }
    expect(boulder.thrown).toBeNull()
    expect(boulder.x).toBeLessThanOrEqual(ROOM_LAYOUT.right)
  })

  it('lets a Weapon fly out of the room and arrive at a target outside it', () => {
    const { body, tick } = setup()
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.mvLimit = -1
    dagger.x = ROOM_LAYOUT.right - 100
    dagger.y = (ROOM_LAYOUT.top + ROOM_LAYOUT.bottom) / 2
    const targetX = ROOM_LAYOUT.right + 500
    throwTo(dagger, targetX, dagger.y)
    for (let i = 0; i < 600 && dagger.thrown; i++) {
      tick()
    }
    expect(dagger.thrown).toBeNull()
    expect(dagger.x).toBeCloseTo(targetX, 5)
    expect(dagger.x).toBeGreaterThan(ROOM_LAYOUT.right)
  })

  it('destroys a Weapon with no throws left once its Throw ends outside the room', () => {
    const { body, tick, state } = setup()
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    dagger.mvLimit = 0
    dagger.x = ROOM_LAYOUT.right - 100
    dagger.y = (ROOM_LAYOUT.top + ROOM_LAYOUT.bottom) / 2
    throwTo(dagger, ROOM_LAYOUT.right + 500, dagger.y)
    tick()
    expect(dagger.destroyed).toBeUndefined()
    for (let i = 0; i < 600 && dagger.thrown; i++) {
      tick()
    }
    expect(dagger.destroyed).toBe(true)
    expect(dagger.alive).toBe(false)
    expect(state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)).toBeDefined()
  })
})
