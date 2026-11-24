import { describe, expect, it } from 'vitest'
import { createRoomSession } from './createRoomSession.ts'
import { ROOM_IDS, ROOM_LAYOUT } from './roomConstants.ts'
import { ARENA_IDS } from './arena.ts'
import { WHEEL_DEFINITION, WHEEL_DUMMY, WHEEL_HINT } from './wheel.ts'
import { TUTORIAL_ROOM_IDS } from './tutorialRoomIds.ts'
import { HOME_AREA_IDS } from './homeArea.ts'
import { createGameWorldState } from './tutorialRooms.ts'
import { getRoomDirectoryEntries } from '../commands/RoomDirectory.ts'
import type { GameSession } from '../application/GameSession.ts'
import { collidesPhysically, colliderTagsOf } from '../domain/ColliderTag.ts'
import { isExitOpen, isExitVisible, visibleExitsOf } from '../domain/RoomTravel.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

const NEXT_ID = HOME_AREA_IDS.storage

const bindings = { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'] }
const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage

type Body = { x: number; y: number; vx?: number; vy?: number; health?: number; maxHealth?: number; alive?: boolean; mvLimit?: number }

function wheelSession(): GameSession {
  return createRoomSession({
    movementBindings: bindings,
    storage: memoryStorage,
    worldState: createGameWorldState(undefined, TUTORIAL_ROOM_IDS.flyAround),
  })
}

function objectOf(session: GameSession, id: string) {
  return session.getWorldState().worldObjects.find((worldObject) => worldObject.id === id)!
}

function body(session: GameSession, id: string): Body {
  return objectOf(session, id).state as unknown as Body
}

function runFor(session: GameSession, ms: number): void {
  for (let frame = 0; frame < Math.round(ms / SIMULATION_TICK_MS); frame++) session.update(SIMULATION_TICK_MS)
}

function wheelOf(session: GameSession) {
  const state = session.getWorldState()
  return { state, room: state.rooms.find((room) => room.id === TUTORIAL_ROOM_IDS.flyAround)! }
}

describe('wheel', () => {
  it('is reached from tutorial4, and the arena (not wheel or room) ends the game', () => {
    const state = createGameWorldState()
    const exitOf = (id: string) => state.rooms.find((room) => room.id === id)!.exits[0]
    expect(exitOf(TUTORIAL_ROOM_IDS.mouseThrow).targetRoomId).toBe(TUTORIAL_ROOM_IDS.flyAround)
    expect(exitOf(TUTORIAL_ROOM_IDS.flyAround)).toMatchObject({ targetRoomId: HOME_AREA_IDS.storage })
    expect(exitOf(TUTORIAL_ROOM_IDS.flyAround).endsGame).toBeUndefined()
    expect(exitOf(ROOM_IDS.main)).toMatchObject({ targetRoomId: ARENA_IDS.room })
    expect(exitOf(ROOM_IDS.main).endsGame).toBeUndefined()
    expect(exitOf(ARENA_IDS.room)).toMatchObject({ targetRoomId: ROOM_IDS.end, endsGame: true })
    expect(state.rooms.filter((room) => room.id === TUTORIAL_ROOM_IDS.flyAround)).toHaveLength(1)
  })

  it('holds only a dagger on the left and a Target Dummy on the right, with a hint', () => {
    const { room } = wheelOf(wheelSession())
    expect(room.hint).toBe(WHEEL_HINT)
    expect(room.objectIds.filter((id) => id !== 'player').sort()).toEqual(['wheeldagger', WHEEL_DUMMY.id].sort())
    const session = wheelSession()
    expect(body(session, 'wheeldagger').x).toBeLessThan(body(session, WHEEL_DUMMY.id).x)
    expect(body(session, WHEEL_DUMMY.id).x).toBeGreaterThan(960)
    expect(body(session, 'wheeldagger')).toMatchObject({ mvLimit: 1 })
  })

  it('has a Target Dummy with 1000 Health that nothing collides with', () => {
    const session = wheelSession()
    const dummy = objectOf(session, WHEEL_DUMMY.id)
    expect(colliderTagsOf(dummy)).toEqual([{ class: 'target' }])
    expect(dummy.metadata.name).toBe('dummy')
    expect(body(session, WHEEL_DUMMY.id)).toMatchObject({ health: WHEEL_DUMMY.maxHealth, maxHealth: WHEEL_DUMMY.maxHealth, alive: true })
    for (const other of session.getWorldState().worldObjects) {
      expect(collidesPhysically(dummy, other)).toBe(false)
    }
  })

  it('lets the player walk through the dummy', () => {
    const session = wheelSession()
    const player = body(session, 'player')
    const dummy = body(session, WHEEL_DUMMY.id)
    player.x = dummy.x - 120
    player.y = dummy.y
    session.keyDown('arrowright')
    runFor(session, 800)
    session.releaseAllKeys()
    expect(player.x).toBeGreaterThan(dummy.x)
  })

  it('hurts the dummy when a thrown dagger flies through it, without stopping the dagger', () => {
    const session = wheelSession()
    const dagger = body(session, 'wheeldagger')
    const dummy = body(session, WHEEL_DUMMY.id)
    expect(session.submitCommand('acc dagger dummy').status).toBe('success')
    runFor(session, 1500)
    expect(dummy.health!).toBeLessThan(1000)
    expect(dummy.alive).toBe(true)
    expect(Math.hypot(dagger.x - dummy.x, dagger.y - dummy.y)).toBeLessThan(20)
  })

  it('bars the exit to storage on the right wall until the dummy is defeated', () => {
    const session = wheelSession()
    const { state, room } = wheelOf(session)
    const exit = room.exits[0]
    expect(exit).toMatchObject({ targetRoomId: NEXT_ID, x: ROOM_LAYOUT.exit.x, y: ROOM_LAYOUT.exit.y })
    expect(exit.hiddenUntilOpen).toBeUndefined()
    expect(isExitVisible(state, room, exit)).toBe(true)
    expect(isExitOpen(state, room, exit)).toBe(false)
    expect(visibleExitsOf(state, room)).toEqual([exit])

    body(session, WHEEL_DUMMY.id).health = 1
    expect(session.submitCommand('acc dagger dummy').status).toBe('success')
    runFor(session, 1500)

    expect(body(session, WHEEL_DUMMY.id).alive).toBe(false)
    expect(isExitOpen(state, room, exit)).toBe(true)
    expect(visibleExitsOf(state, room)).toEqual([exit])
  })

  it('lists the barred exit in the room listing and Tab completion from the start', () => {
    const session = wheelSession()
    expect(session.getCommandCompletionCandidates('acc dagger ', 'acc dagger '.length)).toContain(`${NEXT_ID}/`)
    const { state, room } = wheelOf(session)
    expect(getRoomDirectoryEntries(state, room, true)).toContain(NEXT_ID)
  })

  it('targets the exit with acc once it is open', () => {
    const session = wheelSession()
    body(session, WHEEL_DUMMY.id).alive = false
    expect(session.getCommandCompletionCandidates('acc dagger ', 'acc dagger '.length)).toContain(`${NEXT_ID}/`)
    expect(session.submitCommand(`acc dagger ${NEXT_ID}`).status).toBe('success')
    expect(objectOf(session, 'wheeldagger').metadata.name).toBe('dagger')
  })

  it('leads on to storage when the player walks into the open exit', () => {
    const session = wheelSession()
    body(session, WHEEL_DUMMY.id).alive = false
    const player = body(session, 'player')
    player.x = ROOM_LAYOUT.exit.x - 100
    player.y = ROOM_LAYOUT.exit.y
    session.keyDown('arrowright')
    runFor(session, 1000)
    expect(session.getWorldState().currentRoomId).toBe(NEXT_ID)
    expect(session.getWorldState().outcome).toBe('playing')
  })

  it('keeps the exit unreachable while the dummy lives', () => {
    const session = wheelSession()
    const player = body(session, 'player')
    player.x = ROOM_LAYOUT.exit.x - 100
    player.y = ROOM_LAYOUT.exit.y
    session.keyDown('arrowright')
    runFor(session, 1000)
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.flyAround)
    expect(session.getWorldState().outcome).toBe('playing')
  })

  it('is described for the editor from the same definition', () => {
    expect(WHEEL_DEFINITION.exit).toMatchObject({
      targetRoomId: NEXT_ID,
      requires: { kind: 'defeat', objectIds: [WHEEL_DUMMY.id] },
    })
    expect(WHEEL_DEFINITION.exit.hiddenUntilOpen).toBeUndefined()
  })
})
