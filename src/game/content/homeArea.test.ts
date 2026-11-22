import { describe, expect, it } from 'vitest'
import { createRoom1Session } from './createRoom1Session.ts'
import { createGameWorldState, TUTORIAL_ROOM_IDS } from './tutorialRooms.ts'
import { HOME_AREA_IDS } from './homeArea.ts'
import { ROOM_IDS, ROOM_LAYOUT } from './room1Constants.ts'
import type { GameSession } from '../application/GameSession.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { isExitOpen } from '../domain/RoomTravel.ts'
import { isPlatePressed } from '../domain/PressurePlate.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

const bindings = { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'] }
const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage
const EXIT = ROOM_LAYOUT.exit

type Body = { x: number; y: number; vx?: number; alive?: boolean; health?: number; maxHealth?: number; equippedBy?: string | null }

/** The full game, with the player moved to the start of `roomId`. */
function gameIn(roomId: string): GameSession {
  const state: WorldState = createGameWorldState()
  const player = state.worldObjects.find((worldObject) => worldObject.id === 'player')!
  const target = state.rooms.find((room) => room.id === roomId)!
  state.rooms = state.rooms.map((room) =>
    room.id === roomId
      ? { ...room, objectIds: [...room.objectIds, 'player'] }
      : { ...room, objectIds: room.objectIds.filter((id) => id !== 'player') },
  )
  player.roomId = roomId
  Object.assign(player.state as object, target.entry)
  state.currentRoomId = roomId
  return createRoom1Session({ movementBindings: bindings, storage: memoryStorage, worldState: state })
}

function body(session: GameSession, id: string): Body {
  return session.getWorldState().worldObjects.find((candidate) => candidate.id === id)!.state as unknown as Body
}

function exitOpen(session: GameSession): boolean {
  const state = session.getWorldState()
  const room = state.rooms.find((candidate) => candidate.id === state.currentRoomId)!
  return isExitOpen(state, room, room.exits[0])
}

function plateDown(session: GameSession, id: string): boolean {
  const state = session.getWorldState()
  return isPlatePressed(state, state.worldObjects.find((candidate) => candidate.id === id)!)
}

function runFor(session: GameSession, ms: number): void {
  for (let frame = 0; frame < Math.round(ms / SIMULATION_TICK_MS); frame++) session.update(SIMULATION_TICK_MS)
}

/** Steers the player through the waypoints; stops when pressed against something or when the room changes. */
function walk(session: GameSession, ...waypoints: { x: number; y: number }[]): void {
  const startRoom = session.getWorldState().currentRoomId
  for (const target of waypoints) {
    let stuck = 0
    let last = { x: Number.NaN, y: Number.NaN }
    for (let frame = 0; frame < 900; frame++) {
      if (session.getWorldState().currentRoomId !== startRoom) break
      const player = body(session, 'player')
      const dx = target.x - player.x
      const dy = target.y - player.y
      if (Math.hypot(dx, dy) < 12) break
      stuck = Math.hypot(player.x - last.x, player.y - last.y) < 0.5 ? stuck + 1 : 0
      if (stuck > 20) break
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

describe('home area', () => {
  it('follows the tutorial and leads into room1', () => {
    const state = createGameWorldState()
    const exitOf = (id: string) => state.rooms.find((room) => room.id === id)!.exits[0].targetRoomId
    expect(exitOf(TUTORIAL_ROOM_IDS.slowTime)).toBe(HOME_AREA_IDS.home)
    expect([exitOf('home'), exitOf('storage'), exitOf('yard'), exitOf('lane'), exitOf('gate')]).toEqual([
      'storage',
      'yard',
      'lane',
      'gate',
      ROOM_IDS.first,
    ])
    expect(new Set(state.worldObjects.map((worldObject) => worldObject.id)).size).toBe(state.worldObjects.length)
    // Arrows are never something the player can list or name.
    expect(state.worldObjects.filter((worldObject) => worldObject.metadata.kind === 'arrow').length).toBe(9)
  })

  it('home: the wall stops the player until the crate is shoved through the gap', () => {
    const session = gameIn(HOME_AREA_IDS.home)
    walk(session, { x: 820, y: 250 })
    expect(body(session, 'player').x).toBeLessThan(880) // the wall holds the player back
    walk(session, { x: 760, y: 400 }, { x: 1200, y: 400 })
    expect(body(session, 'homecrate').x).toBeGreaterThan(960) // shoved out of the gap
    walk(session, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(HOME_AREA_IDS.storage)
  })

  it('storage: standing on the plate opens the exit only while you stay; a crate keeps it open', () => {
    const session = gameIn(HOME_AREA_IDS.storage)
    expect(exitOpen(session)).toBe(false)
    walk(session, { x: 1000, y: 400 }, { x: 1500, y: 560 })
    expect(plateDown(session, 'storageplate')).toBe(true)
    expect(exitOpen(session)).toBe(true)
    walk(session, { x: 1500, y: 380 })
    expect(exitOpen(session)).toBe(false) // stepped off: locked again

    expect(session.submitCommand('acc crate plate').status).toBe('success')
    runFor(session, 2500)
    expect(plateDown(session, 'storageplate')).toBe(true)
    expect(exitOpen(session)).toBe(true)
    walk(session, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(HOME_AREA_IDS.yard)
  })

  it('yard: the archer shoots, pillars stop arrows, and a thrown dagger takes it down', () => {
    const session = gameIn(HOME_AREA_IDS.yard)
    runFor(session, 2500)
    expect(body(session, 'player').health).toBe(100) // the entrance is behind the middle pillar
    walk(session, { x: 520, y: 250 }, { x: 760, y: 150 })
    runFor(session, 1500)
    expect(body(session, 'player').health!).toBeLessThan(100) // out in the open you get hit

    walk(session, { x: 560, y: 150 }, { x: 540, y: 420 }, { x: 430, y: 560 })
    expect(body(session, 'yarddagger').equippedBy).toBe('player')
    walk(session, { x: 850, y: 650 }, { x: 1150, y: 420 })
    expect(session.submitCommand('acc dagger archer').status).toBe('success')
    runFor(session, 2000)
    expect(body(session, 'yardarcher').alive).toBe(false)
    expect(body(session, 'player').alive).not.toBe(false)
    walk(session, { x: 1500, y: 650 }, { x: 1700, y: 650 }, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(HOME_AREA_IDS.lane)
  })

  it('pillars stop arrows: hiding behind one keeps the player safe', () => {
    const session = gameIn(HOME_AREA_IDS.yard)
    // Tucked behind the middle pillar, out of the archer's line.
    walk(session, { x: 900, y: 420 })
    const before = body(session, 'player').health!
    runFor(session, 4000)
    expect(body(session, 'player').health).toBe(before)
  })

  it('lane: the archer covers the plate until the boulder is moved onto it, which also blocks the window', () => {
    // Without the boulder, standing on the plate under the window is costly.
    const exposed = gameIn(HOME_AREA_IDS.lane)
    walk(exposed, { x: 1200, y: 600 }, { x: 1505, y: 450 })
    const startHealth = body(exposed, 'player').health!
    runFor(exposed, 3000)
    expect(body(exposed, 'player').health!).toBeLessThan(startHealth)

    const session = gameIn(HOME_AREA_IDS.lane)
    expect(exitOpen(session)).toBe(false)
    expect(session.submitCommand('acc boulder plate').status).toBe('success')
    runFor(session, 3000)
    expect(plateDown(session, 'laneplate')).toBe(true)
    expect(exitOpen(session)).toBe(true)
    // With the window plugged, the walk past it is safe.
    const before = body(session, 'player').health!
    walk(session, { x: 1200, y: 600 }, { x: 1505, y: 520 })
    runFor(session, 3000)
    expect(body(session, 'player').health).toBe(before)
    walk(session, { x: 1700, y: 520 }, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(HOME_AREA_IDS.gate)
  })

  it('gate: the exit needs the plate held down and both guards defeated', () => {
    const session = gameIn(HOME_AREA_IDS.gate)
    // Fight from cover: below-left of the right pillar the archer cannot see you, but you are past the middle
    // of the room, so the guards come to you (and walk through the archer's arrows on the way).
    walk(session, { x: 420, y: 560 })
    expect(body(session, 'gatedagger').equippedBy).toBe('player')
    // Up and around the boulder and the crate, through the gap between the left pillars.
    walk(session, { x: 420, y: 300 }, { x: 645, y: 300 }, { x: 645, y: 420 }, { x: 1000, y: 420 }, { x: 1180, y: 500 })
    for (let i = 0; i < 80 && !(body(session, 'gateguard').alive === false && body(session, 'gateguard2').alive === false); i++) {
      session.attack()
      runFor(session, 100)
      if (body(session, 'player').alive === false) break
    }
    expect(body(session, 'player').alive).not.toBe(false)
    expect(body(session, 'gateguard').alive).toBe(false)
    expect(body(session, 'gateguard2').alive).toBe(false)
    expect(exitOpen(session)).toBe(false) // the plate is still up

    // With the guards gone (and the player out of its path), the crate can fly to the plate.
    walk(session, { x: 1000, y: 300 })
    expect(session.submitCommand('acc crate plate').status).toBe('success')
    runFor(session, 2500)
    expect(plateDown(session, 'gateplate')).toBe(true)
    expect(exitOpen(session)).toBe(true)
    walk(session, { x: 1500, y: 420 }, { x: EXIT.x, y: EXIT.y })
    expect(session.getWorldState().currentRoomId).toBe(ROOM_IDS.first)
  })

  it('keeps arrows out of tab completion and acc', () => {
    const session = gameIn(HOME_AREA_IDS.yard)
    expect(session.getCommandCompletionCandidates('acc yardarcher', 12).some((candidate) => candidate.includes('arrow'))).toBe(false)
    expect(session.submitCommand('acc yardarcherarrow1 hacker').status).toBe('rejected')
  })
})
