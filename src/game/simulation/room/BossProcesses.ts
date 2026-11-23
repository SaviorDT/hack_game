import { BLADE_NAME_RULES, BLADES_PER_WAVE, BOSS_CONFIG } from '../../content/bossConstants.ts'
import { PROCESS_IDS, WORLD_OBJECT_IDS } from '../../content/roomConstants.ts'
import type { CharacterCombatState } from '../../domain/CharacterState.ts'
import { ShapeCollisionWorld, boxFromState } from '../../domain/CollisionWorld.ts'
import { CombatService } from '../../domain/CombatService.ts'
import { destroyWorldObject } from '../../domain/MvLimit.ts'
import { applyPlayerDefeat } from '../../domain/PlayerDefeat.ts'
import { weaponFor } from '../../domain/WeaponDefinition.ts'
import type { WorldObject } from '../../domain/WorldObject.ts'
import { getMutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import { GUARD_ACCELERATION, accelerateToward, brake, steerToward } from '../Drive.ts'
import type { ProcessTickContext, WorldObjectProcess } from '../TickSimulationEngine.ts'

const collision = new ShapeCollisionWorld()
const combat = new CombatService(collision)

/** A Blade flies towards a point this far away, so it never "arrives" by itself. */
const BLADE_TARGET_DISTANCE = 100_000
/** A Blade this far outside the room's bounds is gone. */
const BLADE_ROOM_MARGIN = 200

export type BossMode = 'chase' | 'volley' | 'retreat' | 'dash' | 'recover'

type BossState = CharacterCombatState & {
  speed: number
  bladeIds: string[]
  bossMode: BossMode
  /** Game time spent in the current mode. */
  bossModeElapsedMs: number
  wavesFired: number
  /** The naming rule of each wave of the current volley. */
  volleyRules: string[]
  dashDirX: number
  dashDirY: number
  vx: number
  vy: number
}

interface BladeState {
  x: number
  y: number
  vx: number
  vy: number
  alive: boolean
  destroyed: boolean
  thrown: { targetX: number; targetY: number; targetObjectId: string | null } | null
  mvLimit: number
  immuneId: string
  angle: number
}

function stateOf<T>(worldObject: WorldObject): T {
  return getMutableWorldObjectState(worldObject) as unknown as T
}

function findObject(context: ProcessTickContext, id: string): WorldObject | undefined {
  return context.state.worldObjects.find((worldObject) => worldObject.id === id)
}

/** `count` distinct entries of the Blade naming rules, in random order. */
function pickRules(random: () => number, count: number): string[] {
  const rules = [...BLADE_NAME_RULES]
  for (let index = rules.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1))
    ;[rules[index], rules[other]] = [rules[other], rules[index]]
  }
  return rules.slice(0, count)
}

/**
 * The Boss alternates between three attacks. It chases and strikes; each tick it has a small chance to start a
 * volley (stand still, then fan out Blades) or a retreat followed by a straight dash. Each ends by itself and
 * returns it to the chase; a dash that hits a wall or Obstacle leaves it stunned for a moment first.
 */
