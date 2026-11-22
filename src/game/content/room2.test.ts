import { describe, expect, it } from 'vitest'
import { createRoom1Session } from './createRoom1Session.ts'
import { ROOM_IDS } from './room1Constants.ts'
import { ROOM2_DEFINITION, ROOM2_DUMMY, ROOM2_HINT, ROOM3_ID } from './room2.ts'
import { createGameWorldState } from './tutorialRooms.ts'
import { getRoomDirectoryEntries } from '../commands/RoomDirectory.ts'
import type { GameSession } from '../application/GameSession.ts'
import { collidesPhysically, colliderTagsOf } from '../domain/ColliderTag.ts'
import { isExitOpen, isExitVisible, visibleExitsOf } from '../domain/RoomTravel.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

const bindings = { up: ['arrowup'], down: ['arrowdown'], left: ['arrowleft'], right: ['arrowright'] }
const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage

type Body = { x: number; y: number; vx?: number; vy?: number; health?: number; maxHealth?: number; alive?: boolean; mvLimit?: number }

function room2Session(): GameSession {
  return createRoom1Session({
    movementBindings: bindings,
    storage: memoryStorage,
    worldState: createGameWorldState(undefined, ROOM_IDS.second),
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

function room2Of(session: GameSession) {
  const state = session.getWorldState()
  return { state, room: state.rooms.find((room) => room.id === ROOM_IDS.second)! }
}

describe('room2', () => {
  it('is reached from room1 instead of ending the game there', () => {
    const state = createGameWorldState()
    const room1Exit = state.rooms.find((room) => room.id === ROOM_IDS.first)!.exits[0]
    expect(room1Exit.targetRoomId).toBe(ROOM_IDS.second)
    expect(room1Exit.endsGame).toBeUndefined()
    expect(state.rooms.filter((room) => room.id === ROOM_IDS.second)).toHaveLength(1)
  })

  it('holds only a dagger on the left and a Target Dummy on the right, with a hint', () => {
    const { room } = room2Of(room2Session())
    expect(room.hint).toBe(ROOM2_HINT)
    expect(room.objectIds.filter((id) => id !== 'player').sort()).toEqual(['room2dagger', ROOM2_DUMMY.id].sort())
    const session = room2Session()
    expect(body(session, 'room2dagger').x).toBeLessThan(body(session, ROOM2_DUMMY.id).x)
    expect(body(session, ROOM2_DUMMY.id).x).toBeGreaterThan(960)
    expect(body(session, 'room2dagger')).toMatchObject({ mvLimit: -1 })
  })

  it('has a Target Dummy with 1000 Health that nothing collides with', () => {
    const session = room2Session()
    const dummy = objectOf(session, ROOM2_DUMMY.id)
    expect(colliderTagsOf(dummy)).toEqual([{ class: 'target' }])
    expect(dummy.metadata.name).toBe('dummy')
    expect(body(session, ROOM2_DUMMY.id)).toMatchObject({ health: 1000, maxHealth: 1000, alive: true })
    for (const other of session.getWorldState().worldObjects) {
      expect(collidesPhysically(dummy, other)).toBe(false)
    }
  })

  it('lets the player walk through the dummy', () => {
    const session = room2Session()
    const player = body(session, 'player')
    const dummy = body(session, ROOM2_DUMMY.id)
    player.x = dummy.x - 120
    player.y = dummy.y
    session.keyDown('arrowright')
    runFor(session, 800)
    session.releaseAllKeys()
    expect(player.x).toBeGreaterThan(dummy.x)
  })

  it('hurts the dummy when a thrown dagger flies through it, without stopping the dagger', () => {
    const session = room2Session()
    const dagger = body(session, 'room2dagger')
    const dummy = body(session, ROOM2_DUMMY.id)
    expect(session.submitCommand('acc dagger dummy').status).toBe('success')
    runFor(session, 1500)
    expect(dummy.health!).toBeLessThan(1000)
    expect(dummy.alive).toBe(true)
    expect(Math.hypot(dagger.x - dummy.x, dagger.y - dummy.y)).toBeLessThan(20)
  })

  it('hides the exit to room3 until the dummy is defeated, then shows it where the dummy stood', () => {
    const session = room2Session()
    const { state, room } = room2Of(session)
    const exit = room.exits[0]
    expect(exit).toMatchObject({ targetRoomId: ROOM3_ID, x: ROOM2_DUMMY.x, y: ROOM2_DUMMY.y, endsGame: true })
    expect(isExitVisible(state, room, exit)).toBe(false)
    expect(visibleExitsOf(state, room)).toEqual([])

    body(session, ROOM2_DUMMY.id).health = 1
    expect(session.submitCommand('acc dagger dummy').status).toBe('success')
    runFor(session, 1500)

    expect(body(session, ROOM2_DUMMY.id).alive).toBe(false)
    expect(isExitOpen(state, room, exit)).toBe(true)
    expect(visibleExitsOf(state, room)).toEqual([exit])
  })

  it('keeps the Hidden Exit out of the room listing, Tab completion and acc until it opens', () => {
    const session = room2Session()
    const names = () => session.getCommandCompletionCandidates('acc dagger ', 'acc dagger '.length)
    expect(names()).not.toContain(`${ROOM3_ID}/`)
    const { state, room } = room2Of(session)
    expect(getRoomDirectoryEntries(state, room, true)).not.toContain(ROOM3_ID)

    const result = session.submitCommand(`acc dagger ${ROOM3_ID}`)
    expect(result.status).toBe('rejected')
    expect(result.feedback).toEqual({ kind: 'popup', text: `Cannot find "${ROOM3_ID}".` })
    expect(objectOf(session, 'room2dagger').metadata.name).toBe('dagger')
  })

  it('targets the revealed exit with acc', () => {
    const session = room2Session()
    body(session, ROOM2_DUMMY.id).alive = false
    expect(session.getCommandCompletionCandidates('acc dagger ', 'acc dagger '.length)).toContain(`${ROOM3_ID}/`)
    expect(session.submitCommand(`acc dagger ${ROOM3_ID}`).status).toBe('success')
    expect(objectOf(session, 'room2dagger').metadata.name).toBe('dagger')
  })

  it('ends the game when the player walks into the revealed exit', () => {
    const session = room2Session()
    body(session, ROOM2_DUMMY.id).alive = false
    const player = body(session, 'player')
    player.x = ROOM2_DUMMY.x - 100
    player.y = ROOM2_DUMMY.y
    session.keyDown('arrowright')
    runFor(session, 1000)
    expect(session.getWorldState().currentRoomId).toBe(ROOM3_ID)
    expect(session.getWorldState().outcome).toBe('congratulations')
  })

  it('keeps the exit unreachable while the dummy lives', () => {
    const session = room2Session()
    const player = body(session, 'player')
    player.x = ROOM2_DUMMY.x - 100
    player.y = ROOM2_DUMMY.y
    session.keyDown('arrowright')
    runFor(session, 1000)
    expect(session.getWorldState().currentRoomId).toBe(ROOM_IDS.second)
    expect(session.getWorldState().outcome).toBe('playing')
  })

  it('is described for the editor from the same definition', () => {
    expect(ROOM2_DEFINITION.exit.hiddenUntilOpen).toBe(true)
  })
})
