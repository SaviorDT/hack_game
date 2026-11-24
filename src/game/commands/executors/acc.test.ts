import { describe, expect, it } from 'vitest'
import { AccCommandExecutor } from './acc.ts'
import { createInitialWorldState } from '../../content/roomWorldState.ts'
import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../../content/roomConstants.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import { createGameWorldState } from '../../content/tutorialRooms.ts'
import { ARENA_IDS } from '../../content/arena.ts'
import { TickSimulationEngine } from '../../simulation/TickSimulationEngine.ts'
import { ROOM_PROCESSES } from '../../simulation/room/RoomProcesses.ts'

describe('AccCommandExecutor', () => {
  const executor = new AccCommandExecutor()

  it('uses throw-only usage', () => {
    expect(executor.execute(
      { name: 'acc', arguments: ['dagger'], options: [] },
      createInitialWorldState(),
    ).feedback).toEqual({ kind: 'popup', text: 'Usage: acc <label1> <label2|$mouse>' })
  })

  it('throws a source to an object target', () => {
    const state = createInitialWorldState()
    const result = executor.execute({ name: 'acc', arguments: ['dagger', 'guard_a'], options: [] }, state)
    expect(result.status).toBe('success')
    expect(getMutableWorldObjectState<MutableWorldObjectState>(
      state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!,
    ).mvLimit).toBe(0)
    const thrown = getMutableWorldObjectState<MutableWorldObjectState>(
      state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!,
    ).thrown as { targetObjectId: string } | null
    expect(thrown?.targetObjectId).toBe(WORLD_OBJECT_IDS.guard)
  })

  it('destroys a spent source instead of starting another throw', () => {
    const state = createInitialWorldState()
    const dagger = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(dagger)
    daggerState.mvLimit = 0

    expect(executor.execute({ name: 'acc', arguments: ['dagger', 'guard_a'], options: [] }, state)).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'dagger is used up.' }],
    })
    expect(daggerState).toMatchObject({ destroyed: true, alive: false, thrown: null })
  })

  it('throws to a room exit', () => {
    const state = createInitialWorldState()
    const result = executor.execute({ name: 'acc', arguments: ['dagger', 'end'], options: [] }, state)
    expect(result.status).toBe('success')
    expect(getMutableWorldObjectState<MutableWorldObjectState>(
      state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!,
    ).thrown).toMatchObject({ targetX: ROOM_LAYOUT.exit.x, targetY: ROOM_LAYOUT.exit.y })
  })

  it('throws to $mouse case-insensitively', () => {
    const state = createInitialWorldState()
    expect(executor.execute(
      { name: 'acc', arguments: ['dagger', '$MOUSE'], options: [] },
      state,
      { mouse: { x: 123, y: 234 } },
    ).status).toBe('success')
    expect(getMutableWorldObjectState<MutableWorldObjectState>(
      state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!,
    ).thrown).toMatchObject({ targetX: 123, targetY: 234, targetObjectId: null })
  })

  it('rejects $mouse without a mouse point and as a source', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'acc', arguments: ['dagger', '$mouse'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: 'Move the mouse over the game first.' })
    expect(executor.execute(
      { name: 'acc', arguments: ['$mouse', 'dagger'], options: [] },
      state,
      { mouse: { x: 1, y: 2 } },
    ).feedback).toEqual({ kind: 'popup', text: 'Cannot find "$mouse".' })
  })

  it('rejects missing sources and targets', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'acc', arguments: ['missing', 'guard_a'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: 'Cannot find "missing".' })
    expect(executor.execute({ name: 'acc', arguments: ['dagger', 'missing'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: 'Cannot find "missing".' })
  })

  it('rejects throwing an object to itself', () => {
    expect(executor.execute(
      { name: 'acc', arguments: ['dagger', 'dagger'], options: [] },
      createInitialWorldState(),
    ).feedback).toEqual({ kind: 'popup', text: '"dagger" and "dagger" are the same object.' })
  })

  it('throws wildcard sources and excludes the target', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'acc', arguments: ['d*r', 'guard_a'], options: [] }, state).status).toBe('success')
    const thrown = getMutableWorldObjectState<MutableWorldObjectState>(
      state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!,
    ).thrown as { targetObjectId: string } | null
    expect(thrown?.targetObjectId).toBe(WORLD_OBJECT_IDS.guard)
  })

  it('spends the limit separately for each wildcard source', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'acc', arguments: ['*', 'guard_a'], options: [] }, state).status).toBe('success')
    const dagger = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!
    const boulder = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.boulder)!
    expect(getMutableWorldObjectState<MutableWorldObjectState>(dagger).mvLimit).toBe(0)
    expect(getMutableWorldObjectState<MutableWorldObjectState>(boulder).mvLimit).toBe(-1)
  })

  it('does not resolve destroyed objects as sources or targets', () => {
    const state = createInitialWorldState()
    const dagger = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!
    getMutableWorldObjectState<MutableWorldObjectState>(dagger).destroyed = true

    expect(executor.execute({ name: 'acc', arguments: ['dagger', 'guard_a'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: 'Cannot find "dagger".' })
    expect(executor.execute({ name: 'acc', arguments: ['boulder', 'dagger'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: 'Cannot find "dagger".' })
  })

  it('leaves an armed weapon equipped until it exits reach', () => {
    const state = createInitialWorldState()
    const dagger = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!
    const player = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.player)!
    getMutableWorldObjectState<MutableWorldObjectState>(dagger).equippedBy = WORLD_OBJECT_IDS.player
    getMutableWorldObjectState<MutableWorldObjectState>(player).weaponId = WORLD_OBJECT_IDS.dagger

    executor.execute({ name: 'acc', arguments: ['dagger', 'guard_a'], options: [] }, state)

    expect(getMutableWorldObjectState<MutableWorldObjectState>(dagger).equippedBy).toBe(WORLD_OBJECT_IDS.player)
  })

  it('accelerates across simulation ticks', () => {
    const state = createInitialWorldState()
    const dagger = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(dagger)
    const initialX = daggerState.x as number
    executor.execute({ name: 'acc', arguments: ['dagger', 'guard_a'], options: [] }, state)
    new TickSimulationEngine(ROOM_PROCESSES).advance(state, 100)
    expect(daggerState.x as number).not.toBe(initialX)
  })
  describe('Boss', () => {
    const arena = () => createGameWorldState(undefined, ARENA_IDS.room)
    const run = (state: ReturnType<typeof arena>, a: string, b: string) =>
      executor.execute({ name: 'acc', arguments: [a, b], options: [] }, state)

    it('cannot be a source but can be a target', () => {
      const state = arena()
      expect(run(state, 'warden', 'tl').feedback).toEqual({ kind: 'popup', text: '"warden" cannot be thrown.' })
      expect(run(state, 'warden', 'tl').status).toBe('rejected')
      expect(run(state, 'excalibur', 'warden').status).toBe('success')
    })

    it('is skipped by a wildcard source, which then finds nothing if only the Boss matches', () => {
      const state = arena()
      expect(run(state, 'war*', 'tl').feedback).toEqual({ kind: 'popup', text: 'Cannot find "war*".' })
      expect(run(state, '*', 'tl').status).toBe('success')
      const boss = state.worldObjects.find((obj) => (obj.state as { bossMode?: string }).bossMode)!
      expect((boss.state as { thrown?: unknown }).thrown ?? null).toBeNull()
    })
  })
})
