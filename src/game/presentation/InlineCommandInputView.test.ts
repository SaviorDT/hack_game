import { describe, expect, it, vi } from 'vitest'
import { InlineCommandInputView } from './InlineCommandInputView.ts'

describe('InlineCommandInputView', () => {
  function setupView() {
    const keydownListeners: ((event: KeyboardEvent) => void)[] = []
    const mockScene = {
      add: {
        container: vi.fn(() => ({
          setDepth: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          add: vi.fn(),
          destroy: vi.fn(),
        })),
        rectangle: vi.fn(() => ({
          setStrokeStyle: vi.fn().mockReturnThis(),
          setOrigin: vi.fn().mockReturnThis(),
          setSize: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
        })),
        text: vi.fn(() => ({
          setOrigin: vi.fn().mockReturnThis(),
          setPosition: vi.fn().mockReturnThis(),
          setText: vi.fn().mockReturnThis(),
          setVisible: vi.fn().mockReturnThis(),
          width: 50,
        })),
      },
      input: {
        keyboard: {
          on: vi.fn((event: string, callback: (e: KeyboardEvent) => void) => {
            if (event === 'keydown') keydownListeners.push(callback)
          }),
          off: vi.fn(),
        },
      },
      time: {
        addEvent: vi.fn(() => ({
          remove: vi.fn(),
        })),
      },
    } as any

    const onSubmit = vi.fn()
    const view = new InlineCommandInputView()
    view.mount(mockScene, onSubmit)

    const dispatchKeydown = (event: Partial<KeyboardEvent>) => {
      const e = {
        key: '',
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        preventDefault: vi.fn(),
        ...event,
      } as unknown as KeyboardEvent
      for (const listener of keydownListeners) {
        listener(e)
      }
      return e
    }

    return { view, onSubmit, dispatchKeydown }
  }

  it('calls keyGate on keydown even when not visible (for movement/mode triggers)', () => {
    const { view, dispatchKeydown } = setupView()
    const keyGate = vi.fn(() => false)
    view.setKeyGate(keyGate)

    // View is not visible initially (movement mode)
    dispatchKeydown({ key: 'w' })
    expect(keyGate).toHaveBeenCalled()
  })

  it('does not type characters when keyGate returns false', () => {
    const { view, dispatchKeydown, onSubmit } = setupView()
    const keyGate = vi.fn(() => false)
    view.setKeyGate(keyGate)

    dispatchKeydown({ key: 'w' })
    view.setVisible(true)
    dispatchKeydown({ key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('types characters and submits when visible and keyGate returns true', () => {
    const { view, dispatchKeydown, onSubmit } = setupView()
    const keyGate = vi.fn(() => true)
    view.setKeyGate(keyGate)

    view.setVisible(true)
    dispatchKeydown({ key: 'l' })
    dispatchKeydown({ key: 's' })
    dispatchKeydown({ key: 'Enter' })

    expect(onSubmit).toHaveBeenCalledWith('ls')
  })

  it('exposes getValue and submit for external triggers such as shift release', () => {
    const { view, dispatchKeydown, onSubmit } = setupView()
    const keyGate = vi.fn(() => true)
    view.setKeyGate(keyGate)

    view.setVisible(true)
    dispatchKeydown({ key: 'm' })
    dispatchKeydown({ key: 'v' })

    expect(view.getValue()).toBe('mv')
    view.submit()
    expect(onSubmit).toHaveBeenCalledWith('mv')
    expect(view.getValue()).toBe('')
  })
})

