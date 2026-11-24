import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const titleStorage = (() => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => { values.clear() },
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size },
  } as Storage
})()

beforeEach(() => {
  titleStorage.clear()
  vi.stubGlobal('window', { localStorage: titleStorage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

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
          text: _text,
          style: _style,
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
  ALL_TITLE_MENU_ITEMS,
  TitleScene,
  TITLE_MENU_ITEMS,
} from './TitleScene.ts'
import { SAVE_SCHEMA_VERSION } from '../application/GameSession.ts'

describe('TitleScene', () => {
  function setupScene() {
    const scene = new TitleScene()
    scene.create()
    const handleKeyDown = (scene as unknown as { handleKeyDown: (event: KeyboardEvent) => void }).handleKeyDown
    return { scene, handleKeyDown }
  }

  it('initializes with START as the selected item', () => {
    titleStorage.removeItem('hack-game.save')
    const { scene } = setupScene()
    expect(scene.getSelectedIndex()).toBe(0)
    expect(scene.getSelectedChoice()).toBe('START')
    expect(scene.getMenuItems()).toEqual(['START', 'SETTING', 'HELP'])
    expect(TITLE_MENU_ITEMS).toEqual(['START', 'SETTING', 'HELP'])
  })

  it('shows and selects RESUME when a valid save exists', () => {
    titleStorage.setItem('hack-game.save', JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      worldState: { currentRoomId: 'tutorial3' },
    }))
    const { scene, handleKeyDown } = setupScene()

    expect(scene.getMenuItems()).toEqual(['RESTART', 'RESUME', 'SETTING', 'HELP'])
    expect(ALL_TITLE_MENU_ITEMS).toEqual(['RESTART', 'RESUME', 'SETTING', 'HELP'])
    expect(scene.getSelectedIndex()).toBe(1)
    expect(scene.getSelectedChoice()).toBe('RESUME')

    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('SETTING')
    handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('RESUME')
    handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('RESTART')
  })

  it('restarts fresh or resumes based on the confirmed title choice', () => {
    titleStorage.setItem('hack-game.save', JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      worldState: { currentRoomId: 'tutorial3' },
    }))
    const { scene, handleKeyDown } = setupScene()

    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.scene.start).toHaveBeenCalledWith('game', { resumeFromSave: true })

    ;(scene.scene.start as unknown as ReturnType<typeof vi.fn>).mockClear()
    handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('RESTART')
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.isInRestartConfirm()).toBe(true)
    expect(scene.getConfirmChoice()).toBe('NO')
    expect(scene.getConfirmQuestionText()).toBe('RESTART FROM THE\nBEGINNING?')
    handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getConfirmChoice()).toBe('YES')
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.scene.start).toHaveBeenCalledWith('game')
  })

  it('cancels restart by default and cycles confirmation choices', () => {
    titleStorage.setItem('hack-game.save', JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      worldState: { currentRoomId: 'tutorial3' },
    }))
    const { scene, handleKeyDown } = setupScene()
    handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)

    expect(scene.isInConfirm()).toBe(true)
    expect(scene.getConfirmChoice()).toBe('NO')
    handleKeyDown({ key: 'a', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getConfirmChoice()).toBe('YES')
    handleKeyDown({ key: 'd', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getConfirmChoice()).toBe('NO')
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)

    expect(scene.isInConfirm()).toBe(false)
    expect(scene.getSelectedChoice()).toBe('RESTART')
    expect(scene.scene.start).not.toHaveBeenCalled()
  })

  it('hides Movement & Combat Help until a valid save exists', () => {
    titleStorage.removeItem('hack-game.save')
    const { scene } = setupScene()
    const lines = (scene as any).getHelpLines('hold-shift') as string[]

    expect(lines).not.toContain('-- MOVEMENT & COMBAT --')
    expect(lines.some((line: string) => line.includes('WASD'))).toBe(false)
    expect(lines).toContain('-- SHORTCUTS --')
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
    expect(scene.isInSettings()).toBe(true)

    consoleSpy.mockRestore()
  })

  it('swaps to settings screen when SETTING is confirmed, allows in-place toggle switch, and exits on RETURN', () => {
    titleStorage.setItem('hack-game.command-typing-mode', 'hold-shift')
    const { scene, handleKeyDown } = setupScene()
    expect(scene.isInSettings()).toBe(false)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')

    // Navigate to SETTING
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSelectedChoice()).toBe('SETTING')

    // Confirm SETTING
    const enterEvent = { key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent
    handleKeyDown(enterEvent)
    expect(scene.isInSettings()).toBe(true)

    // Initially in 'hold-shift' (index 0) with focus on the toggle switch (focus row 0)
    expect(scene.getSettingFocusRow()).toBe(0)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')

    // Pressing Enter while focused on [* HOLD SHIFT *] keeps hold-shift selected without exiting settings
    handleKeyDown(enterEvent)
    expect(scene.isInSettings()).toBe(true)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')

    // Arrow keys (ArrowRight, ArrowLeft, D, A) change focus but do not change the current mode value
    handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusIndex()).toBe(2)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')
    const [shiftText, hybridText, stickyText] = (scene as any).settingModeTexts
    expect(stickyText.setText).toHaveBeenCalledWith('> [  ENTER + STICKY  ] <')
    expect(stickyText.setColor).toHaveBeenCalledWith('#ffffff')
    expect(shiftText.setText).toHaveBeenCalledWith('  [* HOLD SHIFT *]  ')
    expect(shiftText.setColor).toHaveBeenCalledWith('#555555')
    expect(hybridText.setText).toHaveBeenCalledWith('  [  HYBRID  ]  ')

    // Focus is clamped at the last mode
    handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusIndex()).toBe(2)
    handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusIndex()).toBe(1)

    handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusIndex()).toBe(0)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')
    expect(shiftText.setText).toHaveBeenCalledWith('> [* HOLD SHIFT *] <')
    expect(shiftText.setColor).toHaveBeenCalledWith('#ffffff')
    expect(stickyText.setText).toHaveBeenCalledWith('  [  ENTER + STICKY  ]  ')
    expect(stickyText.setColor).toHaveBeenCalledWith('#555555')

    handleKeyDown({ key: 'd', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusIndex()).toBe(1)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')

    handleKeyDown({ key: 'a', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusIndex()).toBe(0)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')

    // Space does not toggle mode
    handleKeyDown({ key: ' ', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    expect(scene.getCurrentTypingMode()).toBe('hold-shift')

    // Move focus to hybrid and select it using Enter
    handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusIndex()).toBe(1)
    expect(scene.getSettingSelectedIndex()).toBe(0)
    handleKeyDown(enterEvent)
    expect(scene.getSettingSelectedIndex()).toBe(1)
    expect(scene.getCurrentTypingMode()).toBe('hybrid')

    // Move focus to enter-sticky and select it using Enter
    handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    handleKeyDown(enterEvent)
    expect(scene.getSettingSelectedIndex()).toBe(2)
    expect(scene.getCurrentTypingMode()).toBe('enter-sticky')

    // Pressing Enter again while focused on [* ENTER + STICKY *] keeps it selected
    handleKeyDown(enterEvent)
    expect(scene.getSettingSelectedIndex()).toBe(2)
    expect(scene.getCurrentTypingMode()).toBe('enter-sticky')

    // Move focus down to [ RETURN ] button (focus row 1)
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusRow()).toBe(1)

    // Move focus back up to toggle switch
    handleKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusRow()).toBe(0)

    // Move focus to [ RETURN ] using S key
    handleKeyDown({ key: 's', preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(scene.getSettingFocusRow()).toBe(1)

    // Press Enter while focused on [ RETURN ] to return to main menu
    handleKeyDown(enterEvent)
    expect(scene.isInSettings()).toBe(false)
    expect(scene.getCurrentTypingMode()).toBe('enter-sticky')
  })

  it('displays command line bindings in help screen matching the active typing mode', () => {
    titleStorage.setItem('hack-game.save', JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      worldState: { currentRoomId: 'tutorial3' },
    }))
    const { scene, handleKeyDown } = setupScene()
    const helpTextObj = (scene as any).helpManualText

    // In default hold-shift mode
    const linesDefault = (scene as any).getHelpLines('hold-shift')
    expect(linesDefault.some((line: string) => line.includes('HOLD SHIFT'))).toBe(true)
    expect(linesDefault.some((line: string) => line.includes('ENTER on empty bar'))).toBe(false)
    expect(linesDefault.some((line: string) => line.includes('SPACE / P'))).toBe(true)

    // In enter-sticky mode
    const linesSticky = (scene as any).getHelpLines('enter-sticky')
    expect(linesSticky.some((line: string) => line.includes('HOLD SHIFT'))).toBe(false)
    expect(linesSticky.some((line: string) => line.includes('ENTER on empty bar'))).toBe(true)
    expect(linesSticky.some((line: string) => line.includes('SPACE / P'))).toBe(true)

    // In hybrid mode both bindings are listed
    const linesHybrid = (scene as any).getHelpLines('hybrid')
    expect(linesHybrid.some((line: string) => line.includes('HOLD SHIFT'))).toBe(true)
    expect(linesHybrid.some((line: string) => line.includes('ENTER on empty bar'))).toBe(true)

    // Changing mode updates the help manual text
    const setTextSpy = vi.spyOn(helpTextObj, 'setText')
    handleKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() } as unknown as KeyboardEvent) // select SETTING
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent) // open SETTING
    handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent) // focus hybrid
    handleKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() } as unknown as KeyboardEvent) // focus enter-sticky
    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent) // select enter-sticky

    expect(setTextSpy).toHaveBeenCalled()
    const lastCallArg = setTextSpy.mock.calls[setTextSpy.mock.calls.length - 1][0]
    expect(lastCallArg).toEqual(linesSticky)
  })

  it('includes typing tips in the help screen', () => {
    titleStorage.setItem('hack-game.save', JSON.stringify({
      schemaVersion: SAVE_SCHEMA_VERSION,
      worldState: { currentRoomId: 'tutorial3' },
    }))
    const { scene } = setupScene()
    const lines = (scene as any).getHelpLines('hold-shift')
    expect(lines).toContain('-- MOVEMENT & COMBAT --')
    expect(lines).toContain('-- TYPEING TIPS --')
    expect(lines.some((line: string) => line.includes('TAB'))).toBe(true)
    expect(lines.some((line: string) => line.includes('CTRL+BACKSPACE'))).toBe(true)
    expect(lines.some((line: string) => line.includes('UP / DOWN'))).toBe(true)
  })

  it('unlocks command and recorded-command Help from the saved tutorial room', () => {
    const storageKey = 'hack-game.save'
    const priorSnapshot = window.localStorage.getItem(storageKey)
    const saveAt = (currentRoomId: string) => {
      window.localStorage.setItem(storageKey, JSON.stringify({
        schemaVersion: SAVE_SCHEMA_VERSION,
        worldState: { currentRoomId },
      }))
    }

    try {
      saveAt('tutorial1')
      const tutorial1 = new TitleScene()
      tutorial1.create()
      const lockedHelp = (tutorial1 as any).getHelpLines('hold-shift') as string[]
      expect(lockedHelp).not.toContain('-- COMMAND LINE --')
      expect(lockedHelp).not.toContain('-- VIRTUAL COMMANDS --')
      expect(lockedHelp).not.toContain('-- TYPEING TIPS --')
      expect(lockedHelp.some((line) => line.includes('Execute recorded command'))).toBe(false)

      saveAt('tutorial2')
      const tutorial2 = new TitleScene()
      tutorial2.create()
      const commandHelp = (tutorial2 as any).getHelpLines('hold-shift') as string[]
      expect(commandHelp).toContain('-- COMMAND LINE --')
      expect(commandHelp).toContain('-- VIRTUAL COMMANDS --')
      expect(commandHelp).toContain('-- TYPEING TIPS --')
      expect(commandHelp.some((line) => line.includes('Execute recorded command'))).toBe(false)

      saveAt('tutorial3')
      const tutorial3 = new TitleScene()
      tutorial3.create()
      const recordedCommandHelp = (tutorial3 as any).getHelpLines('hold-shift') as string[]
      expect(recordedCommandHelp.some((line) => line.includes('Execute recorded command'))).toBe(true)
    } finally {
      if (priorSnapshot === null) window.localStorage.removeItem(storageKey)
      else window.localStorage.setItem(storageKey, priorSnapshot)
    }
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
      ; (scene as unknown as { isTransitioning: boolean }).isTransitioning = true
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

  it('types ./main and starts the game when confirming START', () => {
    const { scene, handleKeyDown } = setupScene()
    const typeCommandSpy = vi.spyOn(scene as any, 'typeCommand')
    const startSpy = vi.spyOn(scene.scene, 'start')

    handleKeyDown({ key: 'Enter', preventDefault: vi.fn() } as unknown as KeyboardEvent)

    expect(typeCommandSpy).toHaveBeenCalledWith(
      (scene as any).mainPromptCommand,
      './main',
      expect.any(Function),
    )
    expect(startSpy).toHaveBeenCalledWith('game')
  })

  it('positions all navText (mainMenu, setting menu, help menu) above bottom guest_terminal:~$ prompt', () => {
    const scene = new TitleScene()
    const textSpy = vi.spyOn(scene.add, 'text')
    scene.create()

    const bottomPromptCalls = textSpy.mock.calls.filter(
      call => call[2] === 'guest_terminal:~$ ' && call[1] >= 500,
    )
    expect(bottomPromptCalls.length).toBe(3) // 1 in main menu, 2 across subscreens
    const bottomPromptY = bottomPromptCalls[0][1]
    expect(bottomPromptY).toBe(920)

    const navHints = [
      '<W A S D> <ARROWS> SELECT    <ENTER> CONFIRM',
      '<ENTER> CONFIRM',
    ]
    const navTextCalls = textSpy.mock.calls.filter(
      call => typeof call[2] === 'string' && navHints.includes(call[2]),
    )

    expect(navTextCalls.length).toBe(3)
    navTextCalls.forEach(call => {
      const navY = call[1]
      expect(navY).toBeLessThan(bottomPromptY)
      expect(navY).toBe(860)
      expect((call[3] as any)?.color).toBe('#505050')
    })
  })

  it('renders help manual titles in COLOR_PROMPT and command & description columns in COLOR_DIM', () => {
    const scene = new TitleScene()
    const textSpy = vi.spyOn(scene.add, 'text')
    scene.create()

    // Find the text calls for helpManualText (color: #888888) and helpDescText (color: #555555)
    const helpManualCall = textSpy.mock.calls.find(
      call => call[1] === 125 && (call[3] as any)?.color === '#888888',
    )
    const helpDescCall = textSpy.mock.calls.find(
      call => call[1] === 125 && (call[3] as any)?.color === '#555555',
    )

    expect(helpManualCall).toBeDefined()
    expect(helpDescCall).toBeDefined()

    const helpDescObj = (scene as any).helpDescText
    expect(helpDescObj.setText).toHaveBeenCalled()
    const descArg = (helpDescObj.setText as any).mock.calls[0][0]
    expect(descArg.some((line: string) => line.includes('WASD'))).toBe(false)
    expect(descArg.some((line: string) => line.includes('SPACE / P'))).toBe(true)
    expect(descArg.some((line: string) => line.includes('-- MOVEMENT & COMBAT --'))).toBe(false)
  })

  it('types ./setting when entering settings and ./menu when returning to menu', () => {
    const { scene } = setupScene()
    const typeCommandSpy = vi.spyOn(scene as any, 'typeCommand')

    scene.showSettings()
    expect(typeCommandSpy).toHaveBeenCalledWith(
      (scene as any).mainPromptCommand,
      './setting',
      expect.any(Function),
    )

    scene.exitSettings()
    expect(typeCommandSpy).toHaveBeenCalledWith(
      (scene as any).settingsPromptCommand,
      './menu',
      expect.any(Function),
    )
  })

  it('types ./menu when returning from help to menu', () => {
    const { scene } = setupScene()
    const typeCommandSpy = vi.spyOn(scene as any, 'typeCommand')

    scene.showHelp()
    expect(typeCommandSpy).toHaveBeenCalledWith(
      (scene as any).mainPromptCommand,
      'help',
      expect.any(Function),
    )

    scene.exitHelp()
    expect(typeCommandSpy).toHaveBeenCalledWith(
      (scene as any).helpPromptCommand,
      './menu',
      expect.any(Function),
    )
  })

  it('displays ./setting in settings screen top prompt', () => {
    const scene = new TitleScene()
    const textSpy = vi.spyOn(scene.add, 'text')
    scene.create()

    const topSettingPrompt = textSpy.mock.calls.find(
      call => call[1] === 70 && call[2] === './setting',
    )
    expect(topSettingPrompt).toBeDefined()

    const settingSubtitle = textSpy.mock.calls.find(
      call => call[1] === 125 && call[2] === '-- IN-GAME COMMAND TYPING MODE --',
    )
    expect(settingSubtitle).toBeDefined()
  })
})
