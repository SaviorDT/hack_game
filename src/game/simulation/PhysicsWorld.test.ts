import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import { defaultColliderTags } from '../domain/ColliderTag.ts'
import type { Bounds } from '../domain/CollisionWorld.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { GAME_PHYSICS_CONFIG, type PhysicsConfig } from './physicsConstants.ts'
import { applyForce, PhysicsWorld, type PhysicsCollision } from './PhysicsWorld.ts'

const TICK_MS = 1000 / 60
const DT = TICK_MS / 1000

type Role = 'player' | 'enemy' | 'weapon' | 'object'
type Body = { [key: string]: unknown; x: number; y: number; vx: number; vy: number }

const WIDE_OPEN: Bounds = { left: 0, top: 0, right: 5000, bottom: 5000 }

function createWorld(
  config: Partial<PhysicsConfig> = {},
  bounds: Bounds | undefined = WIDE_OPEN,
) {
  const objects: WorldObject[] = []
  const state: WorldState = {
    rooms: [{ id: 'room1', objectIds: [], exits: [], state: {}, ...(bounds ? { bounds } : {}) }],
    worldObjects: objects,
    processInstances: [],
    currentRoomId: 'room1',
    commandHistory: [],
    simulationTick: 0,
    outcome: 'playing',
  }
  const physics = new PhysicsWorld(() => ({ ...GAME_PHYSICS_CONFIG, friction: 0, ...config }) as PhysicsConfig)
  const add = (id: string, role: Role, fields: Record<string, unknown> = {}) => {
    const object = new BasicWorldObject(
      id,
      'room1',
      { name: id, role, colliderTags: defaultColliderTags(role) },
      [],
      { x: 500, y: 500, width: 100, height: 100, vx: 0, vy: 0, ...fields },
    )
    objects.push(object)
    return { object, body: object.state as unknown as Body }
  }
  const step = (ticks = 1) => {
    for (let i = 0; i < ticks; i++) physics.step(state, TICK_MS)
  }
  return { state, physics, add, step }
}

