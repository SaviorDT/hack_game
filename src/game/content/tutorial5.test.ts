import { describe, expect, it } from 'vitest'
import { createRoomSession } from './createRoomSession.ts'
import { ROOM_IDS } from './roomConstants.ts'
import { TUTORIAL5_DEFINITION, TUTORIAL5_DUMMY, TUTORIAL5_HINT } from './tutorial5.ts'
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

function tutorial5Session(): GameSession {
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

function tutorial5Of(session: GameSession) {
  const state = session.getWorldState()
  return { state, room: state.rooms.find((room) => room.id === TUTORIAL_ROOM_IDS.flyAround)! }
}

describe('tutorial5', () => {
  it('is reached from tutorial4, and room (not tutorial5) ends the game', () => {
    const state = createGameWorldState()
    const exitOf = (id: string) => state.rooms.find((room) => room.id === id)!.exits[0]
    expect(exitOf(TUTORIAL_ROOM_IDS.mouseThrow).targetRoomId).toBe(TUTORIAL_ROOM_IDS.flyAround)
    expect(exitOf(TUTORIAL_ROOM_IDS.flyAround)).toMatchObject({ targetRoomId: HOME_AREA_IDS.storage })
    expect(exitOf(TUTORIAL_ROOM_IDS.flyAround).endsGame).toBeUndefined()
    expect(exitOf(ROOM_IDS.main)).toMatchObject({ targetRoomId: ROOM_IDS.end, endsGame: true })
    expect(state.rooms.filter((room) => room.id === TUTORIAL_ROOM_IDS.flyAround)).toHaveLength(1)
  })

  it('holds only a dagger on the left and a Target Dummy on the right, with a hint', () => {
    const { room } = tutorial5Of(tutorial5Session())
    expect(room.hint).toBe(TUTORIAL5_HINT)
    expect(room.objectIds.filter((id) => id !== 'player').sort()).toEqual(['tutorial5dagger', TUTORIAL5_DUMMY.id].sort())
    const session = tutorial5Session()
    expect(body(session, 'tutorial5dagger').x).toBeLessThan(body(session, TUTORIAL5_DUMMY.id).x)
    expect(body(session, TUTORIAL5_DUMMY.id).x).toBeGreaterThan(960)
    expect(body(session, 'tutorial5dagger')).toMatchObject({ mvLimit: 1 })
  })

  it('has a Target Dummy with 1000 Health that nothing collides with', () => {
    const session = tutorial5Session()
    const dummy = objectOf(session, TUTORIAL5_DUMMY.id)
    expect(colliderTagsOf(dummy)).toEqual([{ class: 'target' }])
    expect(dummy.metadata.name).toBe('dummy')
    expect(body(session, TUTORIAL5_DUMMY.id)).toMatchObject({ health: TUTORIAL5_DUMMY.maxHealth, maxHealth: TUTORIAL5_DUMMY.maxHealth, alive: true })
    for (const other of session.getWorldState().worldObjects) {
      expect(collidesPhysically(dummy, other)).toBe(false)
    }
  })

  it('lets the player walk through the dummy', () => {
    const session = tutorial5Session()
    const player = body(session, 'player')
    const dummy = body(session, TUTORIAL5_DUMMY.id)
    player.x = dummy.x - 120
    player.y = dummy.y
    session.keyDown('arrowright')
    runFor(session, 800)
    session.releaseAllKeys()
    expect(player.x).toBeGreaterThan(dummy.x)
  })

  it('hurts the dummy when a thrown dagger flies through it, without stopping the dagger', () => {
    const session = tutorial5Session()
    const dagger = body(session, 'tutorial5dagger')
    const dummy = body(session, TUTORIAL5_DUMMY.id)
    expect(session.submitCommand('acc dagger dummy').status).toBe('success')
    runFor(session, 1500)
    expect(dummy.health!).toBeLessThan(1000)
    expect(dummy.alive).toBe(true)
    expect(Math.hypot(dagger.x - dummy.x, dagger.y - dummy.y)).toBeLessThan(20)
  })

  it('hides the exit to storage until the dummy is defeated, then shows it where the dummy stood', () => {
    const session = tutorial5Session()
    const { state, room } = tutorial5Of(session)
    const exit = room.exits[0]
    expect(exit).toMatchObject({ targetRoomId: NEXT_ID, x: TUTORIAL5_DUMMY.x, y: TUTORIAL5_DUMMY.y })
    expect(isExitVisible(state, room, exit)).toBe(false)
    expect(visibleExitsOf(state, room)).toEqual([])

    body(session, TUTORIAL5_DUMMY.id).health = 1
    expect(session.submitCommand('acc dagger dummy').status).toBe('success')
    runFor(session, 1500)

    expect(body(session, TUTORIAL5_DUMMY.id).alive).toBe(false)
    expect(isExitOpen(state, room, exit)).toBe(true)
    expect(visibleExitsOf(state, room)).toEqual([exit])
  })

  it('keeps the Hidden Exit out of the room listing, Tab completion and acc until it opens', () => {
    const session = tutorial5Session()
    const names = () => session.getCommandCompletionCandidates('acc dagger ', 'acc dagger '.length)
    expect(names()).not.toContain(`${NEXT_ID}/`)
    const { state, room } = tutorial5Of(session)
    expect(getRoomDirectoryEntries(state, room, true)).not.toContain(NEXT_ID)

    const result = session.submitCommand(`acc dagger ${NEXT_ID}`)
    expect(result.status).toBe('rejected')
    expect(result.feedback).toEqual({ kind: 'popup', text: `Cannot find "${NEXT_ID}".` })
    expect(objectOf(session, 'tutorial5dagger').metadata.name).toBe('dagger')
  })

  it('targets the revealed exit with acc', () => {
    const session = tutorial5Session()
    body(session, TUTORIAL5_DUMMY.id).alive = false
    expect(session.getCommandCompletionCandidates('acc dagger ', 'acc dagger '.length)).toContain(`${NEXT_ID}/`)
    expect(session.submitCommand(`acc dagger ${NEXT_ID}`).status).toBe('success')
    expect(objectOf(session, 'tutorial5dagger').metadata.name).toBe('dagger')
  })

  it('leads on to storage when the player walks into the revealed exit', () => {
    const session = tutorial5Session()
    body(session, TUTORIAL5_DUMMY.id).alive = false
    const player = body(session, 'player')
    player.x = TUTORIAL5_DUMMY.x - 100
    player.y = TUTORIAL5_DUMMY.y
    session.keyDown('arrowright')
    runFor(session, 1000)
    expect(session.getWorldState().currentRoomId).toBe(NEXT_ID)
    expect(session.getWorldState().outcome).toBe('playing')
  })

  it('keeps the exit unreachable while the dummy lives', () => {
    const session = tutorial5Session()
    const player = body(session, 'player')
    player.x = TUTORIAL5_DUMMY.x - 100
    player.y = TUTORIAL5_DUMMY.y
    session.keyDown('arrowright')
    runFor(session, 1000)
    expect(session.getWorldState().currentRoomId).toBe(TUTORIAL_ROOM_IDS.flyAround)
    expect(session.getWorldState().outcome).toBe('playing')
  })

  it('is described for the editor from the same definition', () => {
    expect(TUTORIAL5_DEFINITION.exit.hiddenUntilOpen).toBe(true)
  })
})
