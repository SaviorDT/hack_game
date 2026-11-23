import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from '../../content/roomWorldState.ts'
import { WORLD_OBJECT_IDS, ROOM_LAYOUT } from '../../content/roomConstants.ts'
import { TickSimulationEngine } from '../TickSimulationEngine.ts'
import { ROOM_PROCESSES } from './RoomProcesses.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import { ShapeCollisionWorld } from '../../domain/CollisionWorld.ts'
import { DEFAULT_DRAG, DEFAULT_FRICTION } from '../physicsConstants.ts'

describe('RoomProcesses collisionbox overlap prevention', () => {
  const collisionWorld = new ShapeCollisionWorld()

  it('prevents player from walking into or through a boulder', () => {
    const state = createInitialWorldState()
    const player = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!
    const boulder = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.boulder)!

    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(player)
    const boulderState = getMutableWorldObjectState<MutableWorldObjectState>(boulder)

    // Position player just to the left of the boulder, which is pushed along instead of walked through
    boulderState.x = 740
    boulderState.y = 280
    playerState.x = 650
    playerState.y = 280
    playerState.vx = 0
    playerState.vy = 0
    playerState.moveX = 1 // moving right toward boulder
    playerState.moveY = 0

    const engine = new TickSimulationEngine(ROOM_PROCESSES)

    // Advance 10 ticks (10 * 16.67ms)
    for (let i = 0; i < 10; i++) {
      engine.advance(state, 16.67)
    }

    const playerBox = {
      x: playerState.x as number,
      y: playerState.y as number,
      width: playerState.width as number,
      height: playerState.height as number,
    }
    const boulderBox = {
      x: boulderState.x as number,
      y: boulderState.y as number,
      width: boulderState.width as number,
      height: boulderState.height as number,
    }

    expect(collisionWorld.overlaps(playerBox, boulderBox)).toBe(false)
  })

  it('cannot push the heavy boulder (mass 100) by running into it', () => {
    const state = createInitialWorldState()
    const player = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!
    const boulder = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.boulder)!
    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(player)
    const boulderState = getMutableWorldObjectState<MutableWorldObjectState>(boulder)
    boulderState.x = 740
    boulderState.y = 280
    playerState.x = 450
    playerState.y = 280
    playerState.moveX = 1
    playerState.moveY = 0

    const engine = new TickSimulationEngine(ROOM_PROCESSES)
    for (let i = 0; i < 90; i++) {
      engine.advance(state, 16.67)
    }

    expect(boulderState.x as number).toBeLessThan(740 + 20)
    expect(playerState.x as number).toBeLessThan(boulderState.x as number)
  })

  it('prevents player from walking into or through a guard', () => {
    const state = createInitialWorldState()
    const player = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!
    const guard = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.guard)!

    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(player)
    const guardState = getMutableWorldObjectState<MutableWorldObjectState>(guard)

    // Position guard to the right of player
    guardState.x = 550
    guardState.y = 439
    playerState.x = 450
    playerState.y = 439
    playerState.moveX = 1
    playerState.moveY = 0

    const engine = new TickSimulationEngine(ROOM_PROCESSES)

    for (let i = 0; i < 20; i++) {
      engine.advance(state, 16.67)
    }

    const playerBox = {
      x: playerState.x as number,
      y: playerState.y as number,
      width: playerState.width as number,
      height: playerState.height as number,
    }
    const guardBox = {
      x: guardState.x as number,
      y: guardState.y as number,
      width: guardState.width as number,
      height: guardState.height as number,
    }

    expect(collisionWorld.overlaps(playerBox, guardBox)).toBe(false)
  })

  it('allows player to walk over dagger to pick it up because weapons have no collisionbox', () => {
    const state = createInitialWorldState()
    const player = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!
    const dagger = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!

    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(player)
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(dagger)

    // Place dagger ahead of player
    daggerState.x = playerState.x as number + 30
    daggerState.y = playerState.y as number

    playerState.moveX = 1
    playerState.moveY = 0

    const engine = new TickSimulationEngine(ROOM_PROCESSES)
    engine.advance(state, 100)

    // Player picks up dagger without movement being blocked
    expect(playerState.weaponId).toBe('dagger')
    expect(daggerState.equippedBy).toBe('player')
  })

  it('prevents guard from overlapping player when pursuing', () => {
    const state = createInitialWorldState()
    const player = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!
    const guard = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.guard)!

    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(player)
    const guardState = getMutableWorldObjectState<MutableWorldObjectState>(guard)

    // Put player in right half so guard chases
    playerState.x = ROOM_LAYOUT.rightHalfStartX + 50
    playerState.y = 365
    playerState.moveX = 0
    playerState.moveY = 0

    guardState.x = playerState.x as number + 150
    guardState.y = 365

    const engine = new TickSimulationEngine(ROOM_PROCESSES)

    // Step long enough for guard to reach player
    for (let i = 0; i < 60; i++) {
      engine.advance(state, 16.67)
    }

    const playerBox = {
      x: playerState.x as number,
      y: playerState.y as number,
      width: playerState.width as number,
      height: playerState.height as number,
    }
    const guardBox = {
      x: guardState.x as number,
      y: guardState.y as number,
      width: guardState.width as number,
      height: guardState.height as number,
    }

    expect(collisionWorld.overlaps(playerBox, guardBox)).toBe(false)
  })

  it('prevents guard from overlapping boulder when pursuing player', () => {
    const state = createInitialWorldState()
    const player = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!
    const guard = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.guard)!
    const boulder = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.boulder)!

    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(player)
    const guardState = getMutableWorldObjectState<MutableWorldObjectState>(guard)
    const boulderState = getMutableWorldObjectState<MutableWorldObjectState>(boulder)

    // Align player on left of boulder, guard on right of boulder
    boulderState.x = 1100
    boulderState.y = 365
    playerState.x = 1000
    playerState.y = 365
    guardState.x = 1250
    guardState.y = 365

    const engine = new TickSimulationEngine(ROOM_PROCESSES)

    for (let i = 0; i < 40; i++) {
      engine.advance(state, 16.67)
    }

    const guardBox = {
      x: guardState.x as number,
      y: guardState.y as number,
      width: guardState.width as number,
      height: guardState.height as number,
    }
    const boulderBox = {
      x: boulderState.x as number,
      y: boulderState.y as number,
      width: boulderState.width as number,
      height: boulderState.height as number,
    }

    expect(collisionWorld.overlaps(guardBox, boulderBox)).toBe(false)
  })
})

