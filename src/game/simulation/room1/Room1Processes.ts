import { ROOM_IDS, ROOM_LAYOUT, WORLD_OBJECT_IDS, PROCESS_IDS } from '../../content/room1Constants.ts'
import type { PlayerSpeedConfig } from '../../content/room1.ts'
import type { CharacterState } from '../../domain/CharacterState.ts'
import { AabbCollisionWorld } from '../../domain/CollisionWorld.ts'
import { CombatService } from '../../domain/CombatService.ts'
import { weaponFor } from '../../domain/WeaponDefinition.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../TickSimulationEngine.ts'

interface PlayerState extends CharacterState {
  speed: number | PlayerSpeedConfig
  moveX: number
  moveY: number
  vx: number
  vy: number
}

interface DaggerState extends Record<string, string | number | boolean | null> {
  x: number
  y: number
  equippedBy: string | null
}

interface GuardState extends CharacterState {
  speed: number
  alerted: boolean
  chasing: boolean
  attacking: boolean
}

interface Position {
  x: number
  y: number
}

const ROOM_BOUNDS = {
  left: ROOM_LAYOUT.left,
  top: ROOM_LAYOUT.top,
  right: ROOM_LAYOUT.right,
  bottom: ROOM_LAYOUT.bottom,
}

const collision = new AabbCollisionWorld()
const combat = new CombatService(collision)

function stateOf<T extends MutableWorldObjectState>(
  context: ProcessTickContext,
): T {
  return getMutableWorldObjectState<T>(context.worldObject)
}

function objectState<T extends MutableWorldObjectState>(
  context: ProcessTickContext,
  id: string,
): T | undefined {
  const worldObject = context.state.worldObjects.find((candidate) => candidate.id === id)
  if (!worldObject) {
    return undefined
  }

  return getMutableWorldObjectState<T>(worldObject)
}

function boxOf(character: CharacterState) {
  return { x: character.x, y: character.y, width: character.width, height: character.height }
}

function moveToward(position: Position, target: Position, speed: number, tickDurationMs: number): void {
  const deltaX = target.x - position.x
  const deltaY = target.y - position.y
  const remainingDistance = Math.hypot(deltaX, deltaY)
  const maxDistance = (speed * tickDurationMs) / 1000

  if (remainingDistance <= maxDistance || remainingDistance === 0) {
    position.x = target.x
    position.y = target.y
    return
  }

  position.x += (deltaX / remainingDistance) * maxDistance
  position.y += (deltaY / remainingDistance) * maxDistance
}

export class PlayerMovementProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.player
  readonly definitionId = PROCESS_IDS.player

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    // The player process runs once per tick, so it also counts down every character's attack cooldown.
    combat.advanceCooldowns(context.state, context.tickDurationMs)

    const player = stateOf<PlayerState>(context)
    if (!player.alive) {
      return
    }

    const dt = context.tickDurationMs / 1000

    if (typeof player.speed === 'object' && player.speed !== null) {
      const speedConfig = player.speed as PlayerSpeedConfig
      const maxSpeed = speedConfig.maxSpeed
      const accel = speedConfig.acceleration
      const friction = speedConfig.frictionAcceleration ?? accel
      const turnaround = speedConfig.turnaroundAcceleration ?? (accel * 2)

      let vx = (player.vx as number) ?? 0
      let vy = (player.vy as number) ?? 0

      // X axis
      const inputX = player.moveX
      if (inputX !== 0) {
        const targetVx = inputX * maxSpeed
        const isOpposing = (inputX > 0 && vx < 0) || (inputX < 0 && vx > 0)
        const currentAccel = isOpposing ? turnaround : accel
        if (inputX > 0) {
          vx = Math.min(targetVx, vx + currentAccel * dt)
        } else {
          vx = Math.max(targetVx, vx - currentAccel * dt)
        }
      } else {
        if (vx > 0) {
          vx = Math.max(0, vx - friction * dt)
        } else if (vx < 0) {
          vx = Math.min(0, vx + friction * dt)
        }
      }

      // Y axis
      const inputY = player.moveY
      if (inputY !== 0) {
        const targetVy = inputY * maxSpeed
        const isOpposing = (inputY > 0 && vy < 0) || (inputY < 0 && vy > 0)
        const currentAccel = isOpposing ? turnaround : accel
        if (inputY > 0) {
          vy = Math.min(targetVy, vy + currentAccel * dt)
        } else {
          vy = Math.max(targetVy, vy - currentAccel * dt)
        }
      } else {
        if (vy > 0) {
          vy = Math.max(0, vy - friction * dt)
        } else if (vy < 0) {
          vy = Math.min(0, vy + friction * dt)
        }
      }

      const nextBox = {
        x: player.x + vx * dt,
        y: player.y + vy * dt,
        width: player.width,
        height: player.height,
      }
      const clamped = collision.clampToBounds(nextBox, ROOM_BOUNDS)
      if (clamped.x !== nextBox.x) {
        vx = 0
      }
      if (clamped.y !== nextBox.y) {
        vy = 0
      }

      player.x = clamped.x
      player.y = clamped.y
      player.vx = vx
      player.vy = vy
    } else {
      const speed = typeof player.speed === 'number' ? player.speed : 240
      const distance = (speed * context.tickDurationMs) / 1000
      player.x += player.moveX * distance
      player.y += player.moveY * distance
      Object.assign(player, collision.clampToBounds(boxOf(player), ROOM_BOUNDS))
    }

    const exit = context.state.rooms
      .find((room) => room.id === ROOM_IDS.first)
      ?.exits.find((candidate) => candidate.x === ROOM_LAYOUT.exit.x && candidate.y === ROOM_LAYOUT.exit.y)
    if (exit && collision.gap(boxOf(player), ROOM_LAYOUT.exitZone) === 0) {
      context.state.currentRoomId = exit.targetRoomId
      context.state.outcome = 'congratulations'
    }
  }
}

export class DaggerPickupProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.dagger
  readonly definitionId = PROCESS_IDS.dagger

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    const dagger = stateOf<DaggerState>(context)
    if (!dagger.equippedBy) {
      return
    }

    const holder = objectState<CharacterState>(context, dagger.equippedBy)
    if (holder) {
      dagger.x = holder.x + 44
      dagger.y = holder.y + 38
    }
  }
}

export class GuardResponseProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.guard
  readonly definitionId = PROCESS_IDS.guard

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    const guard = stateOf<GuardState>(context)
    const player = objectState<PlayerState>(context, WORLD_OBJECT_IDS.player)
    if (!guard.alive || !player || !player.alive) {
      return
    }

    if (player.x < ROOM_LAYOUT.rightHalfStartX) {
      guard.chasing = false
      guard.attacking = false
      return
    }

    guard.discovered = true
    guard.alerted = true
    guard.chasing = true

    const reach = weaponFor(guard.weaponId).reach
    if (collision.gap(boxOf(guard), boxOf(player)) > reach) {
      moveToward(guard, player, guard.speed, context.tickDurationMs)
    }

    const attack = combat.attack(context.state, context.worldObject.id)
    guard.attacking = attack.status === 'hit'

    if (!player.alive) {
      player.moveX = 0
      player.moveY = 0
      player.vx = 0
      player.vy = 0
      context.state.outcome = 'game-over'
    }
  }
}

export const ROOM1_PROCESSES: readonly WorldObjectProcess[] = [
  new PlayerMovementProcess(),
  new DaggerPickupProcess(),
  new GuardResponseProcess(),
]
