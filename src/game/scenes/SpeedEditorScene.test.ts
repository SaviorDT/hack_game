import { describe, expect, it } from 'vitest'
import {
  createSpeedEditorSession,
  DEFAULT_SPEED_CONFIG,
  getPlayerSpeedFromObjects,
} from './speedEditorSession.ts'
import { WORLD_OBJECT_IDS } from '../content/room1Constants.ts'
import { generateRoom1Source } from '../content/room1Serializer.ts'
import type { RoomObjectConfig } from '../content/room1.ts'

describe('SpeedEditorScene', () => {
  describe('getPlayerSpeedFromObjects', () => {
    it('extracts speed configuration from player object', () => {
      const objects: RoomObjectConfig[] = [
        {
          id: 'player',
          role: 'player',
          x: 100,
          y: 200,
          displayWidth: 127,
          displayHeight: 127,
          speed: {
            acceleration: 2500,
            frictionAcceleration: 3000,
            turnaroundAcceleration: 1600,
            maxSpeed: 300,
          },
        },
      ]

      const speed = getPlayerSpeedFromObjects(objects)
      expect(speed).toEqual({
        acceleration: 2500,
        frictionAcceleration: 3000,
        turnaroundAcceleration: 1600,
        maxSpeed: 300,
      })
    })

    it('returns default speed config when player has no custom speed', () => {
      const objects: RoomObjectConfig[] = [
        {
          id: 'player',
          role: 'player',
          x: 100,
          y: 200,
          displayWidth: 127,
          displayHeight: 127,
        },
      ]

      const speed = getPlayerSpeedFromObjects(objects)
      expect(speed).toEqual(DEFAULT_SPEED_CONFIG)
    })
  })

  describe('createSpeedEditorSession', () => {
    it('reuses main game movement physics and moves player with keyboard input', () => {
      const { session, worldState } = createSpeedEditorSession({
        playerSpeed: {
          acceleration: 2000,
          frictionAcceleration: 2500,
          turnaroundAcceleration: 1500,
          maxSpeed: 250,
        },
      })

      const player = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
      expect(player).toBeDefined()
      const state = player!.state as Record<string, unknown>
      const startX = state.x as number

      // Press right ('d') and advance simulation
      session.keyDown('d')
      // Advance several 16.6ms simulation frames
      for (let i = 0; i < 10; i++) {
        session.update(16.67)
      }

      // Player should have accelerated to the right
      expect((state.vx as number)).toBeGreaterThan(0)
      expect((state.x as number)).toBeGreaterThan(startX)
    })

    it('can move while adjusting speed parameters dynamically', () => {
      const { session, worldState } = createSpeedEditorSession({
        playerSpeed: {
          acceleration: 2000,
          frictionAcceleration: 2000,
          turnaroundAcceleration: 1500,
          maxSpeed: 200,
        },
      })

      const player = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
      const state = player!.state as Record<string, unknown>

      // Hold right key
      session.keyDown('d')

      // Move until maxSpeed is reached
      for (let i = 0; i < 20; i++) {
        session.update(16.67)
      }

      // Capped at initial maxSpeed of 200
      expect((state.vx as number)).toBeCloseTo(200, 0)

      // Adjust maxSpeed dynamically while moving (as happens during editing)
      const speedConfig = state.speed as Record<string, number>
      speedConfig.maxSpeed = 400
      state.maxSpeed = 400

      // Continue moving with key still held
      for (let i = 0; i < 20; i++) {
        session.update(16.67)
      }

      // Velocity should now have increased beyond 200 up toward 400
      expect((state.vx as number)).toBeGreaterThan(250)
      expect((state.vx as number)).toBeLessThanOrEqual(400)
    })

    it('applies friction deceleration when movement keys are released', () => {
      const { session, worldState } = createSpeedEditorSession({
        playerSpeed: {
          acceleration: 3000,
          frictionAcceleration: 3000,
          turnaroundAcceleration: 2000,
          maxSpeed: 300,
        },
      })

      const player = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
      const state = player!.state as Record<string, unknown>

      // Accelerate
      session.keyDown('d')
      for (let i = 0; i < 15; i++) {
        session.update(16.67)
      }
      const movingVx = state.vx as number
      expect(movingVx).toBeGreaterThan(150)

      // Release key
      session.keyUp('d')

      // Advance frames and check friction deceleration
      session.update(50)
      expect((state.vx as number)).toBeLessThan(movingVx)

      // Eventually halts
      for (let i = 0; i < 30; i++) {
        session.update(16.67)
      }
      expect((state.vx as number)).toBe(0)
    })

    it('applies turnaround acceleration when pressing opposing direction', () => {
      const { session, worldState } = createSpeedEditorSession({
        playerSpeed: {
          acceleration: 1000,
          frictionAcceleration: 1000,
          turnaroundAcceleration: 4000, // very snappy turnaround
          maxSpeed: 200,
        },
      })

      const player = worldState.worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.player)
      const state = player!.state as Record<string, unknown>

      // Accelerate right
      session.keyDown('d')
      for (let i = 0; i < 15; i++) {
        session.update(16.67)
      }
      expect((state.vx as number)).toBeGreaterThan(100)

      // Switch to left ('a') while moving right
      session.keyUp('d')
      session.keyDown('a')

      // A single 16.67ms tick with 4000 turnaround acceleration drops velocity by ~66.7 px/s
      session.update(16.67)
      session.update(16.67)
      session.update(16.67)

      // Velocity should have reversed or dropped sharply toward negative
      expect((state.vx as number)).toBeLessThan(50)
    })

    it('disables room exits so player does not trigger congratulations outcome during testing', () => {
      const { session, worldState } = createSpeedEditorSession()
      for (const room of worldState.rooms) {
        expect(room.exits.length).toBe(0)
      }

      // Move player across room
      session.keyDown('d')
      for (let i = 0; i < 100; i++) {
        session.update(16.67)
      }

      expect(worldState.outcome).toBe('playing')
    })
  })

  describe('source code serialization with updated speed', () => {
    it('serializes updated speed parameters correctly for room1.ts', () => {
      const objects: RoomObjectConfig[] = [
        {
          id: 'player',
          role: 'player',
          x: 378,
          y: 345,
          displayWidth: 127,
          displayHeight: 127,
          scaleX: 0.72,
          scaleY: 0.72,
          speed: {
            acceleration: 2600,
            frictionAcceleration: 3100,
            turnaroundAcceleration: 1700,
            maxSpeed: 320,
          },
          maxHealth: 100,
        },
      ]

      const source = generateRoom1Source(objects)
      expect(source).toContain('acceleration: 2600,')
      expect(source).toContain('frictionAcceleration: 3100,')
      expect(source).toContain('turnaroundAcceleration: 1700,')
      expect(source).toContain('maxSpeed: 320,')
    })
  })
})
