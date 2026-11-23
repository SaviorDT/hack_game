export {
  DAGGER_ATTACK_DISTANCE,
  DAGGER_ATTACK_DURATION_MS,
  computeDaggerAttackTranslation,
  startDaggerAttackAnimation,
  GAME_WEAPON_CONFIG,
} from '../../content/weaponConstants.ts'
import {
  ROOM_LAYOUT,
  WORLD_OBJECT_IDS,
  PROCESS_IDS,
} from '../../content/roomConstants.ts'
import {
  computeDaggerAttackTranslation,
  startDaggerAttackAnimation,
  GAME_WEAPON_CONFIG,
} from '../../content/weaponConstants.ts'
import type { PlayerSpeedConfig } from '../../content/room.ts'
import type { CharacterState } from '../../domain/CharacterState.ts'
import { ShapeCollisionWorld, boxFromState } from '../../domain/CollisionWorld.ts'
import { ArcherProcess, ArrowFlightProcess } from './RangedProcesses.ts'
import { currentRoomOf, isExitOpen, isPlayerAtExit, travelThroughExit } from '../../domain/RoomTravel.ts'
import { CombatService } from '../../domain/CombatService.ts'
import { PICKUP_REACH, PickUpService } from '../../domain/PickUpService.ts'
import { applyPlayerDefeat } from '../../domain/PlayerDefeat.ts'
import { weaponFor } from '../../domain/WeaponDefinition.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import { accelerateToward, brake, GUARD_ACCELERATION, steerToward } from '../Drive.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../TickSimulationEngine.ts'

interface PlayerState extends CharacterState {
  speed: number | PlayerSpeedConfig
  moveX: number
  moveY: number
  vx: number
  vy: number
}

export interface DaggerState extends MutableWorldObjectState {
  x: number
  y: number
  width: number
  height: number
  equippedBy: string | null
  attackDurationMs: number
  attackElapsedMs: number
  attackOffsetX: number
}



interface GuardState extends CharacterState {
  speed: number
  alerted: boolean
  chasing: boolean
  attacking: boolean
}

const collision = new ShapeCollisionWorld()
const combat = new CombatService(collision)
const pickUp = new PickUpService(collision)

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

function boxOf(entity: { x: number; y: number; width: number; height: number; shape?: unknown }) {
  return boxFromState(entity)
}

/** Default walking physics for a player whose speed is only a number or has no config. */
const DEFAULT_PLAYER_SPEED: PlayerSpeedConfig = {
  acceleration: 800,
  frictionAcceleration: 1200,
  turnaroundAcceleration: 1600,
  maxSpeed: 240,
}

/** Speed above a drive's top speed that still counts as being at it, against rounding error. */
const TOP_SPEED_TOLERANCE = 0.01

/**
 * The velocity one axis should have after this tick's drive, or null when the drive does not act:
 * it speeds up towards `input × maxSpeed` (`turnaroundAcceleration` when reversing), brakes with
 * `frictionAcceleration` without input, and, like any drive, only works up to `maxSpeed`. A body
 * knocked beyond it is neither braked, turned around nor pushed further; ground friction slows it.
 */
function walkingTarget(
  velocity: number,
  input: number,
  speed: PlayerSpeedConfig,
  dt: number,
  belowTopSpeed: boolean,
): number | null {
  if (input === 0) {
    if (!belowTopSpeed) {
      return null
    }
    const friction = (speed.frictionAcceleration ?? speed.acceleration) * dt
    return velocity > 0 ? Math.max(0, velocity - friction) : Math.min(0, velocity + friction)
  }

  const target = input * speed.maxSpeed
  const beyondTarget = input > 0 ? velocity > target + TOP_SPEED_TOLERANCE : velocity < target - TOP_SPEED_TOLERANCE
  const isOpposing = (input > 0 && velocity < 0) || (input < 0 && velocity > 0)
  if (beyondTarget || (isOpposing && !belowTopSpeed)) {
    return null
  }

  const turnaround = speed.turnaroundAcceleration ?? speed.acceleration * 2
  const limit = (isOpposing ? turnaround : speed.acceleration) * dt
  return velocity + Math.sign(target - velocity) * Math.min(Math.abs(target - velocity), limit)
}