export class BossProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.boss
  readonly definitionId = PROCESS_IDS.boss
  private readonly random: () => number

  constructor(random: () => number = () => Math.random()) {
    this.random = random
  }

  tick(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }
    const boss = stateOf<BossState>(context.worldObject)
    const playerObject = findObject(context, WORLD_OBJECT_IDS.player)
    const player = playerObject ? stateOf<CharacterCombatState>(playerObject) : undefined
    if (!boss.alive || !player?.alive) {
      return
    }
    boss.facing = player.x < boss.x ? 'left' : 'right'
    boss.bossModeElapsedMs += context.tickDurationMs
    switch (boss.bossMode) {
      case 'chase':
        return this.chase(context, boss, player)
      case 'volley':
        return this.volley(context, boss, player)
      case 'retreat':
        return this.retreat(context, boss, player)
      case 'dash':
        return this.dash(context, boss, player)
      case 'recover':
        return this.recover(context, boss)
    }
  }

  private enter(boss: BossState, mode: BossMode): void {
    boss.bossMode = mode
    boss.bossModeElapsedMs = 0
  }

  private chase(context: ProcessTickContext, boss: BossState, player: CharacterCombatState): void {
    const roll = this.random()
    if (roll < BOSS_CONFIG.volleyChancePerTick) {
      boss.wavesFired = 0
      boss.volleyRules = pickRules(this.random, BOSS_CONFIG.waves)
      this.enter(boss, 'volley')
      return
    }
    if (roll < BOSS_CONFIG.volleyChancePerTick + BOSS_CONFIG.retreatChancePerTick) {
      this.enter(boss, 'retreat')
      return
    }

    const reach = weaponFor(boss.weaponId).reach
    const gap = collision.gap(boxFromState(boss), boxFromState(player))
    if (gap > reach) {
      const stopDistance = Math.hypot(player.x - boss.x, player.y - boss.y) - (gap - reach)
      steerToward(context.worldObject, player, boss.speed, GUARD_ACCELERATION, context.tickDurationMs, stopDistance)
    } else {
      brake(context.worldObject, boss.speed, GUARD_ACCELERATION, context.tickDurationMs)
    }
    combat.attack(context.state, context.worldObject.id)
    applyPlayerDefeat(context.state)
  }

  private volley(context: ProcessTickContext, boss: BossState, player: CharacterCombatState): void {
    brake(context.worldObject, boss.speed, GUARD_ACCELERATION, context.tickDurationMs)
    const fired = boss.wavesFired
    const dueAtMs = BOSS_CONFIG.volleyWindUpMs + fired * BOSS_CONFIG.waveIntervalMs
    if (boss.bossModeElapsedMs < dueAtMs) {
      return
    }
    this.fireWave(context, boss, player, boss.volleyRules[fired] ?? BLADE_NAME_RULES[0])
    boss.wavesFired = fired + 1
    if (boss.wavesFired >= BOSS_CONFIG.waves) {
      this.enter(boss, 'chase')
    }
  }

  /** One Blade per fan step, aimed around the line to the player as it is now. */
  private fireWave(context: ProcessTickContext, boss: BossState, player: CharacterCombatState, rule: string): void {
    const centre = Math.atan2(player.y - boss.y, player.x - boss.x)
    for (let index = 0; index < BLADES_PER_WAVE; index += 1) {
      const offsetDeg = -BOSS_CONFIG.fanHalfAngleDeg + index * BOSS_CONFIG.fanStepDeg
      this.launchBlade(context, boss, centre + (offsetDeg * Math.PI) / 180, `${rule}${index + 1}`)
    }
  }

  /** Reuses the first Blade of the pool that is not in flight; with none free the shot is skipped. */
  private launchBlade(context: ProcessTickContext, boss: BossState, angle: number, name: string): void {
    const blade = boss.bladeIds
      .map((id) => findObject(context, id))
      .find((candidate) => candidate && stateOf<BladeState>(candidate).destroyed)
    if (!blade) {
      return
    }
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)
    const state = stateOf<BladeState>(blade)
    state.x = boss.x + dirX * BOSS_CONFIG.bladeSpawnDistance
    state.y = boss.y + dirY * BOSS_CONFIG.bladeSpawnDistance
    state.vx = dirX * BOSS_CONFIG.bladeSpeed
    state.vy = dirY * BOSS_CONFIG.bladeSpeed
    state.angle = (angle * 180) / Math.PI
    state.destroyed = false
    state.alive = true
    state.mvLimit = 1
    state.immuneId = context.worldObject.id
    state.thrown = {
      targetX: state.x + dirX * BLADE_TARGET_DISTANCE,
      targetY: state.y + dirY * BLADE_TARGET_DISTANCE,
      targetObjectId: null,
    }
    blade.rename(name)
  }

  private retreat(context: ProcessTickContext, boss: BossState, player: CharacterCombatState): void {
    const away = unitVector(boss.x - player.x, boss.y - player.y)
    accelerateToward(
      context.worldObject,
      away.x * BOSS_CONFIG.retreatSpeed,
      away.y * BOSS_CONFIG.retreatSpeed,
      GUARD_ACCELERATION,
      context.tickDurationMs,
      BOSS_CONFIG.retreatSpeed,
    )
    if (boss.bossModeElapsedMs >= BOSS_CONFIG.retreatMs) {
      // The dash goes where the player is now, in a straight line.
      const towards = unitVector(player.x - boss.x, player.y - boss.y)
      boss.dashDirX = towards.x
      boss.dashDirY = towards.y
      this.enter(boss, 'dash')
    }
  }

  private dash(context: ProcessTickContext, boss: BossState, player: CharacterCombatState): void {
    if (collision.gap(boxFromState(boss), boxFromState(player)) <= BOSS_CONFIG.dashTouchGap) {
      player.health = Math.max(0, player.health - BOSS_CONFIG.dashDamage)
      player.alive = player.health > 0
      player.damageSequence = (player.damageSequence ?? 0) + 1
      player.lastDamageFromX = boss.x
      applyPlayerDefeat(context.state)
      this.enter(boss, 'chase')
      return
    }
    const speed = Math.hypot(boss.vx, boss.vy)
    if (
      boss.bossModeElapsedMs > BOSS_CONFIG.dashGraceMs &&
      speed < BOSS_CONFIG.dashSpeed * BOSS_CONFIG.dashStalledShare
    ) {
      this.enter(boss, 'recover')
      return
    }
    accelerateToward(
      context.worldObject,
      boss.dashDirX * BOSS_CONFIG.dashSpeed,
      boss.dashDirY * BOSS_CONFIG.dashSpeed,
      BOSS_CONFIG.dashAcceleration,
      context.tickDurationMs,
    )
  }

  private recover(context: ProcessTickContext, boss: BossState): void {
    brake(context.worldObject, boss.speed, GUARD_ACCELERATION, context.tickDurationMs)
    if (boss.bossModeElapsedMs >= BOSS_CONFIG.recoverMs) {
      this.enter(boss, 'chase')
    }
  }
}

