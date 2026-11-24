import { describe, expect, it } from 'vitest'
import {
  DEFAULT_GLITCH_SHAKE_BLOCK_SIZE,
  DEFAULT_GLITCH_SHAKE_COLOR_RATE,
  DEFAULT_GLITCH_SHAKE_POWER,
  DEFAULT_GLITCH_SHAKE_RATE,
  DEFAULT_GLITCH_SHAKE_SPEED,
  GLITCH_FADE_IN_MS,
  GLITCH_FADE_OUT_MS,
} from './glitchShaderConstants.ts'

describe('glitchShaderConstants', () => {
  it('exports positive numeric constants for human tuning without pinning exact values', () => {
    expect(typeof DEFAULT_GLITCH_SHAKE_POWER).toBe('number')

    expect(typeof DEFAULT_GLITCH_SHAKE_RATE).toBe('number')
    expect(DEFAULT_GLITCH_SHAKE_RATE).toBeGreaterThan(0)
    expect(DEFAULT_GLITCH_SHAKE_RATE).toBeLessThanOrEqual(1.0)

    expect(typeof DEFAULT_GLITCH_SHAKE_SPEED).toBe('number')
    expect(DEFAULT_GLITCH_SHAKE_SPEED).toBeGreaterThan(0)

    expect(typeof DEFAULT_GLITCH_SHAKE_BLOCK_SIZE).toBe('number')
    expect(DEFAULT_GLITCH_SHAKE_BLOCK_SIZE).toBeGreaterThan(0)

    expect(typeof DEFAULT_GLITCH_SHAKE_COLOR_RATE).toBe('number')

    expect(typeof GLITCH_FADE_IN_MS).toBe('number')
    expect(GLITCH_FADE_IN_MS).toBeGreaterThan(0)

    expect(typeof GLITCH_FADE_OUT_MS).toBe('number')
    expect(GLITCH_FADE_OUT_MS).toBeGreaterThan(0)
  })
})
