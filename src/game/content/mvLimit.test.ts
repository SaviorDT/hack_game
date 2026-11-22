import { describe, expect, it } from 'vitest'
import { createRoom1Session } from './createRoom1Session.ts'
import { generateRoom1Source } from './room1Serializer.ts'
import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from './room1Constants.ts'
import { createInitialWorldState } from './room1WorldState.ts'
import type { GameSession } from '../application/GameSession.ts'
import { PickUpService } from '../domain/PickUpService.ts'
import { generatePrefabSource } from '../domain/prefabSerializer.ts'
import { SIMULATION_TICK_MS } from '../simulation/TickSimulationEngine.ts'

const bindings = { up: ['w'], down: ['s'], left: ['a'], right: ['d'] }
const memoryStorage = { getItem: () => null, setItem: () => undefined } as unknown as Storage

type Body = { x: number; y: number; vx?: number; alive?: boolean; destroyed?: boolean; mvLimit?: number; weaponId?: string | null; equippedBy?: string | null }

function newSession(): GameSession {
  return createRoom1Session({ movementBindings: bindings, storage: memoryStorage })
}

function body(session: GameSession, id: string): Body {
  return session.getWorldState().worldObjects.find((worldObject) => worldObject.id === id)!.state as unknown as Body
}

function runFor(session: GameSession, ms: number): void {
  for (let frame = 0; frame < Math.round(ms / SIMULATION_TICK_MS); frame++) session.update(SIMULATION_TICK_MS)
}

describe('Mv Limit in play', () => {
  it('destroys a dagger when its Throw arrives at the target', () => {
    const session = newSession()
    expect(session.submitCommand('mv dagger guard').status).toBe('success')
    expect(body(session, WORLD_OBJECT_IDS.dagger).mvLimit).toBe(0)
    expect(body(session, WORLD_OBJECT_IDS.dagger).destroyed).toBeUndefined() // still in flight

    runFor(session, 2000)

    expect(body(session, WORLD_OBJECT_IDS.dagger)).toMatchObject({ destroyed: true, alive: false })
  })

  it('destroys a dagger as soon as its Throw ends in a Collision, short of the target', () => {
    const session = newSession()
    const dagger = body(session, WORLD_OBJECT_IDS.dagger)
    const boulder = body(session, WORLD_OBJECT_IDS.boulder)
    // The boulder sits between the dagger and the guard.
    dagger.x = 400
    dagger.y = 500
    boulder.x = 700
    boulder.y = 500
    expect(session.submitCommand('mv dagger guard').status).toBe('success')

    runFor(session, 3000)

    expect(dagger.destroyed).toBe(true)
    expect(dagger.x).toBeLessThan(boulder.x)
  })

  it('lets a Throw with no Collision end by arrival first, so the dagger flies the whole way', () => {
    const session = newSession()
    const dagger = body(session, WORLD_OBJECT_IDS.dagger)
    dagger.x = 400
    dagger.y = 600
    const target = { x: 900, y: 600 }
    expect(session.submitCommand('mv dagger $mouse', { mouse: target }).status).toBe('success')
    runFor(session, 40)
    expect(dagger.destroyed).toBeUndefined()
    runFor(session, 2000)
    expect(dagger.destroyed).toBe(true)
    expect(Math.hypot(dagger.x - target.x, dagger.y - target.y)).toBeLessThan(20)
  })

  it('flies out of the room and is destroyed on arrival at a target outside it', () => {
    const session = newSession()
    const dagger = body(session, WORLD_OBJECT_IDS.dagger)
    dagger.x = ROOM_LAYOUT.right - 200
    dagger.y = 600
    expect(session.submitCommand('mv dagger $mouse', { mouse: { x: ROOM_LAYOUT.right + 400, y: 600 } }).status).toBe('success')
    runFor(session, 2000)
    expect(dagger.x).toBeGreaterThan(ROOM_LAYOUT.right)
    expect(dagger.destroyed).toBe(true)
  })

  it('stops the player holding a dagger that is destroyed', () => {
    const session = newSession()
    const player = body(session, WORLD_OBJECT_IDS.player)
    const dagger = body(session, WORLD_OBJECT_IDS.dagger)
    dagger.x = player.x
    dagger.y = player.y
    runFor(session, 100)
    expect(player.weaponId).toBe(WORLD_OBJECT_IDS.dagger)

    expect(session.submitCommand('mv dagger hacker').status).toBe('success')
    runFor(session, 500)

    expect(dagger.destroyed).toBe(true)
    expect(player.weaponId).toBeNull()
    expect(dagger.equippedBy).toBeNull()
  })

  it('keeps a dagger with no limit flying through any number of throws', () => {
    const session = newSession()
    const dagger = body(session, WORLD_OBJECT_IDS.dagger)
    dagger.mvLimit = -1
    dagger.x = 400
    dagger.y = 600
    for (let i = 0; i < 3; i++) {
      expect(session.submitCommand('mv dagger $mouse', { mouse: { x: 600 + i * 100, y: 600 } }).status).toBe('success')
      runFor(session, 1000)
    }
    expect(dagger.destroyed).toBeUndefined()
    expect(dagger.alive).not.toBe(false)
  })

  it('does not let anyone pick up a destroyed dagger', () => {
    const state = createInitialWorldState()
    const player = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!.state as unknown as Body
    const dagger = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!.state as unknown as Body
    dagger.x = player.x
    dagger.y = player.y
    dagger.destroyed = true
    dagger.alive = false

    expect(new PickUpService().pickUp(state, WORLD_OBJECT_IDS.player).status).toBe('nothing-in-reach')
  })
})

describe('Mv Limit in saved sources', () => {
  it('writes mvLimit to room1.ts and to the prefab source only when it is set', () => {
    const room = generateRoom1Source([
      { id: 'a', role: 'weapon', x: 1, y: 2, displayWidth: 10, displayHeight: 10, mvLimit: 3 },
      { id: 'b', role: 'object', x: 1, y: 2, displayWidth: 10, displayHeight: 10 },
    ])
    expect(room.match(/mvLimit: 3,/g)).toHaveLength(1)

    const prefab = generatePrefabSource([
      { id: 'dagger', name: 'Dagger', role: 'weapon', displayWidth: 1, displayHeight: 1, scaleX: 1, scaleY: 1, mvLimit: 2 },
      { id: 'crate', name: 'Crate', role: 'object', displayWidth: 1, displayHeight: 1, scaleX: 1, scaleY: 1 },
    ])
    expect(prefab).toContain('    mvLimit: 2,')
    expect(prefab.match(/ {4}mvLimit:/g)).toHaveLength(1)
  })
})
