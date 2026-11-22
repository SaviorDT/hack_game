import { describe, expect, it } from 'vitest'
import { MvCommandExecutor } from './mv.ts'
import { createInitialWorldState } from '../../content/room1WorldState.ts'
import { WORLD_OBJECT_IDS } from '../../content/room1Constants.ts'
import { getMutableWorldObjectState, type MutableWorldObjectState } from '../../domain/WorldObjectState.ts'

describe('MvCommandExecutor', () => {
  const executor = new MvCommandExecutor()

  it('uses rename-only usage', () => {
    expect(executor.execute(
      { name: 'mv', arguments: ['dagger'], options: [] },
      createInitialWorldState(),
    )).toEqual({
      status: 'rejected',
      feedback: { kind: 'popup', text: 'Usage: mv <label1> <label2>' },
    })
  })

  it('rejects missing sources', () => {
    expect(executor.execute(
      { name: 'mv', arguments: ['missing', 'knife'], options: [] },
      createInitialWorldState(),
    ).feedback).toEqual({ kind: 'popup', text: 'Cannot find "missing".' })
  })

  it('renames a single source without spending its throw limit', () => {
    const state = createInitialWorldState()
    const dagger = state.worldObjects.find((obj) => obj.id === WORLD_OBJECT_IDS.dagger)!
    getMutableWorldObjectState<MutableWorldObjectState>(dagger).discovered = false

    expect(executor.execute({ name: 'mv', arguments: ['dagger', 'knife'], options: [] }, state)).toEqual({
      status: 'success',
      feedback: [{ kind: 'popup', text: 'Renamed dagger to knife.' }],
    })
    expect(dagger.metadata.name).toBe('knife')
    expect(getMutableWorldObjectState<MutableWorldObjectState>(dagger)).toMatchObject({
      discovered: true,
      mvLimit: 1,
    })
  })

  it('rejects uppercase labels', () => {
    expect(executor.execute(
      { name: 'mv', arguments: ['dagger', 'Knife'], options: [] },
      createInitialWorldState(),
    ).feedback).toEqual({ kind: 'popup', text: 'Labels cannot contain uppercase letters.' })
  })

  it('rejects $mouse and existing names or exits', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'mv', arguments: ['dagger', '$mouse'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: '"$mouse" cannot be used as an object name.' })
    expect(executor.execute({ name: 'mv', arguments: ['dagger', 'guard'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: '"guard" already exists.' })
    expect(executor.execute({ name: 'mv', arguments: ['dagger', 'room2'], options: [] }, state).feedback)
      .toEqual({ kind: 'popup', text: '"room2" already exists.' })
  })

  it('rejects self-renaming', () => {
    expect(executor.execute(
      { name: 'mv', arguments: ['dagger', 'dagger'], options: [] },
      createInitialWorldState(),
    ).feedback).toEqual({ kind: 'popup', text: '"dagger" and "dagger" are the same object.' })
  })

  it('renames wildcard matches with numeric suffixes', () => {
    const state = createInitialWorldState()
    expect(executor.execute({ name: 'mv', arguments: ['*', 'x'], options: [] }, state).status).toBe('success')
    const names = state.worldObjects.map((obj) => obj.metadata.name)
    expect(names).toContain('x_0')
    expect(names).toContain('x_1')
    expect(names).toContain('x_2')
  })
})
