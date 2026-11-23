import { describe, expect, it } from 'vitest'
import { generateRoomSource } from './roomSerializer.ts'
import type { RoomObjectConfig } from './room.ts'

describe('roomSerializer', () => {
  it('generates valid TypeScript output for initial room objects', () => {
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

    const source = generateRoomSource(objects)
    expect(source).toContain('export interface RoomObjectConfig')
    expect(source).toContain('export const ROOM_OBJECTS: RoomObjectConfig[] = ([')
    expect(source).toContain('] as RoomObjectConfig[]).map((obj) => {')
    expect(source).toContain('DEFAULT_PREFABS')
    expect(source).toContain("id: \"player\"")
    expect(source).toContain("role: \"player\"")
    expect(source).toContain("speed: 240")
    expect(source).toContain("maxHealth: 100")
    expect(source).toContain("id: \"dagger\"")
    expect(source).toContain("role: \"weapon\"")
    expect(source).not.toContain("speed: undefined")
  })

  it('serializes prefabId when defined on object', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'guard-elite',
        role: 'enemy',
        x: 100,
        y: 200,
        displayWidth: 176,
        displayHeight: 176,
        prefabId: 'guard',
      },
    ]

    const source = generateRoomSource(objects)
    expect(source).toContain('prefabId: "guard"')
    expect(source).toContain('prefabId?: string')
  })

  it('serializes spawned objects and rounds float coordinates', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'guard2',
        role: 'enemy',
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

    const source = generateRoomSource(objects)
    expect(source).toContain("id: \"guard2\"")
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

    const source = generateRoomSource(objects)
    expect(source).toContain('export interface PlayerSpeedConfig')
    expect(source).toContain('acceleration: 800')
    expect(source).toContain('frictionAcceleration: 1200')
    expect(source).not.toContain('fractionAcceleration')
    expect(source).toContain('turnaroundAcceleration: 1600')
    expect(source).toContain('maxSpeed: 240')
  })

  it('does not couple mv speed to room serialization', () => {
    const objects: RoomObjectConfig[] = []
    const source = generateRoomSource(objects)

    expect(source).not.toContain('ROOM_MV_SPEED')
    expect(source).not.toContain('MvSpeedConfig')
  })

  it('serializes weapon attack and hold properties', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'dagger',
        role: 'weapon',
        x: 325,
        y: 610,
        displayWidth: 72,
        displayHeight: 72,
        attackDistance: 45,
        attackDurationMs: 250,
        holdOffsetX: 16,
        holdOffsetY: 8,
      },
    ]

    const source = generateRoomSource(objects)
    expect(source).toContain('attackDistance: 45')
    expect(source).toContain('attackDurationMs: 250')
    expect(source).toContain('holdOffsetX: 16')
    expect(source).toContain('holdOffsetY: 8')
  })

  it('serializes world object with object role', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'boulder',
        role: 'object',
        x: 800,
        y: 280,
        displayWidth: 120,
        displayHeight: 120,
        scaleX: 1,
        scaleY: 1,
      },
    ]

    const source = generateRoomSource(objects)
    expect(source).toContain('id: "boulder"')
    expect(source).toContain('role: "object"')
    expect(source).toContain('x: 800')
    expect(source).toContain('y: 280')
    expect(source).toContain('displayWidth: 120')
    expect(source).toContain('displayHeight: 120')
  })

  it('serializes colliderWidth and colliderHeight when defined', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'player',
        role: 'player',
        x: 250,
        y: 205,
        displayWidth: 176,
        displayHeight: 176,
        colliderWidth: 95,
        colliderHeight: 145,
      },
      {
        id: 'guard1',
        role: 'enemy',
        x: 600,
        y: 400,
        displayWidth: 176,
        displayHeight: 176,
      },
    ]

    const source = generateRoomSource(objects)
    expect(source).toContain('colliderWidth: 95')
    expect(source).toContain('colliderHeight: 145')
    expect(source).not.toContain('colliderWidth: undefined')
  })
})

describe('generateRoomSource physics values', () => {
  it('writes only the physics values that are set', () => {
    const source = generateRoomSource([
      {
        id: 'dagger',
        role: 'weapon',
        x: 1,
        y: 2,
        displayWidth: 72,
        displayHeight: 72,
        drag: 1.5,
        max_velocity: 80,
        restitution: 0.25,
      },
      { id: 'guard', role: 'enemy', x: 1, y: 2, displayWidth: 72, displayHeight: 72 },
    ])
    expect(source).toContain('    drag: 1.5,\n    max_velocity: 80,\n    restitution: 0.25,\n')
    expect(source).not.toContain('mass: ')
    expect(source).not.toContain('mv_attr')
  })
})

describe('roomSerializer collider shape', () => {
  const rock: RoomObjectConfig = {
    id: 'boulder',
    role: 'object',
    x: 800,
    y: 280,
    displayWidth: 154,
    displayHeight: 154,
    colliderWidth: 128,
    colliderHeight: 128,
    colliderShape: 'circle',
  }

  it('writes a circle collider shape and the type that allows it', () => {
    const source = generateRoomSource([rock])
    expect(source).toContain('    colliderShape: "circle",')
    expect(source).toContain("colliderShape?: 'box' | 'circle'")
  })

  it('leaves the default box shape out', () => {
    expect(generateRoomSource([{ ...rock, colliderShape: 'box' }])).not.toContain('colliderShape: "')
  })
})
