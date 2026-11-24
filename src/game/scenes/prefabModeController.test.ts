import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrefabModeController, type LevelEditorSceneLike } from './prefabModeController.ts'
import { getPrefab, resetPrefabs } from '../content/prefabRegistry.ts'
import { resetAllRooms } from '../content/roomRegistry.ts'
import type { EditorObject } from './LevelEditorScene.ts'

function createMockText() {
  const textObj: any = {
    text: '',
    color: '',
    bgColor: '',
    visible: true,
    width: 60,
    setText: vi.fn(function (val: string) {
      textObj.text = val
      return textObj
    }),
    setColor: vi.fn(function (col: string) {
      textObj.color = col
      return textObj
    }),
    setBackgroundColor: vi.fn(function (bg: string) {
      textObj.bgColor = bg
      return textObj
    }),
    setInteractive: vi.fn(() => textObj),
    on: vi.fn(),
    setOrigin: vi.fn(() => textObj),
    setVisible: vi.fn(function (v: boolean) {
      textObj.visible = v
      return textObj
    }),
  }
  return textObj
}

function createMockContainer() {
  const container: any = {
    visible: true,
    setVisible: vi.fn(function (v: boolean) {
      container.visible = v
      return container
    }),
    setDepth: vi.fn(() => container),
  }
  return container
}

function createMockScene(mockObjects: EditorObject[]): LevelEditorSceneLike {
  return {
    add: {
      text: vi.fn(() => createMockText()),
      rectangle: vi.fn(() => ({
        setStrokeStyle: vi.fn().mockReturnThis(),
      })),
      container: vi.fn(() => createMockContainer()),
    } as any,
    getEditorObjects: vi.fn(() => mockObjects),
    refreshObjectVisuals: vi.fn(),
    getCurrentRoomId: vi.fn(() => 'room'),
    updatePropertyPanel: vi.fn(),
  }
}

describe('PrefabModeController', () => {
  beforeEach(() => {
    resetAllRooms()
    resetPrefabs()
  })

  it('enters prefab mode and highlights matching instances in the room', () => {
    const mockGuard1: any = {
      id: 'guard',
      role: 'enemy',
      displayWidth: 176,
      displayHeight: 176,
      scaleX: 1,
      scaleY: 1,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }
    const mockGuard2: any = {
      id: 'guard2',
      role: 'enemy',
      displayWidth: 176,
      displayHeight: 176,
      scaleX: 1,
      scaleY: 1,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }
    const mockDagger: any = {
      id: 'dagger',
      role: 'weapon',
      displayWidth: 72,
      displayHeight: 72,
      scaleX: 1,
      scaleY: 1,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }

    const scene = createMockScene([mockGuard1, mockGuard2, mockDagger])
    const controller = new PrefabModeController(scene)

    controller.enterPrefabMode('guard')
    expect(controller.isPrefabModeActive).toBe(true)
    expect(controller.currentPrefabId).toBe('guard')

    // Matching guards should be alpha 1, non-matching dagger alpha 0.35
    expect(mockGuard1.sprite.setAlpha).toHaveBeenCalledWith(1)
    expect(mockGuard2.sprite.setAlpha).toHaveBeenCalledWith(1)
    expect(mockDagger.sprite.setAlpha).toHaveBeenCalledWith(0.35)
  })

  it('modifies property and propagates live to room instances', () => {
    const mockGuard: any = {
      id: 'guard',
      role: 'enemy',
      displayWidth: 176,
      displayHeight: 176,
      scaleX: 1,
      scaleY: 1,
      maxHealth: 100,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }

    const scene = createMockScene([mockGuard])
    const controller = new PrefabModeController(scene)

    controller.enterPrefabMode('guard')
    const before = getPrefab('guard')!.maxHealth!
    controller.modifyProperty('maxHealth', 20)

    expect(getPrefab('guard')?.maxHealth).toBe(before + 20)
    expect(mockGuard.maxHealth).toBe(before + 20)
    expect(scene.refreshObjectVisuals).toHaveBeenCalledWith(mockGuard)
  })

  it('syncs on handle drag and updates siblings', () => {
    const mockGuard1: any = {
      id: 'guard',
      role: 'enemy',
      displayWidth: 220,
      displayHeight: 220,
      scaleX: 1.25,
      scaleY: 1.25,
      colliderWidth: 140,
      colliderHeight: 190,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }
    const mockGuard2: any = {
      id: 'guard2',
      role: 'enemy',
      displayWidth: 176,
      displayHeight: 176,
      scaleX: 1,
      scaleY: 1,
      colliderWidth: 110,
      colliderHeight: 160,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }

    const scene = createMockScene([mockGuard1, mockGuard2])
    const controller = new PrefabModeController(scene)

    controller.enterPrefabMode('guard')
    controller.onHandleDragged(mockGuard1)

    // Sibling guard2 should now match guard1's dragged size
    expect(mockGuard2.displayWidth).toBe(220)
    expect(mockGuard2.displayHeight).toBe(220)
    expect(mockGuard2.colliderWidth).toBe(140)
    expect(scene.refreshObjectVisuals).toHaveBeenCalledWith(mockGuard2)
  })

  it('exits prefab mode cleanly', () => {
    const mockGuard: any = {
      id: 'guard',
      role: 'enemy',
      displayWidth: 176,
      displayHeight: 176,
      scaleX: 1,
      scaleY: 1,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }

    const scene = createMockScene([mockGuard])
    const controller = new PrefabModeController(scene)

    controller.enterPrefabMode('guard')
    controller.exitPrefabMode()

    expect(controller.isPrefabModeActive).toBe(false)
    expect(controller.currentPrefabId).toBeNull()
    expect(mockGuard.sprite.setAlpha).toHaveBeenCalledWith(1)
    expect(mockGuard.outline.setVisible).toHaveBeenCalledWith(false)
    expect(scene.updatePropertyPanel).toHaveBeenCalled()
  })

  it('saves prefabs via savePrefabs and updates UI status', async () => {
    const mockGuard: any = {
      id: 'guard',
      role: 'enemy',
      displayWidth: 176,
      displayHeight: 176,
      scaleX: 1,
      scaleY: 1,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }

    const scene = createMockScene([mockGuard])
    const controller = new PrefabModeController(scene)
    controller.enterPrefabMode('guard')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    const saved = await controller.savePrefabs(mockFetch as any)
    expect(saved).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith('/api/save-prefabs', expect.objectContaining({ method: 'POST' }))
  })

  it('handles save error and reports failure', async () => {
    const mockGuard: any = {
      id: 'guard',
      role: 'enemy',
      displayWidth: 176,
      displayHeight: 176,
      scaleX: 1,
      scaleY: 1,
      sprite: { setAlpha: vi.fn() },
      outline: { setVisible: vi.fn(), setStrokeStyle: vi.fn() },
    }

    const scene = createMockScene([mockGuard])
    const controller = new PrefabModeController(scene)
    controller.enterPrefabMode('guard')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    })

    const saved = await controller.savePrefabs(mockFetch as any)
    expect(saved).toBe(false)
  })
})
