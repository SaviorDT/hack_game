import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from '../../content/roomWorldState.ts'
import { BehaviorTreeEvaluator } from './BehaviorTreeEvaluator.ts'
import {
  STANDARD_GUARD_TREE,
  PATROL_GUARD_TREE,
  BOSS_CYBER_ENFORCER_TREE,
  HIT_AND_RUN_TREE,
  TANK_BOSS_TREE,
} from './BehaviorTreePresets.ts'
import { BehaviorTreeProcess } from './BehaviorTreeProcess.ts'
import type {
  BehaviorTreeContext,
  BehaviorTreeNodeDef,
  BehaviorTreeStatus,
} from './BehaviorTreeTypes.ts'

describe('BehaviorTreeEvaluator', () => {
  function makeContext(): { context: BehaviorTreeContext; nodeStatuses: Map<string, BehaviorTreeStatus> } {
    const state = createInitialWorldState()
    const guardObj = state.worldObjects.find((obj) => obj.id === 'guard')!
    const nodeStatuses = new Map<string, BehaviorTreeStatus>()
    const blackboard: Record<string, unknown> = {}

    const context: BehaviorTreeContext = {
      state,
      entity: guardObj,
      blackboard,
      tickDurationMs: 16.666,
      recordNodeStatus: (id, status) => {
        nodeStatuses.set(id, status)
      },
    }

    return { context, nodeStatuses }
  }

  // Node helpers using standard actions/conditions
  const succeedingNode = (id: string): BehaviorTreeNodeDef => ({
    id,
    type: 'heal',
    name: 'Heal Action',
    params: { healAmount: 0 },
  })

  const failingNode = (id: string): BehaviorTreeNodeDef => ({
    id,
    type: 'is_health_below',
    name: 'HP Check',
    params: { thresholdPercent: 10 },
  })

  describe('Composites', () => {
    it('evaluates selector: returns SUCCESS on first succeeding child', () => {
      const { context } = makeContext()
      const tree: BehaviorTreeNodeDef = {
        id: 'sel-1',
        type: 'selector',
        name: 'Selector',
        children: [
          failingNode('c1'),
          succeedingNode('c2'),
          failingNode('c3'),
        ],
      }

      const status = BehaviorTreeEvaluator.evaluate(tree, context)
      expect(status).toBe('SUCCESS')
    })

    it('evaluates selector: returns FAILURE when all children fail', () => {
      const { context } = makeContext()
      const tree: BehaviorTreeNodeDef = {
        id: 'sel-2',
        type: 'selector',
        name: 'Selector',
        children: [
          failingNode('c1'),
          failingNode('c2'),
        ],
      }

      const status = BehaviorTreeEvaluator.evaluate(tree, context)
      expect(status).toBe('FAILURE')
    })

    it('evaluates sequence: returns SUCCESS when all children succeed', () => {
      const { context } = makeContext()
      const tree: BehaviorTreeNodeDef = {
        id: 'seq-1',
        type: 'sequence',
        name: 'Sequence',
        children: [
          succeedingNode('c1'),
          succeedingNode('c2'),
        ],
      }

      const status = BehaviorTreeEvaluator.evaluate(tree, context)
      expect(status).toBe('SUCCESS')
    })

    it('evaluates sequence: returns FAILURE on first failing child', () => {
      const { context } = makeContext()
      const tree: BehaviorTreeNodeDef = {
        id: 'seq-2',
        type: 'sequence',
        name: 'Sequence',
        children: [
          succeedingNode('c1'),
          failingNode('c2'),
          succeedingNode('c3'),
        ],
      }

      const status = BehaviorTreeEvaluator.evaluate(tree, context)
      expect(status).toBe('FAILURE')
    })
  })

  describe('Decorators', () => {
    it('evaluates inverter: flips SUCCESS to FAILURE and FAILURE to SUCCESS', () => {
      const { context } = makeContext()

      const invertSuccess: BehaviorTreeNodeDef = {
        id: 'inv-1',
        type: 'inverter',
        name: 'Invert',
        children: [succeedingNode('child-1')],
      }
      expect(BehaviorTreeEvaluator.evaluate(invertSuccess, context)).toBe('FAILURE')

      const invertFailure: BehaviorTreeNodeDef = {
        id: 'inv-2',
        type: 'inverter',
        name: 'Invert',
        children: [failingNode('child-2')],
      }
      expect(BehaviorTreeEvaluator.evaluate(invertFailure, context)).toBe('SUCCESS')
    })

    it('evaluates cooldown: prevents re-execution until cooldown time passes', () => {
      const { context } = makeContext()
      const cooldownNode: BehaviorTreeNodeDef = {
        id: 'cd-1',
        type: 'cooldown',
        name: 'Cooldown',
        params: { cooldownMs: 100 },
        children: [succeedingNode('cd-act')],
      }

      // First run succeeds and records cooldown
      expect(BehaviorTreeEvaluator.evaluate(cooldownNode, context)).toBe('SUCCESS')

      // Second immediate run fails because of cooldown
      expect(BehaviorTreeEvaluator.evaluate(cooldownNode, context)).toBe('FAILURE')

      // Advance time by 150ms
      context.blackboard._timeMs = 150
      expect(BehaviorTreeEvaluator.evaluate(cooldownNode, context)).toBe('SUCCESS')
    })
  })

  describe('Conditions & Actions', () => {
    it('evaluates is_health_below correctly', () => {
      const { context } = makeContext()
      const cond: BehaviorTreeNodeDef = {
        id: 'cond-hp',
        type: 'is_health_below',
        name: 'HP < 50%',
        params: { thresholdPercent: 50 },
      }

      // Guard is at 100/100 HP => health ratio is 100% > 50% => FAILURE
      expect(BehaviorTreeEvaluator.evaluate(cond, context)).toBe('FAILURE')

      // Set health to 40
      const guardState = context.entity.state as { health: number }
      guardState.health = 40
      expect(BehaviorTreeEvaluator.evaluate(cond, context)).toBe('SUCCESS')
    })

    it('evaluates is_player_in_zone based on player x coordinate', () => {
      const { context } = makeContext()
      const condRight: BehaviorTreeNodeDef = {
        id: 'cond-zone',
        type: 'is_player_in_zone',
        name: 'In Right Half',
        params: { zone: 'right' },
      }

      // Initial player x is ~378 (left half < 960)
      expect(BehaviorTreeEvaluator.evaluate(condRight, context)).toBe('FAILURE')

      // Move player to right half (x = 1100)
      const playerObj = context.state.worldObjects.find((o) => o.id === 'player')!
      ;(playerObj.state as { x: number }).x = 1100

      expect(BehaviorTreeEvaluator.evaluate(condRight, context)).toBe('SUCCESS')
    })

    it('heals entity when heal action is executed', () => {
      const { context } = makeContext()
      const guardState = context.entity.state as { health: number; maxHealth: number }
      guardState.health = 50
      guardState.maxHealth = 100

      const healAct: BehaviorTreeNodeDef = {
        id: 'act-heal',
        type: 'heal',
        name: 'Heal',
        params: { healAmount: 20 },
      }

      const status = BehaviorTreeEvaluator.evaluate(healAct, context)
      expect(status).toBe('SUCCESS')
      expect(guardState.health).toBe(70)
    })
  })

  describe('Presets', () => {
    it('evaluates all presets without error on initial state', () => {
      const presets = [
        STANDARD_GUARD_TREE,
        PATROL_GUARD_TREE,
        BOSS_CYBER_ENFORCER_TREE,
        HIT_AND_RUN_TREE,
        TANK_BOSS_TREE,
      ]

      for (const preset of presets) {
        const { context, nodeStatuses } = makeContext()
        const status = BehaviorTreeEvaluator.evaluate(preset.root, context)
        expect(['SUCCESS', 'FAILURE', 'RUNNING']).toContain(status)
        expect(nodeStatuses.size).toBeGreaterThan(0)
      }
    })
  })

  describe('BehaviorTreeProcess', () => {
    it('executes in simulation engine and updates status tracker', () => {
      const { context } = makeContext()
      const process = new BehaviorTreeProcess(STANDARD_GUARD_TREE)

      process.tick({
        state: context.state,
        worldObject: context.entity,
        processInstance: {
          id: 'test-instance',
          ownerObjectId: context.entity.id,
          definitionId: process.definitionId,
          runtimeState: {},
        },
        tickDurationMs: 16.666,
      })

      const tracker = process.getNodeStatuses()
      expect(tracker.size).toBeGreaterThan(0)
      expect(tracker.has('root-selector')).toBe(true)
    })
  })
})
