import { describe, expect, it } from 'vitest'
import { MvCommandExecutor } from './mv.ts'
import { createInitialWorldState } from '../../content/room1WorldState.ts'
import { ROOM_LAYOUT, WORLD_OBJECT_IDS } from '../../content/room1Constants.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'

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
      speed: 300,
    })
    expect(daggerState.discovered).toBe(true)
    expect(daggerState.vx).toBeGreaterThan(0)
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
      speed: 300,
    })
  })

  it('unequips weapon from holder when thrown', () => {
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const playerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!

    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)
    const playerState = getMutableWorldObjectState<MutableWorldObjectState>(playerObj)

    daggerState.equippedBy = WORLD_OBJECT_IDS.player
    playerState.weaponId = 'dagger'

    executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)

    expect(daggerState.equippedBy).toBeNull()
    expect(playerState.weaponId).toBeNull()
  })

  it('uses custom mv_speed configuration when provided statically or dynamically', () => {
    let dynamicSpeed = 450
    const customExecutor = new MvCommandExecutor(() => dynamicSpeed)

    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)

    customExecutor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)
    expect(daggerState.thrown).toMatchObject({
      speed: 450,
    })

    // Modify dynamic speed source as object with mv_speed
    const dynamicConfig = { mv_speed: 600 }
    const customExecutor2 = new MvCommandExecutor(() => dynamicConfig)
    customExecutor2.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)
    expect(daggerState.thrown).toMatchObject({
      speed: 600,
    })
  })

  it('uses default decoupled mv_speed across rooms without room1 dependency', () => {
    const defaultExecutor = new MvCommandExecutor()
    const state = createInitialWorldState()
    const daggerObj = state.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
    const daggerState = getMutableWorldObjectState<MutableWorldObjectState>(daggerObj)

    defaultExecutor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state)
    expect(daggerState.thrown).toMatchObject({
      speed: 300,
    })
  })
  describe('wildcard sources', () => {
    const run = (state: ReturnType<typeof createInitialWorldState>, source: string, target: string) =>
      executor.execute({ name: 'mv', arguments: [source, target], options: [] }, state)
    const find = (state: ReturnType<typeof createInitialWorldState>, id: string) =>
      state.worldObjects.find((o) => o.id === id)!

    it('throws every match, case-insensitively, in one popup and excludes the target', () => {
      const state = createInitialWorldState()
      const result = run(state, '*', 'GUARD')
      expect(result).toEqual({
        status: 'success',
        feedback: [{ kind: 'popup', text: 'Threw hacker, dagger, guard-2, guard-3 to guard.' }],
      })
      const guardState = getMutableWorldObjectState<MutableWorldObjectState>(find(state, WORLD_OBJECT_IDS.guard))
      expect(guardState.thrown).toBeFalsy()
      for (const id of [WORLD_OBJECT_IDS.player, WORLD_OBJECT_IDS.dagger, 'guard-2', 'guard-3']) {
        const st = getMutableWorldObjectState<MutableWorldObjectState>(find(state, id))
        expect(st.thrown).toMatchObject({ targetObjectId: WORLD_OBJECT_IDS.guard })
        expect(st.discovered).toBe(true)
      }
    })

    it('matches a pattern in the middle of a name', () => {
      const state = createInitialWorldState()
      const result = run(state, 'd*x', 'guard')
      expect(result).toEqual({
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
      const result = run(state, '*', 'x')
      expect(result.status).toBe('success')
      expect(find(state, WORLD_OBJECT_IDS.player).metadata.name).toBe('x_0')
      expect(find(state, WORLD_OBJECT_IDS.dagger).metadata.name).toBe('x_1')
      expect(find(state, WORLD_OBJECT_IDS.guard).metadata.name).toBe('x_2')
      expect(find(state, 'guard-3').metadata.name).toBe('x_4')
    })

    it('skips suffixes already taken by other objects or exits', () => {
      const state = createInitialWorldState()
      find(state, WORLD_OBJECT_IDS.guard).rename('X_1')
      const result = run(state, '*a*', 'x')
      expect(result.status).toBe('success')
      // the renamed guard no longer matches "*a*"; x_1 is taken by it
      expect(find(state, WORLD_OBJECT_IDS.player).metadata.name).toBe('x_0')
      expect(find(state, WORLD_OBJECT_IDS.dagger).metadata.name).toBe('x_2')
      expect(find(state, 'guard-2').metadata.name).toBe('x_3')
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
      // and a literal-named object is addressable as a target
      expect(run(state, 'guard', 'k*').status).toBe('success')
      expect(
        getMutableWorldObjectState<MutableWorldObjectState>(find(state, WORLD_OBJECT_IDS.guard)).thrown,
      ).toMatchObject({ targetObjectId: WORLD_OBJECT_IDS.dagger })
    })
  })
})
