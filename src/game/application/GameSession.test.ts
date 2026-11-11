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

    // 250 ms of game time at 210 px/s, less the short time the guard needs to pick up speed
    expect(slowDistance).toBeGreaterThan(210 * 0.25 * 0.8)
    expect(slowDistance).toBeLessThanOrEqual(210 * 0.25)
    expect(fastDistance).toBeGreaterThan(slowDistance * 3)
  })

  it('reveals undiscovered objects in room when ls is executed', () => {
    const session = newSession()
    const dagger = stateOf(session, 'dagger')
    const guard = stateOf(session, 'guard')
    const guard2 = stateOf(session, 'guard2')
    const guard3 = stateOf(session, 'guard3')

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

  it('includes player label "hacker" in tab completion candidates', () => {
    const session = newSession()

    // hacker should be tab-completable at command position
    const cmdCandidates = session.getCommandCompletionCandidates('ha', 2)
    expect(cmdCandidates).toContain('hacker')

    // hacker should be tab-completable when typing arguments to mv
    const argCandidates = session.getCommandCompletionCandidates('mv dagger h', 11)
    expect(argCandidates).toContain('hacker')
    expect(argCandidates).not.toContain('help')

    const mvCandidates = session.getCommandCompletionCandidates('mv h', 4)
    expect(mvCandidates).toContain('hacker')
    expect(mvCandidates).not.toContain('help')
  })

  it('does not list player label "hacker" in ls output', () => {
    const session = newSession()
    const lsResult = session.submitCommand('ls')
    expect(lsResult.status).toBe('success')
    if (lsResult.status === 'success') {
      expect(lsResult.feedback[0].text).not.toContain('hacker')
    }
  })

  it('updates tab completion candidates when player is renamed', () => {
    const session = newSession()
    const renameResult = session.submitCommand('mv hacker neo')
    expect(renameResult.status).toBe('success')

    const candidates = session.getCommandCompletionCandidates('ne', 2)
    expect(candidates).toContain('neo')
    expect(candidates).not.toContain('hacker')
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

  it('accelerates a thrown object from rest across simulation ticks', () => {
    const session = newSession()
    const dagger = stateOf(session, 'dagger')

    session.submitCommand('mv dagger guard')
    const daggerRecord = dagger as unknown as Record<string, unknown>
    expect(daggerRecord.thrown).toMatchObject({ targetObjectId: 'guard', hitIds: [] })
    expect(Math.hypot((dagger.vx as number) ?? 0, (dagger.vy as number) ?? 0)).toBe(0)

    session.update(SIMULATION_TICK_MS)
    const first = Math.hypot(dagger.vx as number, dagger.vy as number)
    expect(first).toBeGreaterThan(0)

    session.update(SIMULATION_TICK_MS)
    expect(Math.hypot(dagger.vx as number, dagger.vy as number)).toBeGreaterThan(first)
  })

  it('unequips weapon when thrown only when it exits pickup reach', () => {
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
    // Still within pickup reach right after throwing
    expect(player.weaponId).toBe('dagger')
    expect((dagger as unknown as Record<string, unknown>).equippedBy).toBe('player')

    // After 1 tick, dagger has accelerated slightly but is still within reach
    session.update(SIMULATION_TICK_MS)
    expect(player.weaponId).toBe('dagger')
    expect((dagger as unknown as Record<string, unknown>).equippedBy).toBe('player')

    // Advance ticks until dagger exits pickup reach (> 10px)
    for (let i = 0; i < 15; i++) {
      session.update(SIMULATION_TICK_MS)
    }
    expect(player.weaponId).toBeNull()
    expect((dagger as unknown as Record<string, unknown>).equippedBy).toBeNull()
  })

  it('throws player to exit zone and triggers congratulations upon reaching exit', () => {
    const session = newSession()
    // Thrown characters are blocked by solid objects, so clear the path first.
    for (const id of ['guard', 'guard2', 'guard3', 'boulder']) {
      ;(stateOf(session, id) as unknown as { alive: boolean }).alive = false
    }
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
  it('INPUT_BINDINGS movement includes WASD and no arrow keys', () => {
    expect(INPUT_BINDINGS.movement.up).toEqual(['w'])
    expect(INPUT_BINDINGS.movement.down).toEqual(['s'])
    expect(INPUT_BINDINGS.movement.left).toEqual(['a'])
    expect(INPUT_BINDINGS.movement.right).toEqual(['d'])

    const allMovementKeys = [
      ...INPUT_BINDINGS.movement.up,
      ...INPUT_BINDINGS.movement.down,
      ...INPUT_BINDINGS.movement.left,
      ...INPUT_BINDINGS.movement.right,
    ]
    expect(allMovementKeys).not.toContain('arrowup')
    expect(allMovementKeys).not.toContain('arrowdown')
    expect(allMovementKeys).not.toContain('arrowleft')
    expect(allMovementKeys).not.toContain('arrowright')
  })

  it('INPUT_BINDINGS attack includes space and no mouse buttons', () => {
    expect(INPUT_BINDINGS.attack.keys).toContain(' ')
    expect(INPUT_BINDINGS.attack.mouseButtons).toEqual([])
  })

  it('INPUT_BINDINGS binds shift to enter command mode and empty exitCommandMode', () => {
    expect(INPUT_BINDINGS.enterCommandMode).toContain('shift')
    expect(INPUT_BINDINGS.exitCommandMode).toEqual([])
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

  it('treats a save from an older schema (with mv_attr and no physics fields) as no save', () => {
    const storage = storageStub()
    const session = createRoom1Session({ movementBindings: bindings, storage })
    session.saveCurrentState()
    const record = JSON.parse(storage.getItem('hack-game.save') as string)
    storage.setItem('hack-game.save', JSON.stringify({ ...record, schemaVersion: 1 }))

    expect(session.hasSavedState()).toBe(false)
    expect(session.loadSavedState()).toBe(false)
  })
})

describe('player facing and turning', () => {
  it('defaults to facing right', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    expect(player.facing).toBe('right')
  })

  it('turns player left when pressing left arrow', () => {
    const session = newSession()
    session.keyDown('arrowleft')
    expect(stateOf(session, 'player').facing).toBe('left')
  })

  it('turns player right when pressing right arrow', () => {
    const session = newSession()
    session.keyDown('arrowleft')
    expect(stateOf(session, 'player').facing).toBe('left')

    session.keyDown('arrowright')
    expect(stateOf(session, 'player').facing).toBe('right')
  })

  it('preserves facing direction when pressing up or down arrow', () => {
    const session = newSession()
    session.keyDown('arrowleft')
    expect(stateOf(session, 'player').facing).toBe('left')

    session.keyDown('arrowup')
    expect(stateOf(session, 'player').facing).toBe('left')

    session.keyDown('arrowdown')
    expect(stateOf(session, 'player').facing).toBe('left')
  })

  it('keeps facing direction after releasing arrow key', () => {
    const session = newSession()
    session.keyDown('arrowleft')
    expect(stateOf(session, 'player').facing).toBe('left')

    session.keyUp('arrowleft')
    expect(stateOf(session, 'player').facing).toBe('left')

    session.update(SIMULATION_TICK_MS)
    expect(stateOf(session, 'player').facing).toBe('left')
  })

  it('switches facing when pressing and releasing opposing keys', () => {
    const session = newSession()
    session.keyDown('arrowleft')
    expect(stateOf(session, 'player').facing).toBe('left')

    // While holding left, press right
    session.keyDown('arrowright')
    expect(stateOf(session, 'player').facing).toBe('right')

    // Release right while left is still held -> turns back to left
    session.keyUp('arrowright')
    expect(stateOf(session, 'player').facing).toBe('left')
  })

  it('does not turn player when typing arrow keys in command mode', () => {
    const session = newSession()
    expect(stateOf(session, 'player').facing).toBe('right')

    session.enterCommandMode()
    session.keyDown('arrowleft')
    // Cursor navigation in command mode should not turn character
    expect(stateOf(session, 'player').facing).toBe('right')
  })

  it('tracks holder position for equipped dagger in domain simulation', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const dagger = stateOf(session, 'dagger')
    player.x = dagger.x
    player.y = dagger.y

    // Pick up dagger
    session.update(SIMULATION_TICK_MS)
    expect(player.weaponId).toBe('dagger')
    expect(dagger.equippedBy).toBe('player')

    // In domain state, equipped dagger tracks holder coordinates
    expect(dagger.x).toBe(player.x)
    expect(dagger.y).toBe(player.y)

    // Turning left or right preserves domain tracking
    session.keyDown('arrowleft')
    session.update(SIMULATION_TICK_MS)
    expect(dagger.x).toBe(player.x)
    expect(dagger.y).toBe(player.y)
  })

  it('translates dagger position during attack animation in domain simulation', () => {
    const session = newSession()
    const player = stateOf(session, 'player')
    const dagger = stateOf(session, 'dagger')
    player.x = dagger.x
    player.y = dagger.y

    // Pick up dagger
    session.update(SIMULATION_TICK_MS)
    expect(player.weaponId).toBe('dagger')
    expect(dagger.x).toBe(player.x)

    // Face right and attack
    session.keyDown('arrowright')
    session.update(SIMULATION_TICK_MS)
    session.attack()

    // At peak (approx 100ms into the 200ms animation): dagger position translated forward (+X)
    runFor(session, 100)
    expect(dagger.x).toBe(player.x + 30)

    // After animation duration finishes (200ms total): returns to holder position
    runFor(session, 100)
    expect(dagger.x).toBe(player.x)

    // Face left and attack
    session.keyDown('arrowleft')
    session.update(SIMULATION_TICK_MS)
    session.attack()

    // At peak: dagger position translated forward in left direction (-X)
    runFor(session, 100)
    expect(dagger.x).toBe(player.x - 30)

    // After animation duration finishes: returns to holder position
    runFor(session, 100)
    expect(dagger.x).toBe(player.x)
  })
})