export class PlayerMovementProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.player
  readonly definitionId = PROCESS_IDS.player

  tick(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }

    // The player process runs once per tick, so it also counts down every character's attack cooldown.
    combat.advanceCooldowns(context.state, context.tickDurationMs)

    const player = stateOf<PlayerState>(context)
    if (!player.alive) {
      return
    }

    if (player.moveX !== 0) {
      player.facing = player.moveX < 0 ? 'left' : 'right'
    }

    const speed: PlayerSpeedConfig =
      typeof player.speed === 'object' && player.speed !== null
        ? (player.speed as PlayerSpeedConfig)
        : { ...DEFAULT_PLAYER_SPEED, maxSpeed: typeof player.speed === 'number' ? player.speed : 240 }
    const dt = context.tickDurationMs / 1000
    const vx = (player.vx as number) ?? 0
    const vy = (player.vy as number) ?? 0

    // Walking is a Force that adds to whatever else is pushing the player (a Throw, a Collision).
    const belowTopSpeed = Math.hypot(vx, vy) <= speed.maxSpeed + TOP_SPEED_TOLERANCE
    accelerateToward(
      context.worldObject,
      walkingTarget(vx, player.moveX, speed, dt, belowTopSpeed),
      walkingTarget(vy, player.moveY, speed, dt, belowTopSpeed),
      Number.POSITIVE_INFINITY,
      context.tickDurationMs,
    )
  }

  afterPhysics(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }

    const player = stateOf<PlayerState>(context)
    if (!player.alive) {
      return
    }

    if (player.weaponId === null) {
      pickUp.pickUp(context.state, context.worldObject.id)
    }

    // Walking into an open Exit takes the player through it; a locked one is just a doorway.
    const room = currentRoomOf(context.state)
    const exit = room?.exits.find((candidate) => isPlayerAtExit(context.state, candidate, 0, context.worldObject.id))
    if (room && exit && isExitOpen(context.state, room, exit)) {
      travelThroughExit(context.state, exit, context.worldObject.id)
    }
  }
}

export class DaggerPickupProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.dagger
  readonly definitionId = PROCESS_IDS.dagger

  tick(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }

    const dagger = stateOf<DaggerState>(context)
    if (!dagger.equippedBy) {
      const playerObj = context.state.worldObjects.find((candidate) => candidate.id === WORLD_OBJECT_IDS.player)
      if (playerObj) {
        const player = getMutableWorldObjectState<PlayerState>(playerObj)
        if (player.alive && player.weaponId === null) {
          if (collision.gap(boxOf(player), boxOf(dagger)) <= PICKUP_REACH) {
            pickUp.pickUp(context.state, WORLD_OBJECT_IDS.player)
          }
        }
      }
    }

    if (!dagger.equippedBy) {
      const daggerRecord = dagger as unknown as Record<string, unknown>
      daggerRecord.attackDurationMs = 0
      daggerRecord.attackElapsedMs = 0
      daggerRecord.attackOffsetX = 0
      return
    }

    const equippedRecord = dagger as unknown as Record<string, unknown>
    if (!equippedRecord.thrown) {
      equippedRecord.vx = 0
      equippedRecord.vy = 0
    }
    const holder = objectState<CharacterState>(context, dagger.equippedBy)
    if (holder) {
      const daggerRecord = dagger as unknown as Record<string, unknown>
      const duration = typeof daggerRecord.attackDurationMs === 'number' ? daggerRecord.attackDurationMs : 0
      let attackOffsetX = 0

      if (duration > 0) {
        const elapsed = ((daggerRecord.attackElapsedMs as number) ?? 0) + context.tickDurationMs
        if (elapsed >= duration) {
          daggerRecord.attackDurationMs = 0
          daggerRecord.attackElapsedMs = 0
          daggerRecord.attackOffsetX = 0
        } else {
          daggerRecord.attackElapsedMs = elapsed
          const maxDist =
            typeof daggerRecord.weaponAttackDistance === 'number'
              ? daggerRecord.weaponAttackDistance
              : typeof daggerRecord.attackDistance === 'number'
                ? daggerRecord.attackDistance
                : GAME_WEAPON_CONFIG.attackDistance
          const translation = computeDaggerAttackTranslation(elapsed, duration, maxDist)
          const isHolderFacingLeft = holder.facing === 'left'
          attackOffsetX = isHolderFacingLeft ? -translation : translation
          daggerRecord.attackOffsetX = attackOffsetX
        }
      } else {
        daggerRecord.attackOffsetX = 0
      }

    }
  }

  afterPhysics(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }

    // A held Weapon follows its holder, who has just moved.
    const dagger = stateOf<DaggerState>(context)
    const holder = dagger.equippedBy ? objectState<CharacterState>(context, dagger.equippedBy) : undefined
    if (holder) {
      const daggerRecord = dagger as unknown as Record<string, unknown>
      if (daggerRecord.thrown) {
        pickUp.unequipIfOutOfReach(context.state, context.worldObject.id)
      } else {
        dagger.x = holder.x + dagger.attackOffsetX
        dagger.y = holder.y
      }
    }
  }
}

