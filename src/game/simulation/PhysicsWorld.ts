import { collidesPhysically, colliderTagsOf, isSolidTagged } from '../domain/ColliderTag.ts'
import { ShapeCollisionWorld, boxFromState, contactOf, isCircle, type Box, type Bounds, type CollisionWorld } from '../domain/CollisionWorld.ts'
import { resolveCollision } from '../domain/CollisionResponse.ts'
import { resolvePhysicsAttr, velocityDecay, type PhysicsAttr } from '../domain/PhysicsAttr.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { GAME_PHYSICS_CONFIG, type PhysicsConfig } from './physicsConstants.ts'

/** A Collision between two bodies, reported after their velocities have been exchanged. */
export interface PhysicsCollision {
  readonly a: WorldObject
  readonly b: WorldObject
  /** Unit vector from `a` to `b`. */
  readonly normal: { readonly x: number; readonly y: number }
  readonly closingSpeed: number
}

export type CollisionListener = (collision: PhysicsCollision) => void
/** Called when a body runs into a wall of its room. */
export type WallHitListener = (body: WorldObject) => void

interface BodyState {
  x: number
  y: number
  width: number
  height: number
  vx?: number
  vy?: number
  forceX?: number
  forceY?: number
  alive?: boolean
  equippedBy?: string | null
  thrown?: unknown
  frozen?: boolean
  [key: string]: unknown
}

interface Body {
  readonly object: WorldObject
  readonly state: BodyState
  readonly attr: PhysicsAttr
}

function stateOf(worldObject: WorldObject): BodyState | undefined {
  const state = worldObject.state
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return undefined
  }
  const candidate = state as Record<string, unknown>
  return typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number'
    ? (state as unknown as BodyState)
    : undefined
}

/** Adds a Force to a body for the current tick; the physics step consumes and clears it. */
export function applyForce(worldObject: WorldObject, forceX: number, forceY: number): void {
  const state = stateOf(worldObject)
  if (!state) {
    return
  }
  state.forceX = (state.forceX ?? 0) + forceX
  state.forceY = (state.forceY ?? 0) + forceY
}

/** Whether walls stop this body: anything solid does; floor objects (pressure plates) and untagged ones do not. */
function blocksWalls(worldObject: WorldObject): boolean {
  return isSolidTagged(colliderTagsOf(worldObject))
}

/** The room bounds that hold this body in: a Weapon is not held, so it can fly out of the room. */
function boundsFor(worldObject: WorldObject, bounds: Bounds | undefined): Bounds | undefined {
  return colliderTagsOf(worldObject).some((tag) => tag.class === 'weapon') ? undefined : bounds
}

/** Gap below which two bodies count as touching. */
const TOUCH_EPSILON = 1e-6

function boxOf(state: BodyState) {
  return boxFromState(state)
}

/**
 * Moves every body of the current room by the Forces applied to it this tick: adds up the Forces,
 * applies drag and the speed cap, moves the body and stops it against the bodies it collides with
 * and the room bounds. Forces are cleared at the end of the step.
 */
export class PhysicsWorld {
  private readonly config: () => PhysicsConfig
  private readonly collision: CollisionWorld
  private readonly listeners: CollisionListener[] = []
  private readonly wallListeners: WallHitListener[] = []

  constructor(
    config: () => PhysicsConfig = () => GAME_PHYSICS_CONFIG,
    collision: CollisionWorld = new ShapeCollisionWorld(),
  ) {
    this.config = config
    this.collision = collision
  }

  onCollision(listener: CollisionListener): void {
    this.listeners.push(listener)
  }

  onWallHit(listener: WallHitListener): void {
    this.wallListeners.push(listener)
  }

