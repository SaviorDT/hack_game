import { ARCHER_CONFIG } from '../../content/archerConstants.ts'
import { PROCESS_IDS, WORLD_OBJECT_IDS } from '../../content/roomConstants.ts'
import { colliderTagsOf } from '../../domain/ColliderTag.ts'
import { ShapeCollisionWorld, boxFromState, type Box } from '../../domain/CollisionWorld.ts'
import { applyPlayerDefeat } from '../../domain/PlayerDefeat.ts'
import type { WorldObject } from '../../domain/WorldObject.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../TickSimulationEngine.ts'

const collision = new ShapeCollisionWorld()

interface ArcherState {
  x: number
  y: number
  alive: boolean
  attackCooldownMs?: number
  arrowIds?: string[]
  facing?: 'left' | 'right'
  passive?: boolean
}

interface ArrowState {
  x: number
  y: number
  width: number
  height: number
  alive: boolean
  flightVx: number
  flightVy: number
  /** Degrees, for drawing the arrow along its flight. */
  angle: number
  travelled: number
  shooterId: string
}

interface TargetState {
  x: number
  y: number
  width: number
  height: number
  shape?: unknown
  alive?: boolean
  equippedBy?: unknown
  health?: number
  damageSequence?: number
  lastDamageFromX?: number
}

function stateOf<T>(worldObject: WorldObject): T {
  return worldObject.state as unknown as T
}

function inRoom(context: ProcessTickContext): WorldObject[] {
  const room = context.state.rooms.find((candidate) => candidate.id === context.state.currentRoomId)
  return context.state.worldObjects.filter(
    (worldObject) => worldObject.roomId === context.state.currentRoomId && (room?.objectIds.includes(worldObject.id) ?? true),
  )
}

/** An archer stands still and shoots at the Player Character whenever its bow is ready and the player is in range. */
export class ArcherProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.archer
  readonly definitionId = PROCESS_IDS.archer

  tick(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }
    const archer = stateOf<ArcherState>(context.worldObject)
    const player = context.state.worldObjects.find((worldObject) => worldObject.id === WORLD_OBJECT_IDS.player)
    const playerState = player ? stateOf<TargetState>(player) : undefined
    if (!archer.alive || archer.passive || !player || player.roomId !== context.worldObject.roomId || !playerState?.alive) {
      return
    }

    const dx = playerState.x - archer.x
    const dy = playerState.y - archer.y
    archer.facing = dx < 0 ? 'left' : 'right'
    archer.attackCooldownMs = Math.max(0, (archer.attackCooldownMs ?? 0) - context.tickDurationMs)
    const distance = Math.hypot(dx, dy)
    if (archer.attackCooldownMs > 0 || distance > ARCHER_CONFIG.rangePx || distance === 0) {
      return
    }

    const arrow = (archer.arrowIds ?? [])
      .map((id) => context.state.worldObjects.find((worldObject) => worldObject.id === id))
      .find((candidate) => candidate && !stateOf<ArrowState>(candidate).alive)
    if (!arrow) {
      return
    }

    // Loose the arrow from just in front of the archer, aimed at where the player is now.
    const dirX = dx / distance
    const dirY = dy / distance
    const arrowState = stateOf<ArrowState>(arrow)
    arrowState.x = archer.x + dirX * 40
    arrowState.y = archer.y + dirY * 40
    arrowState.flightVx = dirX * ARCHER_CONFIG.arrowSpeed
    arrowState.flightVy = dirY * ARCHER_CONFIG.arrowSpeed
    arrowState.angle = (Math.atan2(dirY, dirX) * 180) / Math.PI
    arrowState.travelled = 0
    arrowState.alive = true
    archer.attackCooldownMs = ARCHER_CONFIG.cooldownMs
  }
}

/**
 * Moves a flying arrow in a straight line. It stops at the first wall, room edge or Obstacle (a crate or a
 * boulder blocks it), and hurts the first Character it reaches other than its archer.
 */
export class ArrowFlightProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.arrow
  readonly definitionId = PROCESS_IDS.arrow

  tick(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }
    const arrow = stateOf<ArrowState>(context.worldObject)
    if (!arrow.alive) {
      return
    }

    const dt = context.tickDurationMs / 1000
    arrow.x += arrow.flightVx * dt
    arrow.y += arrow.flightVy * dt
    arrow.travelled += Math.hypot(arrow.flightVx, arrow.flightVy) * dt
    // A small square at the arrow's tip is what hits things, whatever direction it flies.
    const speed = Math.hypot(arrow.flightVx, arrow.flightVy) || 1
    const tip: Box = {
      x: arrow.x + (arrow.flightVx / speed) * (arrow.width / 2),
      y: arrow.y + (arrow.flightVy / speed) * (arrow.width / 2),
      width: arrow.height,
      height: arrow.height,
    }

    const room = context.state.rooms.find((candidate) => candidate.id === context.state.currentRoomId)
    const bounds = room?.bounds
    const outside =
      bounds !== undefined &&
      (tip.x < bounds.left || tip.x > bounds.right || tip.y < bounds.top || tip.y > bounds.bottom)
    if (outside || arrow.travelled > ARCHER_CONFIG.rangePx + 400 || (room?.walls ?? []).some((wall) => collision.overlaps(tip, wall))) {
      arrow.alive = false
      return
    }

    for (const other of inRoom(context)) {
      if (other === context.worldObject || other.id === arrow.shooterId) {
        continue
      }
      const target = stateOf<TargetState>(other)
      const tags = colliderTagsOf(other)
      const solid = tags.some((tag) => tag.class === 'obstacle' || tag.class === 'character')
      if (!solid || target.alive === false || target.equippedBy || !collision.overlaps(tip, boxFromState(target))) {
        continue
      }
      if (tags.some((tag) => tag.class === 'character') && typeof target.health === 'number') {
        target.health = Math.max(0, target.health - ARCHER_CONFIG.arrowDamage)
        target.alive = target.health > 0
        target.damageSequence = (target.damageSequence ?? 0) + 1
        target.lastDamageFromX = arrow.x - arrow.flightVx
        applyPlayerDefeat(context.state)
      }
      arrow.alive = false
      return
    }
  }
}
