import { describe, expect, it } from 'vitest'
import {
  BOSS_CYBER_ENFORCER_TREE,
  PATROL_GUARD_TREE,
  PRESET_BEHAVIOR_TREES,
  STANDARD_GUARD_TREE,
  cloneBehaviorTree,
} from '../ai/behaviorTree/BehaviorTreePresets.ts'
import {
  addChildNode,
  createDefaultNode,
  findNodeById,
  moveChild,
  removeNode,
  updateNode,
} from '../ai/behaviorTree/BehaviorTreeModel.ts'
import { createAiEditorSession } from './aiEditorSession.ts'
import { WORLD_OBJECT_IDS } from '../content/room1Constants.ts'

describe('BehaviorTreeEditorScene Logic & Presets', () => {
  it('provides all required built-in enemy and boss presets', () => {
    expect(PRESET_BEHAVIOR_TREES.length).toBe(5)
    const presetIds = PRESET_BEHAVIOR_TREES.map((p) => p.id)
    expect(presetIds).toContain('standard-guard')
    expect(presetIds).toContain('patrol-guard')
    expect(presetIds).toContain('boss-cyber-enforcer')
    expect(presetIds).toContain('hit-and-run')
    expect(presetIds).toContain('tank-boss')
  })

  it('runs boss 2-phase behavior tree dynamically when health changes', () => {
    const sessionBundle = createAiEditorSession({
      tree: BOSS_CYBER_ENFORCER_TREE,
    })

    const bossObj = sessionBundle.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.guard)!
    const bState = bossObj.state as { health: number; maxHealth: number }

    // Initially Boss is at 150/150 HP (Phase 1)
    expect(bState.health).toBe(150)
    sessionBundle.step(33.333)

    let statuses = sessionBundle.getNodeStatuses()
    // In Phase 1, Phase 2 sequence condition (Health < 50%) should FAIL
    expect(statuses.get('boss-cond-hp-low')).toBe('FAILURE')
    expect(statuses.get('boss-phase2-seq')).toBe('FAILURE')
    // Phase 1 sequence should run
    expect(statuses.get('boss-phase1-seq')).toBeDefined()

    // Now damage boss into Phase 2 (HP = 60 / 150 = 40% < 50%)
    sessionBundle.damageBoss(90)
    expect(bState.health).toBe(60)

    sessionBundle.step(33.333)
    statuses = sessionBundle.getNodeStatuses()

    // Now Phase 2 condition should SUCCEED
    expect(statuses.get('boss-cond-hp-low')).toBe('SUCCESS')
    expect(statuses.get('boss-p2-actions')).toBeDefined()
  })

  it('allows adding custom child nodes to boss behavior tree', () => {
    const tree = cloneBehaviorTree(BOSS_CYBER_ENFORCER_TREE)
    const waitNode = createDefaultNode('wait', 'custom-taunt-wait')

    // Add wait to Phase 1 actions selector
    const added = addChildNode(tree.root, 'boss-p1-actions', waitNode)
    expect(added).toBe(true)

    const found = findNodeById(tree.root, 'custom-taunt-wait')
    expect(found).not.toBeNull()
    expect(found?.type).toBe('wait')
  })

  it('allows deleting nodes while protecting the root node', () => {
    const tree = cloneBehaviorTree(STANDARD_GUARD_TREE)

    // Cannot delete root
    expect(removeNode(tree.root, tree.root.id)).toBe(false)

    // Can delete child
    const removed = removeNode(tree.root, 'act-chase-player')
    expect(removed).toBe(true)
    expect(findNodeById(tree.root, 'act-chase-player')).toBeNull()
  })

  it('reorders siblings with moveChild', () => {
    const tree = cloneBehaviorTree(BOSS_CYBER_ENFORCER_TREE)
    // boss-root has children: boss-phase2-seq (idx 0), boss-phase1-seq (idx 1)
    const moved = moveChild(tree.root, 'boss-phase1-seq', 'left')
    expect(moved).toBe(true)
    expect(tree.root.children?.[0].id).toBe('boss-phase1-seq')
    expect(tree.root.children?.[1].id).toBe('boss-phase2-seq')
  })

  it('updates node parameters and reflects in tree evaluator', () => {
    const tree = cloneBehaviorTree(PATROL_GUARD_TREE)
    const updated = updateNode(tree.root, 'cond-patrol-range', {
      params: { range: 600 },
    })
    expect(updated).toBe(true)

    const node = findNodeById(tree.root, 'cond-patrol-range')!
    expect(node.params?.range).toBe(600)
  })

  it('allows moving the player in the arena using movement keys', () => {
    const sessionBundle = createAiEditorSession({
      tree: STANDARD_GUARD_TREE,
    })

    const playerObj = sessionBundle.worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)!
    const pState = playerObj.state as { x: number; y: number; vx: number }
    const initialX = pState.x

    sessionBundle.session.keyDown('d')
    for (let i = 0; i < 10; i++) {
      sessionBundle.step(20)
    }

    expect(pState.vx).toBeGreaterThan(0)
    expect(pState.x).toBeGreaterThan(initialX)
  })
})
