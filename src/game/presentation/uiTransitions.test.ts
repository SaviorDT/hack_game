import { describe, expect, it, vi } from 'vitest'
import { fadeOut, SCROLL_SPEED_MS, scrollTransition } from './uiTransitions.ts'
import { POPUP_FADE_DURATION_MS } from './uiTheme.ts'

describe('UI transitions', () => {
  it('scrolls between containers using the shared main UI transition', () => {
    const from = { setY: vi.fn().mockReturnThis() }
    const to = { setY: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() }
    const onComplete = vi.fn()
    const add = vi.fn()
    const scene = { tweens: { add } } as any

    scrollTransition(scene, from as any, to as any, onComplete)

    expect(to.setY).toHaveBeenCalledWith(850)
    expect(to.setVisible).toHaveBeenCalledWith(true)
    expect(add).toHaveBeenCalledWith(expect.objectContaining({
      targets: [from, to],
      y: '-=850',
      duration: SCROLL_SPEED_MS,
      ease: 'Linear',
      onComplete,
    }))
  })

  it('completes scroll transitions without a tween manager', () => {
    const from = { setY: vi.fn().mockReturnThis() }
    const to = { setY: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis() }
    const onComplete = vi.fn()

    scrollTransition({} as any, from as any, to as any, onComplete)

    expect(to.setY).toHaveBeenLastCalledWith(0)
    expect(from.setY).toHaveBeenCalledWith(-850)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('fades targets using the shared popup fade duration by default', () => {
    const target = {} as any
    const onComplete = vi.fn()
    const tween = { stop: vi.fn() }
    const add = vi.fn().mockReturnValue(tween)
    const scene = { tweens: { add } } as any

    expect(fadeOut(scene, target, onComplete)).toBe(tween)
    expect(add).toHaveBeenCalledWith(expect.objectContaining({
      targets: target,
      alpha: 0,
      duration: POPUP_FADE_DURATION_MS,
      ease: 'Linear',
      onComplete,
    }))
  })

  it('completes fades without a tween manager', () => {
    const onComplete = vi.fn()

    expect(fadeOut({} as any, {} as any, onComplete)).toBeUndefined()
    expect(onComplete).toHaveBeenCalledOnce()
  })
})
