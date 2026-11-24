import { describe, expect, it, vi } from 'vitest'
import { TimeDilationGlitchView } from './TimeDilationGlitchView.ts'

describe('TimeDilationGlitchView', () => {
  function setupMockScene() {
    const addFilterMock = vi.fn()
    const removeFilterMock = vi.fn()
    const mockCamera = {
      filters: {
        internal: {
          add: addFilterMock,
          remove: removeFilterMock,
        },
      },
    }

    const mockRenderer = {
      renderNodes: {
        _nodeConstructors: {} as Record<string, unknown>,
        addNodeConstructor: vi.fn(),
      },
    }

    const tweensList: { targets: unknown; duration: number; onComplete?: () => void }[] = []
    const addTweenMock = vi.fn((config: { targets: unknown; duration: number; onComplete?: () => void }) => {
      tweensList.push(config)
      return {
        stop: vi.fn(),
      }
    })

    const mockScene = {
      renderer: mockRenderer,
      cameras: {
        main: mockCamera,
      },
      tweens: {
        add: addTweenMock,
      },
    } as unknown as Phaser.Scene

    return {
      mockScene,
      mockCamera,
      mockRenderer,
      addFilterMock,
      removeFilterMock,
      addTweenMock,
      tweensList,
    }
  }

  it('mounts filter controller to camera.filters.internal when WebGL is available', () => {
    const { mockScene, addFilterMock } = setupMockScene()
    const view = new TimeDilationGlitchView()

    view.mount(mockScene)

    expect(addFilterMock).toHaveBeenCalledTimes(1)
    expect(view.getFilter()).toBeDefined()
    expect(view.isActive()).toBe(false)
  })

  it('gracefully handles headless / non-WebGL scenes without throwing', () => {
    const view = new TimeDilationGlitchView()
    expect(() => view.mount({} as Phaser.Scene)).not.toThrow()
    expect(view.getFilter()).toBeUndefined()
    expect(view.isActive()).toBe(false)
    expect(() => view.setMode('command')).not.toThrow()
    expect(() => view.update(16)).not.toThrow()
    expect(() => view.setMode('movement')).not.toThrow()
    expect(() => view.destroy()).not.toThrow()
  })

  it('activates and tweens shakePower on setMode("command")', () => {
    const { mockScene, addTweenMock } = setupMockScene()
    const view = new TimeDilationGlitchView()
    view.mount(mockScene)

    view.setMode('command')

    expect(view.isActive()).toBe(true)
    expect(addTweenMock).toHaveBeenCalledTimes(1)
    const filter = view.getFilter()
    expect(filter).toBeDefined()
  })

  it('deactivates and fades shakePower down on setMode("movement")', () => {
    const { mockScene, tweensList } = setupMockScene()
    const view = new TimeDilationGlitchView()
    view.mount(mockScene)

    view.setMode('command')
    expect(view.isActive()).toBe(true)

    view.setMode('movement')
    // Trigger onComplete of the deactivation tween
    const lastTween = tweensList.at(-1)
    lastTween?.onComplete?.()

    expect(view.isActive()).toBe(false)
  })

  it('accumulates shader time on update while active', () => {
    const { mockScene } = setupMockScene()
    const view = new TimeDilationGlitchView()
    view.mount(mockScene)

    view.setMode('command')
    view.update(100) // 100ms = 0.1s
    view.update(50) // 50ms = 0.05s

    const filter = view.getFilter()
    expect(filter?.time).toBeCloseTo(0.15, 3)

    view.setMode('movement')
    // When inactive, time does not advance
    if (filter) filter.active = false
    const timeBefore = filter?.time
    view.update(100)
    expect(filter?.time).toBe(timeBefore)
  })

  it('removes filter from camera on destroy()', () => {
    const { mockScene, removeFilterMock } = setupMockScene()
    const view = new TimeDilationGlitchView()
    view.mount(mockScene)

    const filter = view.getFilter()
    expect(filter).toBeDefined()

    view.destroy()
    expect(removeFilterMock).toHaveBeenCalledWith(filter)
    expect(view.getFilter()).toBeUndefined()
  })
})