describe('RoomProcesses braking only below the top speed', () => {
  const FRICTION = DEFAULT_FRICTION
  const DRAG = DEFAULT_DRAG
  const DT = 1000 / 60 / 1000

  function setup() {
    const state = createInitialWorldState()
    const get = (id: string) => getMutableWorldObjectState<MutableWorldObjectState>(
      state.worldObjects.find((o) => o.id === id)!,
    )
    for (const id of ['boulder', 'guard', 'guard2', 'guard3']) {
      get(id).alive = false
    }
    const player = get(WORLD_OBJECT_IDS.player)
    player.x = 300
    player.y = 300
    player.moveX = 0
    player.moveY = 0
    return { state, player, get, engine: new TickSimulationEngine(ROOM_PROCESSES) }
  }

  it('does not brake a player who was knocked faster than maxSpeed: only friction and drag slow it', () => {
    const { state, player, engine } = setup()
    player.vx = 800

    engine.advance(state, 16.67)

    expect(player.vx as number).toBeCloseTo(800 * (1 - (DRAG + FRICTION) * DT), 3)
  })

  it('does not turn a knocked player around with turnaroundAcceleration either', () => {
    const { state, player, engine } = setup()
    player.vx = 800
    player.moveX = -1

    engine.advance(state, 16.67)

    expect(player.vx as number).toBeCloseTo(800 * (1 - (DRAG + FRICTION) * DT), 3)
  })

  it('brakes the player again once friction has slowed it below maxSpeed', () => {
    const { state, player, engine } = setup()
    player.vx = 800

    for (let i = 0; i < 90; i++) engine.advance(state, 16.67)

    expect(player.vx as number).toBe(0)
  })

  it('does not brake a knocked idle guard until it is below its own speed', () => {
    const { state, get, engine } = setup()
    const guard = get(WORLD_OBJECT_IDS.guard)
    guard.alive = true
    guard.x = 1500
    guard.y = 300
    guard.vx = 800

    engine.advance(state, 16.67)

    expect(guard.vx as number).toBeCloseTo(800 * (1 - (DRAG + FRICTION) * DT), 3)
  })
})