  step(state: WorldState, tickDurationMs: number): void {
    const dt = tickDurationMs / 1000
    const config = this.config()
    const room = state.rooms.find((candidate) => candidate.id === state.currentRoomId)
    const bounds = room?.bounds
    const walls = room?.walls ?? []
    const bodies = this.bodiesOf(state, config)

    for (const body of bodies) {
      this.integrate(body, dt, config)
    }
    this.separate(bodies, bounds, walls)
    for (const body of bodies) {
      if (!body.state.frozen) {
        this.move(body, bodies, dt, bounds, walls, config)
      }
    }

    for (const worldObject of state.worldObjects) {
      const bodyState = stateOf(worldObject)
      if (bodyState && worldObject.roomId === state.currentRoomId) {
        bodyState.forceX = 0
        bodyState.forceY = 0
        if (bodyState.frozen !== undefined) {
          bodyState.frozen = false
        }
      }
    }
  }

  private bodiesOf(state: WorldState, config: PhysicsConfig): Body[] {
    const bodies: Body[] = []
    for (const object of state.worldObjects) {
      const bodyState = stateOf(object)
      if (
        !bodyState ||
        object.roomId !== state.currentRoomId ||
        bodyState.alive === false ||
        (bodyState.equippedBy && !bodyState.thrown)
      ) {
        continue
      }
      bodies.push({ object, state: bodyState, attr: resolvePhysicsAttr(object, config) })
    }
    return bodies
  }

  private integrate(body: Body, dt: number, config: PhysicsConfig): void {
    const { state, attr } = body
    if (state.frozen) {
      return
    }
    const forceX = state.forceX ?? 0
    const forceY = state.forceY ?? 0
    const speedBefore = Math.hypot(state.vx ?? 0, state.vy ?? 0)
    let vx = (state.vx ?? 0) + (forceX / attr.mass) * dt
    let vy = (state.vy ?? 0) + (forceY / attr.mass) * dt

    // `max_velocity` only limits what a Force can add: speed that came from a Collision is not cut.
    const speedLimit = Math.max(Math.max(0, attr.max_velocity), speedBefore)
    const speed = Math.hypot(vx, vy)
    if (speed > speedLimit) {
      const scale = speedLimit / speed
      vx *= scale
      vy *= scale
    }

    const damping = Math.max(0, 1 - velocityDecay(body.object, attr) * dt)
    vx *= damping
    vy *= damping
    if ((forceX === 0 && forceY === 0) && Math.hypot(vx, vy) < config.min_velocity) {
      vx = 0
      vy = 0
    }

    state.vx = vx
    state.vy = vy
  }

  private move(
    body: Body,
    bodies: readonly Body[],
    dt: number,
    bounds: Bounds | undefined,
    walls: readonly Box[],
    config: PhysicsConfig,
  ): void {
    const { state } = body
    bounds = boundsFor(body.object, bounds)
    const next = { ...boxOf(state), x: state.x + (state.vx ?? 0) * dt, y: state.y + (state.vy ?? 0) * dt }
    const obstacles = bodies.filter((other) => other !== body && collidesPhysically(body.object, other.object))
    const solidWalls = blocksWalls(body.object) ? walls : []

    const resolved = this.collision.resolveMovement(
      boxOf(state),
      next,
      [...obstacles.map((other) => boxOf(other.state)), ...solidWalls],
      bounds,
    )

    let hitBounds = false
    if (bounds) {
      const clamped = this.collision.clampToBounds(next, bounds)
      if (clamped.x !== next.x) {
        state.vx = 0
        hitBounds = true
      }
      if (clamped.y !== next.y) {
        state.vy = 0
        hitBounds = true
      }
    }
    state.x = resolved.x
    state.y = resolved.y

    // A wall is immovable: the body loses its speed into the wall, with no bounce, like at the room bounds.
    let hitWall = false
    for (const wall of solidWalls) {
      const box = boxOf(state)
      if (this.collision.gap(box, wall) > TOUCH_EPSILON) {
        continue
      }
      const normal = this.collision.contactNormal(box, wall)
      const into = (state.vx ?? 0) * normal.x + (state.vy ?? 0) * normal.y
      if (into > 0) {
        state.vx = (state.vx ?? 0) - into * normal.x
        state.vy = (state.vy ?? 0) - into * normal.y
        hitWall = true
      }
    }
    if (hitWall || hitBounds) {
      for (const listener of this.wallListeners) {
        listener(body.object)
      }
    }

    for (const other of obstacles) {
      if (this.collision.gap(boxOf(state), boxOf(other.state)) <= TOUCH_EPSILON) {
        this.collide(body, other, config)
      }
    }
  }

