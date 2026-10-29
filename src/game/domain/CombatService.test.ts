import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from './BasicWorldObject.ts'
import { CombatService } from './CombatService.ts'
import { getMutableWorldObjectState } from './WorldObjectState.ts'
import type { CharacterState } from './CharacterState.ts'
import type { WorldObject } from './WorldObject.ts'
import type { WorldState } from './WorldState.ts'

const SIZE = 10

function character(
  id: string,
  role: string,
  x: number,
  overrides: Partial<CharacterState> = {},
): WorldObject {
  const state: CharacterState = {
    x,
    y: 0,
    width: SIZE,
    height: SIZE,
    health: 100,
    maxHealth: 100,
    alive: true,
    discovered: true,
    weaponId: null,
    attackCooldownMs: 0,
    ...overrides,
  }
  return new BasicWorldObject(id, 'room1', { role }, [], state as never)
}

function worldOf(...worldObjects: WorldObject[]): WorldState {
  return {
    rooms: [],
    worldObjects,
    processInstances: [],
    currentRoomId: 'room1',
    commandHistory: [],
    simulationTick: 0,
    outcome: 'playing',
  }
}

function stateOf(worldObject: WorldObject): CharacterState {
  return getMutableWorldObjectState<never>(worldObject) as CharacterState
}

describe('attack', () => {
  const combat = new CombatService()

  it('deals unarmed damage to a character within unarmed reach', () => {
    const player = character('player', 'player', 0)
    const guard = character('guard', 'guard', SIZE + 5)

    const result = combat.attack(worldOf(player, guard), 'player')

    expect(result).toEqual({ status: 'hit', targetId: 'guard', damage: 10 })
    expect(stateOf(guard).health).toBe(90)
  })

  it('misses a character beyond the weapon reach', () => {
    const player = character('player', 'player', 0)
    const guard = character('guard', 'guard', SIZE + 6)

    expect(combat.attack(worldOf(player, guard), 'player')).toEqual({ status: 'no-target' })
    expect(stateOf(guard).health).toBe(100)
  })

  it('uses the dagger damage and reach when it is equipped', () => {
    const player = character('player', 'player', 0, { weaponId: 'dagger' })
    const guard = character('guard', 'guard', SIZE + 10)

    expect(combat.attack(worldOf(player, guard), 'player')).toEqual({
      status: 'hit',
      targetId: 'guard',
      damage: 35,
    })
    expect(stateOf(guard).health).toBe(65)
  })

  it('hits only the nearest character in reach', () => {
    const player = character('player', 'player', 0, { weaponId: 'dagger' })
    const near = character('near', 'guard', SIZE + 2)
    const far = character('far', 'guard', SIZE + 8)

    combat.attack(worldOf(player, far, near), 'player')

    expect(stateOf(near).health).toBe(65)
    expect(stateOf(far).health).toBe(100)
  })

  it('defeats a character whose health reaches zero and keeps health at zero', () => {
    const player = character('player', 'player', 0, { weaponId: 'dagger' })
    const guard = character('guard', 'guard', SIZE + 1, { health: 20 })

    combat.attack(worldOf(player, guard), 'player')

    expect(stateOf(guard)).toMatchObject({ health: 0, alive: false })
  })

  it('ignores defeated characters and characters in other rooms', () => {
    const player = character('player', 'player', 0)
    const dead = character('dead', 'guard', SIZE + 1, { alive: false, health: 0 })
    const elsewhere = new BasicWorldObject(
      'elsewhere',
      'room2',
      { role: 'guard' },
      [],
      { ...stateOf(character('x', 'guard', SIZE + 1)) } as never,
    )

    expect(combat.attack(worldOf(player, dead, elsewhere), 'player')).toEqual({
      status: 'no-target',
    })
  })

  it('marks the character it hits as discovered', () => {
    const player = character('player', 'player', 0)
    const guard = character('guard', 'guard', SIZE + 1, { discovered: false })

    combat.attack(worldOf(player, guard), 'player')

    expect(stateOf(guard).discovered).toBe(true)
  })

  it('lets a guard strike the player with the guard weapon', () => {
    const guard = character('guard', 'guard', 0, { weaponId: 'guard-strike' })
    const player = character('player', 'player', SIZE + 5)

    const result = combat.attack(worldOf(player, guard), 'guard')

    expect(result).toEqual({ status: 'hit', targetId: 'player', damage: 20 })
  })
})

describe('attack cooldown', () => {
  const combat = new CombatService()

  it('refuses to attack again until the weapon cooldown has elapsed', () => {
    const player = character('player', 'player', 0)
    const guard = character('guard', 'guard', SIZE + 1)
    const state = worldOf(player, guard)

    combat.attack(state, 'player')
    expect(combat.attack(state, 'player')).toEqual({ status: 'cooling-down' })

    combat.advanceCooldowns(state, 499)
    expect(combat.attack(state, 'player')).toEqual({ status: 'cooling-down' })

    combat.advanceCooldowns(state, 1)
    expect(combat.attack(state, 'player')).toMatchObject({ status: 'hit' })
    expect(stateOf(guard).health).toBe(80)
  })

  it('uses the cooldown of the weapon that made the attack', () => {
    const guard = character('guard', 'guard', 0, { weaponId: 'guard-strike' })
    const player = character('player', 'player', SIZE + 1)
    const state = worldOf(player, guard)

    combat.attack(state, 'guard')
    combat.advanceCooldowns(state, 999)

    expect(combat.attack(state, 'guard')).toEqual({ status: 'cooling-down' })
  })

  it('does not start a cooldown when the attack misses', () => {
    const player = character('player', 'player', 0)
    const guard = character('guard', 'guard', 100)
    const state = worldOf(player, guard)

    combat.attack(state, 'player')

    expect(stateOf(player).attackCooldownMs).toBe(0)
  })
})
