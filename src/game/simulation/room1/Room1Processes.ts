import { ROOM_IDS, ROOM_LAYOUT, WORLD_OBJECT_IDS, PROCESS_IDS } from '../../content/room1Constants.ts'
import type { CharacterState } from '../../domain/CharacterState.ts'
import { AabbCollisionWorld } from '../../domain/CollisionWorld.ts'
import { CombatService } from '../../domain/CombatService.ts'
import { weaponFor } from '../../domain/WeaponDefinition.ts'
import { getMutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../TickSimulationEngine.ts'

interface PlayerState extends CharacterState {
  speed: number
  moveX: number
  moveY: number
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

    const distance = (player.speed * context.tickDurationMs) / 1000
    player.x += player.moveX * distance
    player.y += player.moveY * distance
    Object.assign(player, collision.clampToBounds(boxOf(player), ROOM_BOUNDS))

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
      context.state.outcome = 'game-over'
    }
  }
}

export const ROOM1_PROCESSES: readonly WorldObjectProcess[] = [
  new PlayerMovementProcess(),
  new DaggerPickupProcess(),
  new GuardResponseProcess(),
]
