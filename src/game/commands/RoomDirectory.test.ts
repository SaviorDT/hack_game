import { describe, expect, it } from 'vitest'
import { createInitialWorldState } from '../content/room1WorldState.ts'
import { getRoomDirectoryEntries } from './RoomDirectory.ts'

describe('getRoomDirectoryEntries', () => {
  it('excludes player from room entries by default (includePlayer = false)', () => {
    const state = createInitialWorldState()
    const room = state.rooms.find((r) => r.id === state.currentRoomId)!

    const entries = getRoomDirectoryEntries(state, room, false, false)
    expect(entries).not.toContain('hacker')
    expect(entries).not.toContain('player')
  })

  it('includes player label "hacker" when includePlayer = true', () => {
    const state = createInitialWorldState()
    const room = state.rooms.find((r) => r.id === state.currentRoomId)!

    const entries = getRoomDirectoryEntries(state, room, false, true)
    expect(entries).toContain('hacker')
    expect(entries).toContain('room2')
  })

  it('reflects updated player label when player is renamed', () => {
    const state = createInitialWorldState()
    const room = state.rooms.find((r) => r.id === state.currentRoomId)!
    const player = state.worldObjects.find((o) => o.metadata.role === 'player')!

    player.rename('cyber-ninja')

    const entries = getRoomDirectoryEntries(state, room, false, true)
    expect(entries).toContain('cyber-ninja')
    expect(entries).not.toContain('hacker')
  })

  it('does not mutate undiscovered objects when discoverObjects = false', () => {
    const state = createInitialWorldState()
    const room = state.rooms.find((r) => r.id === state.currentRoomId)!
    const dagger = state.worldObjects.find((o) => o.id === 'dagger')!
    ;(dagger.state as Record<string, unknown>).discovered = false

    expect((dagger.state as Record<string, unknown>).discovered).toBe(false)

    getRoomDirectoryEntries(state, room, false, true)

    expect((dagger.state as Record<string, unknown>).discovered).toBe(false)
  })
})
