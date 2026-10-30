import { describe, expect, it } from 'vitest'
import {
  createInitialWorldState,
  computeCollisionSize,
  resolveScale,
} from './room1WorldState.ts'
import { CHARACTER_SIZE, DAGGER_SIZE, CHARACTER_BASE_SIZE } from './room1Constants.ts'
import type { RoomObjectConfig } from './room1.ts'
import { AabbCollisionWorld } from '../domain/CollisionWorld.ts'

describe('room1WorldState scaled collision AABB', () => {
  it('resolves scale from explicit scaleX and scaleY', () => {
    const obj: RoomObjectConfig = {
      id: 'guard-test',
      role: 'guard',
      x: 100,
      y: 100,
      displayWidth: 88,
      displayHeight: 88,
      scaleX: 0.5,
      scaleY: 0.5,
    }
    const resolved = resolveScale(obj, CHARACTER_BASE_SIZE.width, CHARACTER_BASE_SIZE.height)
    expect(resolved.scaleX).toBe(0.5)
    expect(resolved.scaleY).toBe(0.5)
  })

  it('derives scale from displayWidth and displayHeight when scaleX/scaleY are omitted', () => {
    const obj: RoomObjectConfig = {
      id: 'guard-test',
      role: 'guard',
      x: 100,
      y: 100,
      displayWidth: 88,
      displayHeight: 88,
    }
    const resolved = resolveScale(obj, CHARACTER_BASE_SIZE.width, CHARACTER_BASE_SIZE.height)
    expect(resolved.scaleX).toBeCloseTo(0.5, 2)
    expect(resolved.scaleY).toBeCloseTo(0.5, 2)
  })

  it('computes proportional collision box for characters and weapons', () => {
    const unscaledChar = computeCollisionSize('guard', 1, 1)
    expect(unscaledChar.width).toBe(CHARACTER_SIZE.width)
    expect(unscaledChar.height).toBe(CHARACTER_SIZE.height)

    const halfChar = computeCollisionSize('guard', 0.5, 0.5)
    expect(halfChar.width).toBe(55)
    expect(halfChar.height).toBe(80)

    const unscaledWeapon = computeCollisionSize('weapon', 1, 1)
    expect(unscaledWeapon.width).toBe(DAGGER_SIZE.width)
    expect(unscaledWeapon.height).toBe(DAGGER_SIZE.height)

    const doubleWeapon = computeCollisionSize('weapon', 2, 2)
    expect(doubleWeapon.width).toBe(144)
    expect(doubleWeapon.height).toBe(144)
  })

  it('clamps scaled collision box to minimum size', () => {
    const tinyChar = computeCollisionSize('guard', 0.05, 0.05)
    expect(tinyChar.width).toBe(16)
    expect(tinyChar.height).toBe(16)

    const tinyWeapon = computeCollisionSize('weapon', 0.05, 0.05)
    expect(tinyWeapon.width).toBe(12)
    expect(tinyWeapon.height).toBe(12)
  })

  it('assigns scaled collision AABB to objects in createInitialWorldState', () => {
    const objects: RoomObjectConfig[] = [
      {
        id: 'player',
        role: 'player',
        x: 200,
        y: 200,
        displayWidth: 176,
        displayHeight: 176,
        scaleX: 1,
        scaleY: 1,
      },
      {
        id: 'small-guard',
        role: 'guard',
        x: 400,
        y: 200,
        displayWidth: 88,
        displayHeight: 88,
        scaleX: 0.5,
        scaleY: 0.5,
      },
      {
        id: 'big-dagger',
        role: 'weapon',
        x: 600,
        y: 200,
        displayWidth: 108,
        displayHeight: 108,
        scaleX: 1.5,
        scaleY: 1.5,
      },
    ]

    const state = createInitialWorldState(objects)

    const player = state.worldObjects.find((o) => o.id === 'player')!
    const guard = state.worldObjects.find((o) => o.id === 'small-guard')!
    const dagger = state.worldObjects.find((o) => o.id === 'big-dagger')!

    const playerState = player.state as Record<string, unknown>
    const guardState = guard.state as Record<string, unknown>
    const daggerState = dagger.state as Record<string, unknown>

    expect(playerState.width).toBe(110)
    expect(playerState.height).toBe(160)

    // Scaled down by 0.5
    expect(guardState.width).toBe(55)
    expect(guardState.height).toBe(80)

    // Scaled up by 1.5 (72 * 1.5 = 108)
    expect(daggerState.width).toBe(108)
    expect(daggerState.height).toBe(108)
  })

  it('alters collision gap calculation when character scale changes', () => {
    const collisionWorld = new AabbCollisionWorld()

    // Two characters with centers separated by 120 px on x axis
    const playerBox = { x: 100, y: 100, width: 110, height: 160 }

    // When other character is unscaled (width 110):
    // Half-widths sum to (110 + 110) / 2 = 110
    // Center distance = 120 px
    // Gap = 120 - 110 = 10 px
    const unscaledOtherBox = { x: 220, y: 100, width: 110, height: 160 }
    expect(collisionWorld.gap(playerBox, unscaledOtherBox)).toBe(10)

    // When other character is scaled to 0.5 (width 55):
    // Half-widths sum to (110 + 55) / 2 = 82.5
    // Center distance = 120 px
    // Gap = 120 - 82.5 = 37.5 px
    const scaledOtherBox = { x: 220, y: 100, width: 55, height: 80 }
    expect(collisionWorld.gap(playerBox, scaledOtherBox)).toBe(37.5)
  })
})
