import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_EDITORS,
  DEFAULT_PLAYABLE_SCENE,
  SceneManager,
} from './SceneManager.ts'
import type Phaser from 'phaser'

function createMockScene(key: string, extras?: Record<string, unknown>): Phaser.Scene {
  const scenePlugin = {
    key,
    start: vi.fn(),
  }
  return {
    scene: scenePlugin,
    ...extras,
  } as unknown as Phaser.Scene
}

function createMockGame(activeScene: Phaser.Scene): Phaser.Game {
  const scenes = [activeScene]
  const game = {
    scene: {
      getScenes: vi.fn((isActive?: boolean) => (isActive ? scenes : scenes)),
      start: vi.fn(),
      getScene: vi.fn((key: string) => scenes.find((scene) => scene.scene.key === key)),
    },
    registry: {
      set: vi.fn(),
      get: vi.fn(),
      remove: vi.fn(),
    },
    events: {
      once: vi.fn(),
    },
  } as unknown as Phaser.Game
  return game
}

function createMockKeyboardEvent(key: string, ctrlKey = false): KeyboardEvent {
  return {
    key,
    ctrlKey,
    preventDefault: vi.fn(),
    stopImmediatePropagation: vi.fn(),
  } as unknown as KeyboardEvent
}

describe('SceneManager', () => {
  describe('configuration & defaults', () => {
    it('has standard editor hotkeys: LevelEditor (F2), SpeedEditor (F3), AIEditor (F4)', () => {
      expect(DEFAULT_EDITORS).toEqual([
        { key: 'level-editor', hotkey: 'F2' },
        { key: 'speed-editor', hotkey: 'F3' },
        { key: 'behavior-tree-editor', hotkey: 'F4' },
      ])
      expect(DEFAULT_PLAYABLE_SCENE).toBe('game')
    })

    it('correctly categorizes editor vs playable scenes', () => {
      const manager = new SceneManager()
      expect(manager.isEditorScene('level-editor')).toBe(true)
      expect(manager.isEditorScene('speed-editor')).toBe(true)
      expect(manager.isEditorScene('behavior-tree-editor')).toBe(true)
      expect(manager.isEditorScene('game')).toBe(false)
      expect(manager.isEditorScene('room2')).toBe(false)

      expect(manager.isPlayableScene('game')).toBe(true)
      expect(manager.isPlayableScene('room2')).toBe(true)
      expect(manager.isPlayableScene('level-editor')).toBe(false)
      expect(manager.isPlayableScene('speed-editor')).toBe(false)
      expect(manager.isPlayableScene('behavior-tree-editor')).toBe(false)
    })

    it('matches hotkeys case-insensitively', () => {
      const manager = new SceneManager()
      expect(manager.getEditorForHotkey('F2')?.key).toBe('level-editor')
      expect(manager.getEditorForHotkey('f2')?.key).toBe('level-editor')
      expect(manager.getEditorForHotkey('F3')?.key).toBe('speed-editor')
      expect(manager.getEditorForHotkey('f3')?.key).toBe('speed-editor')
      expect(manager.getEditorForHotkey('F4')?.key).toBe('behavior-tree-editor')
      expect(manager.getEditorForHotkey('f4')?.key).toBe('behavior-tree-editor')
      expect(manager.getEditorForHotkey('F5')).toBeUndefined()
    })
  })

  describe('access from anywhere (Requirement 1)', () => {
    it('opens LevelEditor via F2 from playable game scene', () => {
      const gameScene = createMockScene('game')
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      const event = createMockKeyboardEvent('F2')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
      expect(gameScene.scene.start).toHaveBeenCalledWith('level-editor')
      expect(manager.getActivePlayableScene()).toBe('game')
    })

    it('opens LevelEditor via F2 passing currentRoomId when active scene has world state session', () => {
      const gameScene = createMockScene('game', {
        session: {
          getWorldState: () => ({ currentRoomId: 'storage' }),
        },
      })
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      const event = createMockKeyboardEvent('F2')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(gameScene.scene.start).toHaveBeenCalledWith('level-editor', { roomId: 'storage' })
      expect(manager.getActivePlayableScene()).toBe('game')
    })

    it('opens SpeedEditor via F3 from playable game scene', () => {
      const gameScene = createMockScene('game')
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      const event = createMockKeyboardEvent('f3')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(gameScene.scene.start).toHaveBeenCalledWith('speed-editor')
    })

    it('opens BehaviorTreeEditor via F4 from playable game scene', () => {
      const gameScene = createMockScene('game')
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      const event = createMockKeyboardEvent('F4')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(gameScene.scene.start).toHaveBeenCalledWith('behavior-tree-editor')
    })

    it('can access other editors from inside an editor (e.g. F3 or F4 from LevelEditor)', () => {
      const syncSpy = vi.fn()
      const levelEditorScene = createMockScene('level-editor', {
        syncToRoom1Objects: syncSpy,
      })
      const mockGame = createMockGame(levelEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      // Press F3 while in LevelEditor
      const eventF3 = createMockKeyboardEvent('F3')
      const handledF3 = manager.handleKeyDown(eventF3)

      expect(handledF3).toBe(true)
      expect(syncSpy).toHaveBeenCalled()
      expect(levelEditorScene.scene.start).toHaveBeenCalledWith('speed-editor')
      // Active playable scene remains 'game'
      expect(manager.getActivePlayableScene()).toBe('game')
    })

    it('can access LevelEditor (F2) from SpeedEditor', () => {
      const speedEditorScene = createMockScene('speed-editor')
      const mockGame = createMockGame(speedEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const eventF2 = createMockKeyboardEvent('F2')
      const handledF2 = manager.handleKeyDown(eventF2)

      expect(handledF2).toBe(true)
      expect(speedEditorScene.scene.start).toHaveBeenCalledWith('level-editor')
      expect(manager.getActivePlayableScene()).toBe('game')
    })

    it('can access LevelEditor (F2) and SpeedEditor (F3) from BehaviorTreeEditor', () => {
      const aiEditorScene = createMockScene('behavior-tree-editor')
      const mockGame = createMockGame(aiEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const eventF2 = createMockKeyboardEvent('F2')
      expect(manager.handleKeyDown(eventF2)).toBe(true)
      expect(aiEditorScene.scene.start).toHaveBeenCalledWith('level-editor')

      const eventF3 = createMockKeyboardEvent('F3')
      expect(manager.handleKeyDown(eventF3)).toBe(true)
      expect(aiEditorScene.scene.start).toHaveBeenCalledWith('speed-editor')
    })
  })

  describe('exit by pressing button or Esc to current active playable scene (Requirement 2)', () => {
    it('exits LevelEditor when pressing F2 to active playable scene', () => {
      const syncSpy = vi.fn()
      const levelEditorScene = createMockScene('level-editor', {
        syncToRoom1Objects: syncSpy,
      })
      const mockGame = createMockGame(levelEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('F2')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(syncSpy).toHaveBeenCalled()
      expect(levelEditorScene.scene.start).toHaveBeenCalledWith('game')
    })

    it('exits LevelEditor via F2 passing startingRoomId when scene provides getCurrentRoomId', () => {
      const syncSpy = vi.fn()
      const levelEditorScene = createMockScene('level-editor', {
        syncToRoom1Objects: syncSpy,
        getCurrentRoomId: () => 'storage',
      })
      const mockGame = createMockGame(levelEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('F2')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(syncSpy).toHaveBeenCalled()
      expect(levelEditorScene.scene.start).toHaveBeenCalledWith('game', { startingRoomId: 'storage' })
    })

    it('exits LevelEditor via Escape passing startingRoomId when scene provides getCurrentRoomId', () => {
      const syncSpy = vi.fn()
      const levelEditorScene = createMockScene('level-editor', {
        syncToRoom1Objects: syncSpy,
        getCurrentRoomId: () => 'yard',
      })
      const mockGame = createMockGame(levelEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('Escape')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(syncSpy).toHaveBeenCalled()
      expect(levelEditorScene.scene.start).toHaveBeenCalledWith('game', { startingRoomId: 'yard' })
    })

    it('exits LevelEditor when pressing Escape to active playable scene', () => {
      const syncSpy = vi.fn()
      const levelEditorScene = createMockScene('level-editor', {
        syncToRoom1Objects: syncSpy,
      })
      const mockGame = createMockGame(levelEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('Escape')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(syncSpy).toHaveBeenCalled()
      expect(levelEditorScene.scene.start).toHaveBeenCalledWith('game')
    })

    it('exits SpeedEditor when pressing F3 to active playable scene', () => {
      const speedEditorScene = createMockScene('speed-editor')
      const mockGame = createMockGame(speedEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('F3')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(speedEditorScene.scene.start).toHaveBeenCalledWith('game')
    })

    it('exits SpeedEditor when pressing Escape to active playable scene', () => {
      const speedEditorScene = createMockScene('speed-editor')
      const mockGame = createMockGame(speedEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('Escape')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(speedEditorScene.scene.start).toHaveBeenCalledWith('game')
    })

    it('exits BehaviorTreeEditor when pressing F4 to active playable scene', () => {
      const aiEditorScene = createMockScene('behavior-tree-editor')
      const mockGame = createMockGame(aiEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('F4')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(aiEditorScene.scene.start).toHaveBeenCalledWith('game')
    })

    it('exits BehaviorTreeEditor when pressing Escape to active playable scene', () => {
      const aiEditorScene = createMockScene('behavior-tree-editor')
      const mockGame = createMockGame(aiEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('Escape')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(aiEditorScene.scene.start).toHaveBeenCalledWith('game')
    })

    it('preserves custom active playable scene (e.g. room2) when exiting editors', () => {
      const levelEditorScene = createMockScene('level-editor')
      const mockGame = createMockGame(levelEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('room2')

      const event = createMockKeyboardEvent('Escape')
      expect(manager.handleKeyDown(event)).toBe(true)
      expect(levelEditorScene.scene.start).toHaveBeenCalledWith('room2')
    })

    it('does NOT intercept Escape when in a playable scene (passes to scene)', () => {
      const gameScene = createMockScene('game')
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      const event = createMockKeyboardEvent('Escape')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(false)
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(gameScene.scene.start).not.toHaveBeenCalled()
    })

    it('ignores unrelated keys (letters, numbers, etc.)', () => {
      const gameScene = createMockScene('game')
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      expect(manager.handleKeyDown(createMockKeyboardEvent('a'))).toBe(false)
      expect(manager.handleKeyDown(createMockKeyboardEvent('Enter'))).toBe(false)
      expect(manager.handleKeyDown(createMockKeyboardEvent('Space'))).toBe(false)
    })
  })

  describe('Command Editor (F1) overlay management', () => {
    it('toggles Command Editor via F1 in playable game scene', () => {
      const toggleSpy = vi.fn()
      const gameScene = createMockScene('game', {
        toggleCommandEditor: toggleSpy,
      })
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      const event = createMockKeyboardEvent('F1')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(event.stopImmediatePropagation).toHaveBeenCalled()
      expect(toggleSpy).toHaveBeenCalled()
    })

    it('exits an editor to playable game scene with openCommandEditor when F1 is pressed in editor', () => {
      const syncSpy = vi.fn()
      const levelEditorScene = createMockScene('level-editor', {
        syncToRoom1Objects: syncSpy,
      })
      const mockGame = createMockGame(levelEditorScene)
      const manager = new SceneManager(mockGame)
      manager.setActivePlayableScene('game')

      const event = createMockKeyboardEvent('F1')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(levelEditorScene.scene.start).toHaveBeenCalledWith('game', { openCommandEditor: true })
    })

    it('closes Command Editor when Escape is pressed while Command Editor is open in playable scene', () => {
      const closeSpy = vi.fn()
      const gameScene = createMockScene('game', {
        isCommandEditorOpen: () => true,
        closeCommandEditor: closeSpy,
      })
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      const event = createMockKeyboardEvent('Escape')
      const handled = manager.handleKeyDown(event)

      expect(handled).toBe(true)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(closeSpy).toHaveBeenCalled()
    })

    it('openCommandEditor / closeCommandEditor / toggleCommandEditor helper methods delegate appropriately', () => {
      const openSpy = vi.fn()
      const closeSpy = vi.fn()
      const toggleSpy = vi.fn()
      const gameScene = createMockScene('game', {
        openCommandEditor: openSpy,
        closeCommandEditor: closeSpy,
        toggleCommandEditor: toggleSpy,
        isCommandEditorOpen: () => true,
      })
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      expect(manager.isCommandEditorOpen()).toBe(true)
      manager.openCommandEditor()
      expect(openSpy).toHaveBeenCalled()
      manager.closeCommandEditor()
      expect(closeSpy).toHaveBeenCalled()
      manager.toggleCommandEditor()
      expect(toggleSpy).toHaveBeenCalled()
    })
  })

  describe('Pause (Ctrl+P)', () => {
    it('opens pause from the game scene', () => {
      const openPause = vi.fn()
      const gameScene = createMockScene('game', { openPause })
      const mockGame = createMockGame(gameScene)
      mockGame.scene.getScene = vi.fn((key: string) => key === 'game' ? gameScene : undefined) as typeof mockGame.scene.getScene
      const manager = new SceneManager(mockGame)
      const event = createMockKeyboardEvent('p', true)

      expect(manager.handleKeyDown(event)).toBe(true)
      expect(openPause).toHaveBeenCalled()
    })

    it('closes pause from the pause scene', () => {
      const resumeGame = vi.fn()
      const pauseScene = createMockScene('pause', { resumeGame })
      const mockGame = createMockGame(pauseScene)
      mockGame.scene.getScene = vi.fn((key: string) => key === 'pause' ? pauseScene : undefined) as typeof mockGame.scene.getScene
      const manager = new SceneManager(mockGame)
      const event = createMockKeyboardEvent('P', true)

      expect(manager.handleKeyDown(event)).toBe(true)
      expect(resumeGame).toHaveBeenCalled()
    })

    it('does not toggle pause outside game or pause scenes', () => {
      const gameScene = createMockScene('title')
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)
      const event = createMockKeyboardEvent('p', true)

      expect(manager.handleKeyDown(event)).toBe(false)
      expect(event.preventDefault).not.toHaveBeenCalled()
    })
  })

  describe('lifecycle & cleanup', () => {
    it('registers on game registry and cleans up on destroy', () => {
      const gameScene = createMockScene('game')
      const mockGame = createMockGame(gameScene)
      const manager = new SceneManager(mockGame)

      expect(mockGame.registry.set).toHaveBeenCalledWith('sceneManager', manager)
      expect(SceneManager.get(mockGame)).toBe(manager)

      manager.destroy()
      expect(mockGame.registry.remove).toHaveBeenCalledWith('sceneManager')
    })
  })
})

