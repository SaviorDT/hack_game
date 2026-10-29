import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from './BasicWorldObject.ts'
import { PICKUP_REACH, PickUpService } from './PickUpService.ts'
import { getMutableWorldObjectState } from './WorldObjectState.ts'
import type { WorldObject } from './WorldObject.ts'
import type { WorldState } from './WorldState.ts'

const SIZE = 10

function player(x: number, weaponId: string | null = null): WorldObject {
  return new BasicWorldObject('player', 'room1', { role: 'player' }, [], {
    x, y: 0, width: SIZE, height: SIZE, weaponId, discovered: true,
  })
}

function dagger(x: number, extra: Record<string, string | number | boolean | null> = {}): WorldObject {
  return new BasicWorldObject('dagger', 'room1', { role: 'weapon', weaponId: 'dagger' }, [], {
    x, y: 0, width: SIZE, height: SIZE, discovered: false, equippedBy: null, ...extra,
  })
}

function worldOf(...worldObjects: WorldObject[]): WorldState {
  return {
    rooms: [], worldObjects, processInstances: [], currentRoomId: 'room1',
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
})
