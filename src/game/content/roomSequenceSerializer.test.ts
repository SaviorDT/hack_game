import { describe, expect, it } from 'vitest'
import { generateRoomSequenceSource } from './roomSequenceSerializer.ts'

describe('room sequence serializer', () => {
  it('serializes active and unused room ids', () => {
    const source = generateRoomSequenceSource(['tutorial1', 'room'], ['tutorial3'])
    expect(source).toContain('export const ACTIVE_ROOM_IDS: readonly string[] = [')
    expect(source).toContain('  "tutorial1",')
    expect(source).toContain('  "room",')
    expect(source).toContain('export const UNUSED_ROOM_IDS: readonly string[] = [')
    expect(source).toContain('  "tutorial3",')
  })

  it('serializes an empty unused pool', () => {
    const source = generateRoomSequenceSource(['tutorial1'], [])
    expect(source).toContain('export const UNUSED_ROOM_IDS: readonly string[] = [')
    const unusedSection = source
      .split('export const UNUSED_ROOM_IDS: readonly string[] = [')[1]
      ?.split('export const ROOM_CONTENT_SNAPSHOT')[0]
    expect(unusedSection?.trim()).toBe(']')
  })

  it('serializes complete room content snapshots', () => {
    const source = generateRoomSequenceSource(
      ['tutorial1'],
      [],
      {
        tutorial1: {
          id: 'tutorial1',
          goal: 'Test goal',
          objects: [{ id: 'player', role: 'player', x: 250, y: 420 }],
          exit: { targetRoomId: 'room', label: 'room', endsGame: false },
        },
      },
    )
    expect(source).toContain('export const ROOM_CONTENT_SNAPSHOT')
    expect(source).toContain('"tutorial1"')
    expect(source).toContain('"Test goal"')
    expect(source).toContain('"objects"')
  })
})
