import { getMutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../TickSimulationEngine.ts'
import { ROOM_IDS, ROOM_LAYOUT, WORLD_OBJECT_IDS, PROCESS_IDS } from '../../content/room1.ts'

type PlayerAction =
  | 'idle'
  | 'travel'
  | 'approach-exit'
  | 'collect-dagger'
  | 'lure-guard'
  | 'retreat'
  | 'attack-guard'

interface PlayerState extends Record<string, string | number | boolean | null> {
  x: number
  y: number
  speed: number
  health: number
  alive: boolean
  discovered: boolean
  action: PlayerAction
  targetRoomId: string | null
  targetExitX: number
  targetExitY: number
  weaponId: string | null
}

interface DaggerState extends Record<string, string | number | boolean | null> {
  x: number
  y: number
  discovered: boolean
  equippedBy: string | null
}

interface GuardState extends Record<string, string | number | boolean | null> {
  x: number
  y: number
  speed: number
  health: number
  alive: boolean
  discovered: boolean
  alerted: boolean
  chasing: boolean
  attacking: boolean
}

interface Position {
  x: number
  y: number
}

const WEAPON_PICKUP_RANGE = 58
const PLAYER_ATTACK_RANGE = 220
const GUARD_ATTACK_RANGE = 104
const PLAYER_RETREAT_TARGET = ROOM_LAYOUT.retreatPoint

function stateOf<T extends Record<string, string | number | boolean | null>>(
  context: ProcessTickContext,
): T {
  return getMutableWorldObjectState<T>(context.worldObject)
}

function objectState<T extends Record<string, string | number | boolean | null>>(
  context: ProcessTickContext,
  id: string,
): T | undefined {
  const worldObject = context.state.worldObjects.find((candidate) => candidate.id === id)
  if (!worldObject) {
    return undefined
  }

  return getMutableWorldObjectState<T>(worldObject)
}

function distance(from: Position, to: Position): number {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

function moveToward(
  position: Position,
  target: Position,
  speed: number,
  tickDurationMs: number,
): boolean {
  const deltaX = target.x - position.x
  const deltaY = target.y - position.y
  const remainingDistance = Math.hypot(deltaX, deltaY)
  const maxDistance = (speed * tickDurationMs) / 1000

  if (remainingDistance <= maxDistance || remainingDistance === 0) {
    position.x = target.x
    position.y = target.y
    return true
  }

  position.x += (deltaX / remainingDistance) * maxDistance
  position.y += (deltaY / remainingDistance) * maxDistance
  return false
}

export class PlayerMovementProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.player
  readonly definitionId = PROCESS_IDS.player

  tick(context: ProcessTickContext): void {
    if (context.state.currentRoomId !== ROOM_IDS.first || context.state.outcome !== 'playing') {
      return
    }

    const player = stateOf<PlayerState>(context)
    if (!player.alive || player.action === 'idle') {
      return
    }

    const dagger = objectState<DaggerState>(context, WORLD_OBJECT_IDS.dagger)
    const guard = objectState<GuardState>(context, WORLD_OBJECT_IDS.guard)

    switch (player.action) {
      case 'travel': {
        const safeRouteKnown = dagger?.discovered === true && guard?.discovered === true
        if (!safeRouteKnown) {
          player.action = 'approach-exit'
        } else if (player.weaponId === WORLD_OBJECT_IDS.dagger) {
          player.action = 'lure-guard'
        } else {
          player.action = 'collect-dagger'
        }
        return
      }
      case 'approach-exit': {
        const reachedExit = moveToward(
          player,
          { x: player.targetExitX, y: player.targetExitY },
          player.speed,
          context.tickDurationMs,
        )

        if (reachedExit && player.targetRoomId) {
          context.state.currentRoomId = player.targetRoomId
          context.state.outcome = 'congratulations'
          player.action = 'idle'
        }
        return
      }
      case 'collect-dagger': {
        if (dagger) {
          moveToward(player, dagger, player.speed, context.tickDurationMs)
        }
        return
      }
      case 'lure-guard': {
        if (!guard || !guard.alive) {
          player.action = 'approach-exit'
          return
        }

        const guardIsClose = guard.chasing && distance(player, guard) <= PLAYER_ATTACK_RANGE - 40
        if (guardIsClose) {
          player.action = 'retreat'
          return
        }

        moveToward(player, ROOM_LAYOUT.lurePoint, player.speed, context.tickDurationMs)
        return
      }
      case 'retreat': {
        const reachedSafeSide = moveToward(
          player,
          PLAYER_RETREAT_TARGET,
          player.speed,
          context.tickDurationMs,
        )

        if (reachedSafeSide) {
          player.action = 'attack-guard'
        }
        return
      }
      case 'attack-guard': {
        if (!guard || !guard.alive) {
          player.action = 'approach-exit'
          return
        }

        if (distance(player, guard) <= PLAYER_ATTACK_RANGE) {
          guard.health = 0
          guard.alive = false
          guard.chasing = false
          guard.attacking = false
          player.action = 'approach-exit'
          return
        }

        const attackPosition = {
          x: Math.min(guard.x - PLAYER_ATTACK_RANGE + 20, ROOM_LAYOUT.rightHalfStartX - 40),
          y: guard.y,
        }
        moveToward(player, attackPosition, player.speed, context.tickDurationMs)
        return
      }
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
    if (dagger.equippedBy) {
      const player = objectState<PlayerState>(context, WORLD_OBJECT_IDS.player)
      if (player) {
        dagger.x = player.x + 44
        dagger.y = player.y + 38
      }
      return
    }

    const player = objectState<PlayerState>(context, WORLD_OBJECT_IDS.player)
    if (!player || player.action !== 'collect-dagger' || !dagger.discovered) {
      return
    }

    if (distance(player, dagger) <= WEAPON_PICKUP_RANGE) {
      dagger.equippedBy = WORLD_OBJECT_IDS.player
      player.weaponId = WORLD_OBJECT_IDS.dagger
      player.action = 'lure-guard'
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

    const playerInThreatArea = player.x >= ROOM_LAYOUT.rightHalfStartX
    if (!playerInThreatArea) {
      guard.chasing = false
      guard.attacking = false
      return
    }

    guard.discovered = true
    guard.alerted = true
    guard.chasing = true
    moveToward(guard, player, guard.speed, context.tickDurationMs)

    guard.attacking = distance(guard, player) <= GUARD_ATTACK_RANGE
    if (guard.attacking && !player.weaponId) {
      player.health = 0
      player.alive = false
      player.action = 'idle'
      context.state.outcome = 'game-over'
    }
  }
}

export const ROOM1_PROCESSES: readonly WorldObjectProcess[] = [
  new PlayerMovementProcess(),
  new DaggerPickupProcess(),
  new GuardResponseProcess(),
]