  /** Exchanges motion between two touching bodies and tells the listeners, unless they are not approaching. */
  private collide(a: Body, b: Body, config: PhysicsConfig): void {
    // Boxes push along the line between centres; a circle pushes along its surface normal.
    const normal = this.collision.contactNormal(boxOf(a.state), boxOf(b.state))

    const result = resolveCollision(
      { mass: a.attr.mass, restitution: a.attr.restitution, vx: a.state.vx ?? 0, vy: a.state.vy ?? 0 },
      { mass: b.attr.mass, restitution: b.attr.restitution, vx: b.state.vx ?? 0, vy: b.state.vy ?? 0 },
      normal,
      config.min_collide_move_velocity,
    )
    if (!result) {
      return
    }

    const closingSpeed =
      ((a.state.vx ?? 0) - (b.state.vx ?? 0)) * normal.x + ((a.state.vy ?? 0) - (b.state.vy ?? 0)) * normal.y
    a.state.vx = result.a.vx
    a.state.vy = result.a.vy
    b.state.vx = result.b.vx
    b.state.vy = result.b.vy
    for (const listener of this.listeners) {
      listener({ a: a.object, b: b.object, normal, closingSpeed })
    }
  }

  /** Pushes bodies that already overlap apart along the shallowest axis, moving only one of each pair. */
  private separate(bodies: readonly Body[], bounds: Bounds | undefined, walls: readonly Box[]): void {
    // Walls never move: a body caught inside one (placed there, or arriving from a Throw) is pushed straight out.
    for (const body of bodies) {
      if (!blocksWalls(body.object)) {
        continue
      }
      for (const wall of walls) {
        const contact = contactOf(boxOf(body.state), wall)
        if (contact.distance < 0) {
          body.state.x += contact.normal.x * contact.distance
          body.state.y += contact.normal.y * contact.distance
        }
      }
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const first = bodies[i]
        const second = bodies[j]
        if (
          !collidesPhysically(first.object, second.object) ||
          !this.collision.overlaps(boxOf(first.state), boxOf(second.state))
        ) {
          continue
        }

        const mover = this.bodyToDisplace(first, second)
        const fixed = mover === first ? second : first
        if (isCircle(boxOf(first.state)) || isCircle(boxOf(second.state))) {
          // Push the mover straight out along the contact normal by the overlap depth.
          const contact = contactOf(boxOf(mover.state), boxOf(fixed.state))
          mover.state.x += contact.normal.x * contact.distance
          mover.state.y += contact.normal.y * contact.distance
          const moverBounds = boundsFor(mover.object, bounds)
          if (moverBounds) {
            Object.assign(mover.state, this.collision.clampToBounds(boxOf(mover.state), moverBounds))
          }
          continue
        }
        const penetrationX = (first.state.width + second.state.width) / 2 - Math.abs(second.state.x - first.state.x)
        const penetrationY = (first.state.height + second.state.height) / 2 - Math.abs(second.state.y - first.state.y)
        if (penetrationX <= penetrationY) {
          mover.state.x += (mover.state.x >= fixed.state.x ? 1 : -1) * penetrationX
        } else {
          mover.state.y += (mover.state.y >= fixed.state.y ? 1 : -1) * penetrationY
        }
        const moverBounds = boundsFor(mover.object, bounds)
        if (moverBounds) {
          Object.assign(mover.state, this.collision.clampToBounds(boxOf(mover.state), moverBounds))
        }
      }
    }
  }

  /** The one of two overlapping bodies that is moving, else the lighter one, else the second. */
  private bodyToDisplace(first: Body, second: Body): Body {
    const motive = (body: Body) =>
      (body.state.forceX || body.state.forceY ? 1 : 0) + (body.state.vx || body.state.vy ? 1 : 0)
    if (motive(first) !== motive(second)) {
      return motive(first) > motive(second) ? first : second
    }
    return first.attr.mass < second.attr.mass ? first : second
  }
}
