import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from './BasicWorldObject.ts'
import {
  UNLIMITED_MV_LIMIT,
  defaultMvLimit,
  destroyWorldObject,
  isDestroyed,
  isSpent,
  mvLimitOf,
  spendMvLimit,
} from './MvLimit.ts'
import type { WorldState } from './WorldState.ts'

function object(id: string, state: Record<string, unknown>) {
  return new BasicWorldObject(id, 'room', { name: id, role: 'object' }, [], { x: 0, y: 0, alive: true, ...state })
}

function worldOf(...objects: BasicWorldObject[]): WorldState {
  return {
    rooms: [{ id: 'room', objectIds: objects.map((o) => o.id), exits: [], state: {} }],
    worldObjects: objects,
    processInstances: [],
    currentRoomId: 'room',
    commandHistory: [],
    simulationTick: 0,
    outcome: 'playing',
  }
}

describe('Mv Limit', () => {
  it('gives a Weapon one throw and everything else no limit', () => {
    expect(defaultMvLimit('weapon')).toBe(1)
    for (const role of ['player', 'enemy', 'guard', 'object', undefined]) {
      expect(defaultMvLimit(role)).toBe(UNLIMITED_MV_LIMIT)
    }
  })

  it('treats an object without an Mv Limit as unlimited', () => {
    expect(mvLimitOf(object('arrow', {}))).toBe(UNLIMITED_MV_LIMIT)
  })

  it('uses one throw up each time and never changes an unlimited object', () => {
    const limited = object('dagger', { mvLimit: 2 })
    const unlimited = object('boulder', { mvLimit: -1 })
    const state = worldOf(limited, unlimited)

    expect(spendMvLimit(state, limited)).toBe(true)
    expect(mvLimitOf(limited)).toBe(1)
    expect(spendMvLimit(state, unlimited)).toBe(true)
    expect(spendMvLimit(state, unlimited)).toBe(true)
    expect(mvLimitOf(unlimited)).toBe(-1)
  })

  it('destroys an object with no throws left instead of throwing it', () => {
    const spent = object('dagger', { mvLimit: 0, vx: 50 })
    const state = worldOf(spent)

    expect(spendMvLimit(state, spent)).toBe(false)
    expect(isDestroyed(spent)).toBe(true)
    expect(spent.state).toMatchObject({ alive: false, destroyed: true, thrown: null, vx: 0, vy: 0 })
  })

  it('is spent only with no throws left and not in flight', () => {
    expect(isSpent(object('a', { mvLimit: 0 }))).toBe(true)
    expect(isSpent(object('a', { mvLimit: 0, thrown: { targetX: 1, targetY: 1 } }))).toBe(false)
    expect(isSpent(object('a', { mvLimit: 1 }))).toBe(false)
    expect(isSpent(object('a', { mvLimit: -1 }))).toBe(false)
    expect(isSpent(object('a', { mvLimit: 0, alive: false }))).toBe(false)
  })

  it('lets go of a destroyed Weapon that a Character holds', () => {
    const holder = object('player', { weaponId: 'dagger' })
    const dagger = object('dagger', { mvLimit: 0, equippedBy: 'player' })
    const state = worldOf(holder, dagger)

    destroyWorldObject(state, dagger)

    expect(holder.state).toMatchObject({ weaponId: null })
    expect(dagger.state).toMatchObject({ equippedBy: null, destroyed: true })
  })
})
