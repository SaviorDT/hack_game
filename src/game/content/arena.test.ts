import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoomSession } from './createRoomSession.ts'
import { ARENA_DEFINITION, ARENA_IDS, ARENA_PLATES } from './arena.ts'
import { BLADES_PER_BOSS, BLADES_PER_WAVE, BLADE_NAME_RULES, BOSS_CONFIG } from './bossConstants.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { createGameWorldState } from './tutorialRooms.ts'
import { getRoomDirectoryEntries } from '../commands/RoomDirectory.ts'
import type { GameSession } from '../application/GameSession.ts'
import { colliderTagsOf } from '../domain/ColliderTag.ts'
import { isExitOpen } from '../domain/RoomTravel.ts'
import type { WorldObject } from '../domain/WorldObject.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

const bindings = { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'] }
const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage

/** Rolls that leave the Boss chasing, that start a volley, and that start the retreat and dash. */
const BLADE_NAME = /^(dagger|knife|blade|shiv)\d+$/
const NO_SWITCH = 0.5
const START_VOLLEY = 0
const START_RETREAT = (BOSS_CONFIG.volleyChancePerTick + BOSS_CONFIG.retreatChancePerTick) / 2 + BOSS_CONFIG.volleyChancePerTick / 2

interface Body {
  x: number
  y: number
  vx: number
  vy: number
  health: number
  maxHealth: number
  alive: boolean
  destroyed?: boolean
  thrown?: unknown
  bossMode?: string
  wavesFired?: number
}

function arenaSession(): GameSession {
  const session = createRoomSession({
    movementBindings: bindings,
    storage: memoryStorage,
    worldState: createGameWorldState(undefined, ARENA_IDS.room),
  })
  // The player outlasts the Blades, so these tests look at the Boss.
  const player = body(session, 'player')
  player.health = player.maxHealth = 100_000
  return session
}

function objectOf(session: GameSession, id: string): WorldObject {
  return session.getWorldState().worldObjects.find((worldObject) => worldObject.id === id)!
}

function body(session: GameSession, id: string): Body {
  return objectOf(session, id).state as unknown as Body
}

function runFor(session: GameSession, ms: number): void {
  for (let frame = 0; frame < Math.round(ms / SIMULATION_TICK_MS); frame++) session.update(SIMULATION_TICK_MS)
}

function liveBlades(session: GameSession): WorldObject[] {
  return session
    .getWorldState()
    .worldObjects.filter((worldObject) => worldObject.metadata.kind === 'blade' && (worldObject.state as unknown as Body).alive)
}

/** Makes the Boss's next roll the given value, and every later one a non-event. */
function rollNext(value: number): void {
  vi.spyOn(Math, 'random').mockReturnValueOnce(value).mockReturnValue(NO_SWITCH)
}

afterEach(() => vi.restoreAllMocks())

describe('arena', () => {
  it('follows room and ends the game through an Exit that needs the Boss defeated', () => {
    const state = createGameWorldState()
    const exit = state.rooms.find((room) => room.id === ARENA_IDS.room)!.exits[0]
    expect(exit).toMatchObject({ targetRoomId: ROOM_IDS.end, endsGame: true, requires: { kind: 'defeat', objectIds: [ARENA_IDS.boss] } })
    expect(ARENA_DEFINITION.exit.hiddenUntilOpen).toBeUndefined()

    const session = arenaSession()
    const world = session.getWorldState()
    const room = world.rooms.find((candidate) => candidate.id === ARENA_IDS.room)!
    expect(isExitOpen(world, room, room.exits[0])).toBe(false)
    body(session, ARENA_IDS.boss).alive = false
    expect(isExitOpen(world, room, room.exits[0])).toBe(true)
  })

  it('holds a Boss with 300 Health, and a pool of Blades that is neither listed nor drawn', () => {
    const session = arenaSession()
    const boss = objectOf(session, ARENA_IDS.boss)
    expect(boss.metadata).toMatchObject({ kind: 'boss', role: 'enemy' })
    expect(body(session, ARENA_IDS.boss)).toMatchObject({ health: 300, maxHealth: 300, alive: true })
    const blades = session.getWorldState().worldObjects.filter((worldObject) => worldObject.metadata.kind === 'blade')
    expect(blades).toHaveLength(BLADES_PER_BOSS)
    expect(blades.every((blade) => (blade.state as unknown as Body).alive === false)).toBe(true)

    const world = session.getWorldState()
    const room = world.rooms.find((candidate) => candidate.id === ARENA_IDS.room)!
    const listed = getRoomDirectoryEntries(world, room, true)
    expect(listed).toContain(ARENA_IDS.boss)
    expect(listed.some((entry) => BLADE_NAME.test(entry) || entry.includes('wardenblade'))).toBe(false)
  })

  it('chases the player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(NO_SWITCH)
    const session = arenaSession()
    const before = Math.hypot(body(session, 'player').x - body(session, ARENA_IDS.boss).x, body(session, 'player').y - body(session, ARENA_IDS.boss).y)
    runFor(session, 1000)
    const boss = body(session, ARENA_IDS.boss)
    const after = Math.hypot(body(session, 'player').x - boss.x, body(session, 'player').y - boss.y)
    expect(after).toBeLessThan(before - 100)
    expect(Math.hypot(boss.vx, boss.vy)).toBeLessThanOrEqual(BOSS_CONFIG.chaseSpeed + 1)
  })
})

