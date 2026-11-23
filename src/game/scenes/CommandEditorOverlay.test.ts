import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'

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
      Display: {
        Color: {
          HexStringToColor: () => ({ color: 0 }),
        },
      },
    },
  }
})

import {
  CommandEditorOverlay,
  getTuningConfig,
  applyTuningConfig,
} from './CommandEditorOverlay.ts'
import { resetCommandModeTimeScale } from '../application/InputModeController.ts'
import { GAME_MV_CONFIG, DEFAULT_MV_ACCELERATION } from '../commands/mvConstants.ts'
import {
  GAME_PHYSICS_CONFIG,
  DEFAULT_DRAG,
  DEFAULT_FRICTION,
  DEFAULT_MASS,
  DEFAULT_MAX_VELOCITY,
  DEFAULT_RESTITUTION,
  MIN_MASS,
} from '../simulation/physicsConstants.ts'
import { createRoomSession } from '../content/createRoomSession.ts'
import { INPUT_BINDINGS } from '../presentation/InputBindings.ts'
import { WORLD_OBJECT_IDS } from '../content/roomConstants.ts'
import type Phaser from 'phaser'

function createMockPhaserScene(): Phaser.Scene {
  const children = {
    bringToTop: vi.fn(),
  }

  const time = {
    delayedCall: vi.fn((_ms: number, cb: () => void) => cb()),
  }

  const add = {
    rectangle: vi.fn(() => ({
      setStrokeStyle: vi.fn().mockReturnThis(),
      setInteractive: vi.fn().mockReturnThis(),
      setFillStyle: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    })),
    graphics: vi.fn(() => ({
      lineStyle: vi.fn().mockReturnThis(),
      lineBetween: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    })),
    text: vi.fn(() => ({
      setOrigin: vi.fn().mockReturnThis(),
      setInteractive: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    })),
    container: vi.fn((_x: number, _y: number, _items: unknown[]) => ({
      setDepth: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      setSize: vi.fn().mockReturnThis(),
      setInteractive: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
      getAt: vi.fn(() => ({
        setFillStyle: vi.fn(),
        setText: vi.fn(),
      })),
    })),
  }

  return {
    add,
    children,
    time,
  } as unknown as Phaser.Scene
}