describe('PhysicsWorld motion', () => {
  it('turns a force into acceleration (force / mass), then moves with the new velocity', () => {
    const { add, step } = createWorld({ drag: 0 })
    const { object, body } = add('guard', 'enemy', { mass: 2 })

    applyForce(object, 1000, 0)
    step()

    expect(body.vx).toBeCloseTo((1000 / 2) * DT, 6)
    expect(body.vy).toBe(0)
    expect(body.x).toBeCloseTo(500 + (1000 / 2) * DT * DT, 6)
  })

  it('adds up several forces and forgets them after the tick', () => {
    const { add, step } = createWorld({ drag: 0 })
    const { object, body } = add('guard', 'enemy')

    applyForce(object, 600, 0)
    applyForce(object, 400, 300)
    step()
    expect(body.vx).toBeCloseTo(1000 * DT, 6)
    expect(body.vy).toBeCloseTo(300 * DT, 6)

    const vx = body.vx
    step()
    expect(body.vx).toBe(vx) // no force this tick, no drag: it keeps coasting
  })

  it('applies drag after the forces and never lets it reverse the velocity', () => {
    const { add, step } = createWorld({ drag: 0.5, min_velocity: 0 })
    const { object, body } = add('guard', 'enemy', { vy: 300 })

    applyForce(object, 0, 6000)
    step()
    expect(body.vy).toBeCloseTo((300 + 6000 * DT) * (1 - 0.5 * DT), 6)

    const huge = createWorld({ drag: 1000, min_velocity: 0 })
    const fast = huge.add('guard', 'enemy', { vx: 100 })
    huge.step()
    expect(fast.body.vx).toBe(0)
  })

  it('caps the speed at max_velocity, preferring the object override', () => {
    const { add, step } = createWorld({ drag: 0, max_velocity: 500 })
    const free = add('a', 'enemy', { y: 100 })
    const capped = add('b', 'enemy', { y: 300, max_velocity: 80 })

    for (let i = 0; i < 10; i++) {
      applyForce(free.object, 100000, 0)
      applyForce(capped.object, 100000, 0)
      step()
    }

    expect(Math.hypot(free.body.vx, free.body.vy)).toBeCloseTo(500, 6)
    expect(Math.hypot(capped.body.vx, capped.body.vy)).toBeCloseTo(80, 6)
  })

  it('slows a body with ground friction on top of drag', () => {
    const { add, step } = createWorld({ drag: 0.5, friction: 5, min_velocity: 0 })
    const { body } = add('guard', 'enemy', { vx: 300 })

    step()

    expect(body.vx).toBeCloseTo(300 * (1 - (0.5 + 5) * DT), 6)
  })

  it('prefers the friction of the object over the default', () => {
    const { add, step } = createWorld({ drag: 0, friction: 5, min_velocity: 0 })
    const slippery = add('a', 'enemy', { y: 100, vx: 300, friction: 0 })
    const rough = add('b', 'enemy', { y: 300, vx: 300, friction: 10 })

    step()

    expect(slippery.body.vx).toBe(300)
    expect(rough.body.vx).toBeCloseTo(300 * (1 - 10 * DT), 6)
  })

  it('ignores ground friction while the body is Thrown, but not drag', () => {
    const { add, step } = createWorld({ drag: 0.5, friction: 5, min_velocity: 0 })
    const { body } = add('dagger', 'weapon', { vx: 300, thrown: { targetX: 900, targetY: 500 } })

    step()

    expect(body.vx).toBeCloseTo(300 * (1 - 0.5 * DT), 6)
  })

  it('does not cap a speed that did not come from a Force, such as one a Collision gave', () => {
    const { add, step } = createWorld({ drag: 0, max_velocity: 1000 })
    const { body } = add('guard', 'enemy', { vx: 1500 })

    step(3)

    expect(body.vx).toBe(1500)
  })

  it('does not let a Force add speed to a body that is already beyond max_velocity', () => {
    const { add, step } = createWorld({ drag: 0, max_velocity: 1000 })
    const { object, body } = add('guard', 'enemy', { vx: 1500 })

    applyForce(object, 100000, 0)
    step()

    expect(body.vx).toBe(1500)
  })

  it('still lets a Force slow a body that is beyond max_velocity', () => {
    const { add, step } = createWorld({ drag: 0, max_velocity: 1000 })
    const { object, body } = add('guard', 'enemy', { vx: 1500 })

    applyForce(object, -6000, 0)
    step()

    expect(body.vx).toBeCloseTo(1500 - 6000 * DT, 6)
  })

  it('brings a slow body without force to rest, but not one that is being pushed', () => {
    const { add, step } = createWorld({ drag: 0, min_velocity: 5 })
    const coasting = add('a', 'enemy', { y: 100, vx: 4 })
    const pushed = add('b', 'enemy', { y: 300, mass: 1000 })

    applyForce(pushed.object, 1000, 0) // 1000 / 1000 * dt is far below min_velocity
    step()

    expect(coasting.body.vx).toBe(0)
    expect(pushed.body.vx).toBeGreaterThan(0)
  })

  it('keeps a body inside the room bounds and drops the speed into the edge', () => {
    const { add, step } = createWorld({ drag: 0 }, { left: 0, top: 0, right: 1000, bottom: 1000 })
    const { body } = add('guard', 'enemy', { x: 948, y: 500, vx: 400, vy: 50 })

    step()

    expect(body.x).toBe(950) // right edge 1000 - half of the width
    expect(body.vx).toBe(0)
    expect(body.vy).toBe(50)
  })

  it('does not move bodies outside the current room, dead bodies or held weapons', () => {
    const { add, step, state } = createWorld({ drag: 0 })
    const elsewhere = add('elsewhere', 'enemy', { vx: 100 })
      ; (elsewhere.object as unknown as { roomId: string }).roomId = 'room2'
    const dead = add('dead', 'enemy', { vx: 100, alive: false })
    const held = add('dagger', 'weapon', { vx: 100, equippedBy: 'player' })

    step()

    expect(state.worldObjects).toHaveLength(3)
    expect(elsewhere.body.x).toBe(500)
    expect(dead.body.x).toBe(500)
    expect(held.body.x).toBe(500)
  })

  it('leaves a frozen body where it is for the tick', () => {
    const { add, step } = createWorld({ drag: 0 })
    const { object, body } = add('guard', 'enemy', { vx: 100, frozen: true })

    applyForce(object, 1000, 0)
    step()

    expect(body.x).toBe(500)
    expect(body.vx).toBe(100)
    expect(body.frozen).toBe(false)
  })
})