describe('arena floor', () => {
  it('has no walls and no boulder, only Excalibur, the Boss and eight named plates', () => {
    const session = arenaSession()
    const room = session.getWorldState().rooms.find((candidate) => candidate.id === ARENA_IDS.room)!
    expect(room.walls ?? []).toHaveLength(0)
    const names = room.objectIds
      .map((id) => objectOf(session, id))
      .filter((worldObject) => worldObject.metadata.kind !== 'blade' && worldObject.id !== 'player')
      .map((worldObject) => String(worldObject.metadata.name))
    expect(names.sort()).toEqual(['b', 'bl', 'warden', 'br', 'excalibur', 'l', 'r', 't', 'tl', 'tr'].sort())
    expect(ARENA_PLATES.map((plate) => plate.name)).toEqual(['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl'])
  })

  it('puts the plates in the corners and the middle of each side, clear of the Exit', () => {
    const session = arenaSession()
    const at = (name: string) => body(session, `arena${name}`)
    expect(at('t').x).toBe(at('b').x)
    expect(at('l').y).toBe(at('r').y)
    expect(at('tl')).toMatchObject({ x: at('l').x, y: at('t').y })
    expect(at('br')).toMatchObject({ x: at('r').x, y: at('b').y })
    expect(at('l').x).toBeLessThan(at('t').x)
    expect(at('t').x).toBeLessThan(at('r').x)
    expect(at('t').y).toBeLessThan(at('l').y)
    expect(at('l').y).toBeLessThan(at('b').y)
    const exit = createGameWorldState().rooms.find((room) => room.id === ARENA_IDS.room)!.exits[0]
    expect(at('r').x + 40).toBeLessThan(exit.x - 30)
  })

  it('lets the player acc to a plate by name, in either case', () => {
    const session = arenaSession()
    const player = body(session, 'player')
    expect(session.submitCommand('acc hacker TL').status).toBe('success')
    runFor(session, 3000)
    const target = body(session, 'arenatl')
    expect(Math.hypot(player.x - target.x, player.y - target.y)).toBeLessThan(40)
  })
})

