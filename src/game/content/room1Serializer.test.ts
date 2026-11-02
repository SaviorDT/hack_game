import { describe, expect, it } from 'vitest'
import { generateRoom1Source } from './room1Serializer.ts'
import type { RoomObjectConfig } from './room1.ts'

describe('room1Serializer', () => {
  it('generates valid TypeScript output for initial room1 objects', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'player',
        role: 'player',
        x: 250,
        y: 205,
        displayWidth: 176,
        displayHeight: 176,
        speed: 240,
        maxHealth: 100,
      },
      {
        id: 'dagger',
        role: 'weapon',
        x: 325,
        y: 610,
        displayWidth: 72,
        displayHeight: 72,
      },
    ]

    const source = generateRoom1Source(objects)
    expect(source).toContain('export interface RoomObjectConfig')
    expect(source).toContain('export const ROOM1_OBJECTS: RoomObjectConfig[] = [')
    expect(source).toContain("id: \"player\"")
    expect(source).toContain("role: \"player\"")
    expect(source).toContain("speed: 240")
    expect(source).toContain("maxHealth: 100")
    expect(source).toContain("id: \"dagger\"")
    expect(source).toContain("role: \"weapon\"")
    expect(source).not.toContain("speed: undefined")
  })

  it('serializes spawned objects and rounds float coordinates', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'guard-2',
        role: 'guard',
        x: 959.8,
        y: 380.2,
        displayWidth: 194.1,
        displayHeight: 194.1,
        scaleX: 1.1,
        scaleY: 1.1,
        speed: 130,
        maxHealth: 150,
      },
    ]

    const source = generateRoom1Source(objects)
    expect(source).toContain("id: \"guard-2\"")
    expect(source).toContain("x: 960")
    expect(source).toContain("y: 380")
    expect(source).toContain("displayWidth: 194")
    expect(source).toContain("displayHeight: 194")
    expect(source).toContain("scaleX: 1.1")
    expect(source).toContain("scaleY: 1.1")
    expect(source).toContain("speed: 130")
    expect(source).toContain("maxHealth: 150")
  })

  it('serializes structured player speed with acceleration, friction acceleration, turnaround acceleration and max speed', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'player',
        role: 'player',
        x: 250,
        y: 205,
        displayWidth: 176,
        displayHeight: 176,
        speed: {
          acceleration: 800,
          frictionAcceleration: 1200,
          turnaroundAcceleration: 1600,
          maxSpeed: 240,
        },
        maxHealth: 100,
      },
    ]

    const source = generateRoom1Source(objects)
    expect(source).toContain('export interface PlayerSpeedConfig')
    expect(source).toContain('acceleration: 800')
    expect(source).toContain('frictionAcceleration: 1200')
    expect(source).not.toContain('fractionAcceleration')
    expect(source).toContain('turnaroundAcceleration: 1600')
    expect(source).toContain('maxSpeed: 240')
  })

  it('does not couple mv speed to room1 serialization', () => {
    const objects: RoomObjectConfig[] = []
    const source = generateRoom1Source(objects)

    expect(source).not.toContain('ROOM1_MV_SPEED')
    expect(source).not.toContain('MvSpeedConfig')
  })
})


describe('generateRoom1Source mv_attr', () => {
  it('writes only the mv_attr fields that are set', () => {
    const source = generateRoom1Source([
      {
        id: 'dagger',
        role: 'weapon',
        x: 1,
        y: 2,
        displayWidth: 72,
        displayHeight: 72,
        mv_attr: { drag: 1.5, max_velocity: 80 },
      },
      { id: 'guard', role: 'guard', x: 1, y: 2, displayWidth: 72, displayHeight: 72, mv_attr: {} },
    ])
    expect(source).toContain('mv_attr: {\n      drag: 1.5,\n      max_velocity: 80,\n    },')
    expect(source).not.toContain('mass:')
    expect(source.match(/mv_attr/g)).toHaveLength(2) // one in the object, one in the interface
  })
})
