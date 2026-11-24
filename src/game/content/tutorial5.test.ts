import { describe, expect, it } from 'vitest'
import { createRoomSession } from './createRoomSession.ts'
import { ROOM_IDS, ROOM_LAYOUT } from './roomConstants.ts'
import { ARENA_IDS, ARENA_PLATES } from './arena.ts'
import { TUTORIAL5_DEFINITION, TUTORIAL5_HINT, TUTORIAL5_PLATES } from './tutorial5.ts'
import { TUTORIAL_ROOM_IDS } from './tutorialRoomIds.ts'
import { HOME_AREA_IDS } from './homeArea.ts'
import { createGameWorldState } from './tutorialRooms.ts'
import type { GameSession } from '../application/GameSession.ts'
import { isExitOpen } from '../domain/RoomTravel.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

const NEXT_ID = HOME_AREA_IDS.storage

const bindings = { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'] }
const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage

type Body = { x: number; y: number }

function tutorial5Session(): GameSession {
  return createRoomSession({
    movementBindings: bindings,
    storage: memoryStorage,
    worldState: createGameWorldState(undefined, TUTORIAL_ROOM_IDS.selfThrow),
  })
}

function body(session: GameSession, id: string): Body {
  return session.getWorldState().worldObjects.find((worldObject) => worldObject.id === id)!.state as unknown as Body
}

function tutorial5Of(session: GameSession) {
  const state = session.getWorldState()
  return { state, room: state.rooms.find((room) => room.id === TUTORIAL_ROOM_IDS.selfThrow)! }
}

/** Runs the session until it leaves tutorial5 or `ms` of game time pass. */
function runUntilLeft(session: GameSession, ms: number): void {
  for (let frame = 0; frame < Math.round(ms / SIMULATION_TICK_MS); frame++) {
    session.update(SIMULATION_TICK_MS)
    if (session.getWorldState().currentRoomId !== TUTORIAL_ROOM_IDS.selfThrow) return
  }
}

describe('tutorial5', () => {
  it('is reached from tutorial4 and leads on to storage; the arena still ends the game', () => {
    const state = createGameWorldState()
    const exitOf = (id: string) => state.rooms.find((room) => room.id === id)!.exits[0]
    expect(exitOf(TUTORIAL_ROOM_IDS.mouseThrow).targetRoomId).toBe(TUTORIAL_ROOM_IDS.selfThrow)
    expect(exitOf(TUTORIAL_ROOM_IDS.selfThrow)).toMatchObject({ targetRoomId: NEXT_ID })
    expect(exitOf(TUTORIAL_ROOM_IDS.selfThrow).endsGame).toBeUndefined()
    expect(exitOf(ROOM_IDS.main)).toMatchObject({ targetRoomId: ARENA_IDS.room })
    expect(exitOf(ARENA_IDS.room)).toMatchObject({ targetRoomId: ROOM_IDS.end, endsGame: true })
    expect(state.rooms.filter((room) => room.id === TUTORIAL_ROOM_IDS.selfThrow)).toHaveLength(1)
  })

  it('holds only plates named and placed like the arena\'s, and a hint that shows the command', () => {
    const { room } = tutorial5Of(tutorial5Session())
    expect(room.hint).toBe(TUTORIAL5_HINT)
    expect(TUTORIAL5_HINT).toContain('acc hacker bl')
    expect(TUTORIAL5_HINT).toContain(`acc hacker ${NEXT_ID}`)
    expect(room.objectIds.filter((id) => id !== 'player').sort()).toEqual(TUTORIAL5_PLATES.map(({ id }) => id).sort())
    expect(TUTORIAL5_PLATES.map(({ name }) => name).sort()).toEqual(['b', 'bl', 'br', 'l'])
    for (const { name, x, y } of TUTORIAL5_PLATES) {
      expect(ARENA_PLATES).toContainEqual({ name, x, y })
    }
  })

  it('has an open Exit on the right wall', () => {
    const { state, room } = tutorial5Of(tutorial5Session())
    expect(room.exits[0]).toMatchObject({ targetRoomId: NEXT_ID, x: ROOM_LAYOUT.exit.x, y: ROOM_LAYOUT.exit.y })
    expect(isExitOpen(state, room, room.exits[0])).toBe(true)
  })

  it('lands the player on a plate they throw themselves to', () => {
    const session = tutorial5Session()
    expect(session.submitCommand('acc hacker bl').status).toBe('success')
    runUntilLeft(session, 3000)
    const plate = TUTORIAL5_PLATES.find(({ name }) => name === 'bl')!
    const player = body(session, 'player')
    expect(Math.hypot(player.x - plate.x, player.y - plate.y)).toBeLessThan(20)
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.selfThrow)
  })

  it('leads on to storage when the player throws themselves into the exit', () => {
    const session = tutorial5Session()
    expect(session.submitCommand(`acc hacker ${NEXT_ID}`).status).toBe('success')
    runUntilLeft(session, 4000)
    expect(session.getWorldState().currentRoomId).toBe(NEXT_ID)
    expect(session.getWorldState().outcome).toBe('playing')
  })

  it('also lets a player who walks to the exit through', () => {
    const session = tutorial5Session()
    session.keyDown('arrowright')
    runUntilLeft(session, 8000)
    expect(session.getWorldState().currentRoomId).toBe(NEXT_ID)
  })

  it('is described for the editor from the same definition', () => {
    expect(TUTORIAL5_DEFINITION.exit).toMatchObject({ targetRoomId: NEXT_ID })
    expect(TUTORIAL5_DEFINITION.exit.requires).toBeUndefined()
  })
})
