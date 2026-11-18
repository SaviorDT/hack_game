import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockScene {
    scene: {
      key: string
      start: ReturnType<typeof vi.fn>
      stop: ReturnType<typeof vi.fn>
      get: ReturnType<typeof vi.fn>
      resume: ReturnType<typeof vi.fn>
    }
    cameras = { main: { setBackgroundColor: vi.fn() } }
    add = {
      container: vi.fn(() => {
        const container = {
          setVisible: vi.fn().mockReturnThis(),
          setY: vi.fn().mockReturnThis(),
          add: vi.fn().mockReturnThis(),
        }
        return container
      }),
      graphics: vi.fn(() => ({
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        strokeRect: vi.fn().mockReturnThis(),
        lineBetween: vi.fn().mockReturnThis(),
      })),
      text: vi.fn((_x: number, _y: number, _text: string | string[], _style?: Record<string, unknown>) => ({
        width: 304,
        setOrigin: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        setColor: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
      })),
    }
    time = {
      delayedCall: vi.fn((_delay: number, callback?: () => void) => {
        callback?.()
        return { destroy: vi.fn() }
      }),
    }
    tweens = { add: vi.fn((config: Record<string, unknown>) => {
      if (typeof config.onComplete === 'function') config.onComplete()
    }) }
    input = { keyboard: { on: vi.fn(), off: vi.fn() } }
    events = { once: vi.fn() }

    constructor(config?: { key: string }) {
      this.scene = {
        key: config?.key ?? 'mock-scene',
        start: vi.fn(),
        stop: vi.fn(),
        get: vi.fn(),
        resume: vi.fn(),
      }
    }
  }

  return {
    default: {
      Scene: MockScene,
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    },
  }
})

import { PauseScene, PAUSE_MENU_ITEMS } from './PauseScene.ts'
import { getHelpLines } from './pauseSceneHelpers.ts'

function setupScene() {
  const scene = new PauseScene()
  scene.create()
  const handleKeyDown = (scene as unknown as {
    handleKeyDown: (event: KeyboardEvent) => void
  }).handleKeyDown
  return { scene, handleKeyDown }
}

describe('PauseScene', () => {
  it('starts with RESUME selected', () => {
    const { scene } = setupScene()
    expect(PAUSE_MENU_ITEMS).toEqual(['RESUME', 'SETTING', 'HELP'])
    expect(scene.getSelectedIndex()).toBe(0)
    expect(scene.getSelectedChoice()).toBe('RESUME')
  })

  it('cycles menu selection and wraps', () => {
    const { scene, handleKeyDown } = setupScene()
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('SETTING')
    handleKeyDown({ key: 's', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('HELP')
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('RESUME')
  })

  it('opens setting and help subscreens', () => {
    const { scene, handleKeyDown } = setupScene()
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.isInSettings()).toBe(true)
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.isInSettings()).toBe(true)

    scene.exitSettings(false)
    scene.showHelp(false)
    expect(scene.isInHelp()).toBe(true)
  })

  it('Ctrl+P dismisses the pause scene', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')
    handleKeyDown({ key: 'p', ctrlKey: true, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).toHaveBeenCalled()
  })

  it('displays CTRL+P in help screen', () => {
    const lines = getHelpLines('hold-shift')
    expect(lines.some((line) => line.includes('CTRL+P') && line.includes('Pause or resume game'))).toBe(true)
  })

  it('suppresses navigation during transitions', () => {
    const { scene, handleKeyDown } = setupScene()
    ;(scene as unknown as { isTransitioning: boolean }).isTransitioning = true
    const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(scene.getSelectedChoice()).toBe('RESUME')
  })
})
