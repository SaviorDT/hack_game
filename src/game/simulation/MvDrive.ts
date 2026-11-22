import { GAME_MV_CONFIG, type MvConfig } from '../commands/mvConstants.ts'
import { destroyWorldObject, isSpent } from '../domain/MvLimit.ts'
import { resolvePhysicsAttr } from '../domain/PhysicsAttr.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { GAME_PHYSICS_CONFIG, type PhysicsConfig } from './physicsConstants.ts'
import { applyForce, type PhysicsWorld } from './PhysicsWorld.ts'

/** Distance from the target centre at which a Throw counts as arrived, at least one tick's step. */
export const ARRIVAL_RADIUS = 10

export interface ThrownState {
  targetX: number
  targetY: number
  targetObjectId?: string | null
  /** Set for the tick in which the object reached the target; `settle` then ends the Throw. */
  arrived?: boolean
}

interface DriveState {
  x: number
  y: number
  vx?: number
  vy?: number
  alive?: boolean
  frozen?: boolean
  discovered?: boolean
  thrown?: ThrownState | null
  [key: string]: unknown
}

function driveStateOf(worldObject: WorldObject): DriveState | undefined {
  try {
    return getMutableWorldObjectState(worldObject) as unknown as DriveState
  } catch {
    return undefined
  }
}

/**
 * The pull of an `mv` Throw. Every tick it applies a Force of `mass × mv_acceleration` towards the target, so
 * the object speeds up the same whatever its mass; the
 * physics step does the moving. A Throw ends when the object comes within reach of the target
 * (it is placed on it and stopped) or at its first Collision (it keeps its speed and is only
 * handed over to the physics step).
 */
export class MvDrive {
  private readonly config: () => MvConfig
  private readonly physicsConfig: () => PhysicsConfig

  constructor(
    config: () => MvConfig = () => GAME_MV_CONFIG,
    physicsConfig: () => PhysicsConfig = () => GAME_PHYSICS_CONFIG,
  ) {
    this.config = config
    this.physicsConfig = physicsConfig
  }

  /** Ends the Throw of any object that collides, and discovers the target if that is what it hit. */
  attach(physics: PhysicsWorld): void {
    physics.onCollision(({ a, b }) => {
      this.endThrowOnCollision(a, b)
      this.endThrowOnCollision(b, a)
    })
    // Running into a wall ends a Throw like any Collision; nothing is discovered.
    physics.onWallHit((worldObject) => {
      const body = driveStateOf(worldObject)
      if (body?.thrown) {
        body.thrown = null
      }
    })
  }

  /** Before the physics step: tracks the target, then applies the pull or places an arriving object. */
  drive(state: WorldState, tickDurationMs: number): void {
    const dt = tickDurationMs / 1000
    const mvAcceleration = this.config().mv_acceleration
    const physicsConfig = this.physicsConfig()

    for (const { worldObject, body, thrown } of this.thrownObjects(state)) {
      this.trackTarget(state, thrown)

      const step = Math.hypot(body.vx ?? 0, body.vy ?? 0) * dt
      const deltaX = thrown.targetX - body.x
      const deltaY = thrown.targetY - body.y
      const remaining = Math.hypot(deltaX, deltaY)

      if (remaining <= Math.max(step, ARRIVAL_RADIUS)) {
        body.x = thrown.targetX
        body.y = thrown.targetY
        body.frozen = true
        thrown.arrived = true
        continue
      }

      const force = resolvePhysicsAttr(worldObject, physicsConfig).mass * mvAcceleration
      applyForce(worldObject, (force * deltaX) / remaining, (force * deltaY) / remaining)
    }
  }

  /**
   * After the contacts of the tick: stops the objects that arrived and ends their Throw, then destroys every
   * object whose Mv Limit is used up and that is no longer in flight (its Throw ended by arriving, a Collision
   * or a wall).
   */
  settle(state: WorldState): void {
    this.stopArrived(state)
    for (const worldObject of state.worldObjects) {
      if (worldObject.roomId === state.currentRoomId && isSpent(worldObject)) {
        destroyWorldObject(state, worldObject)
      }
    }
  }

  private stopArrived(state: WorldState): void {
    for (const { body, thrown } of this.thrownObjects(state)) {
      if (!thrown.arrived) {
        continue
      }
      body.vx = 0
      body.vy = 0
      body.thrown = null
      this.discover(state, thrown)
    }
  }

  private endThrowOnCollision(worldObject: WorldObject, other: WorldObject): void {
    const body = driveStateOf(worldObject)
    const thrown = body?.thrown
    if (!body || !thrown) {
      return
    }
    body.thrown = null
    if (thrown.targetObjectId === other.id) {
      const otherState = driveStateOf(other)
      if (otherState) {
        otherState.discovered = true
      }
    }
  }

  private thrownObjects(
    state: WorldState,
  ): { worldObject: WorldObject; body: DriveState; thrown: ThrownState }[] {
    const result: { worldObject: WorldObject; body: DriveState; thrown: ThrownState }[] = []
    for (const worldObject of state.worldObjects) {
      if (worldObject.roomId !== state.currentRoomId) {
        continue
      }
      const body = driveStateOf(worldObject)
      if (body?.thrown && body.alive !== false) {
        result.push({ worldObject, body, thrown: body.thrown })
      }
    }
    return result
  }

  private discover(state: WorldState, thrown: ThrownState): void {
    if (!thrown.targetObjectId) {
      return
    }
    const target = state.worldObjects.find((candidate) => candidate.id === thrown.targetObjectId)
    const targetState = target ? driveStateOf(target) : undefined
    if (targetState) {
      targetState.discovered = true
    }
  }

  private trackTarget(state: WorldState, thrown: ThrownState): void {
    if (!thrown.targetObjectId) {
      return
    }
    const target = state.worldObjects.find((candidate) => candidate.id === thrown.targetObjectId)
    const targetState = target ? driveStateOf(target) : undefined
    if (targetState) {
      thrown.targetX = targetState.x
      thrown.targetY = targetState.y
    }
  }
}
