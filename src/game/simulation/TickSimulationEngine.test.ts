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

describe('renderPosition', () => {
  function movingWorld(): { state: WorldState; engine: TickSimulationEngine } {
    const state: WorldState = {
      rooms: [],
      worldObjects: [
        new BasicWorldObject('mover', 'room1', {}, [
          { condition: ALWAYS_ACTIVE_BEHAVIOR, processDefinitionId: 'move' },
        ], { x: 0, y: 100 }),
        new BasicWorldObject('plain', 'room1', {}, [], {}),
      ],
      processInstances: [],
      currentRoomId: 'room1',
      commandHistory: [],
      simulationTick: 0,
      outcome: 'playing',
    }
    const engine = new TickSimulationEngine([
      {
        id: 'move',
        definitionId: 'move',
        tick: (context) => {
          ;(context.worldObject.state as { x: number }).x += 10
        },
      },
    ])
    return { state, engine }
  }

  it('is the current position before any tick has run', () => {
    const { state, engine } = movingWorld()

    expect(engine.renderPosition(state, 'mover')).toEqual({ x: 0, y: 100 })
  })

  it('blends the previous and current tick positions by the leftover tick fraction', () => {
    const { state, engine } = movingWorld()

    engine.advance(state, SIMULATION_TICK_MS * 1.5)

    expect(engine.renderPosition(state, 'mover')?.x).toBeCloseTo(5)
    expect(engine.renderPosition(state, 'mover')?.y).toBe(100)
  })

  it('keeps moving smoothly across frames shorter than a tick', () => {
    const { state, engine } = movingWorld()
    const rendered: number[] = []

    for (let frame = 0; frame < 8; frame += 1) {
      engine.advance(state, SIMULATION_TICK_MS / 4)
      rendered.push(engine.renderPosition(state, 'mover')?.x ?? Number.NaN)
    }

    // The first tick has not run during the first three frames, so nothing can move yet.
    for (let frame = 4; frame < rendered.length; frame += 1) {
      expect(rendered[frame]).toBeGreaterThan(rendered[frame - 1])
    }
    expect(rendered[7]).toBeCloseTo(10)
  })

  it('has no render position for an object without coordinates', () => {
    const { state, engine } = movingWorld()

    expect(engine.renderPosition(state, 'plain')).toBeUndefined()
  })

  it('uses the current position once the game has ended', () => {
    const { state, engine } = movingWorld()
    engine.advance(state, SIMULATION_TICK_MS * 1.5)
    state.outcome = 'game-over'

    expect(engine.renderPosition(state, 'mover')).toEqual({ x: 10, y: 100 })
  })
})

describe('RealtimeSimulationClock frame cap', () => {
  it('limits a single frame to 250 ms of real time', () => {
    expect(new RealtimeSimulationClock().toGameDelta(10_000)).toBe(250)
  })
})
