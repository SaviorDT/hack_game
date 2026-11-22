import { describe, expect, it, vi } from 'vitest'
import { PhaserGameHud } from './PhaserGameHud.ts'
import type { WorldState } from '../domain/WorldState.ts'
import {
  COLOR_DIM,
  COLOR_PROMPT,
  PANEL_BG,
  PANEL_BG_ALPHA,
  PANEL_BORDER,
  PANEL_BORDER_WIDTH,
  POPUP_FADE_DURATION_MS,
  TERMINAL_FONT,
  TYPING_SPEED_MS,
} from './uiTheme.ts'
import { SCROLL_SPEED_MS } from './uiTransitions.ts'

describe('PhaserGameHud', () => {
  function setupMockScene(hasWebGlFilters = true) {
    interface TextConfig {
      fontFamily?: string
      fontSize?: string
      color?: string
      lineSpacing?: number
    }

    const createdTexts: { x: number; y: number; text: string; config?: TextConfig; obj: any }[] = []
    const createdRects: { x: number; y: number; width: number; height: number; fill: number; alpha: number; obj: any }[] = []

    function createMockText(x: number, y: number, text: string, config?: TextConfig) {
      let currentText = text
      let currentY = y
      let isVisible = true
      const obj = {
        x,
        get y() {
          return currentY
        },
        setY: vi.fn((newY: number) => {
          currentY = newY
          return obj
        }),
        setPosition: vi.fn((newX: number, newY: number) => {
          obj.x = newX
          currentY = newY
          return obj
        }),
        get text() {
          return currentText
        },
        setText: vi.fn((t: string) => {
          currentText = t
          return obj
        }),
        setOrigin: vi.fn().mockReturnThis(),
        setAlign: vi.fn().mockReturnThis(),
        setWordWrapWidth: vi.fn().mockReturnThis(),
        setLineSpacing: vi.fn().mockReturnThis(),
        setVisible: vi.fn((v: boolean) => {
          isVisible = v
          return obj
        }),
        get visible() {
          return isVisible
        },
        height: 40,
        width: 100,
      }
      createdTexts.push({ x, y, text, config, obj })
      return obj
    }

    function createMockRect(x: number, y: number, width: number, height: number, fill: number, alpha: number) {
      let currentW = width
      let currentH = height
      let isVisible = true
      const obj = {
        setSize: vi.fn((w: number, h: number) => {
          currentW = w
          currentH = h
          return obj
        }),
        setOrigin: vi.fn().mockReturnThis(),
        setStrokeStyle: vi.fn().mockReturnThis(),
        setVisible: vi.fn((v: boolean) => {
          isVisible = v
          return obj
        }),
        get visible() {
          return isVisible
        },
        get width() {
          return currentW
        },
        get height() {
          return currentH
        },
      }
      createdRects.push({ x, y, width, height, fill, alpha, obj })
      return obj
    }

    const createdContainers: any[] = []
    const popupGeometryMask = { destroy: vi.fn() }
    const popupMaskGraphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      createGeometryMask: vi.fn(() => popupGeometryMask),
      destroy: vi.fn(),
    }

    function createMockContainer() {
      let isVisible = true
      const obj = {
        setDepth: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setY: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        enableFilters: vi.fn().mockReturnThis(),
        filters: hasWebGlFilters ? { external: { addMask: vi.fn(() => ({ autoUpdate: true })) } } : null,
        setMask: vi.fn().mockReturnThis(),
        setVisible: vi.fn((visible: boolean) => {
          isVisible = visible
          return obj
        }),
        get visible() {
          return isVisible
        },
        add: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      }
      createdContainers.push(obj)
      return obj
    }

    const timerCallbacks: (() => void)[] = []
    const activeTimers: { remove: any; callback: () => void }[] = []
    const tweenConfigs: { onComplete?: () => void; [key: string]: any }[] = []

    const mockScene = {
      add: {
        container: vi.fn(() => createMockContainer()),
        text: vi.fn((x: number, y: number, text: string, config?: TextConfig) =>
          createMockText(x, y, text, config),
        ),
        rectangle: vi.fn((x: number, y: number, width: number, height: number, fill: number, alpha: number) =>
          createMockRect(x, y, width, height, fill, alpha),
        ),
      },
      make: {
        graphics: vi.fn(() => popupMaskGraphics),
      },
      cameras: {
        main: {},
      },
      time: {
        addEvent: vi.fn((config: { delay: number; repeat: number; callback: () => void }) => {
          const timer = {
            remove: vi.fn(),
            callback: config.callback,
          }
          activeTimers.push(timer)
          timerCallbacks.push(config.callback)
          return timer
        }),
      },
      tweens: {
        add: vi.fn((config: { onComplete?: () => void; [key: string]: any }) => {
          tweenConfigs.push(config)
          return { stop: vi.fn() }
        }),
      },
    } as any

    return {
      mockScene,
      createdTexts,
      createdRects,
      createdContainers,
      tweenConfigs,
      timerCallbacks,
      activeTimers,
      popupMaskGraphics,
      popupGeometryMask,
    }
  }

  function mockWorldState(roomId: string, hint?: string): WorldState {
    return {
      currentRoomId: roomId,
      rooms: [
        {
          id: roomId,
          title: roomId,
          objects: [],
          objectIds: [],
          ...(hint ? { hint } : {}),
        },
      ],
      worldObjects: [],
      processInstances: [],
      simulationTick: 0,
      outcome: 'playing',
      commandHistory: [],
    } as unknown as WorldState
  }

  function tutorialWorldState(daggerEquipped: boolean, dummyAlive: boolean): WorldState {
    return {
      ...mockWorldState('tutorial1'),
      worldObjects: [
        { id: 'player', metadata: { role: 'player' }, state: {} },
        {
          id: 'tutorial1dagger',
          metadata: { role: 'weapon' },
          state: { equippedBy: daggerEquipped ? 'player' : null },
        },
        { id: 'dummy', metadata: { role: 'enemy' }, state: { alive: dummyAlive } },
      ],
    } as unknown as WorldState
  }

  it('creates UI elements with terminal font and color palette matching main UI', () => {
    const { mockScene, createdTexts, createdRects } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)

    expect(createdTexts.length).toBe(5)
    const [roomText, navText, hintText] = createdTexts

    // All texts use TERMINAL_FONT
    expect(roomText.config?.fontFamily).toBe(TERMINAL_FONT)
    expect(navText.config?.fontFamily).toBe(TERMINAL_FONT)
    expect(hintText.config?.fontFamily).toBe(TERMINAL_FONT)

    // Palette discipline
    expect(roomText.config?.color).toBe(COLOR_PROMPT)
    expect(navText.config?.color).toBe(COLOR_DIM)
    expect(hintText.config?.color).toBe(COLOR_PROMPT)

    // Left-aligned tutorial hint styling
    expect(hintText.x).toBe(150)
    expect(hintText.obj.setOrigin).toHaveBeenCalledWith(0, 0.5)
    expect(hintText.obj.setAlign).toHaveBeenCalledWith('left')

    // Hint panel rectangle styling
    expect(createdRects.length).toBe(3)
    const hintPanel = createdRects[0]
    expect(hintPanel.fill).toBe(PANEL_BG)
    expect(hintPanel.alpha).toBe(PANEL_BG_ALPHA)
    expect(hintPanel.obj.setStrokeStyle).toHaveBeenCalledWith(PANEL_BORDER_WIDTH, PANEL_BORDER)

    hud.destroy()
  })

  it('types out room tutorial hint character-by-character at TYPING_SPEED_MS', () => {
    const { mockScene, createdTexts, createdRects, mockScene: { time } } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)

    const hint = 'WASD to move.'
    const state = mockWorldState('tutorial2', hint)

    hud.update(state)

    const hintText = createdTexts[2].obj
    const hintPanel = createdRects[0].obj

    expect(hintPanel.visible).toBe(true)
    expect(hintText.visible).toBe(true)
    expect(hintText.setPosition).toHaveBeenCalledWith(150, expect.any(Number))
    expect(time.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        delay: TYPING_SPEED_MS,
        repeat: hint.length - 1,
      }),
    )

    // Before callbacks, text was cleared for typewriter effect
    expect(hintText.text).toBe('')

    // Simulate typing ticks
    const timerCall = time.addEvent.mock.calls[0][0]
    for (let i = 1; i <= hint.length; i++) {
      timerCall.callback()
      expect(hintText.text).toBe(hint.slice(0, i))
    }

    expect(hintText.text).toBe(hint)

    hud.destroy()
  })

  it('keeps typing the room hint across later updates in the same room', () => {
    const { mockScene, activeTimers } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)
    const state = mockWorldState('room2', 'Keep typing.')

    hud.update(state)
    expect(activeTimers.length).toBe(1)
    const timer = activeTimers[0]

    hud.update(state)
    hud.update(state)

    expect(timer.remove).not.toHaveBeenCalled()

    hud.destroy()
  })

  it('cancels previous typing timer and hides panel when transitioning to room without hint', () => {
    const { mockScene, createdTexts, createdRects, activeTimers } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)

    hud.update(mockWorldState('tutorial2', 'Type something.'))
    expect(activeTimers.length).toBe(1)
    const timer = activeTimers[0]

    // Switch to room without hint
    hud.update(mockWorldState('home_empty'))

    expect(timer.remove).toHaveBeenCalled()
    expect(createdRects[0].obj.visible).toBe(false)
    expect(createdTexts[2].obj.visible).toBe(false)

    hud.destroy()
  })

  it('cancels typing timer and cleans up on destroy', () => {
    const { mockScene, createdContainers, activeTimers } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)

    hud.update(mockWorldState('tutorial2', 'Type something.'))
    expect(activeTimers.length).toBe(1)
    const timer = activeTimers[0]

    hud.destroy()
    expect(timer.remove).toHaveBeenCalled()
    expect(createdContainers[0].destroy).toHaveBeenCalledWith(true)
  })

  it('types the Move prompt when first shown without a scroll transition', () => {
    const { mockScene, createdTexts, timerCallbacks } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)
    const prompt = '<W A S D> Move'

    hud.update(tutorialWorldState(false, true))

    const moveText = createdTexts[3].obj
    expect(moveText.text).toBe('')
    expect(mockScene.time.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        delay: TYPING_SPEED_MS,
        repeat: prompt.length - 1,
      }),
    )

    timerCallbacks[0]()
    expect(moveText.text).toBe(prompt.slice(0, 1))
    for (let index = 1; index < prompt.length; index++) timerCallbacks[0]()
    expect(moveText.text).toBe(prompt)

    hud.destroy()
  })

  it('scrolls from Move to Attack on pickup and fades Attack only after dummy defeat', () => {
    const {
      mockScene,
      createdTexts,
      createdRects,
      createdContainers,
      tweenConfigs,
      activeTimers,
      timerCallbacks,
    } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)
    const attackPrompt = '<J> Attack'

    hud.update(tutorialWorldState(false, true))
    const moveBanner = createdContainers[3]
    const moveTextContainer = createdContainers[4]
    const attackBanner = createdContainers[5]
    const attackTextContainer = createdContainers[6]
    const movePanel = createdRects[1].obj
    const attackPanel = createdRects[2].obj
    const moveParentYCalls = moveBanner.setY.mock.calls.length
    const attackParentYCalls = attackBanner.setY.mock.calls.length
    const moveText = createdTexts[3].obj
    const attackText = createdTexts[4].obj
    expect(moveText.text).toBe('')
    expect(moveBanner.visible).toBe(true)
    expect(attackBanner.visible).toBe(false)

    hud.update(tutorialWorldState(true, true))
    expect(activeTimers[0].remove).toHaveBeenCalled()
    expect(attackBanner.visible).toBe(true)
    expect(movePanel.visible).toBe(true)
    expect(attackPanel.visible).toBe(false)
    expect(tweenConfigs[0]).toEqual(expect.objectContaining({
      targets: [moveTextContainer, attackTextContainer],
      y: '-=850',
      duration: SCROLL_SPEED_MS,
    }))
    expect(moveBanner.setY).toHaveBeenCalledTimes(moveParentYCalls)
    expect(attackBanner.setY).toHaveBeenCalledTimes(attackParentYCalls)
    expect(tweenConfigs[0].alpha).toBeUndefined()
    tweenConfigs[0].onComplete?.()
    expect(moveBanner.visible).toBe(false)
    expect(attackBanner.visible).toBe(true)
    expect(attackPanel.visible).toBe(true)
    expect(attackText.text).toBe('')
    expect(mockScene.time.addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        delay: TYPING_SPEED_MS,
        repeat: attackPrompt.length - 1,
      }),
    )

    timerCallbacks[1]()
    expect(attackText.text).toBe(attackPrompt.slice(0, 1))
    for (let index = 1; index < attackPrompt.length; index++) timerCallbacks[1]()
    expect(attackText.text).toBe(attackPrompt)

    hud.update(tutorialWorldState(true, false))
    expect(tweenConfigs[1]).toEqual(expect.objectContaining({
      targets: attackBanner,
      alpha: 0,
      duration: POPUP_FADE_DURATION_MS,
    }))
    tweenConfigs[1].onComplete?.()
    expect(attackBanner.visible).toBe(false)

    hud.destroy()
  })

  it('types the Attack prompt when scrolling completes without a tween manager', () => {
    const { mockScene, createdTexts, tweenConfigs, activeTimers, timerCallbacks } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)
    const attackPrompt = '<J> Attack'
    mockScene.tweens = undefined

    hud.update(tutorialWorldState(false, true))
    hud.update(tutorialWorldState(true, true))

    expect(tweenConfigs).toHaveLength(0)
    expect(activeTimers).toHaveLength(2)
    expect(createdTexts[4].obj.text).toBe('')
    timerCallbacks[1]()
    expect(createdTexts[4].obj.text).toBe(attackPrompt.slice(0, 1))

    hud.destroy()
  })

  it('clips tutorial prompt scrolling to its popup bounds', () => {
    const { mockScene, createdContainers, popupMaskGraphics, popupGeometryMask } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)
    const hintBanner = createdContainers[1]
    const moveBanner = createdContainers[3]
    const attackBanner = createdContainers[5]

    expect(popupMaskGraphics.fillRect).toHaveBeenCalledWith(120, 96, 1680, 92)
    expect(moveBanner.filters.external.addMask).toHaveBeenCalledWith(
      popupMaskGraphics,
      false,
      mockScene.cameras.main,
    )
    expect(attackBanner.filters.external.addMask).toHaveBeenCalledWith(
      popupMaskGraphics,
      false,
      mockScene.cameras.main,
    )
    expect(moveBanner.filters.external.addMask.mock.results[0].value.autoUpdate).toBe(false)
    expect(attackBanner.filters.external.addMask.mock.results[0].value.autoUpdate).toBe(false)
    expect(hintBanner.enableFilters).not.toHaveBeenCalled()

    hud.destroy()
    expect(popupGeometryMask.destroy).toHaveBeenCalledOnce()
    expect(popupMaskGraphics.destroy).toHaveBeenCalledOnce()
  })

  it('uses a geometry mask for popup clipping when WebGL filters are unavailable', () => {
    const { mockScene, createdContainers, popupGeometryMask } = setupMockScene(false)
    const hud = new PhaserGameHud(mockScene)

    expect(createdContainers[3].setMask).toHaveBeenCalledWith(popupGeometryMask)
    expect(createdContainers[5].setMask).toHaveBeenCalledWith(popupGeometryMask)

    hud.destroy()
  })
})
