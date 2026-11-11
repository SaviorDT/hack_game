import { describe, expect, it } from 'vitest'
import { MvCommandExecutor } from './mv.ts'
import { createInitialWorldState } from '../../content/room1WorldState.ts'
import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../../content/room1Constants.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'
import { SIMULATION_TICK_MS, TickSimulationEngine } from '../../simulation/TickSimulationEngine.ts'
import { ROOM1_PROCESSES } from '../../simulation/room1/Room1Processes.ts'

describe('MvCommandExecutor', () => {
  const executor = new MvCommandExecutor()

  it('rejects command with usage popup when fewer than 2 arguments are provided', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'mv', arguments: [], options: [] }, state)).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })

    expect(executor.execute({ name: 'mv', arguments: ['dagger'], options: [] }, state)).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })
  })

  it('rejects command if source object cannot be found', () => {
    const state = createInitialWorldState()
    const result = executor.execute({ name: 'mv', arguments: ['nonexistent', 'guard'], options: [] }, state)
    expect(result).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Cannot find "nonexistent".' },
    })
  })

  it('rejects command if source and target refer to the same object', () => {
    const state = createInitialWorldState()
    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'dagger'], options: [] }, state)
    expect(result).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: '"dagger" and "dagger" are the same object.' },
    })
  })

  it('renames source as target if target does not exist in room', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    expect(daggerObj.metadata.name).toBe('dagger')
    expect((daggerObj.state as Record<string, unknown>).discovered).toBe(false)

    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'knife'], options: [] }, state)
    expect(result).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'Renamed dagger to knife.' }],
    })

    expect(daggerObj.metadata.name).toBe('knife')
    expect((daggerObj.state as Record<string, unknown>).discovered).toBe(true)
  })

  it('throws source to target when target object exists in room', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const guardObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.guard)!

    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)
    const guardState = getMutableWorldObjectState<MutableWorldObjectState>(guardObj)

    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)
    expect(result).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'Threw dagger to guard.' }],
    })

    expect(daggerState.thrown).toMatchObject({
      targetX: guardState.x,
      targetY: guardState.y,
      targetObjectId: guardObj.id,
      hitIds: [],
    })
    expect(daggerState.discovered).toBe(true)
  })

  it('rejects command if extra arguments or options are provided', () => {
    const state = createInitialWorldState()
    expect(
      executor.execute({ name: 'mv', arguments: ['dagger', 'guard', 'extra'], options: [] }, state),
    ).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })

    expect(
      executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: ['--speed=500'] }, state),
    ).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })
  })

  it('throws source to room exit when target is exit label', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)

    const result = executor.execute({ name: 'mv', arguments: ['dagger', 'room2'], options: [] }, state)
    expect(result).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'Threw dagger to room2.' }],
    })

    expect(daggerState.thrown).toMatchObject({
      targetX: ROOM_LAYOUT.exit.x,
      targetY: ROOM_LAYOUT.exit.y,
    })
  })

  it('does not unequip weapon immediately when thrown; leaves it equipped until it exits reach', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const playerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!

    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)
    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(playerObj)

    daggerState.equippedBy = WORLD_OBJECT_IDS.player
    playerState.weaponId = 'dagger'

    executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)

    expect(daggerState.thrown).toBeDefined()
    expect(daggerState.equippedBy).toBe(WORLD_OBJECT_IDS.player)
    expect(playerState.weaponId).toBe('dagger')
  })

  it('starts a throw at rest: the executor sets no velocity, the flight accelerates it', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)

    executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)
    expect(daggerState.vx ?? 0).toBe(0)
    expect(daggerState.vy ?? 0).toBe(0)
  })

  it('keeps the current velocity and resets hitIds when thrown again mid-flight', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)

    executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)
    daggerState.vx = 120
    daggerState.vy = -30
    ;(daggerState.thrown as { hitIds: string[] }).hitIds.push('guard')

    executor.execute({ name: 'mv', arguments: ['dagger', 'room2'], options: [] }, state)
    expect(daggerState.vx).toBe(120)
    expect(daggerState.vy).toBe(-30)
    expect((daggerState.thrown as { hitIds: string[] }).hitIds).toEqual([])
  })

  describe('boulder mv behavior', () => {
    it('throws boulder to guard and advances position across simulation ticks', () => {
      const state = createInitialWorldState()
      const boulderObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.boulder)!
      const guardObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.guard)!

      const boulderState = getMutableWorldObjectState<MutableWorldObjectState>(boulderObj)
      const guardState = getMutableWorldObjectState<MutableWorldObjectState>(guardObj)

      const initialX = boulderState.x as number
      const initialY = boulderState.y as number

      const result = executor.execute({ name: 'mv', arguments: ['boulder', 'guard'], options: [] }, state)
      expect(result).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Threw boulder to guard.' }],
      })

      expect(boulderState.thrown).toMatchObject({
        targetX: guardState.x,
        targetY: guardState.y,
        targetObjectId: guardObj.id,
        hitIds: [],
      })
      expect(boulderState.discovered).toBe(true)

      // Run simulation engine with room 1 processes
      const engine = new TickSimulationEngine(ROOM1_PROCESSES)
      engine.advance(state, 100) // advance 100ms

      const nextX = boulderState.x as number
      const nextY = boulderState.y as number

      // Boulder should have moved towards guard
      expect(nextX).not.toBe(initialX)
      const distBefore = Math.hypot((guardState.x as number) - initialX, (guardState.y as number) - initialY)
      const distAfter = Math.hypot((guardState.x as number) - nextX, (guardState.y as number) - nextY)
      expect(distAfter).toBeLessThan(distBefore)

      // guard2 stands on the way: the boulder collides with it, which ends the Throw before it arrives
      for (let i = 0; i < 600 && boulderState.thrown; i++) {
        engine.advance(state, SIMULATION_TICK_MS)
      }
      expect(boulderState.thrown).toBeNull()
      expect(boulderState.x as number).toBeLessThan(guardState.x as number)
      expect(boulderState.discovered).toBe(true)
      expect(guardObj.state).toMatchObject({ health: 100 })
    })

    it('throws boulder to room exit', () => {
      const state = createInitialWorldState()
      const boulderObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.boulder)!
      const boulderState = getMutableWorldObjectState<MutableWorldObjectState>(boulderObj)

      const result = executor.execute({ name: 'mv', arguments: ['boulder', 'room2'], options: [] }, state)
      expect(result).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Threw boulder to room2.' }],
      })

      expect(boulderState.thrown).toMatchObject({
        targetX: ROOM_LAYOUT.exit.x,
        targetY: ROOM_LAYOUT.exit.y,
      })
    })

    it('renames boulder when target does not exist, and renamed object can be thrown', () => {
      const state = createInitialWorldState()
      const boulderObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.boulder)!

      const renameResult = executor.execute({ name: 'mv', arguments: ['boulder', 'rock'], options: [] }, state)
      expect(renameResult).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Renamed boulder to rock.' }],
      })
      expect(boulderObj.metadata.name).toBe('rock')

      const throwResult = executor.execute({ name: 'mv', arguments: ['rock', 'guard'], options: [] }, state)
      expect(throwResult).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Threw rock to guard.' }],
      })
    })

    it('rejects rename when target label contains uppercase letters', () => {
      const state = createInitialWorldState()
      const boulderObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.boulder)!

      const result = executor.execute({ name: 'mv', arguments: ['boulder', 'Rock'], options: [] }, state)
      expect(result).toEqual({
        status: 'rejected',
        feedback: { kind: 'popup', text: 'Labels cannot contain uppercase letters.' },
      })
      expect(boulderObj.metadata.name).toBe('boulder')
    })
  })

  describe('wildcard sources', () => {
    const run = (state: ReturnType<typeof createInitialWorldState>, source: string, target: string) =>
      executor.execute({ name: 'mv', arguments: [source, target], options: [] }, state)
    const find = (state: ReturnType<typeof createInitialWorldState>, id: string) =>
      state.worldObjects.find((o) => o.id === id)!
    const stateOf = (state: ReturnType<typeof createInitialWorldState>, id: string) =>
      getMutableWorldObjectState<MutableWorldObjectState>(find(state, id))

    it('throws every match, case-insensitively, in one popup and excludes the target', () => {
      const state = createInitialWorldState()
      expect(run(state, '*', 'GUARD')).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Threw hacker, boulder, dagger, guard2, guard3 to guard.' }],
      })
      expect(stateOf(state, WORLD_OBJECT_IDS.guard).thrown).toBeFalsy()
      for (const id of [WORLD_OBJECT_IDS.player, WORLD_OBJECT_IDS.boulder, WORLD_OBJECT_IDS.dagger, 'guard2', 'guard3']) {
        expect(stateOf(state, id).thrown).toMatchObject({ targetObjectId: WORLD_OBJECT_IDS.guard })
        expect(stateOf(state, id).discovered).toBe(true)
      }
    })

    it('matches a pattern in the middle of a name', () => {
      const state = createInitialWorldState()
      expect(run(state, 'd*x', 'guard')).toEqual({
        status: 'rejected',
        feedback: { kind: 'popup', text: 'Cannot find "d*x".' },
      })
      expect(run(state, 'd*r', 'guard').status).toBe('success')
    })

    it('rejects when nothing matches', () => {
      const state = createInitialWorldState()
      expect(run(state, 'z*', 'foo')).toEqual({
        status: 'rejected',
        feedback: { kind: 'popup', text: 'Cannot find "z*".' },
      })
      expect(find(state, WORLD_OBJECT_IDS.dagger).metadata.name).toBe('dagger')
    })

    it('rejects when the only match is the target itself', () => {
      const state = createInitialWorldState()
      expect(run(state, 'gu*d', 'guard')).toEqual({
        status: 'rejected',
        feedback: { kind: 'popup', text: 'Cannot find "gu*d".' },
      })
    })

    it('renames a single match to the plain target name', () => {
      const state = createInitialWorldState()
      expect(run(state, 'd*', 'knife')).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Renamed dagger to knife.' }],
      })
      expect(find(state, WORLD_OBJECT_IDS.dagger).metadata.name).toBe('knife')
    })

    it('renames multiple matches with numeric suffixes', () => {
      const state = createInitialWorldState()
      expect(run(state, '*', 'x').status).toBe('success')
      expect(find(state, WORLD_OBJECT_IDS.player).metadata.name).toBe('x_0')
      expect(find(state, WORLD_OBJECT_IDS.boulder).metadata.name).toBe('x_1')
      expect(find(state, WORLD_OBJECT_IDS.dagger).metadata.name).toBe('x_2')
      expect(find(state, 'guard3').metadata.name).toBe('x_5')
    })

    it('skips suffixes already taken by other objects or exits', () => {
      const state = createInitialWorldState()
      find(state, WORLD_OBJECT_IDS.guard).rename('x_1')
      expect(run(state, '*a*', 'x').status).toBe('success')
      // the renamed guard no longer matches "*a*" and keeps x_1 taken
      expect(find(state, WORLD_OBJECT_IDS.player).metadata.name).toBe('x_0')
      expect(find(state, WORLD_OBJECT_IDS.dagger).metadata.name).toBe('x_2')
      expect(find(state, 'guard2').metadata.name).toBe('x_3')
    })

    it('does not count the sources themselves as collisions', () => {
      const state = createInitialWorldState()
      find(state, WORLD_OBJECT_IDS.dagger).rename('x_0')
      run(state, '*', 'x')
      expect(find(state, WORLD_OBJECT_IDS.player).metadata.name).toBe('x_0')
    })

    it('treats * in the target as a literal name', () => {
      const state = createInitialWorldState()
      expect(run(state, 'dagger', 'k*')).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Renamed dagger to k*.' }],
      })
      expect(find(state, WORLD_OBJECT_IDS.dagger).metadata.name).toBe('k*')
      expect(run(state, 'guard', 'k*').status).toBe('success')
      expect(stateOf(state, WORLD_OBJECT_IDS.guard).thrown).toMatchObject({
        targetObjectId: WORLD_OBJECT_IDS.dagger,
      })
    })
  })
})
