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
    children = { list: [] as unknown[] }
    add = {
      container: vi.fn((x = 0, y = 0) => {
        const containerChildren: unknown[] = []
        const container = {
          x,
          y,
          list: containerChildren,
          setScale: vi.fn().mockReturnThis(),
          setPosition: vi.fn((nextX: number, nextY: number) => {
            container.x = nextX
            container.y = nextY
            return container
          }),
          setVisible: vi.fn().mockReturnThis(),
          setY: vi.fn((nextY: number) => {
            container.y = nextY
            return container
          }),
          add: vi.fn((child: unknown | unknown[]) => {
            const addedChildren = Array.isArray(child) ? child : [child]
            containerChildren.push(...addedChildren)
            for (const addedChild of addedChildren) {
              const childIndex = this.children.list.indexOf(addedChild)
              if (childIndex !== -1) this.children.list.splice(childIndex, 1)
            }
            return container
          }),
        }
        this.children.list.push(container)
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
import { EXPAND_MS, getHelpLines } from './pauseSceneHelpers.ts'

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

  it('expands from the live player position when created', () => {
    const scene = new PauseScene()
    const containerFactory = vi.spyOn(scene.add, 'container')
    ;(scene.scene.get as ReturnType<typeof vi.fn>).mockReturnValue({
      session: {
        getRenderPosition: vi.fn(() => ({ x: 400, y: 300 })),
      },
    })

    scene.create()

    expect(scene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({
      scaleX: 1,
      scaleY: 1,
      duration: EXPAND_MS,
      ease: 'Quad.easeOut',
    }))
    expect(scene.isMenuTransitioning()).toBe(false)
    const [mainMenu, helpScreen, settingsScreen, pivot] = containerFactory.mock.results
      .map(({ value }) => value as { x: number; y: number })
    expect([mainMenu, helpScreen, settingsScreen, pivot].map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ])

    scene.showSettings(false)
    expect(settingsScreen.y + pivot.y).toBe(0)
    scene.exitSettings(false)
    scene.showHelp(false)
    expect(helpScreen.y + pivot.y).toBe(0)
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

  it('does not dismiss the pause scene on Ctrl+P', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')
    handleKeyDown({ key: 'p', ctrlKey: true, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).not.toHaveBeenCalled()
  })

  it('types ./main and resumes after confirming RESUME', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')

    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)

    expect(resumeSpy).toHaveBeenCalled()
  })

  it('displays CTRL+P in help screen', () => {
    const lines = getHelpLines('hold-shift')
    expect(lines.some((line) => line.includes('CTRL+P') && line.includes('Open pause menu'))).toBe(true)
  })

  it('suppresses navigation during transitions', () => {
    const { scene, handleKeyDown } = setupScene()
    ;(scene as unknown as { isTransitioning: boolean }).isTransitioning = true
    const event = { key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(scene.getSelectedChoice()).toBe('RESUME')
  })

  it('types ./setting when entering settings and ./pause when returning to pause menu', () => {
    const { scene } = setupScene()
    const mainPrompt = (scene as any).mainPromptCommand
    const settingsPrompt = (scene as any).settingsPromptCommand

    scene.showSettings(true)
    expect(mainPrompt.setText).toHaveBeenCalledWith('./setting')

    scene.exitSettings(true)
    expect(settingsPrompt.setText).toHaveBeenCalledWith('./pause')
  })

  it('types ./pause when returning from help to pause menu', () => {
    const { scene } = setupScene()
    const helpPrompt = (scene as any).helpPromptCommand

    scene.showHelp(true)
    scene.exitHelp(true)
    expect(helpPrompt.setText).toHaveBeenCalledWith('./pause')
  })

  it('displays ./setting in settings screen top prompt', () => {
    const scene = new PauseScene()
    const textSpy = vi.spyOn(scene.add, 'text')
    scene.create()

    const topSettingPrompt = textSpy.mock.calls.find(
      call => call[1] === 70 && call[2] === './setting',
    )
    expect(topSettingPrompt).toBeDefined()
  })
})