describe('PhysicsWorld collisions', () => {
  it('stops a body flush against an Obstacle and exchanges motion with it', () => {
    const { add, step } = createWorld({ drag: 0, restitution: 0.5 })
    const guard = add('guard', 'enemy', { x: 395, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500 })

    step()

    expect(guard.body.x).toBe(400)
    // e = 0.5 * 0.5, equal masses: the guard keeps 225 px/s and the boulder gets 375 px/s
    expect(guard.body.vx).toBeCloseTo(225, 6)
    expect(boulder.body.vx).toBeCloseTo(375, 6)
  })

  it('tells the listeners which bodies collided, along which normal and how fast', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    const guard = add('guard', 'enemy', { x: 395, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500 })

    step()

    expect(events).toHaveLength(1)
    expect(events[0].a).toBe(guard.object)
    expect(events[0].b).toBe(boulder.object)
    expect(events[0].normal.x).toBeCloseTo(1, 6)
    expect(events[0].normal.y).toBeCloseTo(0, 6)
    expect(events[0].closingSpeed).toBeCloseTo(600, 6)
  })

  it('pushes along the line between the centres, not along the blocked axis', () => {
    const { add, step } = createWorld({ drag: 0 })
    const guard = add('guard', 'enemy', { x: 395, y: 480, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500, y: 500 })

    step()

    expect(guard.body.vy).toBeLessThan(0) // knocked back and up, away from the boulder's centre
    expect(boulder.body.vy).toBeGreaterThan(0)
  })

  it('bounces off a heavy Obstacle that would hardly move', () => {
    const { add, step } = createWorld({ drag: 0, restitution: 0.5 })
    const guard = add('guard', 'enemy', { x: 395, vx: 600 })
    const boulder = add('boulder', 'object', { x: 500, mass: 100 })

    step()

    expect(boulder.body.vx).toBe(0)
    expect(guard.body.vx).toBeCloseTo(-150, 6) // -e * v with e = 0.25
  })

  it('collides a Weapon with an Obstacle', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    const dagger = add('dagger', 'weapon', { x: 395, vx: 600 })
    add('boulder', 'object', { x: 500 })

    step()

    expect(dagger.body.x).toBe(400)
    expect(events).toHaveLength(1)
  })

  it('lets a Weapon fly through a Character: no block and no collision', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    const dagger = add('dagger', 'weapon', { x: 450, vx: 600 })
    add('guard', 'enemy', { x: 500 })

    step()

    expect(dagger.body.x).toBeCloseTo(450 + 600 * DT, 6)
    expect(events).toHaveLength(0)
  })

  it('does not report bodies that are only touching or moving apart', () => {
    const { add, step, physics } = createWorld({ drag: 0 })
    const events: PhysicsCollision[] = []
    physics.onCollision((collision) => events.push(collision))
    add('guard', 'enemy', { x: 400, vx: -100 })
    add('boulder', 'object', { x: 500 })

    step()

    expect(events).toHaveLength(0)
  })

  it('pushes a body out of a body it overlaps at the start, along the shallowest axis', () => {
    const { add, step } = createWorld({ drag: 0 })
    const boulder = add('boulder', 'object', { x: 500, y: 500 })
    const dagger = add('dagger', 'weapon', { x: 540, y: 500 })
    applyForce(dagger.object, 1, 0) // the dagger is the one that is moving

    step()

    expect(dagger.body.x).toBeGreaterThanOrEqual(600)
    expect(dagger.body.y).toBe(500)
    expect(boulder.body.x).toBe(500)
  })

  it('pushes the lighter body out when neither one is moving', () => {
    const { add, step } = createWorld({ drag: 0 })
    const heavy = add('boulder', 'object', { x: 500, y: 500, mass: 10 })
    const light = add('dagger', 'weapon', { x: 540, y: 500 })

    step()

    expect(heavy.body.x).toBe(500)
    expect(light.body.x).toBe(600)
  })
})

describe('PhysicsWorld with a circle collider', () => {
  // A heavy round rock of diameter 100 at (500, 500) and a 40 px character walking right towards it.
  function walkTowardsRock(y: number) {
    const { add, step } = createWorld({ drag: 0 })
    add('rock', 'object', { mass: 1e9, shape: 'circle' })
    const walker = add('walker', 'enemy', { x: 380, y, width: 40, height: 40, mass: 1 })
    for (let i = 0; i < 120; i++) {
      applyForce(walker.object, 400, 0)
      step()
    }
    return walker.body
  }

  it('stops a character that walks straight into the middle of the rock', () => {
    expect(walkTowardsRock(500).x).toBeLessThanOrEqual(430 + 1e-6) // flush against the rock's left side
  })

  it('lets a character grazing the rock slide around its curve and carry on', () => {
    // Top edge at 547: inside the rock's bounding square (bottom 550), but only clipping the round rock.
    const walker = walkTowardsRock(567)
    expect(walker.x).toBeGreaterThan(600)
    expect(walker.y).toBeGreaterThan(567) // nudged down around the curve
  })

  it('pushes overlapping bodies apart along the contact normal', () => {
    const { add, step } = createWorld({ drag: 0 })
    add('rock', 'object', { mass: 1e9, shape: 'circle' })
    // Placed overlapping the rock diagonally (down-right).
    const crate = add('crate', 'enemy', { x: 545, y: 545, width: 40, height: 40, mass: 1 })
    step()
    const gap = Math.hypot(Math.max(0, crate.body.x - 20 - 500), Math.max(0, crate.body.y - 20 - 500)) - 50
    expect(gap).toBeGreaterThanOrEqual(-1e-6)
    // Moved diagonally, not just along one axis.
    expect(crate.body.x).toBeGreaterThan(545)
    expect(crate.body.y).toBeGreaterThan(545)
  })
})