function unitVector(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y)
  return length === 0 ? { x: 1, y: 0 } : { x: x / length, y: y / length }
}

/**
 * A Blade in flight is a Thrown Weapon-tagged object, so the physics step moves it and Impact Damage hurts. This
 * process only ends it: once its Throw has ended (a wall or an Obstacle stopped it) or it has left the room, it
 * is Destroyed and goes back to the Boss's pool. A Blade the player threw ends the same way.
 */
export class BladeProcess implements WorldObjectProcess {
  readonly id = PROCESS_IDS.blade
  readonly definitionId = PROCESS_IDS.blade

  tick(context: ProcessTickContext): void {
    if (context.worldObject.roomId !== context.state.currentRoomId || context.state.outcome !== 'playing') {
      return
    }
    const blade = stateOf<BladeState>(context.worldObject)
    if (!blade.alive) {
      return
    }
    const room = context.state.rooms.find((candidate) => candidate.id === context.state.currentRoomId)
    const bounds = room?.bounds
    const outside =
      bounds !== undefined &&
      (blade.x < bounds.left - BLADE_ROOM_MARGIN ||
        blade.x > bounds.right + BLADE_ROOM_MARGIN ||
        blade.y < bounds.top - BLADE_ROOM_MARGIN ||
        blade.y > bounds.bottom + BLADE_ROOM_MARGIN)
    if (!blade.thrown || outside) {
      destroyWorldObject(context.state, context.worldObject)
    }
  }
}