export class GuardResponseProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.guard
  readonly definitionId = PROCESS_IDS.guard

  tick(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }

    const guard = stateOf<GuardState>(context)
    const player = objectState<PlayerState>(context, WORLD_OBJECT_IDS.player)
    if (!guard.alive || !player || !player.alive) {
      return
    }

    // A passive guard (a training dummy) stands still and never fights back.
    if ((guard as unknown as { passive?: unknown }).passive === true) {
      guard.chasing = false
      guard.attacking = false
      brake(context.worldObject, guard.speed, GUARD_ACCELERATION, context.tickDurationMs)
      return
    }

    if (player.x < ROOM_LAYOUT.rightHalfStartX) {
      guard.chasing = false
      guard.attacking = false
      brake(context.worldObject, guard.speed, GUARD_ACCELERATION, context.tickDurationMs)
      return
    }

    guard.alerted = true
    guard.chasing = true

    const reach = weaponFor(guard.weaponId).reach
    const gap = collision.gap(boxOf(guard), boxOf(player))
    if (gap > reach) {
      // Slow down to stop with the target just within reach (centre distance minus the gap still to close).
      const stopDistance = Math.hypot(player.x - guard.x, player.y - guard.y) - (gap - reach)
      steerToward(context.worldObject, player, guard.speed, GUARD_ACCELERATION, context.tickDurationMs, stopDistance)
    } else {
      brake(context.worldObject, guard.speed, GUARD_ACCELERATION, context.tickDurationMs)
    }

    const attack = combat.attack(context.state, context.worldObject.id)
    guard.attacking = attack.status === 'hit'
    if (guard.attacking && guard.weaponId === 'dagger') {
      const daggerObj = context.state.worldObjects.find(
        (o) =>
          (o.id === WORLD_OBJECT_IDS.dagger || o.metadata.role === 'weapon') &&
          (o.state as Record<string, unknown>).equippedBy === context.worldObject.id,
      )
      if (daggerObj) {
        startDaggerAttackAnimation(getMutableWorldObjectState<DaggerState>(daggerObj))
      }
    }

    applyPlayerDefeat(context.state)
  }
}

/** An Obstacle: it only moves when something pushes it or `acc` pulls it; it has no behavior of its own yet. */
export class BoulderProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.boulder
  readonly definitionId = PROCESS_IDS.boulder

  canRun(context: ProcessTickContext): boolean {
    return context.worldObject.roomId === context.state.currentRoomId
  }

  tick(): void { }
}

export const ROOM_PROCESSES: readonly WorldObjectProcess[] = [
  new PlayerMovementProcess(),
  new DaggerPickupProcess(),
  new GuardResponseProcess(),
  new BoulderProcess(),
  new ArcherProcess(),
  new ArrowFlightProcess(),
]
