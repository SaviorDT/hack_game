import { describe, expect, it, vi } from 'vitest'
import { MacroIndicatorView } from './MacroIndicatorView.ts'
import { POPUP_DISPLAY_DURATION_MS, POPUP_FADE_DURATION_MS } from './uiTheme.ts'

describe('MacroIndicatorView', () => {
  function setupMockScene() {
    const textObj = {
      setText: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      width: 150,
    }

    function createMockRect() {
      return {
        setSize: vi.fn().mockReturnThis(),
        setStrokeStyle: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
      }
    }

    const pillBg = createMockRect()
    const progressTrack = createMockRect()
    const progressFill = createMockRect()
    const rects = [pillBg, progressTrack, progressFill]
    let rectIndex = 0

    const container = {
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      add: vi.fn(),
      destroy: vi.fn(),
    }

    const delayedCalls: (() => void)[] = []
    const mockScene = {
      add: {
        container: vi.fn(() => container),
        rectangle: vi.fn(() => {
          const r = rects[rectIndex] ?? createMockRect()
          rectIndex++
          return r
        }),
        text: vi.fn(() => textObj),
      },
      time: {
        delayedCall: vi.fn((_ms: number, cb: () => void) => {
          delayedCalls.push(cb)
          return { remove: vi.fn() }
        }),
      },
      tweens: {
        add: vi.fn((config: { onComplete?: () => void }) => {
          config.onComplete?.()
          return { stop: vi.fn() }
        }),
      },
    } as any

    return { mockScene, container, pillBg, progressTrack, progressFill, textObj, delayedCalls }
  }

  it('mounts and displays success message', () => {
    const { mockScene, container, pillBg, textObj, delayedCalls } = setupMockScene()
    const view = new MacroIndicatorView()
    view.mount(mockScene)

    view.setPlayerPosition(100, 200)
    expect(container.setPosition).toHaveBeenCalledWith(100, 290)

    view.showRecordSuccess(8, 'acc dagger $mouse')
    expect(textObj.setText).toHaveBeenCalledWith('[SLOT 8 RECORDED: acc dagger $mouse]')
    expect(pillBg.setSize).toHaveBeenCalled()
    expect(container.setVisible).toHaveBeenCalledWith(true)

    // Trigger timer
    expect(delayedCalls.length).toBe(1)
    expect(mockScene.time.delayedCall).toHaveBeenCalledWith(
      POPUP_DISPLAY_DURATION_MS,
      expect.any(Function),
    )
    delayedCalls[0]()
    expect(mockScene.tweens.add).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: POPUP_FADE_DURATION_MS,
      }),
    )
    expect(POPUP_DISPLAY_DURATION_MS).toBeGreaterThan(0)
    expect(POPUP_FADE_DURATION_MS).toBeGreaterThan(0)
    expect(container.setVisible).toHaveBeenCalledWith(false)

    view.destroy()
    expect(container.destroy).toHaveBeenCalled()
  })

  it('displays warning when empty history', () => {
    const { mockScene, textObj } = setupMockScene()
    const view = new MacroIndicatorView()
    view.mount(mockScene)

    view.showRecordEmpty()
    expect(textObj.setText).toHaveBeenCalledWith('[NO COMMAND TO RECORD]')

    view.showExecutedCommand(8, 'acc dagger hacker')
    expect(textObj.setText).toHaveBeenCalledWith('[8: acc dagger hacker]')

    view.showSlotEmpty(9)
    expect(textObj.setText).toHaveBeenCalledWith('[SLOT 9 EMPTY (HOLD TO RECORD)]')

    view.destroy()
  })

  it('starts, updates, and cancels hold progress', () => {
    const { mockScene, container, progressTrack, progressFill, textObj, delayedCalls } = setupMockScene()
    const view = new MacroIndicatorView()
    view.mount(mockScene)

    view.startHoldProgress(8, 250)
    expect(textObj.setText).toHaveBeenCalledWith('[RECORDING SLOT 8]')
    expect(textObj.setPosition).toHaveBeenCalledWith(-46, -6)
    expect(progressTrack.setVisible).toHaveBeenCalledWith(true)
    expect(progressFill.setVisible).toHaveBeenCalledWith(true)
    expect(container.setVisible).toHaveBeenCalledWith(false)

    // Trigger show delay callback (> durationMs / 4)
    expect(delayedCalls.length).toBe(1)
    delayedCalls[0]()
    expect(container.setVisible).toHaveBeenCalledWith(true)
    expect(progressFill.setScale).toHaveBeenCalledWith(0, 1)

    expect(mockScene.tweens.add).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: progressFill,
        scaleX: 1,
        duration: 187.5,
      }),
    )

    view.setHoldProgress(0.5)
    expect(progressFill.setScale).toHaveBeenCalledWith(0.5, 1)

    view.cancelHoldProgress()
    expect(progressTrack.setVisible).toHaveBeenCalledWith(false)
    expect(progressFill.setVisible).toHaveBeenCalledWith(false)
    expect(container.setVisible).toHaveBeenCalledWith(false)

    // Second cancel when not holding does nothing
    container.setVisible.mockClear()
    view.cancelHoldProgress()
    expect(container.setVisible).not.toHaveBeenCalled()

    view.destroy()
  })

  it('only shows progress bar UI when hold time exceeds show delay threshold and starts fill from 0', () => {
    const { mockScene, container, progressFill, delayedCalls } = setupMockScene()
    const view = new MacroIndicatorView()
    view.mount(mockScene)

    view.startHoldProgress(8, 250)
    expect(container.setVisible).toHaveBeenCalledWith(false)
    expect(delayedCalls.length).toBe(1)

    // Not visible yet and tween not started
    expect(container.setVisible).not.toHaveBeenCalledWith(true)
    expect(mockScene.tweens.add).not.toHaveBeenCalled()

    // Delay callback triggers (durationMs / 4)
    delayedCalls[0]()
    expect(container.setVisible).toHaveBeenCalledWith(true)
    expect(progressFill.setScale).toHaveBeenCalledWith(0, 1)
    expect(mockScene.tweens.add).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: progressFill,
        scaleX: 1,
        duration: 187.5,
      }),
    )

    view.destroy()
  })

  it('suppresses progress bar UI if cancelled before show delay threshold', () => {
    const { mockScene, container } = setupMockScene()
    const view = new MacroIndicatorView()
    view.mount(mockScene)

    view.startHoldProgress(8, 250)
    expect(container.setVisible).toHaveBeenCalledWith(false)

    // Cancel before delay callback triggers (e.g. quick tap)
    view.cancelHoldProgress()
    expect(container.setVisible).toHaveBeenCalledWith(false)
    expect(container.setVisible).not.toHaveBeenCalledWith(true)

    view.destroy()
  })

  it('transitions cleanly from hold progress to record success', () => {
    const { mockScene, container, progressTrack, progressFill, textObj, delayedCalls } = setupMockScene()
    const view = new MacroIndicatorView()
    view.mount(mockScene)

    view.startHoldProgress(0, 250)
    expect(delayedCalls.length).toBe(1)
    delayedCalls[0]()
    expect(container.setVisible).toHaveBeenCalledWith(true)

    // Complete hold into success
    view.showRecordSuccess(0, 'acc dagger $mouse')
    expect(progressTrack.setVisible).toHaveBeenCalledWith(false)
    expect(progressFill.setVisible).toHaveBeenCalledWith(false)
    expect(textObj.setText).toHaveBeenCalledWith('[SLOT 0 RECORDED: acc dagger $mouse]')
    expect(textObj.setPosition).toHaveBeenCalledWith(-46, 0)

    view.destroy()
  })
})
