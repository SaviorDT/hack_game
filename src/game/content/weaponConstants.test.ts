import { beforeEach, describe, expect, it } from 'vitest'
import {
  DAGGER_SIZE,
  DEFAULT_DAGGER_ATTACK_DISTANCE,
  DEFAULT_DAGGER_ATTACK_DURATION_MS,
  GAME_WEAPON_CONFIG,
  WEAPON_HOLD_OFFSET,
  computeDaggerAttackTranslation,
  resetGameWeaponConfig,
  startDaggerAttackAnimation,
} from './weaponConstants.ts'
import {
  DAGGER_ATTACK_DISTANCE,
  DAGGER_ATTACK_DURATION_MS,
  computeDaggerAttackTranslation as roomComputeTranslation,
} from './roomConstants.ts'
import type { MutableWorldObjectState } from '../domain/WorldObjectState.ts'

describe('weaponConstants', () => {
  beforeEach(() => {
    resetGameWeaponConfig()
  })

  describe('constants and config', () => {
    it('defines base dagger size and hold offset', () => {
      expect(DAGGER_SIZE).toEqual({ width: 72, height: 72 })
      expect(WEAPON_HOLD_OFFSET).toEqual({ x: 20, y: 26 })
    })

    it('defines default attack parameters', () => {
      expect(DEFAULT_DAGGER_ATTACK_DISTANCE).toBe(30)
      expect(DEFAULT_DAGGER_ATTACK_DURATION_MS).toBe(200)
    })

    it('provides mutable GAME_WEAPON_CONFIG that can be reset', () => {
      expect(GAME_WEAPON_CONFIG.attackDistance).toBe(30)
      expect(GAME_WEAPON_CONFIG.attackDurationMs).toBe(200)
      expect(GAME_WEAPON_CONFIG.holdOffsetX).toBe(20)
      expect(GAME_WEAPON_CONFIG.holdOffsetY).toBe(26)

      GAME_WEAPON_CONFIG.attackDistance = 50
      GAME_WEAPON_CONFIG.attackDurationMs = 300
      GAME_WEAPON_CONFIG.holdOffsetX = 20
      GAME_WEAPON_CONFIG.holdOffsetY = 10

      expect(GAME_WEAPON_CONFIG.attackDistance).toBe(50)
      resetGameWeaponConfig()
      expect(GAME_WEAPON_CONFIG.attackDistance).toBe(30)
      expect(GAME_WEAPON_CONFIG.attackDurationMs).toBe(200)
      expect(GAME_WEAPON_CONFIG.holdOffsetX).toBe(20)
      expect(GAME_WEAPON_CONFIG.holdOffsetY).toBe(26)
    })

    it('re-exports weapon constants and functions through roomConstants for backwards compatibility', () => {
      expect(DAGGER_ATTACK_DISTANCE).toBe(DEFAULT_DAGGER_ATTACK_DISTANCE)
      expect(DAGGER_ATTACK_DURATION_MS).toBe(DEFAULT_DAGGER_ATTACK_DURATION_MS)
      expect(roomComputeTranslation(100, 200, 30)).toBe(computeDaggerAttackTranslation(100, 200, 30))
    })
  })

  describe('computeDaggerAttackTranslation', () => {
    it('returns 0 when elapsedMs is 0 or negative', () => {
      expect(computeDaggerAttackTranslation(0, 200, 30)).toBe(0)
      expect(computeDaggerAttackTranslation(-10, 200, 30)).toBe(0)
    })

    it('reaches maximum extension at duration midpoint', () => {
      const peak = computeDaggerAttackTranslation(100, 200, 30)
      expect(peak).toBeCloseTo(30, 2)
    })

    it('returns 0 when elapsedMs reaches or exceeds durationMs', () => {
      expect(computeDaggerAttackTranslation(200, 200, 30)).toBe(0)
      expect(computeDaggerAttackTranslation(250, 200, 30)).toBe(0)
    })

    it('smoothly translates out and back during the attack duration', () => {
      const quarter = computeDaggerAttackTranslation(50, 200, 30)
      const threeQuarter = computeDaggerAttackTranslation(150, 200, 30)

      expect(quarter).toBeGreaterThan(0)
      expect(quarter).toBeLessThan(30)
      expect(quarter).toBeCloseTo(threeQuarter, 2)
    })

    it('uses custom distance and duration parameters', () => {
      const peak = computeDaggerAttackTranslation(150, 300, 60)
      expect(peak).toBeCloseTo(60, 2)
    })

    it('returns 0 when durationMs is <= 0', () => {
      expect(computeDaggerAttackTranslation(100, 0)).toBe(0)
      expect(computeDaggerAttackTranslation(100, -50)).toBe(0)
    })
  })

  describe('startDaggerAttackAnimation', () => {
    it('initializes attack state on dagger state object', () => {
      const daggerState: MutableWorldObjectState = {
        equippedBy: 'player',
        attackDurationMs: 0,
        attackElapsedMs: 100,
        attackOffsetX: 15,
        weaponAttackDistance: 20,
      }

      const started = startDaggerAttackAnimation(daggerState, 250)
      expect(started).toBe(true)
      expect(daggerState.attackElapsedMs).toBe(0)
      expect(daggerState.attackDurationMs).toBe(250)
      expect(daggerState.attackOffsetX).toBe(0)
    })

    it('defaults to GAME_WEAPON_CONFIG values when parameters are omitted', () => {
      GAME_WEAPON_CONFIG.attackDurationMs = 280

      const daggerState: MutableWorldObjectState = {
        equippedBy: 'player',
        attackDurationMs: 0,
        attackElapsedMs: 0,
        attackOffsetX: 0,
      }

      const started = startDaggerAttackAnimation(daggerState)
      expect(started).toBe(true)
      expect(daggerState.attackDurationMs).toBe(280)
      expect(daggerState.attackElapsedMs).toBe(0)
    })

    it('rejects starting new animation if an ongoing attack is still in progress', () => {
      const daggerState: MutableWorldObjectState = {
        equippedBy: 'player',
        attackDurationMs: 200,
        attackElapsedMs: 50,
        attackOffsetX: 10,
      }

      const started = startDaggerAttackAnimation(daggerState, 200)
      expect(started).toBe(false)
      expect(daggerState.attackElapsedMs).toBe(50)
    })
  })
})
