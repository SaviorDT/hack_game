import { describe, expect, it } from 'vitest'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { ROOM_IDS, ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../content/room1Constants.ts'
import type { CharacterState } from '../domain/CharacterState.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
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

function playerMaxSpeed(session: GameSession): number {
  const player = stateOf(session, 'player')
  if (typeof player.speed === 'object' && player.speed !== null) {
    return (player.speed as { maxSpeed: number }).maxSpeed
  }
  return typeof player.speed === 'number' ? player.speed : 240
}

function runFor(session: GameSession, ms: number): void {
  const frames = Math.round(ms / SIMULATION_TICK_MS)
  for (let frame = 0; frame < frames; frame += 1) {
    session.update(SIMULATION_TICK_MS)
  }
}

describe('player movement', () => {
  it('accelerates up to max speed while a movement key is held', () => {
    const session = newSession()
    const maxSpeed = playerMaxSpeed(session)
    session.keyDown('d')

    runFor(session, 1000)

    const player = stateOf(session, 'player')
    expect(player.vx).toBe(maxSpeed)
    const midX = player.x

    runFor(session, 200)
    expect(stateOf(session, 'player').x - midX).toBeCloseTo(maxSpeed * 0.2, 0)
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

  it('keeps moving at a slowed time scale in command mode after Enter while holding a key', () => {
    const session = newSession()
    const maxSpeed = playerMaxSpeed(session)
    session.keyDown('d')
    runFor(session, 1000)
    const startX = stateOf(session, 'player').x
    session.toggleInputMode()
    session.keyUp('d')

    runFor(session, 1000)

    expect(stateOf(session, 'player').x - startX).toBeCloseTo(maxSpeed * 0.25, 0)
  })

  it('decelerates to a stop via friction acceleration when movement keys are released', () => {
    const session = newSession()
    const maxSpeed = playerMaxSpeed(session)
    session.keyDown('d')
    runFor(session, 1000)
    expect(stateOf(session, 'player').vx).toBe(maxSpeed)

    session.keyUp('d')
    runFor(session, 100)
    expect((stateOf(session, 'player').vx as number)).toBeLessThan(maxSpeed)

    runFor(session, 1000)
    expect(stateOf(session, 'player').vx).toBe(0)
  })

  it('reverses direction with turnaround acceleration', () => {
    const session = newSession()
    const maxSpeed = playerMaxSpeed(session)
    session.keyDown('d')
    runFor(session, 1000)
    expect(stateOf(session, 'player').vx).toBe(maxSpeed)

    session.keyUp('d')
    session.keyDown('a')

    runFor(session, 80)
    expect((stateOf(session, 'player').vx as number)).toBeLessThan(maxSpeed)
    runFor(session, 1500)
    expect((stateOf(session, 'player').vx as number)).toBeLessThan(0)
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
  it('automatically picks up the undiscovered dagger when moving into reach on tick', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const dagger = stateOf(session, 'dagger')
    player.x = dagger.x
    player.y = dagger.y

    session.update(SIMULATION_TICK_MS)

    expect(player.weaponId).toBe('dagger')
    expect(dagger.discovered).toBe(true)
    expect(dagger.equippedBy).toBe('player')
  })

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

  it('does not discover guard when guard starts moving/chasing; only becomes discovered when attacked by player', () => {
    const session = newSession()
    const guard = stateOf(session, 'guard')
    const player = stateOf(session, 'player')
    player.x = ROOM_LAYOUT.rightHalfStartX + 100
    player.y = ROOM_LAYOUT.guardStart.y
    const startX = guard.x

    // Run simulation for 500ms: guard starts chasing and moves
    runFor(session, 500)
    expect(guard.x).toBeLessThan(startX)
    expect(guard.chasing).toBe(true)
    // Guard must NOT be discovered simply by moving
    expect(guard.discovered).toBe(false)

    // Player attacks guard within reach
    guard.x = player.x + 10
    guard.y = player.y
    session.attack()
    // Now guard IS discovered because player interacted with it (attacked by player)
    expect(guard.discovered).toBe(true)
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

  it('reveals undiscovered objects in room when ls is executed', () => {
    const session = newSession()
    const dagger = stateOf(session, 'dagger')
    const guard = stateOf(session, 'guard')
    const guard2 = stateOf(session, 'guard-2')
    const guard3 = stateOf(session, 'guard-3')

    expect(dagger.discovered).toBe(false)
    expect(guard.discovered).toBe(false)
    expect(guard2.discovered).toBe(false)
    expect(guard3.discovered).toBe(false)

    const result = session.submitCommand('ls')
    expect(result.status).toBe('success')

    expect(dagger.discovered).toBe(true)
    expect(guard.discovered).toBe(true)
    expect(guard2.discovered).toBe(true)
    expect(guard3.discovered).toBe(true)
  })

  it('lists mv in help output', () => {
    const session = newSession()
    const result = session.submitCommand('help')
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.feedback[0].text).toContain('mv')
    }
  })

  it('renames an object when target does not exist and reflects the new name in ls and autocomplete', () => {
    const session = newSession()
    const daggerObj = session.getWorldState().worldObjects.find((o) => o.id === 'dagger')!

    const renameResult = session.submitCommand('mv dagger sword')
    expect(renameResult.status).toBe('success')
    expect(renameResult.feedback).toEqual([{ kind: 'popup', text: 'Renamed dagger to sword.' }])
    expect(daggerObj.metadata.name).toBe('sword')

    const lsResult = session.submitCommand('ls')
    expect(lsResult.status).toBe('success')
    if (lsResult.status === 'success') {
      expect(lsResult.feedback[0].text).toContain('sword')
      expect(lsResult.feedback[0].text).not.toContain('dagger')
    }

    const candidates = session.getCommandCompletionCandidates('sw', 2)
    expect(candidates).toContain('sword')
  })

  it('throws an object towards target with speed across simulation ticks until arrival', () => {
    const session = newSession()
    const dagger = stateOf(session, 'dagger')
    const guard = stateOf(session, 'guard')
    const startX = dagger.x

    const result = session.submitCommand('mv dagger guard')
    expect(result.status).toBe('success')
    expect(result.feedback).toEqual([{ kind: 'popup', text: 'Threw dagger to guard.' }])

    // Run for 1000ms: at default speed 300 px/s, dagger should move ~300 px towards guard
    runFor(session, 1000)
    expect(dagger.x).toBeGreaterThan(startX + 200)
    expect((dagger as unknown as Record<string, unknown>).thrown).toBeDefined()

    // Run until arrival at guard
    runFor(session, 5000)
    expect(dagger.x).toBe(guard.x)
    expect(dagger.y).toBe(guard.y)
    expect((dagger as unknown as Record<string, unknown>).thrown).toBeNull()
    expect(guard.discovered).toBe(true)
  })

  it('accelerates a thrown object from rest, capped by its max_velocity', () => {
    const session = newSession()
    const dagger = stateOf(session, 'dagger')

    session.submitCommand('mv dagger guard')
    const thrown = (dagger as unknown as Record<string, unknown>).thrown
    expect(thrown).toBeDefined()
    expect(Math.hypot((dagger.vx as number) ?? 0, (dagger.vy as number) ?? 0)).toBe(0)

    // After one tick the object has been pulled for one tick: a = 1000 px/s² -> ~16.7 px/s
    session.update(SIMULATION_TICK_MS)
    expect(Math.hypot(dagger.vx as number, dagger.vy as number)).toBeCloseTo(1000 * (SIMULATION_TICK_MS / 1000), 1)

    // Long flights never exceed the cap
    let peak = 0
    for (let i = 0; i < 400 && (dagger as unknown as Record<string, unknown>).thrown; i++) {
      session.update(SIMULATION_TICK_MS)
      peak = Math.max(peak, Math.hypot(dagger.vx as number, dagger.vy as number))
    }
    expect(peak).toBeGreaterThan(300)
    expect(peak).toBeLessThanOrEqual(500 + 1e-6)
  })

  it('unequips weapon when thrown and allows pickup when in reach', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const dagger = stateOf(session, 'dagger')

    // Start with player at dagger position and equipped
    player.x = dagger.x
    player.y = dagger.y
    player.weaponId = 'dagger'
    dagger.equippedBy = 'player'

    // Throw dagger to guard
    const result = session.submitCommand('mv dagger guard')
    expect(result.status).toBe('success')
    expect(player.weaponId).toBeNull()
    expect((dagger as unknown as Record<string, unknown>).equippedBy).toBeNull()

    // Since player is unarmed and within reach of the unequipped dagger, auto-pickup picks it up
    session.update(SIMULATION_TICK_MS)
    expect(player.weaponId).toBe('dagger')
    expect((dagger as unknown as Record<string, unknown>).equippedBy).toBe('player')
  })

  it('throws player to exit zone and triggers congratulations upon reaching exit', () => {
    const session = newSession()
    const result = session.submitCommand('mv hacker room2')
    expect(result.status).toBe('success')

    // Run until player reaches room2 exit
    runFor(session, 6000)
    expect(session.getWorldState().currentRoomId).toBe(ROOM_IDS.second)
    expect(session.getWorldState().outcome).toBe('congratulations')
  })
})

describe('render position', () => {
  it('blends between ticks so motion stays smooth at sub-tick frame times', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const startX = player.x
    session.keyDown('d')

    session.update(SIMULATION_TICK_MS * 1.5)

    const renderPos = session.getRenderPosition('player')?.x
    expect(renderPos).toBeDefined()
    expect(renderPos!).toBeGreaterThan(startX)
    expect(renderPos!).toBeLessThan(player.x)
  })
})

describe('input bindings and mode switching', () => {
  it('INPUT_BINDINGS movement only includes arrow keys and no WASD', () => {
    expect(INPUT_BINDINGS.movement.up).toEqual(['arrowup'])
    expect(INPUT_BINDINGS.movement.down).toEqual(['arrowdown'])
    expect(INPUT_BINDINGS.movement.left).toEqual(['arrowleft'])
    expect(INPUT_BINDINGS.movement.right).toEqual(['arrowright'])

    const allMovementKeys = [
      ...INPUT_BINDINGS.movement.up,
      ...INPUT_BINDINGS.movement.down,
      ...INPUT_BINDINGS.movement.left,
      ...INPUT_BINDINGS.movement.right,
    ]
    expect(allMovementKeys).not.toContain('w')
    expect(allMovementKeys).not.toContain('a')
    expect(allMovementKeys).not.toContain('s')
    expect(allMovementKeys).not.toContain('d')
  })

  it('INPUT_BINDINGS attack includes space and left mouse button', () => {
    expect(INPUT_BINDINGS.attack.keys).toContain(' ')
    expect(INPUT_BINDINGS.attack.mouseButtons).toContain('left')
  })

  it('GameSession can enter and exit command mode explicitly', () => {
    const session = newSession()
    expect(session.inputMode).toBe('movement')

    session.enterCommandMode()
    expect(session.inputMode).toBe('command')

    session.enterMovementMode()
    expect(session.inputMode).toBe('movement')
  })
})

describe('saved state', () => {
  function storageStub(): Storage {
    const items = new Map<string, string>()
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    } as unknown as Storage
  }

  it('reports no saved state until a save is written, and load does nothing', () => {
    const session = createRoom1Session({ movementBindings: bindings, storage: storageStub() })
    expect(session.hasSavedState()).toBe(false)
    expect(session.loadSavedState()).toBe(false)
  })

  it('restores the saved world, resumes playing in movement mode', () => {
    const storage = storageStub()
    const session = createRoom1Session({ movementBindings: bindings, storage })
    stateOf(session, 'player').x = 321
    session.saveCurrentState()

    stateOf(session, 'player').x = 999
    session.getWorldState().outcome = 'game-over'
    session.enterCommandMode()

    expect(session.hasSavedState()).toBe(true)
    expect(session.loadSavedState()).toBe(true)
    expect(stateOf(session, 'player').x).toBe(321)
    expect(session.getWorldState().outcome).toBe('playing')
    expect(session.inputMode).toBe('movement')
  })

  it('treats corrupt save data as no save', () => {
    const storage = storageStub()
    storage.setItem('hack-game.save', '{not json')
    const session = createRoom1Session({ movementBindings: bindings, storage })
    expect(session.hasSavedState()).toBe(false)
  })
})
