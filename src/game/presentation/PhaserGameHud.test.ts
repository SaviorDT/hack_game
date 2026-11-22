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
  TERMINAL_FONT,
  TYPING_SPEED_MS,
} from './uiTheme.ts'

describe('PhaserGameHud', () => {
  function setupMockScene() {
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

    const containerObj = {
      setDepth: vi.fn().mockReturnThis(),
      add: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    }

    const timerCallbacks: (() => void)[] = []
    const activeTimers: { remove: any; callback: () => void }[] = []

    const mockScene = {
      add: {
        container: vi.fn(() => containerObj),
        text: vi.fn((x: number, y: number, text: string, config?: TextConfig) =>
          createMockText(x, y, text, config),
        ),
        rectangle: vi.fn((x: number, y: number, width: number, height: number, fill: number, alpha: number) =>
          createMockRect(x, y, width, height, fill, alpha),
        ),
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
    } as any

    return { mockScene, createdTexts, createdRects, containerObj, timerCallbacks, activeTimers }
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

  it('creates UI elements with terminal font and color palette matching main UI', () => {
    const { mockScene, createdTexts, createdRects } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)

    expect(createdTexts.length).toBe(3)
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
    expect(createdRects.length).toBe(1)
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
    const state = mockWorldState('tutorial1', hint)

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

  it('cancels previous typing timer and hides panel when transitioning to room without hint', () => {
    const { mockScene, createdTexts, createdRects, activeTimers } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)

    hud.update(mockWorldState('tutorial1', 'Type something.'))
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
    const { mockScene, containerObj, activeTimers } = setupMockScene()
    const hud = new PhaserGameHud(mockScene)

    hud.update(mockWorldState('tutorial1', 'Type something.'))
    expect(activeTimers.length).toBe(1)
    const timer = activeTimers[0]

    hud.destroy()
    expect(timer.remove).toHaveBeenCalled()
    expect(containerObj.destroy).toHaveBeenCalledWith(true)
  })
})
