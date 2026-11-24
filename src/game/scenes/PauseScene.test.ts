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
      graphics: vi.fn(() => {
        const graphics = {
          fillStyle: vi.fn().mockReturnThis(),
          fillRect: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          strokeRect: vi.fn().mockReturnThis(),
          lineBetween: vi.fn().mockReturnThis(),
        }
        this.children.list.push(graphics)
        return graphics
      }),
      text: vi.fn((_x: number, _y: number, _text: string | string[], _style?: Record<string, unknown>) => ({
        text: _text,
        style: _style,
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
    tweens = {
      add: vi.fn((config: Record<string, unknown>) => {
        if (typeof config.onComplete === 'function') config.onComplete()
      })
    }
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
import { getTutorialFeatureUnlocks } from '../content/tutorialRooms.ts'

function setupScene(currentRoomId = 'tutorial3', hasSavedGame = true) {
  const scene = new PauseScene()
  const scenePlugin = scene.scene as unknown as { get: ReturnType<typeof vi.fn> }
  scenePlugin.get.mockImplementation((key: string) => key === 'game'
    ? {
      session: {
        getWorldState: () => ({ currentRoomId }),
        getCommandSlots: () => ({}),
        hasSavedState: () => hasSavedGame,
      },
    }
    : undefined)
  scene.create()
  const handleKeyDown = (scene as unknown as {
    handleKeyDown: (event: KeyboardEvent) => void
  }).handleKeyDown
  return { scene, handleKeyDown }
}

describe('PauseScene', () => {
  it('hides recorded-command UI and Help entries until Tutorial3 is entered', () => {
    const { scene: tutorial1 } = setupScene('tutorial1')
    const tutorial1Help = getHelpLines('hold-shift', (tutorial1 as any).tutorialUnlocks)
    expect(tutorial1Help).not.toContain('-- COMMAND LINE --')

    const { scene: tutorial2 } = setupScene('tutorial2')
    const tutorial2Texts = (tutorial2.add.text as ReturnType<typeof vi.fn>).mock.calls
      .map((call: unknown[]) => call[2])
    expect(tutorial2Texts).not.toContain('── RECORDED COMMANDS ──')

    const tutorial2Help = getHelpLines('hold-shift', (tutorial2 as any).tutorialUnlocks)
    expect(tutorial2Help).toContain('-- COMMAND LINE --')
    expect(tutorial2Help.some((line) => line.includes('Execute recorded command'))).toBe(false)

    const { scene: tutorial3 } = setupScene('tutorial3')
    const tutorial3Texts = (tutorial3.add.text as ReturnType<typeof vi.fn>).mock.calls
      .map((call: unknown[]) => call[2])
    expect(tutorial3Texts).toContain('── RECORDED COMMANDS ──')

    const tutorial3Help = getHelpLines('hold-shift', (tutorial3 as any).tutorialUnlocks)
    expect(tutorial3Help.some((line) => line.includes('Execute recorded command'))).toBe(true)
  })

  it('uses the shared save-based Movement & Combat Help visibility rule', () => {
    const savedRun = setupScene('tutorial1', true).scene
    const freshRun = setupScene('tutorial1', false).scene
    const descriptionsFor = (scene: PauseScene): string[] => {
      const textSpy = scene.add.text as ReturnType<typeof vi.fn>
      const descIndex = textSpy.mock.calls.findIndex((call: unknown[]) =>
        call[1] === 125 && (call[3] as { color?: string }).color === '#555555',
      )
      const descText = textSpy.mock.results[descIndex].value as {
        setText: ReturnType<typeof vi.fn>
      }
      return descText.setText.mock.calls[0][0] as string[]
    }

    expect(descriptionsFor(savedRun).some((line) => line.includes('WASD'))).toBe(true)
    expect(descriptionsFor(freshRun).some((line) => line.includes('WASD'))).toBe(false)
  })

  it('starts with RESUME selected', () => {
    const { scene } = setupScene()
    expect(PAUSE_MENU_ITEMS).toEqual(['RESUME', 'ROOM RESET', 'SETTING', 'HELP', 'TITLE'])
    expect(scene.getSelectedIndex()).toBe(0)
    expect(scene.getSelectedChoice()).toBe('RESUME')
  })

  it('draws the pause overlay behind UI and the outer border above it across subscreens', () => {
    const scene = new PauseScene()
    scene.create()

    const graphicsObjects = (scene.add.graphics as ReturnType<typeof vi.fn>).mock.results
      .map(({ value }) => value as {
        fillRect: ReturnType<typeof vi.fn>
        strokeRect: ReturnType<typeof vi.fn>
      })
    const overlay = graphicsObjects[0]
    const border = graphicsObjects[1]
    const [mainMenu, helpScreen, settingsScreen] =
      (scene.add.container as ReturnType<typeof vi.fn>).mock.results
        .slice(0, 3)
        .map(({ value }) => value)
    const pivot = scene.children.list[0] as unknown as { list: unknown[] }

    expect(overlay.fillRect).toHaveBeenCalledWith(0, 0, 1920, 1080)
    expect(border.strokeRect).toHaveBeenCalledWith(40, 40, 1840, 1000)
    expect(pivot.list.indexOf(overlay)).toBeLessThan(pivot.list.indexOf(mainMenu))
    expect(pivot.list.indexOf(mainMenu)).toBeLessThan(pivot.list.indexOf(helpScreen))
    expect(pivot.list.indexOf(helpScreen)).toBeLessThan(pivot.list.indexOf(settingsScreen))
    expect(pivot.list.indexOf(border)).toBeGreaterThan(pivot.list.indexOf(settingsScreen))

    scene.showSettings(false)
    expect(pivot.list).toContain(overlay)
    expect(pivot.list).toContain(border)
    scene.exitSettings(false)
    scene.showHelp(false)
    expect(pivot.list).toContain(overlay)
    expect(pivot.list).toContain(border)
  })

  it('expands from the live player position when created', () => {
    const scene = new PauseScene()
    const containerFactory = vi.spyOn(scene.add, 'container')
      ; (scene.scene.get as ReturnType<typeof vi.fn>).mockReturnValue({
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
    expect(scene.getSelectedChoice()).toBe('ROOM RESET')
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('SETTING')
    handleKeyDown({ key: 's', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('HELP')
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('TITLE')
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('RESUME')
  })

  describe('Confirmation and return to title', () => {
    const key = (name: string) => ({ key: name, preventDefault: vi.fn() }) as unknown as KeyboardEvent

    function selectTitle(handleKeyDown: (event: KeyboardEvent) => void) {
      for (let i = 0; i < 4; i += 1) handleKeyDown(key('ArrowDown'))
    }

    it('ignores Escape in the main menu and does not resume', () => {
      const { scene, handleKeyDown } = setupScene()
      const resumeSpy = vi.spyOn(scene, 'resumeGame')
      handleKeyDown(key('Escape'))
      expect(resumeSpy).not.toHaveBeenCalled()
    })

    it('returns from the help subscreen on Enter', () => {
      const { scene, handleKeyDown } = setupScene()
      scene.showHelp(false)
      expect(scene.isInHelp()).toBe(true)
      handleKeyDown(key('Enter'))
      expect(scene.isInHelp()).toBe(false)
    })

    it('asks for confirmation before leaving, defaulting to NO', () => {
      const { scene, handleKeyDown } = setupScene()
      const toTitle = vi.spyOn(scene, 'returnToTitle')
      selectTitle(handleKeyDown)
      handleKeyDown(key('Enter'))
      expect(scene.isInTitleConfirm()).toBe(true)
      expect(scene.getConfirmChoice()).toBe('NO')
      expect(scene.getConfirmQuestionText()).toBe('ABANDON RUN AND\nRETURN TO TITLE?')

      handleKeyDown(key('Enter'))
      expect(scene.isInTitleConfirm()).toBe(false)
      expect(toTitle).not.toHaveBeenCalled()
    })

    it('stops the game and starts the title scene when YES is confirmed', () => {
      const { scene, handleKeyDown } = setupScene()
      selectTitle(handleKeyDown)
      handleKeyDown(key('Enter'))
      handleKeyDown(key('ArrowLeft'))
      expect(scene.getConfirmChoice()).toBe('YES')
      handleKeyDown(key('Enter'))
      expect(scene.scene.stop).toHaveBeenCalledWith('game')
      expect(scene.scene.start).toHaveBeenCalledWith('title')
    })

    it('plays a scroll-out animation before switching to the title scene', () => {
      const { scene, handleKeyDown } = setupScene()
      selectTitle(handleKeyDown)
      handleKeyDown(key('Enter'))
      handleKeyDown(key('ArrowLeft'))
      handleKeyDown(key('Enter'))

      expect(scene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({
        y: '-=850',
        ease: 'Linear',
      }))
      expect(scene.scene.stop).toHaveBeenCalledWith('game')
      expect(scene.scene.start).toHaveBeenCalledWith('title')
    })

    it('resets selection and confirmation state when re-created after returning to title', () => {
      const { scene, handleKeyDown } = setupScene()
      selectTitle(handleKeyDown)
      handleKeyDown(key('Enter'))
      handleKeyDown(key('ArrowLeft'))
      handleKeyDown(key('Enter'))

      scene.create()

      expect(scene.getSelectedIndex()).toBe(0)
      expect(scene.getSelectedChoice()).toBe('RESUME')
      expect(scene.isInTitleConfirm()).toBe(false)

      handleKeyDown(key('ArrowDown'))
      expect(scene.getSelectedChoice()).toBe('ROOM RESET')
    })
  })

  it('opens setting and help subscreens', () => {
    const { scene, handleKeyDown } = setupScene()
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.isInSettings()).toBe(true)
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.isInSettings()).toBe(true)

    scene.exitSettings(false)
    scene.showHelp(false)
    expect(scene.isInHelp()).toBe(true)
  })

  it('resumes the game when pressing Space or P in the pause menu', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')
    const preventDefault1 = vi.fn()
    handleKeyDown({ key: ' ', preventDefault: preventDefault1 } as unknown as KeyboardEvent)
    expect(resumeSpy).toHaveBeenCalledTimes(1)
    expect(preventDefault1).toHaveBeenCalled()

    const { scene: scene2, handleKeyDown: handleKeyDown2 } = setupScene()
    const resumeSpy2 = vi.spyOn(scene2, 'resumeGame')
    const preventDefault2 = vi.fn()
    handleKeyDown2({ key: 'p', preventDefault: preventDefault2 } as unknown as KeyboardEvent)
    expect(resumeSpy2).toHaveBeenCalledTimes(1)
    expect(preventDefault2).toHaveBeenCalled()

    const { scene: scene3, handleKeyDown: handleKeyDown3 } = setupScene()
    const resumeSpy3 = vi.spyOn(scene3, 'resumeGame')
    const preventDefault3 = vi.fn()
    handleKeyDown3({ key: 'P', preventDefault: preventDefault3 } as unknown as KeyboardEvent)
    expect(resumeSpy3).toHaveBeenCalledTimes(1)
    expect(preventDefault3).toHaveBeenCalled()
  })

  it('resumes on Space or P even when a non-RESUME item is selected', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('ROOM RESET')
    handleKeyDown({ key: 'p', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).toHaveBeenCalledTimes(1)
  })

  it('ignores repeat key events for Space and P', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')
    handleKeyDown({ key: ' ', repeat: true, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).not.toHaveBeenCalled()
    handleKeyDown({ key: 'p', repeat: true, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).not.toHaveBeenCalled()
  })

  it('does not resume on Space or P while in subscreens or confirmation', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')
    scene.showHelp(false)
    handleKeyDown({ key: 'p', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).not.toHaveBeenCalled()

    scene.exitHelp(false)
    scene.showSettings(false)
    handleKeyDown({ key: 'p', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).not.toHaveBeenCalled()

    scene.exitSettings(false)
    scene.showTitleConfirm()
    handleKeyDown({ key: 'p', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(resumeSpy).not.toHaveBeenCalled()
  })

  it('displays navigation hint including SPACE/P RESUME in main menu', () => {
    const scene = new PauseScene()
    const textSpy = vi.spyOn(scene.add, 'text')
    scene.create()

    const navPrompt = textSpy.mock.calls.find(
      call => call[1] === 860 && typeof call[2] === 'string' && call[2].includes('<SPACE/P> RESUME'),
    )
    expect(navPrompt).toBeDefined()
    expect((navPrompt?.[3] as any)?.color).toBe('#505050')
  })

  it('types ./main and resumes after confirming RESUME', () => {
    const { scene, handleKeyDown } = setupScene()
    const resumeSpy = vi.spyOn(scene, 'resumeGame')

    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)

    expect(resumeSpy).toHaveBeenCalled()
  })

  it('displays SPACE / P in help screen', () => {
    const lines = getHelpLines('hold-shift', getTutorialFeatureUnlocks('tutorial3'))
    expect(lines.some((line) => line.includes('SPACE / P') && line.includes('Open pause menu'))).toBe(true)
  })

  it('separates typing tips from general shortcuts in help screen', () => {
    const lines = getHelpLines('hold-shift', getTutorialFeatureUnlocks('tutorial3'))
    expect(lines).toContain('-- TYPEING TIPS --')
    expect(lines.some((line) => line.includes('TAB'))).toBe(true)
    expect(lines.some((line) => line.includes('CTRL+BACKSPACE'))).toBe(true)
    expect(lines.some((line) => line.includes('UP / DOWN'))).toBe(true)
    expect(lines).toContain('-- SHORTCUTS --')
  })

  it('wraps every visible Help section subtitle in the standard delimiters', () => {
    const headings = getHelpLines('hold-shift', getTutorialFeatureUnlocks('tutorial3'))
      .filter((line) => line.startsWith('-- '))

    expect(headings).toEqual([
      '-- MOVEMENT & COMBAT --',
      '-- COMMAND LINE --',
      '-- VIRTUAL COMMANDS --',
      '-- TYPEING TIPS --',
      '-- SHORTCUTS --',
    ])
    expect(headings.every((heading) => /^-- .+ --$/.test(heading))).toBe(true)
  })

  it('suppresses navigation during transitions', () => {
    const { scene, handleKeyDown } = setupScene()
      ; (scene as unknown as { isTransitioning: boolean }).isTransitioning = true
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
