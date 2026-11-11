import { describe, expect, it } from 'vitest'
import { createRoom1Session } from './createRoom1Session.ts'
import { createGameWorldState, TUTORIAL_ROOM_IDS } from './tutorialRooms.ts'
import { HOME_AREA_IDS } from './homeArea.ts'
import { ROOM1_OBJECTS } from './room1.ts'
import { ROOM_IDS, ROOM_LAYOUT } from './room1Constants.ts'
import type { GameSession } from '../application/GameSession.ts'
import { isExitOpen } from '../domain/RoomTravel.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

const bindings = { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'] }
const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage

type Body = { x: number; y: number; alive?: boolean; health?: number; maxHealth?: number; weaponId?: string | null; equippedBy?: string | null; discovered?: boolean }

function newGame(): GameSession {
  return createRoom1Session({ movementBindings: bindings, storage: memoryStorage, worldState: createGameWorldState() })
}

function body(session: GameSession, id: string): Body {
  const worldObject = session.getWorldState().worldObjects.find((candidate) => candidate.id === id)
  if (!worldObject) throw new Error(`Missing ${id}`)
  return worldObject.state as unknown as Body
}

function room(session: GameSession) {
  const state = session.getWorldState()
  return state.rooms.find((candidate) => candidate.id === state.currentRoomId)!
}

function exitOpen(session: GameSession): boolean {
  const current = room(session)
  return isExitOpen(session.getWorldState(), current, current.exits[0])
}

function runFor(session: GameSession, ms: number): void {
  for (let frame = 0; frame < Math.round(ms / SIMULATION_TICK_MS); frame++) session.update(SIMULATION_TICK_MS)
}

/** Steers the player with the arrow keys to each waypoint in turn; stops early if the room changes. */
function walk(session: GameSession, ...waypoints: { x: number; y: number }[]): void {
  const startRoom = session.getWorldState().currentRoomId
  for (const target of waypoints) {
    let stuckFrames = 0
    let last = { x: Number.NaN, y: Number.NaN }
    for (let frame = 0; frame < 600; frame++) {
      if (session.getWorldState().currentRoomId !== startRoom) break
      const player = body(session, 'player')
      const dx = target.x - player.x
      const dy = target.y - player.y
      if (Math.hypot(dx, dy) < 12) break
      // Pressed against something (a dummy, a wall): that is as close as it gets.
      stuckFrames = Math.hypot(player.x - last.x, player.y - last.y) < 0.5 ? stuckFrames + 1 : 0
      if (stuckFrames > 20) break
      last = { x: player.x, y: player.y }
      for (const [key, on] of [
        ['arrowright', dx > 6],
        ['arrowleft', dx < -6],
        ['arrowdown', dy > 6],
        ['arrowup', dy < -6],
      ] as const) {
        if (on) session.keyDown(key)
        else session.keyUp(key)
      }
      session.update(SIMULATION_TICK_MS)
    }
  }
  session.releaseAllKeys()
}

const EXIT = ROOM_LAYOUT.exit

describe('tutorial rooms', () => {
  it('starts the game in tutorial1 with the player there and nowhere else', () => {
    const state = createGameWorldState()
    expect(state.currentRoomId).toBe(TUTORIAL_ROOM_IDS.move)
    const holders = state.rooms.filter((candidate) => candidate.objectIds.includes('player')).map((candidate) => candidate.id)
    expect(holders).toEqual([TUTORIAL_ROOM_IDS.move])
    expect(new Set(state.worldObjects.map((worldObject) => worldObject.id)).size).toBe(state.worldObjects.length)
  })

  it('starts the game in specified startingRoomId with the player placed there and nowhere else', () => {
    for (const targetId of [HOME_AREA_IDS.storage, HOME_AREA_IDS.yard, ROOM_IDS.first, ROOM_IDS.second, TUTORIAL_ROOM_IDS.throw]) {
      const state = createGameWorldState(ROOM1_OBJECTS, targetId)
      expect(state.currentRoomId).toBe(targetId)
      const holders = state.rooms.filter((candidate) => candidate.objectIds.includes('player')).map((candidate) => candidate.id)
      expect(holders).toEqual([targetId])
      const playerObj = state.worldObjects.find((wo) => wo.id === 'player')
      expect(playerObj?.roomId).toBe(targetId)
    }
  })

  it('falls back to tutorial1 when an invalid startingRoomId is specified', () => {
    const state = createGameWorldState(ROOM1_OBJECTS, 'non-existent-room-xyz')
    expect(state.currentRoomId).toBe(TUTORIAL_ROOM_IDS.move)
    const holders = state.rooms.filter((candidate) => candidate.objectIds.includes('player')).map((candidate) => candidate.id)
    expect(holders).toEqual([TUTORIAL_ROOM_IDS.move])
  })

  it('plays through every tutorial room into the home area using the taught mechanics', () => {
    const session = newGame()

    // tutorial1: pick up the dagger, beat the dummy, walk into the exit.
    expect(exitOpen(session)).toBe(false)
    walk(session, { x: EXIT.x - 60, y: EXIT.y }, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.move) // locked: the doorway does nothing
    walk(session, { x: 640, y: 520 })
    expect(body(session, 'tutorial1dagger').equippedBy).toBe('player')
    walk(session, { x: 1250, y: 420 }) // walks into the dummy and stops against it
    for (let i = 0; i < 40 && body(session, 'dummy').alive !== false; i++) {
      session.attack()
      runFor(session, 100)
    }
    expect(body(session, 'dummy').alive).toBe(false)
    expect(body(session, 'player').health).toBe(100) // the dummy never fights back
    expect(exitOpen(session)).toBe(true)
    walk(session, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.discover)
    // The dagger stayed behind in tutorial1.
    expect(body(session, 'player').weaponId).toBeNull()
    expect(session.getWorldState().worldObjects.find((o) => o.id === 'tutorial1dagger')!.roomId).toBe(TUTORIAL_ROOM_IDS.move)
    expect(body(session, 'tutorial1dagger').equippedBy).toBeNull()

    // tutorial2: ls reveals everything and opens the exit; cd works only next to it.
    expect(exitOpen(session)).toBe(false)
    expect(session.submitCommand('cd tutorial3').status).toBe('rejected')
    expect(session.submitCommand('ls').status).toBe('success')
    expect(exitOpen(session)).toBe(true)
    const farAway = session.submitCommand('cd tutorial3')
    expect(farAway.status).toBe('rejected')
    walk(session, { x: 700, y: 640 }, { x: 1600, y: 640 }, { x: EXIT.x - 160, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.discover)
    expect(session.submitCommand('cd tutorial3/').status).toBe('success')
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.throw)

    // tutorial3: pick up the dagger and throw it at the sentry from a distance.
    walk(session, { x: 420, y: 560 })
    expect(body(session, 'tutorial3dagger').equippedBy).toBe('player')
    expect(session.submitCommand('mv dagger guard').status).toBe('success')
    runFor(session, 2000)
    expect(body(session, 'sentry').alive).toBe(false)
    // The sentry never reached the player (a throw from the hand may graze its thrower for a few points).
    expect(body(session, 'player').health).toBeGreaterThan(90)
    walk(session, { x: EXIT.x - 160, y: 600 }, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.slowTime)

    // tutorial4: crossing the middle sets off the runner, which outpaces the player; throwing the held
    // dagger, typed in slowed time, still beats it.
    walk(session, { x: 430, y: 560 })
    expect(body(session, 'tutorial4dagger').equippedBy).toBe('player')
    walk(session, { x: 1000, y: 420 })
    runFor(session, 200)
    expect(Math.abs((body(session, 'runner') as unknown as { vx: number }).vx)).toBeGreaterThan(0) // it charges
    session.enterCommandMode() // what typing a letter does in the game: time slows
    expect(session.inputMode).toBe('command')
    runFor(session, 400)
    expect(body(session, 'player').alive).not.toBe(false)
    expect(session.submitCommand('mv dagger guard').status).toBe('success')
    runFor(session, 2000)
    expect(body(session, 'runner').alive).toBe(false)
    walk(session, { x: EXIT.x, y: EXIT.y })

    // The tutorial leads into the home area, with full Health.
    const state = session.getWorldState()
    expect(state.currentRoomId).toBe('home')
    expect(body(session, 'player').health).toBe(body(session, 'player').maxHealth)
    expect(state.rooms.find((candidate) => candidate.id === 'home')!.objectIds).toContain('player')
    expect(state.rooms.find((candidate) => candidate.id === TUTORIAL_ROOM_IDS.slowTime)!.objectIds).not.toContain('player')
  })

  it('shows the current room tip in help', () => {
    const session = newGame()
    const result = session.submitCommand('help')
    expect(result.status).toBe('success')
    const text = result.status === 'success' ? result.feedback.map((feedback) => feedback.text).join('\n') : ''
    expect(text).toContain('cd')
    expect(text).toContain('Tip for tutorial1')
    expect(text).toContain('WASD')
  })

  it('explains why cd is refused at a locked exit', () => {
    const session = newGame()
    walk(session, { x: 700, y: 640 }, { x: EXIT.x - 150, y: 640 }, { x: EXIT.x - 150, y: EXIT.y })
    const result = session.submitCommand('cd tutorial2')
    expect(result.status).toBe('rejected')
    expect(result.status === 'rejected' && result.feedback.text).toContain('locked')
    expect(session.submitCommand('cd room1').status).toBe('rejected') // exists, but not next door
    expect(session.submitCommand('cd nowhere').status).toBe('rejected')
  })

  it('keeps room1 on its own as before for the editors and older tests', () => {
    const session = createRoom1Session({ movementBindings: bindings, storage: memoryStorage })
    expect(session.getWorldState().currentRoomId).toBe(ROOM_IDS.first)
    expect(session.getWorldState().rooms.map((candidate) => candidate.id)).toEqual([ROOM_IDS.first, ROOM_IDS.second])
  })
})
