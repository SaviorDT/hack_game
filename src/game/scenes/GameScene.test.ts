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

    Object.assign(scene, {
      session,
      inlineCommandInputView: mockInlineCommandInputView,
      commandEditor: mockCommandEditor,
    })

    const handleKeyDown = (scene as unknown as { handleKeyDown: (event: KeyboardEvent) => boolean }).handleKeyDown
    const handleKeyUp = (scene as unknown as { handleKeyUp: (event: KeyboardEvent) => void }).handleKeyUp

    return { scene, session, mockInlineCommandInputView, mockCommandEditor, handleKeyDown, handleKeyUp }
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

  it('does not exit command mode when Escape is pressed in command mode', () => {
    const { session, mockInlineCommandInputView, handleKeyDown } = setupScene()
    session.enterCommandMode()

    const preventDefault = vi.fn()
    const result = handleKeyDown({
      key: 'Escape',
      repeat: false,
      preventDefault,
    } as unknown as KeyboardEvent)

    expect(session.inputMode).toBe('command')
    expect(mockInlineCommandInputView.clearInput).not.toHaveBeenCalled()
    expect(mockInlineCommandInputView.setVisible).not.toHaveBeenCalled()
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

    it('closes command editor when Escape is pressed while command editor is open', () => {
      const { scene, mockCommandEditor, handleKeyDown, mockInlineCommandInputView } = setupScene()
      mockCommandEditor.isOpen.mockReturnValue(true)
      const closeSpy = vi.spyOn(scene, 'closeCommandEditor')

      const preventDefault = vi.fn()
      const result = handleKeyDown({
        key: 'Escape',
        repeat: false,
        preventDefault,
      } as unknown as KeyboardEvent)

      expect(preventDefault).toHaveBeenCalled()
      expect(closeSpy).toHaveBeenCalled()
      expect(mockCommandEditor.close).toHaveBeenCalled()
      expect(mockInlineCommandInputView.clearInput).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('initializes with openCommandEditor flag from init data', () => {
      const scene = new GameScene()
      scene.init({ openCommandEditor: true })
      expect((scene as any).initialOpenCommandEditor).toBe(true)
    })
  })
})
