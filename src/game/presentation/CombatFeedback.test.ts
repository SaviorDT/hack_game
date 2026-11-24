import { describe, expect, it } from 'vitest'
import { CombatFeedback } from './CombatFeedback.ts'
import { CombatService } from '../domain/CombatService.ts'
import { createInitialWorldState } from '../content/roomWorldState.ts'
import type { CharacterCombatState } from '../domain/CharacterState.ts'

function setup() {
  const state = createInitialWorldState()
  const player = state.worldObjects.find(o => o.id === 'player')!.state as CharacterCombatState
  const guard = state.worldObjects.find(o => o.id === 'guard_a')!.state as CharacterCombatState
  guard.x = player.x + 10
  guard.y = player.y
  const feedback = new CombatFeedback()
  feedback.update(state)
  return { state, player, guard, feedback, combat: new CombatService() }
}

describe('CombatFeedback', () => {
  it('records a successful strike once, with blood directed away from the attacker', () => {
    const { state, player, guard, feedback, combat } = setup()
    expect(combat.attack(state, 'guard_a').status).toBe('hit')
    expect(guard.facing).toBe('left')
    feedback.update(state)
    expect(feedback.attacks.has('guard_a')).toBe(true)
    expect(feedback.damage.has('player')).toBe(true)
    expect(feedback.bursts).toHaveLength(1)
    expect(feedback.bursts[0].direction).toBe(-1)
    expect(player.damageSequence).toBe(1)
    expect(combat.attack(state, 'guard_a').status).toBe('cooling-down')
    feedback.update(state)
    expect(feedback.bursts).toHaveLength(1)
  })

  it('does not replay historical hits when a saved world is first observed', () => {
    const { state, combat } = setup()
    combat.attack(state, 'guard_a')
    const feedback = new CombatFeedback()
    feedback.update(state)
    expect(feedback.bursts).toHaveLength(0)
    expect(feedback.attacks.size).toBe(0)
  })

  it('uses simulation time while playing, and clears effects after a lethal hit ends play', () => {
    const { state, player, combat, feedback } = setup()
    player.health = 1
    combat.attack(state, 'guard_a')
    state.outcome = 'game-over'
    feedback.update(state, 16)
    expect(player.alive).toBe(false)
    expect(feedback.bursts).toHaveLength(1)
    feedback.update(state, 400)
    expect(feedback.bursts).toHaveLength(0)
    expect(feedback.attacks.size).toBe(0)
    expect(feedback.damage.size).toBe(0)
  })

  it('holds effects while simulation is paused, and resets on teardown', () => {
    const { state, combat, feedback } = setup()
    combat.attack(state, 'guard_a')
    feedback.update(state)
    feedback.update(state, 500)
    expect(feedback.attacks.get('guard_a')).toBe(0)
    state.simulationTick += 30
    feedback.update(state)
    expect(feedback.bursts).toHaveLength(0)
    feedback.clear()
    expect(feedback.attacks.size).toBe(0)
  })
})