describe('PhysicsWorld room bounds and Weapons', () => {
  const SMALL: Bounds = { left: 0, top: 0, right: 800, bottom: 800 }

  it('lets a Weapon fly out through the room edge without losing speed', () => {
    const { add, step } = createWorld({ drag: 0 }, SMALL)
    const { body } = add('dagger', 'weapon', { x: 700, width: 50, height: 50, vx: 600, vy: 0 })
    step(60)
    expect(body.x).toBeGreaterThan(SMALL.right)
    expect(body.vx).toBe(600)
  })

  it('does not tell the wall listeners when a Weapon crosses the room edge', () => {
    const { add, step, physics } = createWorld({ drag: 0 }, SMALL)
    const hits: string[] = []
    physics.onWallHit((worldObject) => hits.push(worldObject.id))
    add('dagger', 'weapon', { x: 700, width: 50, height: 50, vx: 600, vy: 0 })
    step(30)
    expect(hits).toEqual([])
  })

  it('still stops every other body at the room edge', () => {
    const { add, step } = createWorld({ drag: 0 }, SMALL)
    const { body } = add('guard', 'enemy', { x: 700, width: 100, height: 100, vx: 600, vy: 0 })
    step(60)
    expect(body.x).toBeLessThanOrEqual(SMALL.right)
    expect(body.vx).toBe(0)
  })

  it('still stops a Weapon at a wall inside the room', () => {
    const world = createWorld({ drag: 0 }, SMALL)
    world.state.rooms[0] = { ...world.state.rooms[0], walls: [{ x: 620, y: 500, width: 40, height: 2000 }] }
    const { body } = world.add('dagger', 'weapon', { x: 500, width: 100, height: 100, vx: 600, vy: 0 })
    world.step(30)
    expect(body.x).toBeCloseTo(550, 6)
    expect(body.vx).toBe(0)
  })
})

describe('PhysicsWorld walls', () => {
  function walledWorld() {
    const world = createWorld({ drag: 0 })
    // A wall from x 600 to 640, top to bottom of the open space.
    world.state.rooms[0] = { ...world.state.rooms[0], walls: [{ x: 620, y: 500, width: 40, height: 2000 }] }
    return world
  }

  it('stops a body at a wall and takes away its speed into the wall, with no bounce', () => {
    const { add, step } = walledWorld()
    const { body } = add('walker', 'enemy', { x: 500, width: 100, height: 100, vx: 600, vy: 0 })
    step(30)
    expect(body.x).toBeCloseTo(550, 6) // flush against the wall's left face
    expect(body.vx).toBe(0)
  })

  it('lets a body slide along a wall it hits at an angle', () => {
    const { add, step } = walledWorld()
    const { body } = add('walker', 'enemy', { x: 540, y: 500, width: 100, height: 100, vx: 300, vy: 300 })
    step(10)
    expect(body.x).toBeCloseTo(550, 6)
    expect(body.vy).toBeGreaterThan(0)
    expect(body.y).toBeGreaterThan(500)
  })

  it('pushes a body that overlaps a wall straight out', () => {
    const { add, step } = walledWorld()
    const { body } = add('walker', 'enemy', { x: 590, width: 100, height: 100 })
    step()
    expect(body.x).toBeCloseTo(550, 6)
  })

  it('ends a Throw that runs into a wall', () => {
    const { add, step, physics } = walledWorld()
    const { body } = add('boulder', 'object', { x: 500, width: 100, height: 100, vx: 400, thrown: { targetX: 900, targetY: 500 } })
    physics.onWallHit((worldObject) => {
      ; (worldObject.state as { thrown?: unknown }).thrown = null
    })
    step(20)
    expect(body.thrown).toBeNull()
    expect(body.x).toBeCloseTo(550, 6)
  })

  it('lets floor objects ignore walls', () => {
    const { state, step } = walledWorld()
    const plate = new BasicWorldObject('plate', 'room1', { name: 'plate', role: 'object', colliderTags: [{ class: 'floor' }] }, [], {
      x: 610,
      y: 500,
      width: 80,
      height: 80,
    })
    state.worldObjects.push(plate)
    step()
    expect((plate.state as { x: number }).x).toBe(610)
  })
})