describe('boss volley', () => {
  it('stands still, then fires three waves of 13 Blades fanned around the player, one naming rule per wave', () => {
    rollNext(START_VOLLEY)
    const session = arenaSession()
    const boss = body(session, ARENA_IDS.boss)
    const start = { x: boss.x, y: boss.y }

    runFor(session, BOSS_CONFIG.volleyWindUpMs - 100)
    expect(liveBlades(session)).toHaveLength(0)
    expect(boss.bossMode).toBe('volley')

    runFor(session, 200)
    const firstWave = liveBlades(session)
    expect(firstWave).toHaveLength(BLADES_PER_WAVE)
    const names = firstWave.map((blade) => blade.metadata.name as string)
    const rule = BLADE_NAME_RULES.find((candidate) => names[0].startsWith(candidate))!
    expect(names.sort()).toEqual(Array.from({ length: BLADES_PER_WAVE }, (_, index) => `${rule}${index + 1}`).sort())

    const player = body(session, 'player')
    const towardsPlayer = Math.atan2(player.y - start.y, player.x - start.x)
    for (const blade of firstWave) {
      const state = blade.state as unknown as Body
      expect(Math.hypot(state.vx, state.vy)).toBeCloseTo(BOSS_CONFIG.bladeSpeed, 0)
      const offset = Math.abs(Math.atan2(Math.sin(Math.atan2(state.vy, state.vx) - towardsPlayer), Math.cos(Math.atan2(state.vy, state.vx) - towardsPlayer)))
      expect(offset).toBeLessThanOrEqual(((BOSS_CONFIG.fanHalfAngleDeg + 1) * Math.PI) / 180)
    }

    runFor(session, 2 * BOSS_CONFIG.waveIntervalMs)
    expect(boss.bossMode).toBe('chase')
    expect(boss.wavesFired).toBe(BOSS_CONFIG.waves)
    const rules = new Set(
      session
        .getWorldState()
        .worldObjects.filter((worldObject) => BLADE_NAME.test(String(worldObject.metadata.name)))
        .map((blade) => String(blade.metadata.name).replace(/\d+$/, '')),
    )
    expect(rules.size).toBe(BOSS_CONFIG.waves)
  })

  it('does not hurt the Boss with its own Blades, and ends every Blade at a wall or outside the room', () => {
    rollNext(START_VOLLEY)
    const session = arenaSession()
    runFor(session, BOSS_CONFIG.volleyWindUpMs + 3 * BOSS_CONFIG.waveIntervalMs)
    expect(body(session, ARENA_IDS.boss).health).toBe(300)
    runFor(session, 6000)
    expect(liveBlades(session)).toHaveLength(0)
    const world = session.getWorldState()
    const room = world.rooms.find((candidate) => candidate.id === ARENA_IDS.room)!
    expect(getRoomDirectoryEntries(world, room, true).some((entry) => entry.includes('shiv') || entry.includes('knife'))).toBe(false)
  })

  it('hurts the player, in proportion to the Blade speed', () => {
    rollNext(START_VOLLEY)
    const session = arenaSession()
    const player = body(session, 'player')
    Object.assign(player, { x: 1100, y: 365 })
    runFor(session, BOSS_CONFIG.volleyWindUpMs + BOSS_CONFIG.waveIntervalMs + 1000)
    expect(player.health).toBeLessThan(100_000)
    expect(100_000 - player.health).toBeGreaterThanOrEqual(BOSS_CONFIG.bladeImpactDamageRate * BOSS_CONFIG.bladeSpeed - 0.01)
  })

  it('cannot be picked up', () => {
    rollNext(START_VOLLEY)
    const session = arenaSession()
    runFor(session, BOSS_CONFIG.volleyWindUpMs + 100)
    const blade = liveBlades(session)[0]
    expect(colliderTagsOf(blade)).toEqual([{ class: 'weapon', impactDamageRate: BOSS_CONFIG.bladeImpactDamageRate }])
    expect(blade.metadata.role).toBe('object')
    expect(blade.metadata.weaponId).toBeUndefined()
  })

  it('survives two Blades with the same name when one is named literally', () => {
    rollNext(START_VOLLEY)
    const session = arenaSession()
    runFor(session, BOSS_CONFIG.volleyWindUpMs + 100)
    const [first, second] = liveBlades(session)
    second.rename(first.metadata.name as string)
    expect(() => session.submitCommand(`acc ${first.metadata.name as string} warden`)).not.toThrow()
    expect(() => runFor(session, 3000)).not.toThrow()
  })

  it('can be sent back with acc: it hurts the Boss but not the player, and a Wildcard reaches same-named Blades', () => {
    rollNext(START_VOLLEY)
    const session = arenaSession()
    runFor(session, BOSS_CONFIG.volleyWindUpMs + 100)
    const [first, second] = liveBlades(session)
    // Two Blades sharing a name is unlikely in play but must not break anything.
    second.rename(first.metadata.name as string)
    const name = first.metadata.name as string
    const rule = BLADE_NAME_RULES.find((candidate) => name.startsWith(candidate))!

    const result = session.submitCommand(`acc ${rule}* warden`)
    expect(result.status).toBe('success')
    for (const blade of [first, second]) {
      expect((blade.state as unknown as Body).thrown).toMatchObject({ targetObjectId: ARENA_IDS.boss })
      expect((blade.state as unknown as { immuneId: string }).immuneId).toBe('player')
    }
    runFor(session, 3000)
    expect(body(session, ARENA_IDS.boss).health).toBeLessThan(300)
  })
})

describe('boss retreat and dash', () => {
  function placeFacing(session: GameSession): void {
    const boss = body(session, ARENA_IDS.boss)
    const player = body(session, 'player')
    Object.assign(boss, { x: 1500, y: 365 })
    Object.assign(player, { x: 1200, y: 365 })
  }

  it('backs away slowly for a second, then dashes straight at the player and kills them on touch', () => {
    rollNext(START_RETREAT)
    const session = arenaSession()
    placeFacing(session)
    const boss = body(session, ARENA_IDS.boss)
    const player = body(session, 'player')
    player.health = player.maxHealth = 100

    runFor(session, BOSS_CONFIG.retreatMs - 100)
    expect(boss.bossMode).toBe('retreat')
    expect(boss.x).toBeGreaterThan(1500)
    expect(Math.hypot(boss.vx, boss.vy)).toBeLessThanOrEqual(BOSS_CONFIG.retreatSpeed + 1)

    runFor(session, 200)
    expect(boss.bossMode).toBe('dash')
    runFor(session, 700)
    expect(player.alive).toBe(false)
    expect(player.health).toBe(0)
    expect(session.getWorldState().outcome).toBe('game-over')
  })

  it('does not turn: a player who steps aside is missed, and the wall stuns the Boss', () => {
    rollNext(START_RETREAT)
    const session = arenaSession()
    placeFacing(session)
    const boss = body(session, ARENA_IDS.boss)
    const player = body(session, 'player')
    runFor(session, BOSS_CONFIG.retreatMs + 100)
    expect(boss.bossMode).toBe('dash')

    Object.assign(player, { x: 1200, y: 640 })
    runFor(session, 2500)
    expect(player.health).toBe(100_000)
    expect(boss.bossMode).toBe('recover')
    expect(Math.abs(boss.y - 365)).toBeLessThan(60)

    runFor(session, BOSS_CONFIG.recoverMs + 200)
    expect(boss.bossMode).toBe('chase')
  })
})
