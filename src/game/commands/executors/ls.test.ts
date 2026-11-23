import { describe, expect, it } from 'vitest'
import { LsCommandExecutor } from './ls.ts'
import { createInitialWorldState } from '../../content/roomWorldState.ts'
import type { ParsedCommand } from '../ParsedCommand.ts'

describe('LsCommandExecutor', () => {
  it('rejects execution when arguments are passed', () => {
    const executor = new LsCommandExecutor()
    const state = createInitialWorldState()
    const command: ParsedCommand = {
      name: 'ls',
      arguments: ['foo'],
      options: [],
    }

    const result = executor.execute(command, state)
    expect(result.status).toBe('rejected')
    expect(result.feedback).toEqual({ kind: 'popup', text: 'Usage: ls' })
  })

  it('rejects execution when options are passed', () => {
    const executor = new LsCommandExecutor()
    const state = createInitialWorldState()
    const command: ParsedCommand = {
      name: 'ls',
      arguments: [],
      options: ['-l'],
    }

    const result = executor.execute(command, state)
    expect(result.status).toBe('rejected')
    expect(result.feedback).toEqual({ kind: 'popup', text: 'Usage: ls' })
  })

  it('rejects execution when game has ended', () => {
    const executor = new LsCommandExecutor()
    const state = createInitialWorldState()
    state.outcome = 'game-over'
    const command: ParsedCommand = {
      name: 'ls',
      arguments: [],
      options: [],
    }

    const result = executor.execute(command, state)
    expect(result.status).toBe('rejected')
    expect(result.feedback).toEqual({ kind: 'popup', text: 'This game has ended.' })
  })

  it('lists room entries and exits on success without including hacker', () => {
    const executor = new LsCommandExecutor()
    const state = createInitialWorldState()
    const command: ParsedCommand = {
      name: 'ls',
      arguments: [],
      options: [],
    }

    const result = executor.execute(command, state)
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      const feedback = result.feedback[0]
      expect(feedback.text).toContain('dagger')
      expect(feedback.text).toContain('guard')
      expect(feedback.text).toContain('tutorial5')
      expect(feedback.text).not.toContain('hacker')
      if (feedback.kind === 'popup') {
        expect(feedback.reverseColorLines).toEqual(['tutorial5'])
      }
    }
  })

  it('marks undiscovered objects discovered when ls is executed', () => {
    const executor = new LsCommandExecutor()
    const state = createInitialWorldState()
    const dagger = state.worldObjects.find((o) => o.id === 'dagger')!
    ;(dagger.state as Record<string, unknown>).discovered = false

    const command: ParsedCommand = {
      name: 'ls',
      arguments: [],
      options: [],
    }

    const result = executor.execute(command, state)
    expect(result.status).toBe('success')
    expect((dagger.state as Record<string, unknown>).discovered).toBe(true)
  })

  it('reflects renamed objects in output', () => {
    const executor = new LsCommandExecutor()
    const state = createInitialWorldState()
    const dagger = state.worldObjects.find((o) => o.id === 'dagger')!
    dagger.rename('staff')

    const command: ParsedCommand = {
      name: 'ls',
      arguments: [],
      options: [],
    }

    const result = executor.execute(command, state)
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.feedback[0].text).toContain('staff')
      expect(result.feedback[0].text).not.toContain('dagger')
    }
  })
})
