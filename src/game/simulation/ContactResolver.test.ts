import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from '../content/room1WorldState.ts'
import { WORLD_OBJECT_IDS } from '../content/room1Constants.ts'
import { colliderTagsOf } from '../domain/ColliderTag.ts'
import { getMutableWorldObjectState } from '../domain/WorldObjectState.ts'
import { ContactResolver } from './ContactResolver.ts'
import { SIMULATION_TICK_MS, TickSimulationEngine } from './TickSimulationEngine.ts'
import { ROOM1_PROCESSES } from './room1/Room1Processes.ts'

type Body = {
  x: number
  y: number
  vx?: number
  vy?: number
  health?: number
  alive?: boolean
  discovered?: boolean
  thrown?: { hitIds: string[]; targetX: number; targetY: number; targetObjectId?: string | null } | null
  [key: string]: unknown
}

function setup() {
  const state = createInitialWorldState()
  const body = (id: string) =>
    getMutableWorldObjectState(state.worldObjects.find((o) => o.id === id)!) as unknown as Body
  const dagger = body(WORLD_OBJECT_IDS.dagger)
  const guard = body(WORLD_OBJECT_IDS.guard)
  // Park the dagger on the guard, with nothing else nearby
  dagger.x = guard.x
  dagger.y = guard.y
  return { state, body, dagger, guard, resolver: new ContactResolver() }
}

function fly(dagger: Body, speed: number): void {
  dagger.vx = speed
  dagger.vy = 0
  dagger.thrown = { targetX: 1700, targetY: dagger.y, targetObjectId: null, hitIds: [] }
}

describe('Collider Tags', () => {
  it('gives weapons a weapon tag with the impact damage rate and characters a character tag', () => {
    const { state } = setup()
    const tagsOf = (id: string) => colliderTagsOf(state.worldObjects.find((o) => o.id === id)!)
    expect(tagsOf(WORLD_OBJECT_IDS.dagger)).toEqual([{ class: 'weapon', impactDamageRate: 0.05 }])
    expect(tagsOf(WORLD_OBJECT_IDS.player)).toEqual([{ class: 'character' }])
    expect(tagsOf(WORLD_OBJECT_IDS.guard)).toEqual([{ class: 'character' }])
  })
})

describe('ContactResolver: thrown weapon touching a character', () => {
  it('deals impact damage rate x weapon speed', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 100
    fly(dagger, 300)
    resolver.resolve(state)
    expect(guard.health).toBeCloseTo(100 - 0.05 * 300, 9)
  })

  it('keeps fractional health and uses the speed vector length', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 100
    fly(dagger, 0)
    dagger.vx = 30
    dagger.vy = 40
    resolver.resolve(state)
    expect(guard.health).toBeCloseTo(100 - 0.05 * 50, 9)
  })

  it('hurts each character at most once per throw', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 100
    fly(dagger, 300)
    resolver.resolve(state)
    resolver.resolve(state)
    expect(guard.health).toBeCloseTo(85, 9)
    expect(dagger.thrown?.hitIds).toContain(WORLD_OBJECT_IDS.guard)
  })

  it('hits again on a different throw (hitIds reset)', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 100
    fly(dagger, 300)
    resolver.resolve(state)
    fly(dagger, 300)
    resolver.resolve(state)
    expect(guard.health).toBeCloseTo(70, 9)
  })

  it('consumes the hit even when the speed is zero', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 100
    fly(dagger, 0)
    resolver.resolve(state)
    expect(guard.health).toBe(100)
    dagger.vx = 300
    resolver.resolve(state)
    expect(guard.health).toBe(100)
  })

  it('is a trigger: the weapon keeps flying and nothing but Health changes', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 100
    guard.discovered = false
    fly(dagger, 300)
    const x = dagger.x
    resolver.resolve(state)
    expect(dagger.vx).toBe(300)
    expect(dagger.x).toBe(x)
    expect(dagger.thrown).not.toBeNull()
    expect(guard.discovered).toBe(false)
  })

  it('does nothing for a weapon that is not in flight', () => {
    const { state, guard, resolver } = setup()
    guard.health = 100
    resolver.resolve(state)
    expect(guard.health).toBe(100)
  })

  it('does nothing without overlap', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 100
    dagger.x = 200
    dagger.y = 700
    fly(dagger, 300)
    resolver.resolve(state)
    expect(guard.health).toBe(100)
  })

  it('does not hurt defeated characters and marks the defeat at zero Health', () => {
    const { state, dagger, guard, resolver } = setup()
    guard.health = 10
    fly(dagger, 300)
    resolver.resolve(state)
    expect(guard.health).toBe(0)
    expect(guard.alive).toBe(false)
  })

  it('ends the game when the Player Character is defeated by a thrown weapon', () => {
    const { state, body, dagger, resolver } = setup()
    const player = body(WORLD_OBJECT_IDS.player)
    player.health = 5
    dagger.x = player.x
    dagger.y = player.y
    fly(dagger, 300)
    resolver.resolve(state)
    expect(player.alive).toBe(false)
    expect(state.outcome).toBe('game-over')
  })

  it('a thrown character (no weapon tag) hurts nobody', () => {
    const { state, body, guard, resolver } = setup()
    const player = body(WORLD_OBJECT_IDS.player)
    guard.health = 100
    player.x = guard.x
    player.y = guard.y
    player.vx = 300
    player.thrown = { targetX: 1700, targetY: player.y, targetObjectId: null, hitIds: [] }
    resolver.resolve(state)
    expect(guard.health).toBe(100)
  })
})

describe('tick order: move, contacts, then velocity update', () => {
  it('damages a guard on the path with the speed the dagger moved with, once, via mv', () => {
    const state = createInitialWorldState()
    const body = (id: string) =>
      getMutableWorldObjectState(state.worldObjects.find((o) => o.id === id)!) as unknown as Body
    const dagger = body(WORLD_OBJECT_IDS.dagger)
    const guard = body(WORLD_OBJECT_IDS.guard)
    const player = body(WORLD_OBJECT_IDS.player)
    // Keep the guard idle and the player away from the line of flight
    player.x = 150
    player.y = 150
    dagger.x = 800
    dagger.y = guard.y
    guard.health = 100
    dagger.thrown = { targetX: 1700, targetY: guard.y, targetObjectId: null, hitIds: [] }

    const engine = new TickSimulationEngine(ROOM1_PROCESSES)
    let lastSpeedBeforeHit = 0
    for (let i = 0; i < 600 && guard.health === 100; i++) {
      lastSpeedBeforeHit = Math.hypot(dagger.vx ?? 0, dagger.vy ?? 0)
      engine.advance(state, SIMULATION_TICK_MS)
    }
    expect(guard.health).toBeLessThan(100)
    expect(guard.health).toBeGreaterThan(100 - 0.05 * 500 - 1e-9)
    expect(guard.health).toBeCloseTo(100 - 0.05 * lastSpeedBeforeHit, 0)

    const afterHit = guard.health
    for (let i = 0; i < 60; i++) engine.advance(state, SIMULATION_TICK_MS)
    expect(guard.health).toBe(afterHit)
  })
})
