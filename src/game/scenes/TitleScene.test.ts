import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockScene {
    scene: { key: string; start: ReturnType<typeof vi.fn> }
    cameras = {
      main: {
        setBackgroundColor: vi.fn(),
      },
    }
    add = {
      container: vi.fn((_x: number, _y: number) => {
        const items: unknown[] = []
        return {
          y: _y,
          add: vi.fn((item: unknown) => {
            if (Array.isArray(item)) {
              items.push(...item)
            } else {
              items.push(item)
            }
          }),
          setVisible: vi.fn().mockReturnThis(),
          setY: vi.fn().mockReturnThis(),
        }
      }),
      graphics: vi.fn(() => ({
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((_x: number, _y: number, _text: string | string[], _style?: Record<string, unknown>) => {
        const textObj = {
          width: 304,
          setOrigin: vi.fn().mockReturnThis(),
          setText: vi.fn().mockReturnThis(),
          setColor: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setInteractive: vi.fn().mockReturnThis(),
          on: vi.fn().mockReturnThis(),
        }
        return textObj
      }),
    }
    time = {
      addEvent: vi.fn((config?: { callback?: () => void; repeat?: number }) => {
        if (config?.callback) {
          const repeat = config.repeat ?? 0
          for (let i = 0; i <= repeat; i++) {
            config.callback()
          }
        }
        return { destroy: vi.fn() }
      }),
      delayedCall: vi.fn((_delay: number, callback?: () => void) => {
        callback?.()
        return { destroy: vi.fn() }
      }),
    }
    tweens = {
      add: vi.fn((config: Record<string, unknown>) => {
        if (typeof config.onComplete === 'function') {
          config.onComplete()
        }
      }),
    }
    input = {
      keyboard: {
        on: vi.fn(),
        off: vi.fn(),
      },
    }
    events = {
      once: vi.fn(),
    }

    constructor(config?: { key: string }) {
      this.scene = {
        key: config?.key ?? 'mock-scene',
        start: vi.fn(),
      }
    }
  }

  return {
    default: {
      Scene: MockScene,
      Scenes: {
        Events: {
          SHUTDOWN: 'shutdown',
        },
      },
    },
  }
})

import {
  TitleScene,
  TITLE_MENU_ITEMS,
  TYPING_SPEED_MS,
  SCROLL_SPEED_MS,
  PAUSE_DURATION_MS,
  EXECUTION_PAUSE_MS,
} from './TitleScene.ts'

describe('TitleScene', () => {
  function setupScene() {
    const scene = new TitleScene()
    scene.create()
    const handleKeyDown = (scene as unknown as { handleKeyDown: (event: KeyboardEvent) => void }).handleKeyDown
    return { scene, handleKeyDown }
  }

  it('initializes with START as the selected item', () => {
    const { scene } = setupScene()
    expect(scene.getSelectedIndex()).toBe(0)
    expect(scene.getSelectedChoice()).toBe('START')
    expect(TITLE_MENU_ITEMS).toEqual(['START', 'SETTING', 'HELP'])
  })

  it('cycles downwards using ArrowDown and wraps around', () => {
    const { scene, handleKeyDown } = setupScene()

    const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent

    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('SETTING')
    expect(event.preventDefault).toHaveBeenCalled()

    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('HELP')

    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('START')
  })

  it('cycles downwards using S key', () => {
    const { scene, handleKeyDown } = setupScene()

    const event = { key: 's', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('SETTING')
  })

  it('cycles upwards using ArrowUp and wraps around', () => {
    const { scene, handleKeyDown } = setupScene()

    const event = { key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent

    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('HELP')
    expect(event.preventDefault).toHaveBeenCalled()

    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('SETTING')

    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('START')
  })

  it('cycles upwards using W key', () => {
    const { scene, handleKeyDown } = setupScene()

    const event = { key: 'w', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(event)
    expect(scene.getSelectedChoice()).toBe('HELP')
  })

  it('confirms the selection on Enter key and starts GameScene when START is selected', () => {
    const { scene, handleKeyDown } = setupScene()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

    const enterEvent = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(enterEvent)

    expect(enterEvent.preventDefault).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('[TitleScene] selected: START')
    expect(scene.scene.start).toHaveBeenCalledWith('game')

      // Arrow down to SETTING
      ; (scene.scene.start as unknown as ReturnType<typeof vi.fn>).mockClear()
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown(enterEvent)
    expect(scene.getSelectedChoice()).toBe('SETTING')
    expect(consoleSpy).toHaveBeenCalledWith('[TitleScene] selected: SETTING')
    expect(scene.scene.start).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('ignores other keys like Space', () => {
    const { scene, handleKeyDown } = setupScene()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

    const spaceEvent = { key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(spaceEvent)

    expect(scene.getSelectedChoice()).toBe('START')
    expect(spaceEvent.preventDefault).not.toHaveBeenCalled()
    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('swaps to full scene help screen when HELP is confirmed, ignores Escape, and returns on Enter', () => {
    const { scene, handleKeyDown } = setupScene()
    expect(scene.isInHelp()).toBe(false)

    // Navigate to HELP
    handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('HELP')

    // Confirm HELP
    const enterEvent = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(enterEvent)
    expect(scene.isInHelp()).toBe(true)

    // While in help, W and S should not move selection
    handleKeyDown({ key: 'w', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('HELP')

    // Escape should NOT return to main menu
    const escEvent = { key: 'Escape', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(escEvent)
    expect(scene.isInHelp()).toBe(true)

    // Press Enter to return to main menu
    handleKeyDown(enterEvent)
    expect(scene.isInHelp()).toBe(false)
  })

  it('suppresses key navigation during menu transition', () => {
    const { scene, handleKeyDown } = setupScene()
    ;(scene as unknown as { isTransitioning: boolean }).isTransitioning = true
    expect(scene.isMenuTransitioning()).toBe(true)

    const arrowDownEvent = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(arrowDownEvent)
    expect(arrowDownEvent.preventDefault).toHaveBeenCalled()
    expect(scene.getSelectedChoice()).toBe('START')

    const enterEvent = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(enterEvent)
    expect(enterEvent.preventDefault).toHaveBeenCalled()
    expect(scene.isInHelp()).toBe(false)
  })

  it('exports shell animation timing constants', () => {
    expect(TYPING_SPEED_MS).toBe(22)
    expect(SCROLL_SPEED_MS).toBe(30)
    expect(PAUSE_DURATION_MS).toBe(200)
    expect(EXECUTION_PAUSE_MS).toBe(200)
  })
})
