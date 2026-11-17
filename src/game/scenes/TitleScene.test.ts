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
      graphics: vi.fn(() => ({
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((_x: number, _y: number, _text: string | string[], _style?: Record<string, unknown>) => {
        const textObj = {
          setOrigin: vi.fn().mockReturnThis(),
          setText: vi.fn().mockReturnThis(),
          setColor: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
        }
        return textObj
      }),
    }
    time = {
      addEvent: vi.fn(() => ({
        destroy: vi.fn(),
      })),
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

import { TitleScene, TITLE_MENU_ITEMS } from './TitleScene.ts'

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
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const enterEvent = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(enterEvent)

    expect(enterEvent.preventDefault).toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('[TitleScene] selected: START')
    expect(scene.scene.start).toHaveBeenCalledWith('game')

    // Arrow down to SETTING
    ;(scene.scene.start as unknown as ReturnType<typeof vi.fn>).mockClear()
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown(enterEvent)
    expect(scene.getSelectedChoice()).toBe('SETTING')
    expect(consoleSpy).toHaveBeenCalledWith('[TitleScene] selected: SETTING')
    expect(scene.scene.start).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('ignores other keys like Space', () => {
    const { scene, handleKeyDown } = setupScene()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const spaceEvent = { key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(spaceEvent)

    expect(scene.getSelectedChoice()).toBe('START')
    expect(spaceEvent.preventDefault).not.toHaveBeenCalled()
    expect(consoleSpy).not.toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})
