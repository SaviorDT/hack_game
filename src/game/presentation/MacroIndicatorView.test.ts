import { describe, expect, it, vi } from 'vitest'
import { MacroIndicatorView } from './MacroIndicatorView.ts'

describe('MacroIndicatorView', () => {
  function setupMockScene() {
    const textObj = {
      setText: vi.fn().mockReturnThis(),
      setColor: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      width: 150,
    }
    const pillBg = {
      setSize: vi.fn().mockReturnThis(),
      setStrokeStyle: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
    }
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
        rectangle: vi.fn(() => pillBg),
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

    return { mockScene, container, pillBg, textObj, delayedCalls }
  }

  it('mounts and displays success message', () => {
    const { mockScene, container, pillBg, textObj, delayedCalls } = setupMockScene()
    const view = new MacroIndicatorView()
    view.mount(mockScene)

    view.setPlayerPosition(100, 200)
    expect(container.setPosition).toHaveBeenCalledWith(100, 290)

    view.showRecordSuccess(8, 'mv dagger $mouse')
    expect(textObj.setText).toHaveBeenCalledWith('[SLOT 8 RECORDED: mv dagger $mouse]')
    expect(pillBg.setSize).toHaveBeenCalled()
    expect(container.setVisible).toHaveBeenCalledWith(true)

    // Trigger timer
    expect(delayedCalls.length).toBe(1)
    delayedCalls[0]()
    expect(mockScene.tweens.add).toHaveBeenCalled()
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

    view.showExecutedCommand(8, 'mv dagger hacker')
    expect(textObj.setText).toHaveBeenCalledWith('[8: mv dagger hacker]')

    view.showSlotEmpty(9)
    expect(textObj.setText).toHaveBeenCalledWith('[SLOT 9 EMPTY (HOLD TO RECORD)]')

    view.destroy()
  })
})