describe('CommandEditorOverlay & MV Tuning', () => {
  const memoryStorage = {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
    key: () => null,
    length: 0,
  } as unknown as Storage

  const initialMv = { ...GAME_MV_CONFIG }
  const initialPhysics = { ...GAME_PHYSICS_CONFIG }

  function createTestSession() {
    return createRoomSession({
      movementBindings: INPUT_BINDINGS.movement,
      storage: memoryStorage,
    })
  }

  beforeEach(() => {
    Object.assign(GAME_MV_CONFIG, initialMv)
    Object.assign(GAME_PHYSICS_CONFIG, initialPhysics)
    resetCommandModeTimeScale()
  })

  afterEach(() => {
    Object.assign(GAME_MV_CONFIG, initialMv)
    Object.assign(GAME_PHYSICS_CONFIG, initialPhysics)
    resetCommandModeTimeScale()
  })

  describe('getTuningConfig & applyTuningConfig', () => {
    it('returns combined mv and physics defaults', () => {
      const config = getTuningConfig()
      expect(config.mv_acceleration).toBe(GAME_MV_CONFIG.mv_acceleration)
      expect(config.drag).toBe(GAME_PHYSICS_CONFIG.drag)
      expect(config.friction).toBe(GAME_PHYSICS_CONFIG.friction)
      expect(config.mass).toBe(GAME_PHYSICS_CONFIG.mass)
    })

    it('overrides selected properties while preserving others', () => {
      const config = getTuningConfig({ mv_acceleration: 7500, drag: 1.2 })
      expect(config.mv_acceleration).toBe(7500)
      expect(config.drag).toBe(1.2)
      expect(config.mass).toBe(GAME_PHYSICS_CONFIG.mass)
    })

    it('applyTuningConfig mutates live GAME_MV_CONFIG and GAME_PHYSICS_CONFIG', () => {
      applyTuningConfig({
        ...getTuningConfig(),
        mv_acceleration: 8888,
        drag: 3.5,
        restitution: 0.8,
      })
      expect(GAME_MV_CONFIG.mv_acceleration).toBe(8888)
      expect(GAME_PHYSICS_CONFIG.drag).toBe(3.5)
      expect(GAME_PHYSICS_CONFIG.restitution).toBe(0.8)
    })
  })

  describe('overlay lifecycle (mount, open, close, toggle)', () => {
    it('starts closed and toggles open/closed with open(), close(), toggle()', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)

      expect(overlay.isOpen()).toBe(false)

      overlay.open()
      expect(overlay.isOpen()).toBe(true)

      overlay.close()
      expect(overlay.isOpen()).toBe(false)

      overlay.toggle()
      expect(overlay.isOpen()).toBe(true)

      overlay.toggle()
      expect(overlay.isOpen()).toBe(false)
    })
  })

  describe('parameter adjustments & constraints', () => {
    it('adjusts MV acceleration and physics parameters by delta', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      const baseAccel = overlay.getMvConfig().mv_acceleration
      overlay.adjustMv(250, 'mv_acceleration')
      expect(overlay.getMvConfig().mv_acceleration).toBe(baseAccel + 250)
      expect(GAME_MV_CONFIG.mv_acceleration).toBe(baseAccel + 250)

      const baseDrag = overlay.getMvConfig().drag
      overlay.adjustMv(-0.1, 'drag')
      expect(overlay.getMvConfig().drag).toBeCloseTo(baseDrag - 0.1, 3)
    })

    it('enforces minimum mass constraint', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      overlay.setMvConfig({ mass: -5 })
      expect(overlay.getMvConfig().mass).toBe(MIN_MASS)
    })

    it('resets to default physics and MV values', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      overlay.setMvConfig({
        mv_acceleration: 9999,
        drag: 10,
        mass: 5,
        restitution: 0.9,
      })

      overlay.resetDefaults()
      const cfg = overlay.getMvConfig()
      expect(cfg.mv_acceleration).toBe(DEFAULT_MV_ACCELERATION)
      expect(cfg.drag).toBe(DEFAULT_DRAG)
      expect(cfg.friction).toBe(DEFAULT_FRICTION)
      expect(cfg.mass).toBe(DEFAULT_MASS)
      expect(cfg.max_velocity).toBe(DEFAULT_MAX_VELOCITY)
      expect(cfg.restitution).toBe(DEFAULT_RESTITUTION)
      expect(cfg.commandTimeScale).toBe(0.25)
    })
  })

  describe('command mode slow down speed tuning', () => {
    it('adjusts command time scale and clamps within [0.01, 2.0]', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      expect(overlay.getMvConfig().commandTimeScale).toBe(0.25)

      // Step up +0.05
      overlay.adjustCommandTimeScale(0.05)
      expect(overlay.getMvConfig().commandTimeScale).toBeCloseTo(0.3, 3)

      // Step down -0.10
      overlay.adjustCommandTimeScale(-0.1)
      expect(overlay.getMvConfig().commandTimeScale).toBeCloseTo(0.2, 3)

      // Clamping lower bound
      overlay.adjustCommandTimeScale(-5.0)
      expect(overlay.getMvConfig().commandTimeScale).toBe(0.01)

      // Clamping upper bound
      overlay.adjustCommandTimeScale(10.0)
      expect(overlay.getMvConfig().commandTimeScale).toBe(2.0)
    })

    it('syncs command time scale with session when updated', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      overlay.setCommandTimeScale(0.15)
      expect(overlay.getMvConfig().commandTimeScale).toBe(0.15)
      expect(session.getCommandTimeScale()).toBe(0.15)
    })

    it('prompts user for direct numeric input', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      const promptMock = vi.fn().mockReturnValueOnce('0.40')
      const originalWindow = (globalThis as any).window
      ;(globalThis as any).window = { prompt: promptMock }

      overlay.promptCommandTimeScale()
      expect(promptMock).toHaveBeenCalled()
      expect(overlay.getMvConfig().commandTimeScale).toBe(0.4)

      // Ignores cancel (null)
      promptMock.mockReturnValueOnce(null as unknown as string)
      overlay.promptCommandTimeScale()
      expect(overlay.getMvConfig().commandTimeScale).toBe(0.4)

      if (originalWindow !== undefined) {
        ;(globalThis as any).window = originalWindow
      } else {
        delete (globalThis as any).window
      }
    })
  })

  describe('reusing gameplay level codes (session, commands & telemetry)', () => {
    it('tracks thrown object from gameplay terminal command submission', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      const dagger = session.getWorldState().worldObjects.find((o) => o.id === WORLD_OBJECT_IDS.dagger)!
      const dState = dagger.state as Record<string, unknown>
      expect(dState.thrown).toBeFalsy()

      session.submitCommand('acc dagger guard')

      expect(dState.thrown).toMatchObject({
        targetObjectId: WORLD_OBJECT_IDS.guard,
      })
    })

    it('updates telemetry texts reflecting active thrown object during flight', () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      // Before throw: Idle telemetry
      overlay.update(16.67)
      expect((overlay as any).telemetryStatusText.setText).toHaveBeenCalledWith('Active: None (idle)')

      // Execute throw via terminal command and advance physics step
      session.submitCommand('acc dagger guard')
      session.update(16.67)

      // Update telemetry
      overlay.update(16.67)
      expect((overlay as any).telemetryStatusText.setText).toHaveBeenCalledWith('Active: dagger')
    })
  })

  describe('persistence (saveChanges)', () => {
    it('posts serialized source to save-mv and save-physics endpoints', async () => {
      const scene = createMockPhaserScene()
      const session = createTestSession()
      const overlay = new CommandEditorOverlay(scene, session)
      overlay.open()

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (
          typeof url === 'string' &&
          (url.includes('save-mv') ||
            url.includes('save-physics') ||
            url.includes('save-command-mode'))
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true }),
          } as unknown as Response
        }
        return { ok: false, status: 404 } as unknown as Response
      })

      const success = await overlay.saveChanges()
      expect(success).toBe(true)
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/save-mv',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/save-physics',
        expect.objectContaining({ method: 'POST' }),
      )
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/save-command-mode',
        expect.objectContaining({ method: 'POST' }),
      )
      fetchSpy.mockRestore()
    })
  })
})
