import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from './BasicWorldObject.ts'
import { PICKUP_REACH, PickUpService } from './PickUpService.ts'
import { getMutableWorldObjectState } from './WorldObjectState.ts'
import type { WorldObject } from './WorldObject.ts'
import type { WorldState } from './WorldState.ts'

const SIZE = 10

function player(x: number, weaponId: string | null = null): WorldObject {
  return new BasicWorldObject('player', 'room', { role: 'player' }, [], {
    x, y: 0, width: SIZE, height: SIZE, weaponId, discovered: true,
  })
}

function dagger(x: number, extra: Record<string, string | number | boolean | null> = {}): WorldObject {
  return new BasicWorldObject('dagger', 'room', { role: 'weapon', weaponId: 'dagger' }, [], {
    x, y: 0, width: SIZE, height: SIZE, discovered: false, equippedBy: null, ...extra,
  })
}

function worldOf(...worldObjects: WorldObject[]): WorldState {
  return {
    rooms: [], worldObjects, processInstances: [], currentRoomId: 'room',
    commandHistory: [], simulationTick: 0, outcome: 'playing',
  }
}

describe('pickUp', () => {
  const pickUp = new PickUpService()

  it('equips the nearest weapon within the pick-up reach', () => {
    expect(PICKUP_REACH).toBe(10)
    const hero = player(0)
    const item = dagger(SIZE + 10)

    const result = pickUp.pickUp(worldOf(hero, item), 'player')

    expect(result).toEqual({ status: 'picked-up', objectId: 'dagger' })
    expect(getMutableWorldObjectState(hero)).toMatchObject({ weaponId: 'dagger' })
    expect(getMutableWorldObjectState(item)).toMatchObject({ equippedBy: 'player' })
  })

  it('picks up an undiscovered weapon and marks it discovered', () => {
    const item = dagger(SIZE + 1, { discovered: false })

    pickUp.pickUp(worldOf(player(0), item), 'player')

    expect(getMutableWorldObjectState(item)).toMatchObject({ discovered: true })
  })

  it('finds nothing beyond the reach', () => {
    expect(pickUp.pickUp(worldOf(player(0), dagger(SIZE + 11)), 'player')).toEqual({
      status: 'nothing-in-reach',
    })
  })

  it('does not swap a weapon the collector already holds', () => {
    const hero = player(0, 'guard-strike')

    expect(pickUp.pickUp(worldOf(hero, dagger(SIZE + 1)), 'player')).toEqual({
      status: 'already-armed',
    })
  })

  it('ignores a weapon someone already equipped', () => {
    const taken = dagger(SIZE + 1, { equippedBy: 'guard' })

    expect(pickUp.pickUp(worldOf(player(0), taken), 'player')).toEqual({
      status: 'nothing-in-reach',
    })
  })

  it('supports picking up non-weapon items with role "item" or pickUpAble metadata', () => {
    const item = new BasicWorldObject('potion', 'room', { role: 'item', pickUpAble: true }, [], {
      x: SIZE + 1, y: 0, width: SIZE, height: SIZE, discovered: false, equippedBy: null,
    })

    const result = pickUp.pickUp(worldOf(player(0), item), 'player')
    expect(result).toEqual({ status: 'picked-up', objectId: 'potion' })
    expect(getMutableWorldObjectState(item)).toMatchObject({ equippedBy: 'player', discovered: true })
  })
})

describe('unequip and unequipIfOutOfReach', () => {
  const pickUp = new PickUpService()

  it('keeps weapon equipped when within pickup reach', () => {
    const hero = player(0, 'dagger')
    const item = dagger(SIZE + 5, { equippedBy: 'player' })
    const state = worldOf(hero, item)

    const unequipped = pickUp.unequipIfOutOfReach(state, 'dagger')
    expect(unequipped).toBe(false)
    expect(getMutableWorldObjectState(hero).weaponId).toBe('dagger')
    expect(getMutableWorldObjectState(item).equippedBy).toBe('player')
  })

  it('unequips weapon when it exits pickup reach', () => {
    const hero = player(0, 'dagger')
    const item = dagger(SIZE + 15, { equippedBy: 'player' })
    const state = worldOf(hero, item)

    const unequipped = pickUp.unequipIfOutOfReach(state, 'dagger')
    expect(unequipped).toBe(true)
    expect(getMutableWorldObjectState(hero).weaponId).toBeNull()
    expect(getMutableWorldObjectState(item).equippedBy).toBeNull()
  })

  it('unequips directly regardless of reach', () => {
    const hero = player(0, 'dagger')
    const item = dagger(0, { equippedBy: 'player' })
    const state = worldOf(hero, item)

    pickUp.unequip(state, 'dagger')
    expect(getMutableWorldObjectState(hero).weaponId).toBeNull()
    expect(getMutableWorldObjectState(item).equippedBy).toBeNull()
  })
})
