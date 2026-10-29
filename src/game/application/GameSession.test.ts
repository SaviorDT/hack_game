import { describe, expect, it } from 'vitest'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { ROOM_IDS, ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../content/room1.ts'
import type { CharacterState } from '../domain/CharacterState.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'
import type { GameSession } from './GameSession.ts'

const bindings = {
  up: ['w', 'arrowup'],
  down: ['s', 'arrowdown'],
  left: ['a', 'arrowleft'],
  right: ['d', 'arrowright'],
}

const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage

function newSession(): GameSession {
  return createRoom1Session({ movementBindings: bindings, storage: memoryStorage })
}

function stateOf(session: GameSession, id: string): CharacterState {
  const worldObject = session.getWorldState().worldObjects.find((candidate) => candidate.id === id)
  if (!worldObject) {
    throw new Error(`Missing ${id}`)
  }
  return getMutableWorldObjectState<CharacterState>(worldObject)
}

function runFor(session: GameSession, ms: number): void {
  const frames = Math.round(ms / SIMULATION_TICK_MS)
  for (let frame = 0; frame < frames; frame += 1) {
    session.update(SIMULATION_TICK_MS)
  }
}

describe('player movement', () => {
  it('moves at the player speed while a movement key is held', () => {
    const session = newSession()
    const startX = stateOf(session, 'player').x
    session.keyDown('d')

    runFor(session, 1000)

    expect(stateOf(session, 'player').x - startX).toBeCloseTo(240, 0)
  })

  it('does not leave the room', () => {
    const session = newSession()
    session.keyDown('a')
    session.keyDown('w')

    runFor(session, 5000)

    const player = stateOf(session, 'player')
    expect(player.x - player.width / 2).toBeGreaterThanOrEqual(ROOM_LAYOUT.left)
    expect(player.y - player.height / 2).toBeGreaterThanOrEqual(ROOM_LAYOUT.top)
  })

  it('keeps moving at a quarter speed in command mode after Enter while holding a key', () => {
    const session = newSession()
    const startX = stateOf(session, 'player').x
    session.keyDown('d')
    session.toggleInputMode()
    session.keyUp('d')

    runFor(session, 1000)

    expect(stateOf(session, 'player').x - startX).toBeCloseTo(60, 0)
  })

  it('stops after returning to movement mode', () => {
    const session = newSession()
    session.keyDown('d')
    session.toggleInputMode()
    session.keyUp('d')
    session.toggleInputMode()
    const x = stateOf(session, 'player').x

    runFor(session, 500)

    expect(stateOf(session, 'player').x).toBe(x)
  })

  it('enters the next room and congratulates the player on reaching the exit', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    player.x = ROOM_LAYOUT.exit.x - 100
    player.y = ROOM_LAYOUT.exit.y
    session.keyDown('d')

    runFor(session, 1000)

    expect(session.getWorldState().currentRoomId).toBe(ROOM_IDS.second)
    expect(session.getWorldState().outcome).toBe('congratulations')
  })
})

describe('pick-up and attack', () => {
  it('picks up the undiscovered dagger when standing next to it', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const dagger = stateOf(session, 'dagger')
    player.x = dagger.x
    player.y = dagger.y

    session.pickUp()

    expect(player.weaponId).toBe('dagger')
    expect(dagger.discovered).toBe(true)
  })

  it('ignores pick-up and attack in command mode', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const dagger = stateOf(session, 'dagger')
    player.x = dagger.x
    player.y = dagger.y
    session.toggleInputMode()

    session.pickUp()

    expect(player.weaponId).toBeNull()
  })

  it('defeats a guard with three dagger hits spaced by the cooldown', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const guard = stateOf(session, 'guard')
    player.weaponId = 'dagger'
    guard.x = player.x + player.width + 5
    guard.y = player.y

    session.attack()
    runFor(session, 500)
    session.attack()
    runFor(session, 500)
    session.attack()

    expect(guard.health).toBe(0)
    expect(guard.alive).toBe(false)
  })
})

describe('guard', () => {
  it('chases the player in the right half and ends the game when the player runs out of health', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    player.x = ROOM_LAYOUT.rightHalfStartX + 100
    player.y = ROOM_LAYOUT.guardStart.y

    runFor(session, 15000)

    expect(player.health).toBe(0)
    expect(session.getWorldState().outcome).toBe('game-over')
  })

  it('stays put while the player is in the left half', () => {
    const session = newSession()
    const guard = stateOf(session, 'guard')
    const start = { x: guard.x, y: guard.y }

    runFor(session, 2000)

    expect({ x: guard.x, y: guard.y }).toEqual(start)
    expect(stateOf(session, WORLD_OBJECT_IDS.player).health).toBe(100)
  })
})

describe('commands', () => {
  it('no longer knows the cd command', () => {
    const result = newSession().submitCommand('cd room2/')

    expect(result).toMatchObject({ status: 'rejected' })
  })

  it('returns to movement mode after a command, even a rejected one', () => {
    const session = newSession()
    session.toggleInputMode()
    session.submitCommand('nonsense')

    expect(session.inputMode).toBe('movement')
  })

  it('slows time only while in command mode', () => {
    const session = newSession()
    const guard = stateOf(session, 'guard')
    const player = stateOf(session, 'player')
    player.x = ROOM_LAYOUT.rightHalfStartX + 100
    player.y = guard.y
    const startX = guard.x

    session.toggleInputMode()
    runFor(session, 1000)
    const slowDistance = startX - guard.x

    session.submitCommand('ls')
    runFor(session, 1000)
    const fastDistance = startX - slowDistance - guard.x

    expect(slowDistance).toBeCloseTo(210 * 0.25, 0)
    expect(fastDistance).toBeGreaterThan(slowDistance * 3)
  })
})

describe('render position', () => {
  it('blends between ticks so motion stays smooth at sub-tick frame times', () => {
    const session = newSession()
    const startX = stateOf(session, 'player').x
    session.keyDown('d')

    session.update(SIMULATION_TICK_MS * 1.5)

    expect(session.getRenderPosition('player')?.x).toBeCloseTo(startX + 2, 3)
  })
})
