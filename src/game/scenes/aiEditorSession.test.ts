import { describe, expect, it } from 'vitest'
import { createAiEditorSession } from './aiEditorSession.ts'
import { BOSS_CYBER_ENFORCER_TREE, STANDARD_GUARD_TREE } from '../ai/behaviorTree/BehaviorTreePresets.ts'

describe('aiEditorSession', () => {
  it('creates AI editor session reusing room environment and runs simulation steps', () => {
    const bundle = createAiEditorSession({ tree: STANDARD_GUARD_TREE })
    expect(bundle.session).toBeDefined()
    expect(bundle.worldState.worldObjects.length).toBeGreaterThanOrEqual(3)

    // Run a step
    bundle.step(20)
    const statuses = bundle.getNodeStatuses()
    expect(statuses.size).toBeGreaterThan(0)
  })

  it('allows switching tree and damage/heal boss with real room guard', () => {
    const bundle = createAiEditorSession({ tree: BOSS_CYBER_ENFORCER_TREE, bossMaxHealth: 150 })
    expect(bundle.getTree().id).toBe('boss-cyber-enforcer')

    bundle.damageBoss(25)
    const boss = bundle.worldState.worldObjects.find((o) => o.id === bundle.targetGuardId)!
    expect((boss.state as { health: number }).health).toBe(125)

    bundle.healBoss(10)
    expect((boss.state as { health: number }).health).toBe(135)

    bundle.setTree(STANDARD_GUARD_TREE)
    expect(bundle.getTree().id).toBe('standard-guard')

    bundle.resetArena()
    expect((boss.state as { health: number }).health).toBe(150)
  })

  it('switches previewed enemy with setTargetGuard and ticks simulation without crashing', () => {
    const bundle = createAiEditorSession({ tree: STANDARD_GUARD_TREE })
    expect(bundle.targetGuardId).toBe('guard_a')

    bundle.step(20)

    const switched = bundle.setTargetGuard('guard_b')
    expect(switched).toBe(true)
    expect(bundle.targetGuardId).toBe('guard_b')

    // Must advance simulation without throwing "No simulation process registered"
    expect(() => {
      bundle.step(20)
      bundle.step(20)
    }).not.toThrow()

    // Now damage affects guard_b
    const g2 = bundle.worldState.worldObjects.find((o) => o.id === 'guard_b')!
    const initialHp = (g2.state as { health: number }).health
    bundle.damageBoss(20)
    expect((g2.state as { health: number }).health).toBe(initialHp - 20)

    // Switch to guard_c and step simulation
    expect(bundle.setTargetGuard('guard_c')).toBe(true)
    expect(bundle.targetGuardId).toBe('guard_c')
    expect(() => {
      bundle.step(20)
    }).not.toThrow()

    // Switch back to guard and step simulation
    expect(bundle.setTargetGuard('guard_a')).toBe(true)
    expect(bundle.targetGuardId).toBe('guard_a')
    expect(() => {
      bundle.step(20)
    }).not.toThrow()

    // Cannot switch to non-existent or non-guard
    expect(bundle.setTargetGuard('non-existent')).toBe(false)
    expect(bundle.setTargetGuard('player')).toBe(false)
    expect(bundle.targetGuardId).toBe('guard_a')
  })
})
