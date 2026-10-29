import { describe, expect, it } from 'vitest'
import { BasicWorldObject } from '../domain/BasicWorldObject.ts'
import type { WorldState } from '../domain/WorldState.ts'
import { ALWAYS_ACTIVE_BEHAVIOR } from '../processes/BehaviorRule.ts'
import { RealtimeSimulationClock } from './RealtimeSimulationClock.ts'
import { SIMULATION_TICK_MS, TickSimulationEngine } from './TickSimulationEngine.ts'
import type { WorldObjectProcess } from './TickSimulationEngine.ts'

function countingWorld(): { state: WorldState; ticks: number[] } {
  const state: WorldState = {
    rooms: [],
    worldObjects: [
      new BasicWorldObject('thing', 'room1', {}, [
        { condition: ALWAYS_ACTIVE_BEHAVIOR, processDefinitionId: 'count' },
      ], {}),
    ],
    processInstances: [],
    currentRoomId: 'room1',
    commandHistory: [],
    simulationTick: 0,
    outcome: 'playing',
  }
  return { state, ticks: [] }
}

describe('TickSimulationEngine', () => {
  it('runs sixty ticks of 1000/60 ms for one second of game time', () => {
    const { state, ticks } = countingWorld()
    const process: WorldObjectProcess = {
      id: 'count',
      definitionId: 'count',
      tick: (context) => ticks.push(context.tickDurationMs),
    }
    const engine = new TickSimulationEngine([process])

    for (let frame = 0; frame < 60; frame += 1) {
      engine.advance(state, SIMULATION_TICK_MS)
    }

    expect(SIMULATION_TICK_MS).toBeCloseTo(16.6667, 3)
    expect(ticks).toHaveLength(60)
    expect(ticks[0]).toBe(SIMULATION_TICK_MS)
  })

  it('carries leftover time into the next advance', () => {
    const { state, ticks } = countingWorld()
    const engine = new TickSimulationEngine([
      { id: 'count', definitionId: 'count', tick: (context) => ticks.push(context.tickDurationMs) },
    ])

    engine.advance(state, SIMULATION_TICK_MS * 0.6)
    expect(ticks).toHaveLength(0)

    engine.advance(state, SIMULATION_TICK_MS * 0.6)
    expect(ticks).toHaveLength(1)
  })
})

describe('RealtimeSimulationClock time scale', () => {
  it('passes real time through at the default scale of one', () => {
    expect(new RealtimeSimulationClock().toGameDelta(16)).toBe(16)
  })

  it('multiplies real time by the current time scale', () => {
    const clock = new RealtimeSimulationClock()
    clock.setTimeScale(0.25)

    expect(clock.toGameDelta(100)).toBe(25)
  })

  it('rejects a negative or non-finite time scale', () => {
    const clock = new RealtimeSimulationClock()

    expect(() => clock.setTimeScale(-1)).toThrow()
    expect(() => clock.setTimeScale(Number.NaN)).toThrow()
  })
})
