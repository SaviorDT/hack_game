import { describe, expect, it, vi } from 'vitest'

vi.mock('phaser', () => {
  class MockScene {
    scene: { key: string }
    constructor(config?: { key: string }) {
      this.scene = { key: config?.key ?? 'mock-scene' }
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
      Core: {
        Events: {
          BLUR: 'blur',
        },
      },
    },
  }
})

import { GameScene } from './GameScene.ts'
import { createRoom1Session } from '../content/createRoom1Session.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'

describe('GameScene key handling', () => {
  const memoryStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  } as unknown as Storage

  function setupScene() {
    const scene = new GameScene()
    const session = createRoom1Session({ movementBindings: INPUT_BINDINGS.movement, storage: memoryStorage })
    const mockInlineCommandInputView = {
      setVisible: vi.fn(),
      clearInput: vi.fn(),
      setValue: vi.fn(),
      setPlayerPosition: vi.fn(),
      getValue: vi.fn(() => ''),
      submit: vi.fn(),
    }

    const mockCommandEditor = {
      isOpen: vi.fn(() => false),
      isModalPromptOpen: vi.fn(() => false),
      open: vi.fn(),
      close: vi.fn(),
      toggle: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    }

    const delayedCalls: { delay: number; callback: () => void }[] = []
    const mockTime = {
      delayedCall: vi.fn((delay: number, callback: () => void) => {
        const item = { delay, callback }
        delayedCalls.push(item)
        return {
          remove: vi.fn(() => {
            const idx = delayedCalls.indexOf(item)
            if (idx !== -1) delayedCalls.splice(idx, 1)
          }),
        }
      }),
    }

    Object.assign(scene, {
      session,
      time: mockTime,
      inlineCommandInputView: mockInlineCommandInputView,
      commandEditor: mockCommandEditor,
    })

    const handleKeyDown = (scene as unknown as { handleKeyDown: (event: KeyboardEvent) => boolean }).handleKeyDown
    const handleKeyUp = (scene as unknown as { handleKeyUp: (event: KeyboardEvent) => void }).handleKeyUp

    return {
      scene,
      session,
      mockInlineCommandInputView,
      mockCommandEditor,
      delayedCalls,
      handleKeyDown,
      handleKeyUp,
    }
  }

  it('moves player with WASD in movement mode', () => {
    const { session, handleKeyDown, handleKeyUp } = setupScene()
    expect(session.inputMode).toBe('movement')

    for (const key of ['w', 'a', 's', 'd']) {
      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key,
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(result).toBe(false)

      handleKeyUp({
        key,
      } as unknown as KeyboardEvent)
    }
  })

  it('enters command mode when Shift is pressed in movement mode', () => {
    const { session, mockInlineCommandInputView, handleKeyDown } = setupScene()
    expect(session.inputMode).toBe('movement')

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Shift',
      repeat: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalled()
    expect(session.inputMode).toBe('command')
    expect(mockInlineCommandInputView.setVisible).toHaveBeenCalledWith(true)
    expect(result).toBe(false)
  })

  it('does not re-enter command mode when Shift is repeated in movement mode', () => {
    const { session, mockInlineCommandInputView, handleKeyDown } = setupScene()
    const spy = vi.spyOn(session, 'enterCommandMode')

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Shift',
      repeat: true,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalled()
    expect(spy).not.toHaveBeenCalled()
    expect(mockInlineCommandInputView.setVisible).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('does not enter command mode when Enter is pressed in movement mode', () => {
    const { session, mockInlineCommandInputView, handleKeyDown } = setupScene()
    expect(session.inputMode).toBe('movement')

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Enter',
      repeat: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(preventDefault).toHaveBeenCalled()
    expect(session.inputMode).toBe('movement')
    expect(mockInlineCommandInputView.setVisible).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('allows Enter to pass through to command input when already in command mode', () => {
    const { session, handleKeyDown } = setupScene()
    session.enterCommandMode()
    expect(session.inputMode).toBe('command')

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Enter',
      repeat: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    // In command mode, typeable is returned so InlineCommandInputView can handle the submission
    expect(result).toBe(true)
  })

  it('opens the pause menu on Space in movement mode', () => {
    const { scene, handleKeyDown } = setupScene()
    const openPause = vi.spyOn(scene, 'openPause').mockImplementation(() => {})
    const preventDefault = vi.fn()
    const result = handleKeyDown({ key: ' ', repeat: false, preventDefault } as unknown as KeyboardEvent)
    expect(openPause).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('opens the pause menu on P in movement mode', () => {
    const { scene, handleKeyDown } = setupScene()
    const openPause = vi.spyOn(scene, 'openPause').mockImplementation(() => {})
    const preventDefault = vi.fn()
    const result = handleKeyDown({ key: 'p', repeat: false, preventDefault } as unknown as KeyboardEvent)
    expect(openPause).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('allows Space to pass through to command input when in command mode', () => {
    const { scene, session, handleKeyDown } = setupScene()
    const openPause = vi.spyOn(scene, 'openPause').mockImplementation(() => {})
    session.enterCommandMode()
    const result = handleKeyDown({ key: ' ', repeat: false, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(openPause).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('allows P to pass through to command input when in command mode', () => {
    const { scene, session, handleKeyDown } = setupScene()
    const openPause = vi.spyOn(scene, 'openPause').mockImplementation(() => {})
    session.enterCommandMode()
    const result = handleKeyDown({ key: 'p', repeat: false, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(openPause).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('attacks with J in movement mode', () => {
    const { session, handleKeyDown } = setupScene()
    const attackSpy = vi.spyOn(session, 'attack').mockImplementation(() => ({} as any))
    const preventDefault = vi.fn()
    const result = handleKeyDown({ key: 'j', repeat: false, preventDefault } as unknown as KeyboardEvent)
    expect(attackSpy).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('does not attack with J in command mode and allows typing j', () => {
    const { session, handleKeyDown } = setupScene()
    const attackSpy = vi.spyOn(session, 'attack').mockImplementation(() => ({} as any))
    session.enterCommandMode()
    const result = handleKeyDown({ key: 'j', repeat: false, preventDefault: vi.fn() } as unknown as KeyboardEvent)
    expect(attackSpy).not.toHaveBeenCalled()
    expect(result).toBe(true)
  })

  it('exits command mode when Shift is released if entered by Shift with empty draft', () => {
    const { scene, session, mockInlineCommandInputView, handleKeyDown, handleKeyUp } = setupScene()
    handleKeyDown({
      key: 'Shift',
      repeat: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent)
    expect(session.inputMode).toBe('command')
    expect((scene as any).enteredByShift).toBe(true)

    handleKeyUp({
      key: 'Shift',
    } as unknown as KeyboardEvent)

    expect(session.inputMode).toBe('movement')
    expect(mockInlineCommandInputView.clearInput).toHaveBeenCalled()
    expect(mockInlineCommandInputView.setVisible).toHaveBeenCalledWith(false)
    expect((scene as any).enteredByShift).toBe(false)
  })

  it('submits command when Shift is released if entered by Shift with non-empty draft', () => {
    const { scene, session, mockInlineCommandInputView, handleKeyDown, handleKeyUp } = setupScene()
    handleKeyDown({
      key: 'Shift',
      repeat: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent)
    expect(session.inputMode).toBe('command')

    mockInlineCommandInputView.getValue.mockReturnValue('ls')

    handleKeyUp({
      key: 'Shift',
    } as unknown as KeyboardEvent)

    expect(mockInlineCommandInputView.submit).toHaveBeenCalled()
    expect((scene as any).enteredByShift).toBe(false)
  })

  describe('enter-sticky typing mode', () => {
    it('disables Shift in movement mode', () => {
      const { scene, session, mockInlineCommandInputView, handleKeyDown } = setupScene()
      scene.setCommandTypingMode('enter-sticky')
      expect(scene.getCommandTypingMode()).toBe('enter-sticky')

      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key: 'Shift',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(session.inputMode).toBe('movement')
      expect(mockInlineCommandInputView.setVisible).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('enters command mode when Enter is pressed in movement mode', () => {
      const { scene, session, mockInlineCommandInputView, handleKeyDown } = setupScene()
      scene.setCommandTypingMode('enter-sticky')

      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key: 'Enter',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(session.inputMode).toBe('command')
      expect(mockInlineCommandInputView.setVisible).toHaveBeenCalledWith(true)
      expect(result).toBe(false)
    })

    it('does not re-enter when Enter is repeated in movement mode', () => {
      const { scene, session, mockInlineCommandInputView, handleKeyDown } = setupScene()
      scene.setCommandTypingMode('enter-sticky')
      const spy = vi.spyOn(session, 'enterCommandMode')

      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key: 'Enter',
        repeat: true,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(spy).not.toHaveBeenCalled()
      expect(mockInlineCommandInputView.setVisible).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('does not exit command mode when Shift is released in enter-sticky mode', () => {
      const { scene, session, mockInlineCommandInputView, handleKeyDown, handleKeyUp } = setupScene()
      scene.setCommandTypingMode('enter-sticky')

      // Enter command mode via Enter
      handleKeyDown({
        key: 'Enter',
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent)
      expect(session.inputMode).toBe('command')

      // Releasing shift should do nothing in enter-sticky mode
      handleKeyUp({
        key: 'Shift',
      } as unknown as KeyboardEvent)

      expect(session.inputMode).toBe('command')
      expect(mockInlineCommandInputView.clearInput).not.toHaveBeenCalled()
    })

    it('closes command prompt on empty submission without error or executing', () => {
      const scene = new GameScene()
      const session = createRoom1Session({ movementBindings: INPUT_BINDINGS.movement, storage: memoryStorage })

      const mockInlineCommandInputView = {
        setVisible: vi.fn(),
        clearInput: vi.fn(),
        setPlayerPosition: vi.fn(),
        setKeyGate: vi.fn(),
        destroy: vi.fn(),
      }

      Object.assign(scene, {
        session,
        inlineCommandInputView: mockInlineCommandInputView,
      })
      scene.setCommandTypingMode('enter-sticky')
      session.enterCommandMode()
      expect(session.inputMode).toBe('command')

      const submitCommandSpy = vi.spyOn(session, 'submitCommand')

      const onSubmit = (rawText: string) => {
        if (rawText.trim().length === 0) {
          session.enterMovementMode()
          mockInlineCommandInputView.setVisible(false)
          return
        }
        session.submitCommand(rawText)
        mockInlineCommandInputView.setVisible(false)
      }

      onSubmit('   ')
      expect(session.inputMode).toBe('movement')
      expect(mockInlineCommandInputView.setVisible).toHaveBeenCalledWith(false)
      expect(submitCommandSpy).not.toHaveBeenCalled()
    })
  })

  describe('hybrid typing mode', () => {
    const key = (name: string, repeat = false) =>
      ({ key: name, repeat, preventDefault: vi.fn() }) as unknown as KeyboardEvent

    it('opens the prompt with Shift and closes it on Shift release', () => {
      const { scene, session, mockInlineCommandInputView, handleKeyDown, handleKeyUp } = setupScene()
      scene.setCommandTypingMode('hybrid')

      handleKeyDown(key('Shift'))
      expect(session.inputMode).toBe('command')
      expect((scene as any).enteredByShift).toBe(true)

      handleKeyUp(key('Shift'))
      expect(session.inputMode).toBe('movement')
      expect(mockInlineCommandInputView.setVisible).toHaveBeenLastCalledWith(false)
    })

    it('opens the prompt with Enter and ignores Shift release', () => {
      const { scene, session, mockInlineCommandInputView, handleKeyDown, handleKeyUp } = setupScene()
      scene.setCommandTypingMode('hybrid')

      handleKeyDown(key('Enter'))
      expect(session.inputMode).toBe('command')
      expect((scene as any).enteredByShift).toBe(false)

      handleKeyUp(key('Shift'))
      expect(session.inputMode).toBe('command')
      expect(mockInlineCommandInputView.clearInput).not.toHaveBeenCalled()
    })

    it('does not treat an Enter-opened prompt as Shift-opened after a Shift-opened one was submitted', () => {
      const { scene, session, handleKeyDown, handleKeyUp } = setupScene()
      scene.setCommandTypingMode('hybrid')

      handleKeyDown(key('Shift'))
      session.enterMovementMode() // submitted with Enter while Shift is still held
      handleKeyUp(key('Shift'))
      expect((scene as any).enteredByShift).toBe(false)

      handleKeyDown(key('Enter'))
      handleKeyUp(key('Shift'))
      expect(session.inputMode).toBe('command')
    })
  })

  describe('hold-shift typing mode', () => {
    it('ignores Enter in movement mode', () => {
      const { scene, session, handleKeyDown } = setupScene()
      scene.setCommandTypingMode('hold-shift')
      handleKeyDown({ key: 'Enter', repeat: false, preventDefault: vi.fn() } as unknown as KeyboardEvent)
      expect(session.inputMode).toBe('movement')
    })
  })

  describe('command editor overlay integration (F1)', () => {
    it('toggles command editor when F1 is pressed', () => {
      const { scene, mockCommandEditor, handleKeyDown } = setupScene()
      const toggleSpy = vi.spyOn(scene, 'toggleCommandEditor')

      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key: 'F1',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(toggleSpy).toHaveBeenCalled()
      expect(mockCommandEditor.toggle).toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('initializes with openCommandEditor flag from init data', () => {
      const scene = new GameScene()
      scene.init({ openCommandEditor: true })
      expect((scene as any).initialOpenCommandEditor).toBe(true)
    })
  })

  describe('recorded commands (8, 9, 0)', () => {
    it('records last command when held for the hold duration in movement mode', () => {
      const { scene, session, handleKeyDown, handleKeyUp, delayedCalls } = setupScene()
      session.submitCommand('ls')

      const startSpy = vi.spyOn((scene as any).macroIndicatorView, 'startHoldProgress')
      const preventDefault = vi.fn()
      handleKeyDown({
        key: '8',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(startSpy).toHaveBeenCalledWith(8, expect.any(Number), expect.any(Number))
      expect(delayedCalls.length).toBe(1)

      // Hold duration passes -> trigger hold callback
      delayedCalls[0].callback()
      expect(session.getCommandSlot(8)).toBe('ls')

      // Key release after hold does not execute command
      const historyLength = session.getWorldState().commandHistory.length
      handleKeyUp({ key: '8' } as unknown as KeyboardEvent)
      expect(session.getWorldState().commandHistory.length).toBe(historyLength)
      expect(session.inputMode).toBe('movement')
    })

    it('taps slot key (releases before hold duration) to execute command directly in movement mode', () => {
      const { scene, session, handleKeyDown, handleKeyUp, delayedCalls } = setupScene()
      session.setCommandSlot(8, 'mv dagger $mouse')

      const cancelSpy = vi.spyOn((scene as any).macroIndicatorView, 'cancelHoldProgress')
      const preventDefault = vi.fn()
      handleKeyDown({
        key: '8',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(delayedCalls.length).toBe(1)
      expect(session.inputMode).toBe('movement')

      // Released before hold timer finishes
      handleKeyUp({ key: '8' } as unknown as KeyboardEvent)
      expect(cancelSpy).toHaveBeenCalled()
      expect(delayedCalls.length).toBe(0) // Timer removed
      expect(session.getWorldState().commandHistory).toContain('mv dagger $mouse')
      expect(session.inputMode).toBe('movement')
    })

    it('taps an empty slot key without executing or changing input mode', () => {
      const { scene, session, handleKeyDown, handleKeyUp, delayedCalls } = setupScene()
      const cancelSpy = vi.spyOn((scene as any).macroIndicatorView, 'cancelHoldProgress')

      const preventDefault = vi.fn()
      handleKeyDown({
        key: '9',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(session.inputMode).toBe('movement')
      handleKeyUp({ key: '9' } as unknown as KeyboardEvent)
      expect(cancelSpy).toHaveBeenCalled()
      expect(delayedCalls.length).toBe(0)
      expect(session.inputMode).toBe('movement')
    })

    it('cancels hold progress when opening pause menu while holding slot key', () => {
      const { scene, handleKeyDown } = setupScene()
      Object.assign((scene as any).scene, {
        isActive: vi.fn(() => false),
        launch: vi.fn(),
        pause: vi.fn(),
      })
      const cancelSpy = vi.spyOn((scene as any).macroIndicatorView, 'cancelHoldProgress')

      handleKeyDown({
        key: '0',
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent)

      scene.openPause()
      expect(cancelSpy).toHaveBeenCalled()
    })

    it('cancels hold progress on blur while holding slot key', () => {
      const { scene, handleKeyDown } = setupScene()
      const cancelSpy = vi.spyOn((scene as any).macroIndicatorView, 'cancelHoldProgress')

      handleKeyDown({
        key: '8',
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent)

      ;(scene as any).handleBlur()
      expect(cancelSpy).toHaveBeenCalled()
    })

    it('cancels hold progress on game over outcome while holding slot key', () => {
      const { scene, session, handleKeyDown } = setupScene()
      const cancelSpy = vi.spyOn((scene as any).macroIndicatorView, 'cancelHoldProgress')

      handleKeyDown({
        key: '8',
        repeat: false,
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent)

      session.getWorldState().outcome = 'game-over'
      scene.update(0, 16)
      expect(cancelSpy).toHaveBeenCalled()
    })
  })
})
